'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  getPlaylistById,
  getPlaylistRecordings,
} from '@/lib/supabase';
import RecordingList from '@/components/admin/RecordingList';
import Statistics from '@/components/admin/Statistics';
import AudioFileUploader from '@/components/admin/AudioFileUploader';
import Header from '@/components/layout/Header';
import type { Recording } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export default function PlaylistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.id as string;

  const [playlistName, setPlaylistName] = useState('');
  const [playlistIsActive, setPlaylistIsActive] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlaylistData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  async function loadPlaylistData() {
    try {
      setIsLoading(true);
      setError('');
      const [playlist, recordingsData] = await Promise.all([
        getPlaylistById(playlistId),
        getPlaylistRecordings(playlistId),
      ]);
      setPlaylistName(playlist.name);
      setPlaylistIsActive(playlist.is_active);
      setRecordings(recordingsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(message);
    } finally {
      setIsLoading(false);
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
          <Button
            onClick={() => router.push('/admin')}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            管理画面に戻る
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{playlistName}</h1>
            {playlistIsActive && (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                有効
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            録音数: {recordings.length}件
          </p>
        </div>

        {/* ファイルアップロード */}
        <div>
          <AudioFileUploader
            playlistId={playlistId}
            onUploadComplete={loadPlaylistData}
          />
        </div>

        {/* 統計情報 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">統計情報</h2>
          <Statistics recordings={recordings} isLoading={isLoading} />
        </div>

        {/* 録音一覧 */}
        <div>
          <RecordingList recordings={recordings} onUpdate={loadPlaylistData} playlistId={playlistId} />
        </div>
      </div>
    </div>
    </>
  );
}
