"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPlaylistById, getPlaylistRecordings } from "@/lib/supabase";
import RecordingList from "@/components/playlist/RecordingList";
import { PlaybackControl } from "@/components/playback/PlaybackControl";
import { UploadModal } from "@/components/audio/UploadModal";
import { Recorder } from "@/components/recording/Recorder";
import Header from "@/components/layout/Header";
import type { Recording } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function PlaylistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.id as string;

  const [playlistName, setPlaylistName] = useState("");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    loadPlaylistData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  async function loadPlaylistData() {
    try {
      setIsLoading(true);
      setError("");
      const [playlist, recordingsData] = await Promise.all([
        getPlaylistById(playlistId),
        getPlaylistRecordings(playlistId),
      ]);
      setPlaylistName(playlist.name);
      setRecordings(recordingsData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "データの取得に失敗しました";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleUploadComplete(newRecordings: Recording[]) {
    // 新しいレコーディングを既存の配列に追加
    // NOTE: ページ全体を再読み込みせず、ローカルstateのみを更新する
    // これにより、PlaybackControlでの再生が中断されるのを防ぐ
    setRecordings((prev) => [...prev, ...newRecordings]);
  }

  function handleRecordingAdded(recording: Recording) {
    // Recorderから録音が追加された場合
    // ページ全体をリフレッシュせず、ローカルstateのみを更新
    setRecordings((prev) => [...prev, recording]);
  }

  function handleRecordingDeleted(recordingId: string) {
    // RecordingListから録音が削除された場合
    // ページ全体をリフレッシュせず、ローカルstateのみを更新
    // これによりPlaybackControl/usePlayerでも削除を検出できる
    setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
  }

  function handleRecordingReordered(newRecordings: Recording[]) {
    // RecordingListから並び替えが行われた場合
    // ページ全体をリフレッシュせず、ローカルstateのみを更新
    // これによりPlaybackControl/usePlayerでも並び替えを検出できる
    setRecordings(newRecordings);
  }

  async function handleAnalysisComplete() {
    // 音量最適化が完了した場合
    // データベースから最新のLUFS値を取得
    // これによりPlaybackControl/usePlayerでもLUFS値の更新を検出できる
    try {
      const recordingsData = await getPlaylistRecordings(playlistId);
      setRecordings(recordingsData);
    } catch (err) {
      console.error("録音データの再取得に失敗:", err);
    }
  }

  async function handleTranscriptionComplete() {
    // 文字起こしが完了した場合
    // データベースから最新の文字起こしデータを取得
    try {
      const recordingsData = await getPlaylistRecordings(playlistId);
      setRecordings(recordingsData);
    } catch (err) {
      console.error("録音データの再取得に失敗:", err);
    }
  }

  async function handleRecordingsUpdate() {
    // 再読み込みボタンが押された場合
    // ページ全体をリロードせず、データベースから最新のデータを取得してstateのみを更新
    try {
      const recordingsData = await getPlaylistRecordings(playlistId);
      setRecordings(recordingsData);
    } catch (err) {
      console.error("録音データの再取得に失敗:", err);
    }
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Alert variant="destructive">
            <AlertDescription>エラー: {error}</AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* ヘッダー */}
          <div>
            <div className="flex items-start gap-4 mb-2">
              <h1 className="text-3xl font-bold">{playlistName}</h1>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                戻る
              </Button>
            </div>
          </div>

          {/* 再生コントロールと録音 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlaybackControl
              playlistId={playlistId}
              recordingCount={recordings.length}
              recordings={recordings}
            />
            <Recorder
              playlistId={playlistId}
              onRecordingAdded={handleRecordingAdded}
            />
          </div>

          {/* 録音一覧 */}
          <div>
            <RecordingList
              recordings={recordings}
              onUpdate={handleRecordingsUpdate}
              playlistId={playlistId}
              onUploadRequest={() => setIsUploadModalOpen(true)}
              onRecordingDeleted={handleRecordingDeleted}
              onRecordingReordered={handleRecordingReordered}
              onAnalysisComplete={handleAnalysisComplete}
              onTranscriptionComplete={handleTranscriptionComplete}
            />
          </div>
        </div>
      </div>

      {/* アップロードモーダル */}
      <UploadModal
        playlistId={playlistId}
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onUploadComplete={handleUploadComplete}
      />

      {/* トップに戻るボタン */}
      <ScrollToTop />
    </>
  );
}
