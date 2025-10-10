'use client';

import { useState, useEffect } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { getPlaylists, getActivePlaylist } from '@/lib/supabase';
import { Playlist } from '@/lib/types';

export default function LoopPlayer() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylistName, setSelectedPlaylistName] = useState<string>('');
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);

  const {
    recordings,
    currentIndex,
    isPlaying,
    error,
    totalCount,
    startPlayback,
    needsUserInteraction
  } = usePlayer({ playlistId: selectedPlaylistId });

  // プレイリスト一覧を取得し、有効なプレイリストを初期選択
  useEffect(() => {
    loadPlaylists();
  }, []);

  async function loadPlaylists() {
    try {
      setIsLoadingPlaylists(true);
      const [allPlaylists, activePlaylist] = await Promise.all([
        getPlaylists(),
        getActivePlaylist(),
      ]);
      setPlaylists(allPlaylists);

      // 有効なプレイリストがあればそれを選択、なければ最初のプレイリスト
      if (activePlaylist) {
        setSelectedPlaylistId(activePlaylist.id);
        setSelectedPlaylistName(activePlaylist.name);
      } else if (allPlaylists.length > 0) {
        setSelectedPlaylistId(allPlaylists[0].id);
        setSelectedPlaylistName(allPlaylists[0].name);
      }
    } catch (err) {
      console.error('プレイリストの取得に失敗:', err);
    } finally {
      setIsLoadingPlaylists(false);
    }
  }

  function handlePlaylistChange(playlistId: string) {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist) {
      setSelectedPlaylistId(playlistId);
      setSelectedPlaylistName(playlist.name);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        {/* プレイリスト選択UI */}
        {!isLoadingPlaylists && playlists.length > 0 && (
          <div className="mb-6 flex items-center justify-center gap-4">
            <label htmlFor="playlist-select" className="text-white text-lg font-semibold">
              プレイリスト:
            </label>
            <select
              id="playlist-select"
              value={selectedPlaylistId || ''}
              onChange={(e) => handlePlaylistChange(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/20 backdrop-blur text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 hover:bg-white/30 transition-colors"
            >
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id} className="bg-gray-800">
                  {playlist.name} {playlist.is_active && '(有効)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 再生開始ボタン（ユーザーインタラクション必要時） */}
        {needsUserInteraction && totalCount > 0 && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-12 text-center max-w-md mx-4 shadow-2xl">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                再生を開始
              </h2>
              <p className="text-gray-600 mb-8">
                {totalCount}件の録音を連続再生します
              </p>
              <button
                onClick={startPlayback}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-4 px-12 rounded-full transition-all transform hover:scale-105 shadow-lg"
              >
                再生開始
              </button>
            </div>
          </div>
        )}

        {/* エラーメッセージ */}
        {error && (
          <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-100 px-6 py-4 rounded-lg mb-8 text-center">
            <p className="text-lg font-semibold">{error}</p>
          </div>
        )}

        {/* メインコンテンツ */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-12 border border-white/20">
          {/* タイトル */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              音声ループ再生
            </h1>
            {selectedPlaylistName && (
              <p className="text-2xl text-white/90 mb-2 font-semibold">
                {selectedPlaylistName}
              </p>
            )}
            <p className="text-xl text-white/80">
              録音された声が連続再生されています
            </p>
          </div>

          {/* 録音がない場合 */}
          {totalCount === 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/20 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-white/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </div>
              <p className="text-2xl text-white/60 font-semibold">
                まだ録音がありません
              </p>
              <p className="text-lg text-white/40 mt-2">
                録音が追加されると自動的に再生されます
              </p>
            </div>
          )}

          {/* 再生情報 */}
          {totalCount > 0 && (
            <div className="space-y-8">
              {/* 再生状態インジケーター */}
              <div className="flex items-center justify-center gap-4">
                <div
                  className={`w-4 h-4 rounded-full ${
                    isPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                  }`}
                />
                <p className="text-2xl text-white font-semibold">
                  {isPlaying ? '再生中' : '一時停止中'}
                </p>
              </div>

              {/* 現在の再生位置 */}
              <div className="text-center">
                <p className="text-8xl font-bold text-white mb-4">
                  {currentIndex + 1}
                  <span className="text-5xl text-white/60"> / {totalCount}</span>
                </p>
                <p className="text-xl text-white/60">
                  録音番号 / 総録音数
                </p>
              </div>

              {/* プログレスバー */}
              <div className="relative w-full h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-500 ease-linear"
                  style={{
                    width: `${((currentIndex + 1) / totalCount) * 100}%`,
                  }}
                />
              </div>

              {/* 録音情報 */}
              {recordings[currentIndex] && (
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-sm text-white/60 mb-1">録音時間</p>
                      <p className="text-2xl font-bold text-white">
                        {recordings[currentIndex].duration
                          ? `${Math.floor(recordings[currentIndex].duration!)}秒`
                          : '不明'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-white/60 mb-1">録音日時</p>
                      <p className="text-xl font-semibold text-white">
                        {new Date(
                          recordings[currentIndex].created_at
                        ).toLocaleDateString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 波形アニメーション（装飾） */}
              {isPlaying && (
                <div className="flex items-center justify-center gap-2 h-24">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-gradient-to-t from-blue-400 to-purple-400 rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 80 + 20}%`,
                        animationDelay: `${i * 0.05}s`,
                        animationDuration: `${Math.random() * 0.5 + 0.5}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* 自動更新の説明 */}
              <div className="text-center pt-4">
                <p className="text-sm text-white/50">
                  ⚡ 10秒ごとに録音リストを自動更新（追加・削除に対応）
                </p>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="text-center mt-8">
          <p className="text-white/40 text-sm">
            画面を閉じるまで自動的にループ再生されます
          </p>
        </div>
      </div>
    </div>
  );
}
