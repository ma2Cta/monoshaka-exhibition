-- RLSポリシーの修正: Supabase Authentication対応
-- BASIC認証は実装されていないため、全てのポリシーを auth.role() = 'authenticated' に修正
-- 全ての操作（SELECT/INSERT/UPDATE/DELETE）は認証済みユーザーのみに制限

-- ==========================================
-- recordingsテーブルのポリシー修正
-- ==========================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS recordings_select_all ON recordings;
DROP POLICY IF EXISTS recordings_insert_all ON recordings;
DROP POLICY IF EXISTS recordings_update_all ON recordings;
DROP POLICY IF EXISTS recordings_delete_all ON recordings;

-- 新しいポリシーを作成（認証済みユーザーのみ）
CREATE POLICY recordings_select_authenticated ON recordings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY recordings_insert_authenticated ON recordings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY recordings_update_authenticated ON recordings
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY recordings_delete_authenticated ON recordings
  FOR DELETE USING (auth.role() = 'authenticated');

-- ==========================================
-- playlistsテーブルのポリシー修正
-- ==========================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS playlists_select_all ON playlists;
DROP POLICY IF EXISTS playlists_insert_all ON playlists;
DROP POLICY IF EXISTS playlists_update_all ON playlists;
DROP POLICY IF EXISTS playlists_delete_all ON playlists;

-- 新しいポリシーを作成（認証済みユーザーのみ）
CREATE POLICY playlists_select_authenticated ON playlists
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY playlists_insert_authenticated ON playlists
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY playlists_update_authenticated ON playlists
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY playlists_delete_authenticated ON playlists
  FOR DELETE USING (auth.role() = 'authenticated');

-- ==========================================
-- playlist_recordingsテーブルのポリシー修正
-- ==========================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS playlist_recordings_select_all ON playlist_recordings;
DROP POLICY IF EXISTS playlist_recordings_insert_all ON playlist_recordings;
DROP POLICY IF EXISTS playlist_recordings_update_all ON playlist_recordings;
DROP POLICY IF EXISTS playlist_recordings_delete_all ON playlist_recordings;

-- 新しいポリシーを作成（認証済みユーザーのみ）
CREATE POLICY playlist_recordings_select_authenticated ON playlist_recordings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY playlist_recordings_insert_authenticated ON playlist_recordings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY playlist_recordings_update_authenticated ON playlist_recordings
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY playlist_recordings_delete_authenticated ON playlist_recordings
  FOR DELETE USING (auth.role() = 'authenticated');

-- ==========================================
-- storage.objectsのポリシー修正
-- ==========================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS recordings_read_all ON storage.objects;
DROP POLICY IF EXISTS recordings_upload_all ON storage.objects;
DROP POLICY IF EXISTS recordings_storage_delete_all ON storage.objects;

-- 新しいポリシーを作成（認証済みユーザーのみ）
CREATE POLICY recordings_read_authenticated ON storage.objects
  FOR SELECT USING (
    bucket_id = 'recordings' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY recordings_upload_authenticated ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'recordings' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY recordings_storage_delete_authenticated ON storage.objects
  FOR DELETE USING (
    bucket_id = 'recordings' AND
    auth.role() = 'authenticated'
  );

-- ==========================================
-- コメント: セキュリティ方針
-- ==========================================

COMMENT ON TABLE recordings IS 'ユーザーの録音データ。全ての操作は認証済みユーザーのみ許可。';
COMMENT ON TABLE playlists IS 'プレイリスト情報。全ての操作は認証済みユーザーのみ許可。';
COMMENT ON TABLE playlist_recordings IS 'プレイリストと録音の関連。全ての操作は認証済みユーザーのみ許可。';
