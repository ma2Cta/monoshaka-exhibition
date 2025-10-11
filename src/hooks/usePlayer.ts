import { useState, useEffect, useRef, useCallback } from 'react';
import { getRecordings, getRecordingUrl, getPlaylistRecordings } from '@/lib/supabase';
import { Recording } from '@/lib/types';

interface UsePlayerReturn {
  recordings: Recording[];
  currentIndex: number;
  isPlaying: boolean;
  error: string | null;
  totalCount: number;
  startPlayback: () => void;
  needsUserInteraction: boolean;
}

interface UsePlayerOptions {
  playlistId?: string | null;
}

export const usePlayer = (options?: UsePlayerOptions): UsePlayerReturn => {
  const { playlistId } = options || {};
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUserInteraction, setNeedsUserInteraction] = useState<boolean>(true);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef<number>(0);
  const recordingsRef = useRef<Recording[]>([]);
  const isSwitching = useRef(false);
  const hasStartedPlayback = useRef<boolean>(false);
  const switchToNextTrackRef = useRef<(() => void) | null>(null);

  // 再生開始時のプレイリストのスナップショット
  const playbackSnapshotRef = useRef<Recording[] | null>(null);
  // 再生が完了したかどうかのフラグ
  const hasCompletedPlaybackRef = useRef<boolean>(false);

  // 参照を常に最新に保つ
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    // スナップショットが存在する場合はスナップショットを使用
    // 存在しない場合は通常のrecordingsを使用
    if (playbackSnapshotRef.current && !hasCompletedPlaybackRef.current) {
      recordingsRef.current = playbackSnapshotRef.current;
    } else {
      recordingsRef.current = recordings;
    }
  }, [recordings]);

  // 録音リストを取得
  const fetchRecordings = useCallback(async () => {
    try {
      // プレイリストIDが指定されている場合はプレイリストの録音を取得
      // 指定されていない場合は全録音を取得
      const data = playlistId
        ? await getPlaylistRecordings(playlistId)
        : await getRecordings();

      const oldRecordings = recordingsRef.current;

      // 再生中の場合はスナップショットを保持し続ける
      if (playbackSnapshotRef.current && !hasCompletedPlaybackRef.current) {
        // 再生中のスナップショット内の録音が削除されていないかチェック
        const currentRecording = playbackSnapshotRef.current[currentIndexRef.current];
        const newIds = new Set(data.map(r => r.id));
        const wasCurrentDeleted = currentRecording && !newIds.has(currentRecording.id);

        // 現在再生中の録音が削除された場合のみ処理
        if (wasCurrentDeleted) {
          console.log('現在再生中の録音が削除されました。次の録音にスキップします。');

          // スナップショットから削除された録音を除外
          const updatedSnapshot = playbackSnapshotRef.current.filter(r => newIds.has(r.id));

          if (updatedSnapshot.length === 0) {
            // すべて削除された場合は再生終了
            console.log('すべての録音が削除されました。');
            playbackSnapshotRef.current = null;
            hasCompletedPlaybackRef.current = true;
            setRecordings(data);
            setCurrentIndex(0);
            setIsPlaying(false);

            if (currentAudioRef.current) {
              currentAudioRef.current.pause();
              currentAudioRef.current.src = '';
            }
            if (nextAudioRef.current) {
              nextAudioRef.current.pause();
              nextAudioRef.current.src = '';
            }
          } else {
            // スナップショットを更新し、インデックスを調整
            playbackSnapshotRef.current = updatedSnapshot;
            const newIndex = currentIndexRef.current >= updatedSnapshot.length ? 0 : currentIndexRef.current;
            setCurrentIndex(newIndex);

            // 現在の再生を停止
            if (currentAudioRef.current) {
              currentAudioRef.current.pause();
              currentAudioRef.current.src = '';
            }
            if (nextAudioRef.current) {
              nextAudioRef.current.pause();
              nextAudioRef.current.src = '';
            }
          }
        }

        // 表示用のrecordingsは更新しない（スナップショットを表示）
        setError(null);
        return;
      }

      // プレイリストが完了した後、新しいプレイリストを取得
      if (hasCompletedPlaybackRef.current) {
        console.log('新しいプレイリストを取得しました:', data.length);
        playbackSnapshotRef.current = [...data];
        hasCompletedPlaybackRef.current = false;
        setCurrentIndex(0);
      }

      // 再生していない場合は通常通り更新
      const newIds = new Set(data.map(r => r.id));

      // 現在再生中の録音が削除されたかチェック
      const currentRecording = oldRecordings[currentIndexRef.current];
      const wasCurrentDeleted = currentRecording && !newIds.has(currentRecording.id);

      setRecordings(data);
      setError(null);

      // 現在再生中の録音が削除された場合
      if (wasCurrentDeleted && data.length > 0) {
        console.log('現在再生中の録音が削除されました。次の録音にスキップします。');

        // 現在のインデックスを調整
        // 削除された場合は同じインデックス位置の録音を再生（または最後まで行っていたら0に戻る）
        const newIndex = currentIndexRef.current >= data.length ? 0 : currentIndexRef.current;
        setCurrentIndex(newIndex);

        // 現在の再生を停止して次の録音を再生
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.src = '';
        }
        if (nextAudioRef.current) {
          nextAudioRef.current.pause();
          nextAudioRef.current.src = '';
        }
      } else if (data.length === 0) {
        // すべての録音が削除された場合
        console.log('すべての録音が削除されました。');
        setCurrentIndex(0);
        setIsPlaying(false);

        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.src = '';
        }
        if (nextAudioRef.current) {
          nextAudioRef.current.pause();
          nextAudioRef.current.src = '';
        }
      }
    } catch (err) {
      console.error('録音取得エラー:', err);
      setError(err instanceof Error ? err.message : '録音の取得に失敗しました');
    }
  }, [playlistId]);

  // 次のトラックに移動
  const moveToNextTrack = useCallback(() => {
    if (recordingsRef.current.length === 0) return;
    const nextIndex = (currentIndexRef.current + 1) % recordingsRef.current.length;

    // プレイリストが一周した場合（インデックスが0に戻る場合）
    if (nextIndex === 0 && playbackSnapshotRef.current) {
      console.log('プレイリストが一周しました。新しいプレイリストに更新します。');
      hasCompletedPlaybackRef.current = true;
      playbackSnapshotRef.current = null;
    }

    setCurrentIndex(nextIndex);
  }, []);

  // 次のトラックをプリロード
  const preloadNextTrack = useCallback((currentIdx: number) => {
    if (recordingsRef.current.length === 0) return;

    const nextIndex = (currentIdx + 1) % recordingsRef.current.length;
    const nextRecording = recordingsRef.current[nextIndex];

    if (!nextRecording) return;

    // 次のAudio要素を作成/再利用
    if (!nextAudioRef.current) {
      nextAudioRef.current = new Audio();
      nextAudioRef.current.preload = 'auto';

      // プリロード用のエラーハンドラを設定
      nextAudioRef.current.onerror = (e) => {
        console.error('次のトラックのプリロードエラー:', e);
        // プリロードエラーの場合はスキップして次のトラックを試す
      };
    }

    const url = getRecordingUrl(nextRecording.file_path);
    nextAudioRef.current.src = url;
    nextAudioRef.current.load();
  }, []);

  // 次のトラックに切り替えて再生
  const switchToNextTrack = useCallback(() => {
    if (isSwitching.current || recordingsRef.current.length === 0) return;

    isSwitching.current = true;

    // まずインデックスを更新
    moveToNextTrack();

    // 次のトラックが既にプリロードされていれば、それを再生
    if (nextAudioRef.current && nextAudioRef.current.src) {
      // 現在のAudioを停止
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        // イベントリスナーをクリア
        currentAudioRef.current.onended = null;
        currentAudioRef.current.onerror = null;
        currentAudioRef.current.onplaying = null;
        currentAudioRef.current.onpause = null;
      }

      // 参照を入れ替え
      const temp = currentAudioRef.current;
      currentAudioRef.current = nextAudioRef.current;
      nextAudioRef.current = temp;

      // 新しいcurrentAudioにイベントリスナーを設定
      if (currentAudioRef.current) {
        currentAudioRef.current.onended = () => {
          if (switchToNextTrackRef.current) {
            switchToNextTrackRef.current();
          }
        };

        currentAudioRef.current.onerror = (e) => {
          console.error('Audio error:', e);
          setTimeout(() => {
            if (switchToNextTrackRef.current) {
              switchToNextTrackRef.current();
            }
          }, 100);
        };

        currentAudioRef.current.onplaying = () => {
          setIsPlaying(true);
        };

        currentAudioRef.current.onpause = () => {
          setIsPlaying(false);
        };
      }

      // 新しいcurrentAudioを再生
      currentAudioRef.current.play().catch((err) => {
        console.error('再生エラー:', err);
      });

      // さらに次をプリロード
      const nextIdx = (currentIndexRef.current + 1) % recordingsRef.current.length;
      preloadNextTrack(nextIdx);
    }

    isSwitching.current = false;
  }, [moveToNextTrack, preloadNextTrack]);

  // switchToNextTrackの参照を常に最新に保つ
  useEffect(() => {
    switchToNextTrackRef.current = switchToNextTrack;
  }, [switchToNextTrack]);

  // Audio要素にイベントリスナーを設定
  const setupAudioListeners = useCallback((audio: HTMLAudioElement) => {
    // 既存のリスナーを削除（重複防止）
    audio.onended = null;
    audio.onerror = null;
    audio.onplaying = null;
    audio.onpause = null;
    audio.onloadstart = null;

    // 新しいリスナーを設定
    audio.onended = () => {
      switchToNextTrack();
    };

    audio.onerror = (e) => {
      console.error('Audio error:', e);
      console.log('削除された可能性のある音声の再生をスキップします');
      // エラーが発生した場合は次のトラックにスキップ
      setTimeout(() => {
        switchToNextTrack();
      }, 100);
    };

    audio.onplaying = () => {
      setIsPlaying(true);
    };

    audio.onpause = () => {
      setIsPlaying(false);
    };

    // 音声のロード開始時にエラーをキャッチ
    audio.onloadstart = () => {
      console.log('音声の読み込みを開始しました');
    };
  }, [switchToNextTrack]);

  // 指定されたインデックスのトラックを再生
  const playTrack = useCallback((index: number) => {
    if (recordingsRef.current.length === 0) return;

    const recording = recordingsRef.current[index];
    if (!recording) {
      console.error('録音が見つかりません:', index);
      return;
    }

    const url = getRecordingUrl(recording.file_path);

    // 現在のAudio要素を作成/設定
    if (!currentAudioRef.current) {
      currentAudioRef.current = new Audio();
    }

    // イベントリスナーを設定
    setupAudioListeners(currentAudioRef.current);

    // トラックをセット
    currentAudioRef.current.src = url;
    currentAudioRef.current.load();

    // 再生
    currentAudioRef.current.play().catch((err) => {
      console.error('再生エラー:', err);
      switchToNextTrack();
    });

    // 次のトラックをプリロード
    preloadNextTrack(index);
  }, [setupAudioListeners, switchToNextTrack, preloadNextTrack]);

  // 初回ロード時に録音を取得し、自動的にスナップショットを作成
  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // 録音が取得されたときにスナップショットを準備（再生はstartPlaybackで開始）
  useEffect(() => {
    if (recordings.length > 0 && !playbackSnapshotRef.current && !hasCompletedPlaybackRef.current) {
      console.log('プレイリストのスナップショットを準備:', recordings.length);
      playbackSnapshotRef.current = [...recordings];
      recordingsRef.current = [...recordings];
    }
  }, [recordings]);

  // 10秒ごとに録音リストを更新
  useEffect(() => {
    fetchIntervalRef.current = setInterval(() => {
      fetchRecordings();
    }, 10000);

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, [fetchRecordings]);

  // ユーザーインタラクション後に再生を開始
  const startPlayback = useCallback(() => {
    if (recordings.length === 0) return;
    if (hasStartedPlayback.current) return;

    console.log('再生を開始します:', recordings.length);

    // スナップショットがまだなければ作成
    if (!playbackSnapshotRef.current) {
      playbackSnapshotRef.current = [...recordings];
      recordingsRef.current = [...recordings];
    }

    hasStartedPlayback.current = true;
    hasCompletedPlaybackRef.current = false;
    setNeedsUserInteraction(false);

    // 最初のトラックを再生
    playTrack(0);
  }, [recordings, playTrack]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
      }
      if (nextAudioRef.current) {
        nextAudioRef.current.pause();
        nextAudioRef.current.src = '';
      }
    };
  }, []);

  return {
    recordings,
    currentIndex,
    isPlaying,
    error,
    totalCount: recordings.length,
    startPlayback,
    needsUserInteraction,
  };
};
