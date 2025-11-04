-- 並び替え関数の権限を認証済みユーザーのみに制限
-- Supabase Authを使用しているため、anonロールからのアクセスは拒否する

-- 既存の権限を全て取り消し
REVOKE EXECUTE ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) FROM anon;

-- 認証済みユーザーのみに権限を付与
GRANT EXECUTE ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) TO authenticated;

-- セキュリティに関するコメントを更新
COMMENT ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) IS
'プレイリスト内の録音を並び替える関数。
セキュリティ:
1. 認証済みユーザー（authenticated）のみが実行可能
2. 指定されたrecording_idsがplaylist_idに実際に属しているかバリデーション
3. middlewareでもSupabase Authによる認証チェックを実施（多層防御）';
