import { useState, useEffect, useRef, useCallback } from 'react';
import { getRecordingUrl, getPlaylistRecordings } from '@/lib/supabase';
import { Recording } from '@/lib/types';

interface UsePlayerReturn {
  recordings: Recording[];
  currentIndex: number;
  isPlaying: boolean;
  error: string | null;
  totalCount: number;
  startPlayback: () => void;
  needsUserInteraction: boolean;
  resetPlayback: () => void;
  selectAudioOutput: () => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
  currentAudioDevice: string | null;
  audioOutputSupported: boolean;
}

interface UsePlayerOptions {
  playlistId?: string | null | undefined;
}

export const usePlayer = (options?: UsePlayerOptions): UsePlayerReturn => {
  const { playlistId } = options || {};
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUserInteraction, setNeedsUserInteraction] = useState<boolean>(true);
  const [currentAudioDevice, setCurrentAudioDevice] = useState<string | null>(null);
  const [audioOutputSupported, setAudioOutputSupported] = useState<boolean>(false);

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
  // 選択された音声出力デバイスID
  const selectedAudioDeviceIdRef = useRef<string>('');

  // Audio Output Devices APIのサポートを確認
  useEffect(() => {
    const checkAudioOutputSupport = () => {
      const hasSetsinkId = 'setSinkId' in HTMLAudioElement.prototype;
      const hasMediaDevices = 'mediaDevices' in navigator;
      const hasSelectAudioOutput = hasMediaDevices && 'selectAudioOutput' in navigator.mediaDevices;
      const hasEnumerateDevices = hasMediaDevices && 'enumerateDevices' in navigator.mediaDevices;

      console.log('Audio Output Devices API サポート確認:');
      console.log('  - setSinkId:', hasSetsinkId);
      console.log('  - mediaDevices:', hasMediaDevices);
      console.log('  - selectAudioOutput:', hasSelectAudioOutput);
      console.log('  - enumerateDevices:', hasEnumerateDevices);

      // setSinkIdとenumerateDevicesの両方が使えればサポートありとする
      // selectAudioOutputは必須ではない（代替UIで対応可能）
      const supported = hasSetsinkId && hasMediaDevices && hasEnumerateDevices;
      console.log('  - 総合サポート:', supported);

      setAudioOutputSupported(supported);

      // localStorageから保存されたデバイスIDを復元
      if (supported) {
        const savedDeviceId = localStorage.getItem('audioOutputDeviceId');
        if (savedDeviceId) {
          selectedAudioDeviceIdRef.current = savedDeviceId;
          setCurrentAudioDevice(savedDeviceId);
          console.log('  - 保存されたデバイスID:', savedDeviceId);
        }
      }
    };
    checkAudioOutputSupport();
  }, []);

  // Audio要素に音声出力デバイスを設定
  const setAudioSinkId = useCallback(async (audio: HTMLAudioElement) => {
    if (!audioOutputSupported || !selectedAudioDeviceIdRef.current) {
      return;
    }

    try {
      await audio.setSinkId(selectedAudioDeviceIdRef.current);
      console.log(`音声出力デバイスを設定: ${selectedAudioDeviceIdRef.current}`);
    } catch (err) {
      console.error('音声出力デバイスの設定に失敗:', err);
      // デバイスが利用できない場合はデフォルトにフォールバック
      selectedAudioDeviceIdRef.current = '';
      setCurrentAudioDevice(null);
      localStorage.removeItem('audioOutputDeviceId');
    }
  }, [audioOutputSupported]);

  // 音声出力デバイス一覧を取得
  const getAudioOutputDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      console.log('利用可能な音声出力デバイス:', audioOutputs);
      return audioOutputs;
    } catch (err) {
      console.error('デバイス一覧の取得に失敗:', err);
      return [];
    }
  }, []);

  // 音声出力デバイスを選択
  const selectAudioOutput = useCallback(async () => {
    if (!audioOutputSupported) {
      console.warn('音声出力デバイス選択がこのブラウザでサポートされていません');
      return;
    }

    try {
      // selectAudioOutputが利用可能な場合はそれを使用
      if ('selectAudioOutput' in navigator.mediaDevices) {
        console.log('selectAudioOutputを使用してデバイス選択ダイアログを表示します');
        const device = await navigator.mediaDevices.selectAudioOutput();
        selectedAudioDeviceIdRef.current = device.deviceId;
        setCurrentAudioDevice(device.deviceId);
        localStorage.setItem('audioOutputDeviceId', device.deviceId);

        console.log(`選択されたデバイス: ${device.label} (${device.deviceId})`);

        // 現在再生中のAudio要素に適用
        if (currentAudioRef.current) {
          await setAudioSinkId(currentAudioRef.current);
        }
        if (nextAudioRef.current) {
          await setAudioSinkId(nextAudioRef.current);
        }
      } else {
        // selectAudioOutputが使えない場合はenumerateDevicesを使用
        // この場合、UIコンポーネント側でデバイス一覧を表示する必要がある
        console.log('selectAudioOutputが利用できないため、enumerateDevicesを使用してカスタムダイアログを表示します');
        const devices = await getAudioOutputDevices();

        if (devices.length > 0) {
          console.log(`${devices.length}個の音声出力デバイスが見つかりました:`, devices.map(d => d.label || d.deviceId));
          // カスタムイベントを発行してUIに通知
          const event = new CustomEvent('audioOutputDeviceListAvailable', { detail: devices });
          window.dispatchEvent(event);
        } else {
          console.warn('音声出力デバイスが見つかりませんでした');
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          console.log('ユーザーがデバイス選択をキャンセルしました');
        } else {
          console.error('音声出力デバイスの選択に失敗:', err);
        }
      }
    }
  }, [audioOutputSupported, setAudioSinkId, getAudioOutputDevices]);

  // デバイスIDを直接設定する関数（UI側から呼び出される）
  const setOutputDevice = useCallback(async (deviceId: string) => {
    selectedAudioDeviceIdRef.current = deviceId;
    setCurrentAudioDevice(deviceId);
    localStorage.setItem('audioOutputDeviceId', deviceId);

    console.log(`デバイスを設定: ${deviceId}`);

    // 現在再生中のAudio要素に適用
    if (currentAudioRef.current) {
      await setAudioSinkId(currentAudioRef.current);
    }
    if (nextAudioRef.current) {
      await setAudioSinkId(nextAudioRef.current);
    }
  }, [setAudioSinkId]);

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
      // プレイリストIDが指定されていない場合は何もしない
      if (!playlistId) {
        return;
      }

      // プレイリストIDが指定されている場合はプレイリストの録音を取得
      const data = await getPlaylistRecordings(playlistId);

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

      // 音声出力デバイスを設定
      setAudioSinkId(nextAudioRef.current).catch(err => {
        console.error('プリロード用Audio要素のデバイス設定エラー:', err);
      });
    }

    const url = getRecordingUrl(nextRecording.file_path);
    nextAudioRef.current.src = url;
    nextAudioRef.current.load();
  }, [setAudioSinkId]);

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
  const playTrack = useCallback(async (index: number) => {
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
      // 音声出力デバイスを設定
      await setAudioSinkId(currentAudioRef.current).catch(err => {
        console.error('Audio要素のデバイス設定エラー:', err);
      });
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
  }, [setupAudioListeners, switchToNextTrack, preloadNextTrack, setAudioSinkId]);

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

  // 再生をリセット
  const resetPlayback = useCallback(() => {
    console.log('再生をリセットします');

    // オーディオを停止
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.onplaying = null;
      currentAudioRef.current.onpause = null;
    }
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.src = '';
      nextAudioRef.current.onended = null;
      nextAudioRef.current.onerror = null;
      nextAudioRef.current.onplaying = null;
      nextAudioRef.current.onpause = null;
    }

    // 状態をリセット
    playbackSnapshotRef.current = null;
    hasCompletedPlaybackRef.current = false;
    hasStartedPlayback.current = false;
    setCurrentIndex(0);
    setIsPlaying(false);
    setNeedsUserInteraction(true);
    setRecordings([]);
  }, []);

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
    resetPlayback,
    selectAudioOutput,
    setOutputDevice,
    currentAudioDevice,
    audioOutputSupported,
  };
};
