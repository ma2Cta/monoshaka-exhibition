'use client';

import { useRecorder } from '@/hooks/useRecorder';
import { useRef, useEffect, useState } from 'react';
import { uploadRecording } from '@/lib/supabase';

export default function AudioRecorder() {
  const {
    state,
    recordedBlob,
    recordedUrl,
    duration,
    error,
    startRecording,
    stopRecording,
    reset,
  } = useRecorder();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 録音URLが変更されたら、オーディオ要素に設定して自動再生
  useEffect(() => {
    if (audioRef.current && recordedUrl) {
      audioRef.current.src = recordedUrl;
      // 自動再生
      audioRef.current.play().catch((error) => {
        console.error('自動再生エラー:', error);
      });
    }
  }, [recordedUrl]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleUpload = async () => {
    if (!recordedBlob) return;

    setUploadState('uploading');
    setUploadError(null);

    try {
      await uploadRecording(recordedBlob, duration);
      setUploadState('success');
    } catch (err) {
      console.error('アップロードエラー:', err);
      setUploadError(err instanceof Error ? err.message : 'アップロードに失敗しました');
      setUploadState('error');
    }
  };

  const handleRetry = () => {
    setUploadState('idle');
    setUploadError(null);
  };

  const handleNewRecording = () => {
    reset();
    setUploadState('idle');
    setUploadError(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      {/* タイトル */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          音声録音
        </h1>
        <p className="text-gray-600">
          小説の一節を読み上げてください
        </p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">エラー</p>
          <p>{error}</p>
        </div>
      )}

      {/* アップロードエラーメッセージ */}
      {uploadError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">アップロードエラー</p>
          <p>{uploadError}</p>
        </div>
      )}

      {/* アップロード成功メッセージ */}
      {uploadState === 'success' && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-center">
          <p className="text-2xl font-bold mb-2">ありがとうございました!</p>
          <p>録音がアップロードされました。</p>
        </div>
      )}

      {/* 録音コントロール */}
      <div className="bg-white rounded-lg shadow-md p-8">
        {/* 録音状態の表示 */}
        <div className="text-center mb-6">
          {state === 'idle' && (
            <p className="text-gray-500 text-lg">録音を開始してください</p>
          )}
          {state === 'recording' && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <p className="text-red-500 text-xl font-semibold">録音中...</p>
              </div>
              <p className="text-3xl font-mono text-gray-700">
                {formatDuration(duration)}
              </p>
              <p className="text-sm text-gray-500">
                最大録音時間: 60秒
              </p>
            </div>
          )}
          {state === 'stopped' && (
            <p className="text-green-600 text-lg font-semibold">
              録音完了 ({formatDuration(duration)})
            </p>
          )}
        </div>

        {/* ボタン */}
        <div className="flex justify-center gap-4">
          {state === 'idle' && (
            <button
              onClick={startRecording}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
            >
              録音開始
            </button>
          )}

          {state === 'recording' && (
            <button
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
            >
              録音停止
            </button>
          )}

          {state === 'stopped' && (
            <>
              <button
                onClick={reset}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
              >
                やり直す
              </button>
            </>
          )}
        </div>
      </div>

      {/* 録音プレビュー */}
      {state === 'stopped' && recordedUrl && uploadState === 'idle' && (
        <div className="bg-white rounded-lg shadow-md p-8 space-y-4">
          <h2 className="text-xl font-bold text-gray-800 text-center">
            録音を確認
          </h2>

          <audio
            ref={audioRef}
            controls
            className="w-full"
          />

          <div className="flex justify-center gap-4">
            <button
              onClick={handleUpload}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
            >
              送信する
            </button>
            <button
              onClick={handleDownload}
              className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-colors"
            >
              ダウンロード
            </button>
          </div>

          {recordedBlob && (
            <div className="text-sm text-gray-500 text-center">
              ファイルサイズ: {(recordedBlob.size / 1024).toFixed(2)} KB
            </div>
          )}
        </div>
      )}

      {/* アップロード中 */}
      {uploadState === 'uploading' && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-lg font-semibold text-gray-700">アップロード中...</p>
          </div>
        </div>
      )}

      {/* アップロードエラー時のリトライボタン */}
      {uploadState === 'error' && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center space-y-4">
          <button
            onClick={handleRetry}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
          >
            再試行
          </button>
        </div>
      )}

      {/* アップロード成功後 */}
      {uploadState === 'success' && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <button
            onClick={handleNewRecording}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
          >
            もう一度録音する
          </button>
        </div>
      )}

      {/* 使い方 */}
      {uploadState !== 'success' && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-bold text-gray-800 mb-2">使い方</h3>
          <ol className="list-decimal list-inside space-y-1 text-gray-600 text-sm">
            <li>「録音開始」ボタンをクリック</li>
            <li>マイクへのアクセスを許可</li>
            <li>小説の一節を読み上げる</li>
            <li>「録音停止」ボタンをクリック（最大60秒）</li>
            <li>録音を再生して確認</li>
            <li>問題なければ「送信する」ボタン、やり直す場合は「やり直す」ボタン</li>
          </ol>
        </div>
      )}
    </div>
  );
}
