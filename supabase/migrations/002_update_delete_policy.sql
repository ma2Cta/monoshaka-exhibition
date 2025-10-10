-- 削除ポリシーの更新
-- BASIC認証を使用するため、RLSの削除ポリシーを全員に許可
-- （管理画面はBASIC認証で保護されているため安全）

-- 既存の削除ポリシーを削除
DROP POLICY IF EXISTS "recordings_delete_admin" ON recordings;
DROP POLICY IF EXISTS "recordings_delete_admin" ON storage.objects;

-- 新しい削除ポリシー: 全員が削除可能（BASIC認証で保護済み）
CREATE POLICY "recordings_delete_all" ON recordings
  FOR DELETE USING (true);

-- ストレージの削除ポリシー: 全員が削除可能（BASIC認証で保護済み）
CREATE POLICY "recordings_storage_delete_all" ON storage.objects
  FOR DELETE USING (bucket_id = 'recordings');
