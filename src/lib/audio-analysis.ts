/**
 * 音量最適化ユーティリティ
 * Web Audio APIを使用して音声ファイルの音量レベルを解析します
 */

export interface VolumeMetadata {
  lufs: number;      // ラウドネス値（LUFS相当）
  peak: number;      // ピークレベル（0.0〜1.0）
  rms: number;       // RMS平均レベル
}

/**
 * 音声ファイルの音量レベルを解析する
 * @param file 音声ファイル（File または Blob）
 * @returns 音量メタデータ（LUFS、ピーク、RMS）
 */
export async function analyzeAudioVolume(file: File | Blob): Promise<VolumeMetadata> {
  // AudioContextを作成
  const audioContext = new AudioContext();

  try {
    // Fileを ArrayBuffer に変換
    const arrayBuffer = await file.arrayBuffer();

    // デコードして AudioBuffer を取得
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // すべてのチャンネルを解析（モノラル/ステレオ対応）
    let globalPeak = 0;
    let globalRmsSum = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);

      // ピークレベルを計算
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > globalPeak) {
          globalPeak = abs;
        }
      }

      // RMS（Root Mean Square）を計算
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] * channelData[i];
      }
      globalRmsSum += sumSquares / channelData.length;
    }

    // 平均RMS（複数チャンネルの場合）
    const rms = Math.sqrt(globalRmsSum / audioBuffer.numberOfChannels);

    // LUFS近似値（簡易版: ITU-R BS.1770の簡略化）
    // 実際のLUFSはK-weightingフィルタとゲート処理が必要ですが、
    // 簡易版としてRMSベースで計算
    // -0.691は参照レベルの調整値
    const lufs = rms > 0 ? 20 * Math.log10(rms) - 0.691 : -70;

    return {
      lufs: Math.round(lufs * 10) / 10,           // 小数第1位まで
      peak: Math.round(globalPeak * 1000) / 1000, // 小数第3位まで
      rms: Math.round(rms * 1000) / 1000,         // 小数第3位まで
    };
  } finally {
    // AudioContextをクリーンアップ（メモリリーク防止）
    await audioContext.close();
  }
}

/**
 * LUFS値から再生時のGain値を計算する
 * @param recordingLufs 録音のLUFS値
 * @param targetLufs ターゲットLUFS値（デフォルト: -16 LUFS）
 * @returns Gain値（0.0〜2.0程度）
 */
export function calculateGainFromLufs(
  recordingLufs: number | null | undefined,
  targetLufs: number = -16
): number {
  // LUFS値がない場合はゲインを適用しない
  if (recordingLufs == null) {
    return 1.0;
  }

  // LUFS差分からゲインを計算
  // gain = 10^((target - current) / 20)
  const gainDb = targetLufs - recordingLufs;
  const gain = Math.pow(10, gainDb / 20);

  // 極端な値を制限（0.1〜3.0倍の範囲に制限）
  return Math.max(0.1, Math.min(3.0, gain));
}
