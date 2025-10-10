# 削除機能の修正手順

## 問題
管理画面で録音を削除しても、リロードすると復活する。

## 原因
SupabaseのRow Level Security (RLS)ポリシーで、削除には認証が必要だが、BASIC認証では認証状態にならない。

## 解決方法

### ローカル環境（Supabase CLIを使用している場合）

```bash
# データベースをリセット（すべてのマイグレーションを再適用）
npx supabase db reset
```

**注意:** これによりローカルのデータベースがリセットされ、すべてのデータが削除されます。

### 本番環境（Supabase Cloudを使用している場合）

#### 方法1: Supabase CLI経由
```bash
# プロジェクトにリンク
npx supabase link --project-ref YOUR_PROJECT_REF

# マイグレーションを適用
npx supabase db push --linked
```

#### 方法2: Supabase Dashboard経由（SQL Editor）
1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. プロジェクトを選択
3. SQL Editor を開く
4. 以下のSQLを実行:

```sql
-- 既存の削除ポリシーを削除
DROP POLICY IF EXISTS "recordings_delete_admin" ON recordings;
DROP POLICY IF EXISTS "recordings_delete_admin" ON storage.objects;

-- 新しい削除ポリシー: 全員が削除可能（BASIC認証で保護済み）
CREATE POLICY "recordings_delete_all" ON recordings
  FOR DELETE USING (true);

-- ストレージの削除ポリシー: 全員が削除可能（BASIC認証で保護済み）
CREATE POLICY "recordings_storage_delete_all" ON storage.objects
  FOR DELETE USING (bucket_id = 'recordings');
```

5. "Run"ボタンをクリックして実行

## 確認方法

1. 開発サーバーを起動: `npm run dev`
2. ブラウザで `/admin` にアクセス
3. BASIC認証でログイン
4. 録音を削除
5. ブラウザの開発者ツールのConsoleタブを開いて、ログを確認:
   - `削除開始:` が表示される
   - `データベース削除結果:` でエラーがないことを確認
   - `Storage削除結果:` でエラーがないことを確認
   - `削除完了` が表示される
6. ページをリロード
7. 削除した録音が表示されないことを確認

## トラブルシューティング

### エラーログの確認
ブラウザの開発者ツール（F12）のConsoleタブで、以下のようなエラーがないか確認:

- `データベース削除エラー: new row violates row-level security policy`
  → マイグレーションが適用されていない

- `ストレージ削除エラー: ...`
  → Storageのポリシーが適用されていない

### まだ削除できない場合
現在のRLSポリシーを確認:

```sql
-- recordingsテーブルのポリシーを確認
SELECT * FROM pg_policies WHERE tablename = 'recordings';

-- storage.objectsのポリシーを確認
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```

削除ポリシー（DELETE用）が存在し、`USING`句が`true`になっていることを確認してください。
