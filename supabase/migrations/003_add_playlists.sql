-- プレイリスト機能の追加
-- プレイリストと録音の関連を管理するテーブルを作成

-- playlists テーブル
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_playlists_is_active ON playlists(is_active);

-- playlist_recordings テーブル
CREATE TABLE IF NOT EXISTS playlist_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(playlist_id, recording_id),
  UNIQUE(playlist_id, order_index)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_playlist_recordings_playlist_id ON playlist_recordings(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_recordings_recording_id ON playlist_recordings(recording_id);
CREATE INDEX IF NOT EXISTS idx_playlist_recordings_order ON playlist_recordings(playlist_id, order_index);

-- is_activeがtrueのプレイリストを1つだけにするトリガー関数
CREATE OR REPLACE FUNCTION ensure_single_active_playlist()
RETURNS TRIGGER AS $$
BEGIN
  -- 新しくis_activeをtrueにする場合、他のプレイリストをfalseにする
  IF NEW.is_active = true THEN
    UPDATE playlists
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
DROP TRIGGER IF EXISTS trigger_ensure_single_active_playlist ON playlists;
CREATE TRIGGER trigger_ensure_single_active_playlist
  BEFORE INSERT OR UPDATE ON playlists
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_playlist();

-- updated_atを自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
DROP TRIGGER IF EXISTS trigger_update_playlists_updated_at ON playlists;
CREATE TRIGGER trigger_update_playlists_updated_at
  BEFORE UPDATE ON playlists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) を有効化
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_recordings ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー: playlists - 全員が読み取り可能
CREATE POLICY "playlists_select_all" ON playlists
  FOR SELECT USING (true);

-- RLS ポリシー: playlists - 認証済みユーザーのみ挿入可能
CREATE POLICY "playlists_insert_admin" ON playlists
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS ポリシー: playlists - 認証済みユーザーのみ更新可能
CREATE POLICY "playlists_update_admin" ON playlists
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS ポリシー: playlists - 認証済みユーザーのみ削除可能
CREATE POLICY "playlists_delete_admin" ON playlists
  FOR DELETE USING (auth.role() = 'authenticated');

-- RLS ポリシー: playlist_recordings - 全員が読み取り可能
CREATE POLICY "playlist_recordings_select_all" ON playlist_recordings
  FOR SELECT USING (true);

-- RLS ポリシー: playlist_recordings - 認証済みユーザーのみ挿入可能
CREATE POLICY "playlist_recordings_insert_admin" ON playlist_recordings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS ポリシー: playlist_recordings - 認証済みユーザーのみ削除可能
CREATE POLICY "playlist_recordings_delete_admin" ON playlist_recordings
  FOR DELETE USING (auth.role() = 'authenticated');
