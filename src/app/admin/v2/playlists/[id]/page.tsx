"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPlaylistById, getPlaylistRecordings } from "@/lib/supabase";
import RecordingList from "@/components/admin/RecordingList";
import { PlaybackControl } from "@/components/admin/PlaybackControl";
import { AudioUploadModal } from "@/components/admin/AudioUploadModal";
import { AdminRecorder } from "@/components/admin/AdminRecorder";
import Header from "@/components/layout/Header";
import type { Recording } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

export default function PlaylistDetailV2Page() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.id as string;

  const [playlistName, setPlaylistName] = useState("");
  const [playlistIsActive, setPlaylistIsActive] = useState(false);
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
      setPlaylistIsActive(playlist.is_active);
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
    // AdminRecorderから録音が追加された場合
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
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{playlistName}</h1>
                {playlistIsActive && (
                  <Badge
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    有効
                  </Badge>
                )}
              </div>
              <Button
                onClick={() => router.push("/admin/v2")}
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
            <AdminRecorder
              playlistId={playlistId}
              onRecordingAdded={handleRecordingAdded}
            />
          </div>

          {/* 録音一覧 */}
          <div>
            <RecordingList
              recordings={recordings}
              onUpdate={loadPlaylistData}
              playlistId={playlistId}
              onUploadRequest={() => setIsUploadModalOpen(true)}
              onRecordingDeleted={handleRecordingDeleted}
              onRecordingReordered={handleRecordingReordered}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </div>
        </div>
      </div>

      {/* アップロードモーダル */}
      <AudioUploadModal
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
