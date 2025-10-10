-- 文字起こし機能の追加
-- recordingsテーブルにtranscriptionカラムを追加

ALTER TABLE recordings
ADD COLUMN transcription TEXT;
