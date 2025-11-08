-- 音量ノーマライゼーション用のメタデータカラムを追加
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS lufs FLOAT,
ADD COLUMN IF NOT EXISTS peak_level FLOAT,
ADD COLUMN IF NOT EXISTS rms_level FLOAT;

-- カラムにコメントを追加
COMMENT ON COLUMN recordings.lufs IS 'ラウドネス値（LUFS: Loudness Units relative to Full Scale）';
COMMENT ON COLUMN recordings.peak_level IS 'ピークレベル（0.0〜1.0）';
COMMENT ON COLUMN recordings.rms_level IS 'RMS平均レベル（Root Mean Square）';
