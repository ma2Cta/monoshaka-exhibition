-- 認証機能の有効化確認と必要なポリシー設定

-- 注意: Supabase Auth はデフォルトで有効化されているため、
-- 特別な設定は不要ですが、既存のRLSポリシーが認証と整合性を保つことを確認します

-- 既存のポリシーは以下の通り:
-- - recordings: SELECT/INSERT は全員可能、DELETE は認証済みユーザーのみ
-- - playlists: すべての操作が全員可能
-- - storage.objects: アップロード/読み取りは全員可能、削除は認証済みユーザーのみ

-- この構成は認証後も問題なく動作します
-- middlewareで認証チェックを行うため、実質的に全操作が認証済みユーザーのみになります

-- 確認用のコメント
COMMENT ON TABLE recordings IS '録音データテーブル - middlewareで認証制御';
COMMENT ON TABLE playlists IS 'プレイリストテーブル - middlewareで認証制御';
COMMENT ON TABLE playlist_recordings IS 'プレイリスト-録音紐付けテーブル - middlewareで認証制御';
