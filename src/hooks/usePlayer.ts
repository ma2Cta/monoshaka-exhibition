import { useState, useEffect, useRef, useCallback } from 'react';
import { getRecordingUrl, getPlaylistRecordings } from '@/lib/supabase';
import { Recording } from '@/lib/types';
import { calculateGainFromLufs } from '@/lib/audio-analysis';

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
      audioContextRef.current = new AudioContext();
      console.log('AudioContextを作成しました');
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
        console.log(`音量メタデータがないため、通常再生: ${recording.file_path}`);
        return null;
      }

      const context = getAudioContext();

      // 既にこのAudio要素に対してノードが作成されているか確認
      const existingNodes = audioToNodesMap.current.get(audio);
      if (existingNodes) {
        // Gainだけ更新
        const gainValue = calculateGainFromLufs(recording.lufs);
        existingNodes.gain.gain.value = gainValue;
        console.log(
          `Gain更新: ${recording.file_path} - LUFS: ${recording.lufs}, Gain: ${gainValue.toFixed(2)}`
        );
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
      console.log(
        `音量ノーマライゼーション適用: ${recording.file_path} - LUFS: ${recording.lufs}, Gain: ${gainValue.toFixed(2)}`
      );

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

        // デバイス名も保存
        const deviceName = device.label || `デバイス ${device.deviceId.substring(0, 8)}...`;
        localStorage.setItem('audioOutputDeviceName', deviceName);

        console.log(`選択されたデバイス: ${device.label} (${device.deviceId})`);

        // UIに選択されたデバイスを通知
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

  // プレイリストの再生順序を事前計算
  const buildPlaybackOrder = useCallback((recordings: Recording[]) => {
    // 単純に0からrecordings.length-1までの配列を作成
    const order = recordings.map((_, index) => index);
    console.log('再生順序を計算しました:', order);
    return order;
  }, []);

  // 録音リストを取得
  const fetchRecordings = useCallback(async () => {
    try {
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
        console.log('再生中のため、プレイリストの変更を無視します');
        setError(null);
        return;
      }

      // プレイリストが完了した後、新しいプレイリストを取得
      if (hasCompletedPlaybackRef.current) {
        console.log('プレイリストが一周しました。新しいプレイリストを取得:', data.length);
        playbackSnapshotRef.current = [...data];
        recordingsRef.current = [...data];
        setRecordings(data);

        // 新しいプレイリストの再生順序を事前計算
        playbackOrderRef.current = buildPlaybackOrder(data);
        playbackPositionRef.current = 0;
        console.log('新しい再生順序を設定:', playbackOrderRef.current);

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
  }, [playlistId, buildPlaybackOrder]);

  // 次のトラックに移動（再生順序配列を使用）
  const moveToNextTrack = useCallback(() => {
    if (playbackOrderRef.current.length === 0) return;

    // 次の再生位置を計算
    const nextPosition = playbackPositionRef.current + 1;

    // プレイリストが一周した場合（再生順序配列の最後に達した場合）
    if (nextPosition >= playbackOrderRef.current.length) {
      console.log('プレイリストが一周しました。新しいプレイリストに更新します。');
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

    console.log(`次のトラックに移動: 再生位置 ${nextPosition}/${playbackOrderRef.current.length}, 実際のインデックス ${actualIndex}`);
  }, []);

  // 次のトラックをプリロード（再生順序配列を参照）
  const preloadNextTrack = useCallback(async () => {
    // プレイリスト一周完了時はプリロードしない（古いプレイリストのファイルをロードしないため）
    if (hasCompletedPlaybackRef.current) {
      console.log('プレイリスト一周完了のため、プリロードをスキップします');
      return;
    }

    if (playbackOrderRef.current.length === 0) return;

    // 次の再生位置を取得
    const nextPosition = playbackPositionRef.current + 1;

    // 次の再生位置が再生順序配列の範囲外の場合（プレイリスト一周する場合）、プリロードしない
    if (nextPosition >= playbackOrderRef.current.length) {
      console.log('次のトラックがプレイリストの最後なので、プリロードをスキップします');
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
    console.log(`次のトラックをプリロード: 再生位置 ${nextPosition}/${playbackOrderRef.current.length}, 実際のインデックス ${nextIndex}`);
  }, [setAudioSinkId, connectAudioToWebAudio]);

  // 次のトラックに切り替えて再生
  const switchToNextTrack: () => Promise<void> = useCallback(async () => {
    if (isSwitching.current || recordingsRef.current.length === 0) return;

    isSwitching.current = true;

    // プレイリスト一周完了フラグをチェック
    if (hasCompletedPlaybackRef.current) {
      // 新しいプレイリストが読み込まれるまで待つ
      console.log('プレイリスト一周完了。新しいプレイリストの読み込みを待機中...');

      // 古いプリロードをクリア（古いプレイリストのファイルが残っている可能性があるため）
      if (nextAudioRef.current) {
        nextAudioRef.current.pause();
        nextAudioRef.current.src = '';
        nextAudioRef.current.onended = null;
        nextAudioRef.current.onerror = null;
        console.log('プリロード済みの古いトラックをクリアしました');
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
        console.log('新しいプレイリストで再生を再開:', recordingsRef.current.length, '再生位置: 0, インデックス:', firstIndex);
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
      console.log('プレイリスト一周完了フラグが立ちました。即座に新しいプレイリストをロードします');

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
        console.log('新しいプレイリストで再生を継続:', recordingsRef.current.length, '再生位置: 0, インデックス:', firstIndex);
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
  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // 録音が取得されたときにスナップショットを準備（再生はstartPlaybackで開始）
  // ただし、再生中は更新しない
  useEffect(() => {
    // 再生中は何もしない
    if (playbackSnapshotRef.current && !hasCompletedPlaybackRef.current) {
      return;
    }

    // 再生していない場合のみ、初期スナップショットを作成
    if (recordings.length > 0 && !playbackSnapshotRef.current) {
      console.log('プレイリストのスナップショットを準備:', recordings.length);
      playbackSnapshotRef.current = [...recordings];
      recordingsRef.current = [...recordings];

      // 初期再生順序を計算
      playbackOrderRef.current = buildPlaybackOrder(recordings);
      playbackPositionRef.current = 0;
      console.log('初期再生順序を設定:', playbackOrderRef.current);
    }
  }, [recordings, buildPlaybackOrder]);

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
    playbackOrderRef.current = [];
    playbackPositionRef.current = 0;
    setCurrentIndex(0);
    setIsPlaying(false);
    setNeedsUserInteraction(true);
    // recordingsは削除しない（再生開始できるようにする）
    // setRecordings([]);
  }, []);

  // ユーザーインタラクション後に再生を開始
  const startPlayback = useCallback(async () => {
    if (recordings.length === 0) return;
    if (hasStartedPlayback.current) return;

    console.log('再生を開始します:', recordings.length);

    // AudioContextをresumeする（ユーザーインタラクション後に必要）
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
      console.log('AudioContextをresumeしました');
    }

    // スナップショットがまだなければ作成
    if (!playbackSnapshotRef.current) {
      playbackSnapshotRef.current = [...recordings];
      recordingsRef.current = [...recordings];

      // 再生順序を計算
      playbackOrderRef.current = buildPlaybackOrder(recordings);
      playbackPositionRef.current = 0;
      console.log('再生開始時の再生順序を設定:', playbackOrderRef.current);
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
    resetPlayback,
    selectAudioOutput,
    setOutputDevice,
    currentAudioDevice,
    audioOutputSupported,
  };
};
