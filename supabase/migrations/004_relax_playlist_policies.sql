-- プレイリスト関連のRLSポリシーを緩和
-- BASIC認証で保護されている管理画面からの操作を許可

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "playlists_insert_admin" ON playlists;
DROP POLICY IF EXISTS "playlists_update_admin" ON playlists;
DROP POLICY IF EXISTS "playlists_delete_admin" ON playlists;
DROP POLICY IF EXISTS "playlist_recordings_insert_admin" ON playlist_recordings;
DROP POLICY IF EXISTS "playlist_recordings_delete_admin" ON playlist_recordings;

-- 新しいポリシー: playlists - 全員が作成・更新・削除可能
-- （実際はBASIC認証で保護されている）
CREATE POLICY "playlists_insert_all" ON playlists
  FOR INSERT WITH CHECK (true);

CREATE POLICY "playlists_update_all" ON playlists
  FOR UPDATE USING (true);

CREATE POLICY "playlists_delete_all" ON playlists
  FOR DELETE USING (true);

-- 新しいポリシー: playlist_recordings - 全員が作成・削除可能
CREATE POLICY "playlist_recordings_insert_all" ON playlist_recordings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "playlist_recordings_delete_all" ON playlist_recordings
  FOR DELETE USING (true);
