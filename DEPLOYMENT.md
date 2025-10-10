# デプロイメントガイド

このドキュメントでは、Vercelへの本番デプロイ手順を説明します。

## 前提条件

- Supabaseアカウント
- Vercelアカウント
- Supabase CLIインストール済み
- Vercel CLIインストール済み

```bash
npm install -g supabase vercel
```

## 1. Supabase本番プロジェクトのセットアップ

### 1.1 Supabaseプロジェクトを作成

1. [Supabase Dashboard](https://app.supabase.com)にアクセス
2. 「New project」をクリック
3. プロジェクト名を入力（例: `monoshaka-exhibition`）
4. データベースパスワードを設定（安全に保管）
5. リージョンを選択（推奨: `Singapore` または `Tokyo`）
6. 「Create new project」をクリック

### 1.2 ローカルプロジェクトとSupabaseをリンク

```bash
# Supabaseにログイン
npx supabase login

# プロジェクトをリンク
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

**プロジェクトREFの取得方法:**
- Supabase Dashboard > Settings > General > Reference ID

**重要:**
- リンク後、`.supabase/` ディレクトリが作成されます
- このディレクトリはGitにコミットしてください（Vercelビルド時に必要）
- リンク情報には機密情報は含まれていません

### 1.3 マイグレーションを本番環境にプッシュ

```bash
# マイグレーションを実行
npx supabase db push --linked
```

これにより、`supabase/migrations/`内のすべてのマイグレーションファイルが本番データベースに適用されます。

**現在のマイグレーション:**
- `001_initial_schema.sql`: 初期データベーススキーマ
- `002_update_delete_policy.sql`: 削除ポリシーの更新（BASIC認証対応）

### 1.4 環境変数を取得

Supabase Dashboard > Settings > API で以下を取得:

- **Project URL**: `https://xxxxx.supabase.co`
- **Anon public key**: `eyJhbGc...`（長い文字列）

これらは後でVercelに設定します。

## 2. Vercelプロジェクトのセットアップ

### 2.1 Vercelにログイン

```bash
npx vercel login
```

### 2.2 プロジェクトをリンク（初回のみ）

```bash
npx vercel link
```

プロンプトに従って設定:
- **Set up and deploy**: `Y`
- **Which scope**: 自分のアカウントを選択
- **Link to existing project**: `N`（初回の場合）
- **Project name**: `monoshaka-exhibition` など

### 2.3 環境変数を設定

Vercel CLIを使って環境変数を設定します:

```bash
# 本番環境用
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# 値を入力: https://xxxxx.supabase.co

npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# 値を入力: eyJhbGc... (Anon public key)

# 管理画面のBASIC認証
npx vercel env add ADMIN_USERNAME production
# 値を入力: admin（または任意のユーザー名）

npx vercel env add ADMIN_PASSWORD production
# 値を入力: 安全なパスワード

# プレビュー環境用（オプション）
npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
npx vercel env add ADMIN_USERNAME preview
npx vercel env add ADMIN_PASSWORD preview

# 開発環境用（オプション）
npx vercel env add NEXT_PUBLIC_SUPABASE_URL development
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development
npx vercel env add ADMIN_USERNAME development
npx vercel env add ADMIN_PASSWORD development
```

### 2.4 Supabaseアクセストークンを設定（マイグレーション用）

ビルド時にマイグレーションを実行するため、SupabaseのアクセストークンをVercelに設定します:

```bash
# Supabaseアクセストークンを取得
npx supabase login

# トークンを環境変数として設定
npx vercel env add SUPABASE_ACCESS_TOKEN production
# 値を入力: sbp_xxxxx... (Supabaseのアクセストークン)
```

**アクセストークンの取得方法:**
- `npx supabase login` 実行後、`~/.supabase/access-token` に保存されています
- または、Supabase Dashboard > Account > Access Tokens で新規作成

### 2.5 ビルドコマンドを設定

プロジェクトルートに `vercel.json` が既に作成されています:

```json
{
  "buildCommand": "npm run build:vercel",
  "installCommand": "npm install"
}
```

**build:vercelスクリプトの動作:**
1. `npx supabase db push --linked` でマイグレーションを実行
2. `next build --turbopack` でNext.jsアプリをビルド

**重要:** Vercelビルド環境で `npx supabase` コマンドを実行するため、Supabaseアクセストークンが必要です。

## 3. デプロイ

### 3.1 初回デプロイ

```bash
# プレビューデプロイ
npx vercel

# 本番デプロイ
npx vercel --prod
```

### 3.2 Git連携での自動デプロイ（推奨）

1. GitHubにプッシュ
2. Vercel Dashboard > Git Integration で連携
3. 以降、`main`ブランチへのプッシュで自動デプロイ

## 4. デプロイ後の確認

### 4.1 動作確認

1. デプロイされたURLにアクセス
2. 録音機能をテスト
3. Supabase Dashboard > Storage で録音ファイルが保存されているか確認
4. Supabase Dashboard > Table Editor > `recordings` でレコードが作成されているか確認

### 4.2 ストレージバケットの確認

Supabase Dashboard > Storage > `recordings` バケットが存在し、Publicアクセスが有効になっているか確認。

## 5. 環境変数の管理

### ローカル開発環境

`.env.local` を使用（Gitにコミットしない）:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

### 本番環境

Vercel CLIまたはDashboardで管理:

```bash
# 環境変数の一覧を確認
npx vercel env ls

# 環境変数を取得
npx vercel env pull .env.production

# 環境変数を削除
npx vercel env rm VARIABLE_NAME production
```

## 6. マイグレーションの管理

### 新しいマイグレーションを作成

```bash
# マイグレーションファイルを作成
npx supabase migration new <migration_name>
```

### 本番環境に適用

```bash
# ローカルでテスト
npx supabase db reset

# 本番環境にプッシュ
npx supabase db push --linked
```

### ビルド時の自動マイグレーション

Vercelデプロイ時、`package.json`の`build:vercel`スクリプトが自動実行されます:

```json
"build:vercel": "npm run db:migrate:prod && next build --turbopack",
"db:migrate:prod": "npx supabase db push --linked"
```

**動作の仕組み:**
1. Vercelビルド時に `npm run build:vercel` が実行される
2. `npx supabase db push --linked` が実行され、`supabase/migrations/` 内のSQLファイルが本番DBに適用される
3. `npx` が自動的にSupabase CLIをダウンロード・実行（バイナリは一時的にキャッシュされます）
4. マイグレーション成功後、Next.jsアプリがビルドされる

**必須環境変数:**
- `SUPABASE_ACCESS_TOKEN`: Supabaseへの認証に必要
- プロジェクトは事前に `npx supabase link` でリンクされている必要があります

**リンク情報の保存:**
- `npx supabase link` を実行すると、`.supabase/` ディレクトリにリンク情報が保存されます
- このディレクトリはGitにコミットする必要があります（`.supabase/.gitignore` で重要なファイルは除外されています）

## トラブルシューティング

### ビルドエラー: Supabaseリンクが見つからない

**原因1**: `SUPABASE_ACCESS_TOKEN`が設定されていない

**解決策**:
```bash
npx vercel env add SUPABASE_ACCESS_TOKEN production
```

**原因2**: `.supabase/` ディレクトリがGitにコミットされていない

**解決策**:
```bash
# .supabaseディレクトリを確認
ls -la .supabase/

# 存在しない場合は、ローカルでリンクを作成
npx supabase link --project-ref <YOUR_PROJECT_REF>

# Gitにコミット
git add .supabase/
git commit -m "Add Supabase link configuration"
git push
```

### ストレージアップロードエラー

**原因**: `recordings`バケットが存在しないか、RLSポリシーが正しくない

**解決策**:
1. Supabase Dashboardでバケット確認
2. マイグレーションを再実行: `npx supabase db push --linked`

### 環境変数が反映されない

**原因**: Vercelでの環境変数設定後、再デプロイが必要

**解決策**:
```bash
npx vercel --prod --force
```

## 参考リンク

- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
