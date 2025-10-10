-- 初期データベーススキーマ
-- 録音データ用のテーブル作成

-- recordings テーブル
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  duration FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at);

-- Row Level Security (RLS) を有効化
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー: 全員が読み取り可能
CREATE POLICY "recordings_select_all" ON recordings
  FOR SELECT USING (true);

-- RLS ポリシー: 全員が挿入可能
CREATE POLICY "recordings_insert_all" ON recordings
  FOR INSERT WITH CHECK (true);

-- RLS ポリシー: 認証済みユーザーのみ削除可能
CREATE POLICY "recordings_delete_admin" ON recordings
  FOR DELETE USING (auth.role() = 'authenticated');

-- ストレージバケット「recordings」を作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', true)
ON CONFLICT (id) DO NOTHING;

-- ストレージポリシー: 全員がファイルをアップロード可能
CREATE POLICY "recordings_upload_all" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'recordings');

-- ストレージポリシー: 全員がファイルを読み取り可能
CREATE POLICY "recordings_read_all" ON storage.objects
  FOR SELECT USING (bucket_id = 'recordings');

-- ストレージポリシー: 認証済みユーザーのみファイルを削除可能
CREATE POLICY "recordings_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'recordings' AND
    auth.role() = 'authenticated'
  );
