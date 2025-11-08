import { useState, useEffect, useRef, useCallback } from 'react';
import { getRecordingUrl, getPlaylistRecordings } from '@/lib/supabase';
import { Recording } from '@/lib/types';
import { calculateGainFromLufs } from '@/lib/audio-analysis';

// AudioContextOptionsの拡張（sinkIdサポート用）
interface ExtendedAudioContextOptions extends AudioContextOptions {
  sinkId?: string;
}

// AudioContextの拡張（setSinkIdサポート用）
interface ExtendedAudioContext extends AudioContext {
  setSinkId?(sinkId: string): Promise<void>;
}

interface UsePlayerReturn {
  recordings: Recording[];
  currentIndex: number;
  isPlaying: boolean;
  error: string | null;
  totalCount: number;
  startPlayback: () => void;
  needsUserInteraction: boolean;
  pausePlayback: () => void;
  resetPlayback: () => void;
  selectAudioOutput: () => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
  currentAudioDevice: string | null;
  audioOutputSupported: boolean;
}

interface UsePlayerOptions {
  playlistId?: string | null | undefined;
  recordings?: Recording[];
}

export const usePlayer = (options?: UsePlayerOptions): UsePlayerReturn => {
  const { playlistId, recordings: externalRecordings } = options || {};
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
  const switchToNextTrackRef = useRef<(() => Promise<void>) | null>(null);
  const playTrackRef = useRef<((index: number) => Promise<void>) | null>(null);

  // Web Audio API関連の参照
  const audioContextRef = useRef<AudioContext | null>(null);
  // Audio要素とノードの対応を管理するWeakMap
  const audioToNodesMap = useRef<WeakMap<HTMLAudioElement, { source: MediaElementAudioSourceNode; gain: GainNode }>>(new WeakMap());

  // 事前計算された再生順序（インデックスの配列）
  // 例: [0, 1, 2] → 録音0 → 録音1 → 録音2 の順で再生
  const playbackOrderRef = useRef<number[]>([]);
  // 現在の再生順序配列内の位置
  const playbackPositionRef = useRef<number>(0);

  // 再生開始時のプレイリストのスナップショット
  const playbackSnapshotRef = useRef<Recording[] | null>(null);
  // 再生が完了したかどうかのフラグ
  const hasCompletedPlaybackRef = useRef<boolean>(false);
  // 選択された音声出力デバイスID
  const selectedAudioDeviceIdRef = useRef<string>('');

  // AudioContextを初期化（遅延初期化）
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      // デバイスが選択されている場合は、そのデバイスでAudioContextを作成
      const options: ExtendedAudioContextOptions = {};
      if (selectedAudioDeviceIdRef.current) {
        options.sinkId = selectedAudioDeviceIdRef.current;
      }

      audioContextRef.current = new AudioContext(options);
    }
    return audioContextRef.current;
  }, []);

  // Audio要素をWeb Audio APIに接続し、音量ノーマライゼーションを適用
  const connectAudioToWebAudio = useCallback(
    (
      audio: HTMLAudioElement,
      recording: Recording
    ): { source: MediaElementAudioSourceNode; gain: GainNode } | null => {
      // LUFS値がない場合はWeb Audio APIを使用しない（通常のAudio要素のまま）
      if (recording.lufs == null) {
        return null;
      }

      const context = getAudioContext();

      // 既にこのAudio要素に対してノードが作成されているか確認
      const existingNodes = audioToNodesMap.current.get(audio);
      if (existingNodes) {
        // Gainだけ更新
        const gainValue = calculateGainFromLufs(recording.lufs);
        existingNodes.gain.gain.value = gainValue;
        return existingNodes;
      }

      // MediaElementSourceNodeを作成
      let source: MediaElementAudioSourceNode;
      try {
        source = context.createMediaElementSource(audio);
      } catch (err) {
        console.error('MediaElementSourceNode作成エラー:', err);
        // エラーの場合はnullを返して通常再生にフォールバック
        return null;
      }

      // GainNodeを作成
      const gain = context.createGain();

      // LUFS値から適切なGain値を計算して設定
      const gainValue = calculateGainFromLufs(recording.lufs);
      gain.gain.value = gainValue;

      // ノードを接続: source → gain → destination
      source.connect(gain);
      gain.connect(context.destination);

      // WeakMapに保存
      audioToNodesMap.current.set(audio, { source, gain });

      return { source, gain };
    },
    [getAudioContext]
  );

  // Audio Output Devices APIのサポートを確認
  useEffect(() => {
    const checkAudioOutputSupport = () => {
      const hasSetsinkId = 'setSinkId' in HTMLAudioElement.prototype;
      const hasMediaDevices = 'mediaDevices' in navigator;
      const hasEnumerateDevices = hasMediaDevices && 'enumerateDevices' in navigator.mediaDevices;

      // setSinkIdとenumerateDevicesの両方が使えればサポートありとする
      // selectAudioOutputは必須ではない（代替UIで対応可能）
      const supported = hasSetsinkId && hasMediaDevices && hasEnumerateDevices;

      setAudioOutputSupported(supported);
    };
    checkAudioOutputSupport();
  }, []);

  // Audio要素に音声出力デバイスを設定
  const setAudioSinkId = useCallback(async (audio: HTMLAudioElement) => {
    if (!audioOutputSupported) {
      return;
    }

    if (!selectedAudioDeviceIdRef.current) {
      return;
    }

    // Web Audio APIに接続されているAudio要素はsetSinkIdを変更できない
    // （AbortErrorが発生する）ため、スキップする
    const isConnectedToWebAudio = audioToNodesMap.current.has(audio);
    if (isConnectedToWebAudio) {
      return;
    }

    try {
      await audio.setSinkId(selectedAudioDeviceIdRef.current);
    } catch (err) {
      console.error(`音声出力デバイスの設定に失敗 (デバイスID: ${selectedAudioDeviceIdRef.current}):`, err);
      // エラーが発生してもselectedAudioDeviceIdRef.currentはクリアしない
      // （他のAudio要素では成功する可能性があるため）
    }
  }, [audioOutputSupported]);

  // 音声出力デバイス一覧を取得（既定のデバイスを除外）
  const getAudioOutputDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      // 既定のデバイス（default）を除外し、実際のデバイスのみを返す
      const audioOutputs = devices.filter(device =>
        device.kind === 'audiooutput' &&
        device.deviceId !== 'default' &&
        device.deviceId !== ''
      );
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
        const device = await navigator.mediaDevices.selectAudioOutput();
        selectedAudioDeviceIdRef.current = device.deviceId;
        setCurrentAudioDevice(device.deviceId);

        // UIに選択されたデバイスを通知
        const deviceName = device.label || `デバイス ${device.deviceId.substring(0, 8)}...`;
        const nameEvent = new CustomEvent('audioOutputDeviceSelected', { detail: deviceName });
        window.dispatchEvent(nameEvent);

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
        const devices = await getAudioOutputDevices();

        if (devices.length > 0) {
          // カスタムイベントを発行してUIに通知
          const event = new CustomEvent('audioOutputDeviceListAvailable', { detail: devices });
          window.dispatchEvent(event);
        } else {
          console.warn('音声出力デバイスが見つかりませんでした');
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name !== 'NotAllowedError') {
          console.error('音声出力デバイスの選択に失敗:', err);
        }
      }
    }
  }, [audioOutputSupported, setAudioSinkId, getAudioOutputDevices]);

  // デバイスIDを直接設定する関数（UI側から呼び出される）
  const setOutputDevice = useCallback(async (deviceId: string) => {
    // 既定のデバイスIDは設定しない（状態不整合を防ぐため）
    if (deviceId === 'default' || deviceId === '') {
      console.warn('既定のデバイスIDは設定できません');
      return;
    }

    selectedAudioDeviceIdRef.current = deviceId;
    setCurrentAudioDevice(deviceId);

    // AudioContextにもデバイスを設定（Web Audio API使用時に必要）
    if (audioContextRef.current && 'setSinkId' in audioContextRef.current) {
      try {
        const extendedContext = audioContextRef.current as ExtendedAudioContext;
        if (extendedContext.setSinkId) {
          await extendedContext.setSinkId(deviceId);
        }
      } catch (err) {
        console.error('AudioContextのデバイス設定に失敗:', err);
      }
    }

    // 現在再生中のAudio要素に適用（Web Audio API未接続の場合のみ）
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

  // プレイリストの再生順序を事前計算
  const buildPlaybackOrder = useCallback((recordings: Recording[]) => {
    // 単純に0からrecordings.length-1までの配列を作成
    const order = recordings.map((_, index) => index);
    return order;
  }, []);

  // 録音リストを取得
  const fetchRecordings = useCallback(async () => {
    try {
      // 外部からrecordingsが渡されている場合は何もしない
      if (externalRecordings) {
        return;
      }

      // プレイリストIDが指定されていない場合は何もしない
      if (!playlistId) {
        return;
      }

      // プレイリストIDが指定されている場合はプレイリストの録音を取得
      const data = await getPlaylistRecordings(playlistId);

      // 再生中の場合はスナップショットを保持し続ける
      // 追加も削除も一切反映せず、プレイリストが一周するまで固定する
      if (playbackSnapshotRef.current && !hasCompletedPlaybackRef.current) {
        // 再生中は何も更新しない
        // recordingsRefもスナップショットを保持し続ける
        setError(null);
        return;
      }

      // プレイリストが完了した後、新しいプレイリストを取得
      if (hasCompletedPlaybackRef.current) {
        playbackSnapshotRef.current = [...data];
        recordingsRef.current = [...data];
        setRecordings(data);

        // 新しいプレイリストの再生順序を事前計算
        playbackOrderRef.current = buildPlaybackOrder(data);
        playbackPositionRef.current = 0;

        // hasCompletedPlaybackRefとindexの更新はswitchToNextTrackで行う
      } else {
        // 再生していない場合のみ更新
        setRecordings(data);
      }

      setError(null);
    } catch (err) {
      console.error('録音取得エラー:', err);
      setError(err instanceof Error ? err.message : '録音の取得に失敗しました');
    }
  }, [playlistId, buildPlaybackOrder, externalRecordings]);

  // 次のトラックに移動（再生順序配列を使用）
  const moveToNextTrack = useCallback(() => {
    if (playbackOrderRef.current.length === 0) return;

    // 次の再生位置を計算
    const nextPosition = playbackPositionRef.current + 1;

    // プレイリストが一周した場合（再生順序配列の最後に達した場合）
    if (nextPosition >= playbackOrderRef.current.length) {
      hasCompletedPlaybackRef.current = true;
      playbackSnapshotRef.current = null;
      // 一周完了時はインデックスを更新しない（switchToNextTrackで処理）
      return;
    }

    // 再生位置を更新
    playbackPositionRef.current = nextPosition;
    // 再生順序配列から実際のインデックスを取得
    const actualIndex = playbackOrderRef.current[nextPosition];
    currentIndexRef.current = actualIndex;
    setCurrentIndex(actualIndex);
  }, []);

  // 次のトラックをプリロード（再生順序配列を参照）
  const preloadNextTrack = useCallback(async () => {
    // プレイリスト一周完了時はプリロードしない（古いプレイリストのファイルをロードしないため）
    if (hasCompletedPlaybackRef.current) {
      return;
    }

    if (playbackOrderRef.current.length === 0) return;

    // 次の再生位置を取得
    const nextPosition = playbackPositionRef.current + 1;

    // 次の再生位置が再生順序配列の範囲外の場合（プレイリスト一周する場合）、プリロードしない
    if (nextPosition >= playbackOrderRef.current.length) {
      return;
    }

    // 再生順序配列から次の実際のインデックスを取得
    const nextIndex = playbackOrderRef.current[nextPosition];
    const nextRecording = recordingsRef.current[nextIndex];

    if (!nextRecording) return;

    // 次のAudio要素を作成/再利用
    if (!nextAudioRef.current) {
      nextAudioRef.current = new Audio();
      nextAudioRef.current.preload = 'auto';
      // Web Audio APIを使用する場合はCORS設定が必要
      nextAudioRef.current.crossOrigin = 'anonymous';

      // プリロード用のエラーハンドラを設定
      nextAudioRef.current.onerror = (e) => {
        console.error('次のトラックのプリロードエラー:', e);
        // プリロードエラーの場合はスキップして次のトラックを試す
      };
    }

    // Web Audio APIに接続して音量ノーマライゼーションを適用（既存の場合はGainを更新）
    connectAudioToWebAudio(nextAudioRef.current, nextRecording);

    // 毎回音声出力デバイスを設定（入れ替え後のAudio要素にも確実に設定）
    await setAudioSinkId(nextAudioRef.current).catch(err => {
      console.error('プリロード用Audio要素のデバイス設定エラー:', err);
    });

    const url = getRecordingUrl(nextRecording.file_path);
    nextAudioRef.current.src = url;
    nextAudioRef.current.load();
  }, [setAudioSinkId, connectAudioToWebAudio]);

  // 次のトラックに切り替えて再生
  const switchToNextTrack: () => Promise<void> = useCallback(async () => {
    if (isSwitching.current || recordingsRef.current.length === 0) return;

    isSwitching.current = true;

    // プレイリスト一周完了フラグをチェック
    if (hasCompletedPlaybackRef.current) {
      // 古いプリロードをクリア（古いプレイリストのファイルが残っている可能性があるため）
      if (nextAudioRef.current) {
        nextAudioRef.current.pause();
        nextAudioRef.current.src = '';
        nextAudioRef.current.onended = null;
        nextAudioRef.current.onerror = null;
      }

      // fetchRecordingsを呼び出して新しいプレイリストを取得
      // fetchRecordings内で再生順序が再計算される
      await fetchRecordings();

      // 確実にインデックスと再生位置を0にリセット
      playbackPositionRef.current = 0;
      const firstIndex = playbackOrderRef.current.length > 0 ? playbackOrderRef.current[0] : 0;
      currentIndexRef.current = firstIndex;
      setCurrentIndex(firstIndex);

      // フラグをリセット
      hasCompletedPlaybackRef.current = false;

      // 新しいプレイリストで最初のトラックを再生
      if (recordingsRef.current.length > 0 && playTrackRef.current) {
        // 少し待機してから再生（state更新が確実に反映されるように）
        await new Promise(resolve => setTimeout(resolve, 100));
        await playTrackRef.current(firstIndex);
      }

      isSwitching.current = false;
      return;
    }

    // まずインデックスを更新
    moveToNextTrack();

    // moveToNextTrackでhasCompletedPlaybackRef.currentがtrueになった場合、
    // 即座に新しいプレイリストをロードして再生を継続
    if (hasCompletedPlaybackRef.current) {
      // 古いプリロードをクリア
      if (nextAudioRef.current) {
        nextAudioRef.current.pause();
        nextAudioRef.current.src = '';
        nextAudioRef.current.onended = null;
        nextAudioRef.current.onerror = null;
      }

      // fetchRecordingsを呼び出して新しいプレイリストを取得
      await fetchRecordings();

      // 確実にインデックスと再生位置を0にリセット
      playbackPositionRef.current = 0;
      const firstIndex = playbackOrderRef.current.length > 0 ? playbackOrderRef.current[0] : 0;
      currentIndexRef.current = firstIndex;
      setCurrentIndex(firstIndex);

      // フラグをリセット
      hasCompletedPlaybackRef.current = false;

      // 新しいプレイリストで最初のトラックを再生
      if (recordingsRef.current.length > 0 && playTrackRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await playTrackRef.current(firstIndex);
      }

      isSwitching.current = false;
      return;
    }

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

      // 参照を入れ替え（Audio要素のみ。ノードはWeakMapで管理されているので不要）
      const tempAudio = currentAudioRef.current;
      currentAudioRef.current = nextAudioRef.current;
      nextAudioRef.current = tempAudio;

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

      // さらに次をプリロード（再生順序配列を参照）
      await preloadNextTrack();
    }

    isSwitching.current = false;
  }, [moveToNextTrack, preloadNextTrack, fetchRecordings]);

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
      // Web Audio APIを使用する場合はCORS設定が必要
      currentAudioRef.current.crossOrigin = 'anonymous';
      // 音声出力デバイスを設定
      await setAudioSinkId(currentAudioRef.current).catch(err => {
        console.error('Audio要素のデバイス設定エラー:', err);
      });
    }

    // Web Audio APIに接続して音量ノーマライゼーションを適用（既存の場合はGainを更新）
    connectAudioToWebAudio(currentAudioRef.current, recording);

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

    // 次のトラックをプリロード（再生順序配列を参照）
    preloadNextTrack();
  }, [setupAudioListeners, switchToNextTrack, preloadNextTrack, setAudioSinkId, connectAudioToWebAudio]);

  // playTrackの参照を常に最新に保つ
  useEffect(() => {
    playTrackRef.current = playTrack;
  }, [playTrack]);

  // 初回ロード時に録音を取得し、自動的にスナップショットを作成
  // 外部recordingsがある場合は、fetchRecordingsは何もしない
  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // 外部からrecordingsが渡された場合は、それをrecordings stateに設定
  useEffect(() => {
    if (externalRecordings) {
      // 前回の録音数と比較
      const previousCount = recordingsRef.current.length;
      const newCount = externalRecordings.length;

      // recordingsRefを更新
      recordingsRef.current = [...externalRecordings];
      setRecordings(externalRecordings);

      // 再生中で、録音が増えた場合（新規追加）、再生順序配列に追加
      if (playbackSnapshotRef.current && newCount > previousCount) {
        // スナップショットも更新（新しい録音を含める）
        playbackSnapshotRef.current = [...externalRecordings];

        // 追加された録音のインデックスを再生順序配列に追加
        const addedIndexes = [];
        for (let i = previousCount; i < newCount; i++) {
          addedIndexes.push(i);
        }
        playbackOrderRef.current = [...playbackOrderRef.current, ...addedIndexes];
      }

      // 録音の順序が変わった場合やLUFS値が変わった場合の処理
      // （録音数が同じでIDの順序が異なる、またはLUFS値が異なる）
      if (newCount === previousCount && playbackSnapshotRef.current) {
        // IDの配列を比較して並び替えを検出
        const oldIds = recordingsRef.current.map((r) => r.id);
        const newIds = externalRecordings.map((r) => r.id);
        const isReordered = oldIds.some((id, index) => id !== newIds[index]);

        if (isReordered) {
          // スナップショットを更新
          playbackSnapshotRef.current = [...externalRecordings];

          // 現在再生中の録音のIDを取得
          const currentRecordingId = recordingsRef.current[currentIndexRef.current]?.id;

          // 新しい順序での再生順序配列を再構築
          playbackOrderRef.current = buildPlaybackOrder(externalRecordings);

          // 現在再生中の録音の新しいインデックスを特定
          const newCurrentIndex = externalRecordings.findIndex((r) => r.id === currentRecordingId);
          if (newCurrentIndex !== -1) {
            currentIndexRef.current = newCurrentIndex;
            setCurrentIndex(newCurrentIndex);

            // 再生位置も更新（再生順序配列内での位置）
            const newPosition = playbackOrderRef.current.findIndex((idx) => idx === newCurrentIndex);
            if (newPosition !== -1) {
              playbackPositionRef.current = newPosition;
            }
          }

          // プリロードされた次の録音が並び替え後も正しいかチェック
          if (nextAudioRef.current && nextAudioRef.current.src) {
            // 並び替え後の次の録音を取得
            const newNextPosition = playbackPositionRef.current + 1;
            if (newNextPosition < playbackOrderRef.current.length) {
              const newNextIndex = playbackOrderRef.current[newNextPosition];
              const newNextRecording = externalRecordings[newNextIndex];

              // プリロード済みの録音が並び替え後の次の録音と一致しない場合はクリアして再プリロード
              // srcからファイルパスを抽出して比較
              const preloadedPath = nextAudioRef.current.src;
              const expectedPath = newNextRecording ? getRecordingUrl(newNextRecording.file_path) : null;

              if (preloadedPath !== expectedPath) {
                nextAudioRef.current.pause();
                nextAudioRef.current.src = '';

                // 新しい次の録音をプリロード
                if (!isSwitching.current && !hasCompletedPlaybackRef.current) {
                  preloadNextTrack();
                }
              }
            } else {
              // 次の録音がない場合（最後の録音）はプリロードをクリア
              nextAudioRef.current.pause();
              nextAudioRef.current.src = '';
            }
          }
        }

        // LUFS値の変更を検出（並び替えがない場合のみ）
        if (!isReordered) {
          // 各録音のLUFS値を比較
          const lufsChanges: { id: string; oldLufs: number | null | undefined; newLufs: number | null | undefined; index: number }[] = [];

        for (let i = 0; i < externalRecordings.length; i++) {
          const oldRecording = recordingsRef.current[i];
          const newRecording = externalRecordings[i];

          if (oldRecording && newRecording && oldRecording.id === newRecording.id) {
            if (oldRecording.lufs !== newRecording.lufs) {
              lufsChanges.push({
                id: newRecording.id,
                oldLufs: oldRecording.lufs,
                newLufs: newRecording.lufs,
                index: i,
              });
            }
          }
        }

        if (lufsChanges.length > 0) {
          // スナップショットを更新
          playbackSnapshotRef.current = [...externalRecordings];

          // 現在再生中の録音のLUFS値が変わった場合、Gainノードを更新
          const currentRecordingId = recordingsRef.current[currentIndexRef.current]?.id;
          const currentChange = lufsChanges.find((c) => c.id === currentRecordingId);

          if (currentChange && currentAudioRef.current) {
            const newRecording = externalRecordings[currentChange.index];

            // connectAudioToWebAudioを再度呼び出してGainノードを更新
            // この関数は既にノードが存在する場合はGainのみを更新する
            connectAudioToWebAudio(currentAudioRef.current, newRecording);
          }

          // プリロード済みの録音のLUFS値が変わった場合、Gainノードを更新
          if (nextAudioRef.current && nextAudioRef.current.src) {
            const nextPosition = playbackPositionRef.current + 1;
            if (nextPosition < playbackOrderRef.current.length) {
              const nextIndex = playbackOrderRef.current[nextPosition];
              const nextRecording = externalRecordings[nextIndex];

              if (nextRecording) {
                const nextChange = lufsChanges.find((c) => c.id === nextRecording.id);
                if (nextChange) {
                  // connectAudioToWebAudioを再度呼び出してGainノードを更新
                  connectAudioToWebAudio(nextAudioRef.current, nextRecording);
                }
              }
            }
          }
        }
        }
      }

      // 録音が削除された場合（newCount < previousCount）の処理
      if (newCount < previousCount && playbackSnapshotRef.current) {
        // 削除された録音のIDを特定
        const deletedRecordings = recordingsRef.current.filter(
          (oldRec) => !externalRecordings.some((newRec) => newRec.id === oldRec.id)
        );

        // スナップショットを更新
        playbackSnapshotRef.current = [...externalRecordings];

        // 削除された録音のインデックスを特定
        const deletedIndexes = deletedRecordings.map((deletedRec) => {
          return recordingsRef.current.findIndex((r) => r.id === deletedRec.id);
        });

        // 再生順序配列から削除されたインデックスを除外し、
        // 削除されたインデックスより大きいインデックスを調整
        const newPlaybackOrder = playbackOrderRef.current
          .filter((idx) => !deletedIndexes.includes(idx))
          .map((idx) => {
            // 削除されたインデックスより大きい場合は、削除された数だけ減算
            const adjustmentCount = deletedIndexes.filter((delIdx) => delIdx < idx).length;
            return idx - adjustmentCount;
          });

        playbackOrderRef.current = newPlaybackOrder;

        // 現在の再生位置を調整（削除されたインデックスより大きい場合は減算）
        const currentActualIndex = currentIndexRef.current;
        if (deletedIndexes.includes(currentActualIndex)) {
          // 現在再生中の録音が削除された場合は、次のトラックにスキップ
          // 現在のオーディオを停止
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.src = '';
          }
          // 次のトラックに切り替え
          if (switchToNextTrackRef.current && !isSwitching.current) {
            switchToNextTrackRef.current();
          }
        } else {
          // 現在のインデックスを調整（削除されたインデックスより大きい場合は減算）
          const adjustmentCount = deletedIndexes.filter((delIdx) => delIdx < currentActualIndex).length;
          const newCurrentIndex = currentActualIndex - adjustmentCount;
          currentIndexRef.current = newCurrentIndex;
          setCurrentIndex(newCurrentIndex);

          // 再生位置も調整（現在のインデックスが再生順序配列のどこにあるか）
          const newPosition = playbackOrderRef.current.findIndex((idx) => idx === newCurrentIndex);
          if (newPosition !== -1) {
            playbackPositionRef.current = newPosition;
          }
        }

        // プリロードされた録音が削除された場合はクリア
        if (nextAudioRef.current && nextAudioRef.current.src) {
          // 次の再生位置を取得
          const nextPosition = playbackPositionRef.current + 1;
          if (nextPosition < playbackOrderRef.current.length) {
            const nextIndex = playbackOrderRef.current[nextPosition];
            const nextRecording = externalRecordings[nextIndex];
            // プリロード済みの録音が削除された録音の場合はクリア
            const wasNextDeleted = deletedRecordings.some((deletedRec) => {
              return recordingsRef.current.findIndex((r) => r.id === deletedRec.id) === nextIndex + deletedIndexes.filter((delIdx) => delIdx <= nextIndex).length;
            });
            if (wasNextDeleted || !nextRecording) {
              nextAudioRef.current.pause();
              nextAudioRef.current.src = '';
              // 新しい次の録音をプリロード
              if (playTrackRef.current && !isSwitching.current && !hasCompletedPlaybackRef.current) {
                preloadNextTrack();
              }
            }
          }
        }
      }
    }
    // preloadNextTrackは含めると無限ループの可能性があるため除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRecordings]);

  // 録音が取得されたときにスナップショットを準備（再生はstartPlaybackで開始）
  // ただし、再生中は更新しない
  useEffect(() => {
    // 再生中は何もしない
    if (playbackSnapshotRef.current && !hasCompletedPlaybackRef.current) {
      return;
    }

    // 再生していない場合のみ、初期スナップショットを作成
    if (recordings.length > 0 && !playbackSnapshotRef.current) {
      playbackSnapshotRef.current = [...recordings];
      recordingsRef.current = [...recordings];

      // 初期再生順序を計算
      playbackOrderRef.current = buildPlaybackOrder(recordings);
      playbackPositionRef.current = 0;
    }
  }, [recordings, buildPlaybackOrder]);

  // 10秒ごとに録音リストを更新（外部recordingsがある場合は無効）
  useEffect(() => {
    // 外部recordingsがある場合は自動更新しない
    if (externalRecordings) {
      return;
    }

    fetchIntervalRef.current = setInterval(() => {
      fetchRecordings();
    }, 10000);

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, [fetchRecordings, externalRecordings]);

  // 再生を一時停止（現在位置を保持）
  const pausePlayback = useCallback(() => {
    console.log('再生を一時停止します');

    // オーディオを一時停止（srcはクリアしない）
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
    }

    setIsPlaying(false);
    // hasStartedPlayback.currentはtrueのまま（再開可能にするため）
    // needsUserInteractionもfalseのまま（再開可能にするため）
    // インデックスもそのまま保持
  }, []);

  // 再生をリセット
  const resetPlayback = useCallback(() => {
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
    playbackOrderRef.current = [];
    playbackPositionRef.current = 0;
    setCurrentIndex(0);
    setIsPlaying(false);
    setNeedsUserInteraction(true);
    // recordingsは削除しない（再生開始できるようにする）
    // setRecordings([]);
  }, []);

  // ユーザーインタラクション後に再生を開始または一時停止から再開
  const startPlayback = useCallback(async () => {
    if (recordings.length === 0) return;

    // AudioContextをresumeする（ユーザーインタラクション後に必要）
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    // 一時停止から再開の場合
    if (hasStartedPlayback.current) {
      // 現在のAudio要素がある場合は再開
      if (currentAudioRef.current && currentAudioRef.current.src) {
        currentAudioRef.current.play().catch((err) => {
          console.error('再生エラー:', err);
        });
      } else {
        // Audio要素がない場合は現在のインデックスから再生
        playTrack(currentIndexRef.current);
      }
      return;
    }

    // 初回再生の場合
    // スナップショットがまだなければ作成
    if (!playbackSnapshotRef.current) {
      playbackSnapshotRef.current = [...recordings];
      recordingsRef.current = [...recordings];

      // 再生順序を計算
      playbackOrderRef.current = buildPlaybackOrder(recordings);
      playbackPositionRef.current = 0;
    }

    hasStartedPlayback.current = true;
    hasCompletedPlaybackRef.current = false;
    setNeedsUserInteraction(false);

    // 最初のトラックを再生（再生順序配列の最初のインデックス）
    const firstIndex = playbackOrderRef.current.length > 0 ? playbackOrderRef.current[0] : 0;
    playTrack(firstIndex);
  }, [recordings, playTrack, buildPlaybackOrder]);

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
      // AudioContextをクローズ
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => {
          console.error('AudioContext close error:', err);
        });
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
    pausePlayback,
    resetPlayback,
    selectAudioOutput,
    setOutputDevice,
    currentAudioDevice,
    audioOutputSupported,
  };
};
