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
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { updateRecordingTranscription } from '@/lib/supabase';
import type { Recording } from '@/lib/types';

interface TranscriptionModalProps {
  recordings: Recording[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTranscriptionComplete?: () => void | Promise<void>;
}

export default function TranscriptionModal({
  recordings,
  open,
  onOpenChange,
  onTranscriptionComplete,
}: TranscriptionModalProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState('');

  // 文字起こしが必要な録音（transcriptionがない録音）を絞り込む
  const recordingsNeedTranscription = recordings.filter(
    (r) => !r.transcription || r.transcription.trim() === ''
  );

  // ファイルパスからファイル名のみを抽出
  const getFileName = (filePath: string): string => {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  };

  async function transcribeAudio(recordingId: string, filePath: string): Promise<string> {
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, filePath }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || '文字起こしに失敗しました');
    }

    const data = await response.json();
    return data.transcription;
  }

  async function handleTranscribeAll() {
    if (recordingsNeedTranscription.length === 0) {
      setError('すべての録音は既に文字起こし済みです');
      return;
    }

    setIsTranscribing(true);
    setError('');
    setCompleted(0);
    setFailed(0);
    setProgress(0);

    const total = recordingsNeedTranscription.length;

    // ローカル変数で成功/失敗を追跡
    let completedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recordingsNeedTranscription.length; i++) {
      const recording = recordingsNeedTranscription[i];
      setCurrentFile(recording.file_path);

      try {
        // 文字起こし実行
        const transcription = await transcribeAudio(recording.id, recording.file_path);

        // データベースを更新
        await updateRecordingTranscription(recording.id, transcription);

        completedCount++;
        setCompleted(completedCount);
      } catch (err) {
        console.error(`Failed to transcribe ${recording.file_path}:`, err);
        failedCount++;
        setFailed(failedCount);
      }

      // 進捗を更新
      setProgress(((i + 1) / total) * 100);
    }

    setIsTranscribing(false);
    setCurrentFile('');

    // 完了後にコールバックを呼ぶ（親コンポーネントでデータを再取得）
    await onTranscriptionComplete?.();

    // 2秒後にモーダルを自動で閉じる
    setTimeout(() => {
      onOpenChange(false);
      // モーダルを閉じた後、stateをリセット
      setCompleted(0);
      setFailed(0);
      setProgress(0);
      setCurrentFile('');
      setError('');
    }, 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文字起こし
          </DialogTitle>
          <DialogDescription>
            録音ファイルを一括で文字起こしします
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {recordingsNeedTranscription.length === 0 ? (
            <Alert>
              <AlertDescription>
                すべての録音が文字起こし済みです
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                {recordingsNeedTranscription.length}件が未処理です
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isTranscribing && (
                <div className="space-y-2">
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        進捗: {completed + failed} / {recordingsNeedTranscription.length} ファイル
                      </span>
                      <span className="text-muted-foreground">
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      成功: {completed}件 / 失敗: {failed}件
                    </div>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      処理中: {getFileName(currentFile)}
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleTranscribeAll}
                disabled={isTranscribing}
                className="w-full"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    文字起こし中...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    {recordingsNeedTranscription.length}件を文字起こし
                  </>
                )}
              </Button>

              {!isTranscribing && (completed > 0 || failed > 0) && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    処理完了: 成功 {completed}件、失敗 {failed}件
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
