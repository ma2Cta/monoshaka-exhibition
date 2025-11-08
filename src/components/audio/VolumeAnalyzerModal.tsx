'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, Volume2, AlertCircle } from 'lucide-react';
import { analyzeAudioVolume } from '@/lib/audio-analysis';
import { getRecordingUrl } from '@/lib/supabase';
import { createClient } from '@/lib/supabase-client';
import type { Recording } from '@/lib/types';

interface VolumeAnalyzerModalProps {
  recordings: Recording[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalysisComplete: () => void;
}

export default function VolumeAnalyzerModal({
  recordings,
  open,
  onOpenChange,
  onAnalysisComplete,
}: VolumeAnalyzerModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState('');
  const [failedFiles, setFailedFiles] = useState<string[]>([]);

  // 解析が必要な録音（LUFS値がない録音）を絞り込む
  const recordingsNeedAnalysis = recordings.filter((r) => r.lufs == null);

  // ファイルパスからファイル名のみを抽出
  const getFileName = (filePath: string): string => {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  };

  async function handleAnalyzeAll() {
    if (recordingsNeedAnalysis.length === 0) {
      setError('すべての録音は既に解析済みです');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setCompleted(0);
    setFailed(0);
    setFailedFiles([]);
    setProgress(0);

    const supabase = createClient();
    const total = recordingsNeedAnalysis.length;

    // ローカル変数で成功/失敗を追跡
    let completedCount = 0;
    let failedCount = 0;
    const failedFilesList: string[] = [];

    for (let i = 0; i < recordingsNeedAnalysis.length; i++) {
      const recording = recordingsNeedAnalysis[i];
      setCurrentFile(recording.file_path);

      try {
        // 音声ファイルをfetchして解析
        const url = getRecordingUrl(recording.file_path);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('ファイルの取得に失敗しました');
        }

        // レスポンスからblobを取得し、正しいmimeTypeを設定
        const originalBlob = await response.blob();
        const contentType = response.headers.get('content-type') || 'audio/webm';
        const blob = new Blob([originalBlob], { type: contentType });

        // 音量最適化のための解析
        const volumeMetadata = await analyzeAudioVolume(blob);

        // データベースを更新
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('recordings')
          .update({
            lufs: volumeMetadata.lufs,
            peak_level: volumeMetadata.peak,
            rms_level: volumeMetadata.rms,
          })
          .eq('id', recording.id);

        if (updateError) {
          throw updateError;
        }

        completedCount++;
        setCompleted(completedCount);
      } catch (err) {
        console.error(`Failed to analyze ${recording.file_path}:`, err);
        failedCount++;
        setFailed(failedCount);
        failedFilesList.push(getFileName(recording.file_path));
        setFailedFiles([...failedFilesList]);
      }

      // 進捗を更新
      setProgress(((i + 1) / total) * 100);
    }

    setIsAnalyzing(false);
    setCurrentFile('');

    // 完了後に必ずコールバックを呼ぶ（親コンポーネントでデータを再取得）
    onAnalysisComplete();

    // 2秒後にモーダルを自動で閉じる
    setTimeout(() => {
      onOpenChange(false);
      // モーダルを閉じた後、stateをリセット
      setCompleted(0);
      setFailed(0);
      setFailedFiles([]);
      setProgress(0);
      setCurrentFile('');
      setError('');
    }, 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            音量最適化
          </DialogTitle>
          <DialogDescription>
            録音ファイルの音量レベルを一括解析して最適化します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {recordingsNeedAnalysis.length === 0 ? (
            <Alert>
              <AlertDescription>
                すべての録音の音量メタデータが解析済みです
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                {recordingsNeedAnalysis.length}件が未解析です
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isAnalyzing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {completed + failed} / {recordingsNeedAnalysis.length} ファイル
                    </span>
                    <span className="text-muted-foreground">
                      成功: {completed}件 • 失敗: {failed}件
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      解析中: {getFileName(currentFile)}
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleAnalyzeAll}
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    解析中...
                  </>
                ) : (
                  <>
                    <Volume2 className="mr-2 h-4 w-4" />
                    {recordingsNeedAnalysis.length}件の録音を解析
                  </>
                )}
              </Button>

              {!isAnalyzing && (completed > 0 || failed > 0) && (
                <div className="space-y-2">
                  <Alert variant={failed > 0 ? "destructive" : "default"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      解析完了: 成功 {completed}件、失敗 {failed}件
                      {failed > 0 && (
                        <div className="mt-2 text-xs">
                          <p className="font-semibold">失敗したファイル:</p>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {failedFiles.map((file, index) => (
                              <li key={index} className="truncate">{file}</li>
                            ))}
                          </ul>
                          <p className="mt-2">
                            ※ WebM形式の音声ファイルはブラウザでデコードできない場合があります。
                            これらのファイルは再生時に自動で音量調整されません。
                          </p>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
