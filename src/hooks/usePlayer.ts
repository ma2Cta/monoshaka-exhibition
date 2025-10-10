import { useState, useEffect, useRef, useCallback } from 'react';
import { getRecordings, getRecordingUrl } from '@/lib/supabase';
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

export const usePlayer = (): UsePlayerReturn => {
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

  // 参照を常に最新に保つ
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  // 録音リストを取得
  const fetchRecordings = useCallback(async () => {
    try {
      const data = await getRecordings();
      const oldRecordings = recordingsRef.current;

      // 削除された録音を検出
      const oldIds = new Set(oldRecordings.map(r => r.id));
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
  }, []);

  // 次のトラックに移動
  const moveToNextTrack = useCallback(() => {
    if (recordingsRef.current.length === 0) return;
    const nextIndex = (currentIndexRef.current + 1) % recordingsRef.current.length;
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
      }

      // 参照を入れ替え
      const temp = currentAudioRef.current;
      currentAudioRef.current = nextAudioRef.current;
      nextAudioRef.current = temp;

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

  // 初回ロード時に録音を取得
  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

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

  // currentIndexが変更されたら再生（ユーザーが開始した後のみ）
  useEffect(() => {
    if (needsUserInteraction) return;
    if (recordings.length === 0) return;

    playTrack(currentIndex);
  }, [currentIndex, needsUserInteraction, recordings.length, playTrack]);

  // ユーザーインタラクション後に再生を開始
  const startPlayback = useCallback(() => {
    if (recordings.length === 0) return;

    setNeedsUserInteraction(false);
  }, [recordings.length]);

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
