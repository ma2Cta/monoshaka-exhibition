This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 芸術祭展示用録音アプリケーション

来場者が小説の一節を録音し、それを連続ループ再生する展示用Webアプリケーションです。

### 主な機能

- 📱 録音機能（来場者向け）
- 🔊 自動連続再生（展示ディスプレイ向け）
- ⚙️ プレイリスト管理（管理者向け）
- 📝 **AI文字起こし機能**（OpenAI Whisper API使用）

## Getting Started

### 1. 環境変数の設定

`.env.local`ファイルに以下の環境変数を設定してください：

```bash
# 管理画面のログイン情報
ADMIN_USERNAME="monoshaka"
ADMIN_PASSWORD="exhibition"

# Supabase設定（ローカル開発用）
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-local-anon-key"
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_KEY=your-local-service-role-key

# 文字起こし機能用（オプション）
OPENAI_API_KEY=your-openai-api-key-here
```

**文字起こし機能を使用する場合：**
1. [OpenAI Platform](https://platform.openai.com/api-keys)でAPIキーを取得
2. `.env.local`の`OPENAI_API_KEY`に設定

### 2. 依存関係のインストール

```bash
npm install
```

### 3. ローカルデータベースの起動

```bash
npx supabase start
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 使い方

### 管理画面（/admin）

管理画面では以下の操作が可能です：

1. **プレイリスト管理**
   - プレイリストの作成・削除
   - 有効なプレイリストの切り替え
   - プレイリスト詳細ページへのアクセス

2. **プレイリスト詳細ページ（/admin/playlists/[id]）**
   - 音声ファイルの一括アップロード
   - 録音の再生・削除
   - **文字起こしの生成・編集**
   - 再生順序の変更（ドラッグ&ドロップ）

### 文字起こし機能の使い方

管理画面の録音一覧で、各録音に対して以下の操作ができます：

1. **文字起こしを生成**
   - 録音に文字起こしがない場合、「生成」ボタンをクリック
   - OpenAI Whisper APIが自動的に日本語の文字起こしを生成
   - 生成には数秒〜数十秒かかります（音声の長さによる）

2. **文字起こしを編集**
   - 既に文字起こしがある場合、「編集」ボタンをクリック
   - テキストエリアで自由に編集可能
   - 「保存」ボタンで変更を保存

3. **コスト**
   - OpenAI Whisper API: 約$0.006/分（1分の録音で約0.9円）
   - 例: 100件の1分録音 = 約90円

### 録音画面（/record）

来場者が使用する画面：
- マイクボタンで録音開始・停止
- 自動的にSupabaseにアップロード
- アクティブなプレイリストに追加

### 再生画面（/play）

展示ディスプレイで使用する画面：
- アクティブなプレイリストの録音を連続ループ再生
- 自動的に次の録音へ移行

## データベース管理

### ローカルDBのマイグレーション
```bash
npm run db:migrate:local
```

**注意:** `npx supabase db reset`や`npx supabase db push`は直接使用しないでください。

### リモートDBのマイグレーション（本番環境のみ）
```bash
npm run db:migrate:remote
```

**警告:** 開発段階では絶対にリモートDBのマイグレーションを実行しないでください。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
