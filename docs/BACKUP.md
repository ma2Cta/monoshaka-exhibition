# バックアップシステムドキュメント

## 概要

このプロジェクトでは、Supabase Storage上の録音ファイルを保護するために、GitHub Actionsを使用した自動バックアップシステムを実装しています。

### 重要な背景

**Supabase ProのPITR（Point-in-Time Recovery）の制限**
- Supabase ProのPITRは**データベースのみ**が対象です
- **Storageのファイル（録音ファイル）は対象外**です
- バケットやファイルを誤って削除すると**復元不可能**です

そのため、独自のバックアップシステムが必須となります。

---

## バックアップ戦略

### 日次差分バックアップ

- **実行頻度**: 毎日深夜2時（JST）に自動実行
- **バックアップ対象**: 過去24時間以内に作成された録音ファイルとメタデータ
- **保存先**: GitHub Releases（Draft状態）
- **保持期間**: 90日間（それ以降は自動削除）

### 容量見積もり

想定される使用量：
- 1日あたり: 約6.4MB（20人 × 20秒 × 128kbps）
- 90日分: 約576MB

---

## セットアップ手順

### 1. GitHubシークレットの設定

リポジトリに以下のシークレットを設定する必要があります：

1. GitHubリポジトリページを開く
2. `Settings` → `Secrets and variables` → `Actions` をクリック
3. `New repository secret` をクリック
4. 以下の2つのシークレットを追加：

#### `SUPABASE_URL`
- **値**: Supabase プロジェクトのURL
- **取得方法**:
  1. Supabaseダッシュボードを開く
  2. `Settings` → `API`
  3. "Project URL" をコピー
  4. 例: `https://abcdefghijk.supabase.co`

#### `SUPABASE_SERVICE_KEY`
- **値**: Supabase Service Role Key
- **取得方法**:
  1. Supabaseダッシュボードを開く
  2. `Settings` → `API`
  3. "Service Role Key" の `Reveal` ボタンをクリック
  4. キーをコピー（非常に長い文字列: `eyJhbGc...`で始まる）

⚠️ **重要**: Service Role Keyは**絶対に**公開しないでください。このキーはデータベースへの完全なアクセス権を持っています。

### 2. 依存関係のインストール

ローカルでバックアップスクリプトを実行する場合は、依存関係をインストールします：

```bash
npm install
```

### 3. ローカルでのテスト実行（オプション）

`.env.local`ファイルに環境変数を設定してテスト実行できます：

```bash
# .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
```

テスト実行：

```bash
npm run backup:daily
```

成功すると、`backup-YYYY-MM-DD.zip` ファイルが生成されます。

---

## 自動バックアップの動作

### GitHub Actions ワークフロー

`.github/workflows/backup-daily.yml` により、以下が自動実行されます：

1. **毎日深夜2時（JST）に起動**
2. **バックアップスクリプトを実行**
   - 過去24時間の録音データを取得
   - Storageからファイルをダウンロード
   - メタデータとファイルをZIP圧縮
3. **Draft Releaseを作成**
   - リリース名: `backup-YYYY-MM-DD`
   - ZIPファイルを添付
   - Draft状態（非公開）
4. **古いバックアップを削除**
   - 90日以上前のDraft Releaseを自動削除

### 手動実行

必要に応じて手動でバックアップを実行できます：

1. GitHubリポジトリページを開く
2. `Actions` タブをクリック
3. `Daily Backup` ワークフローを選択
4. `Run workflow` ボタンをクリック
5. `Run workflow` を再度クリックして実行

---

## バックアップの確認

### Draft Releasesの確認方法

1. GitHubリポジトリページを開く
2. `Releases` をクリック
3. ページ下部の `Drafts` セクションを確認
4. `backup-YYYY-MM-DD` という名前のリリースが表示されます

### バックアップ内容

各バックアップZIPファイルには以下が含まれます：

```
backup-YYYY-MM-DD.zip
├── metadata.json          # 録音データのメタデータ
└── files/
    ├── 1234567890-abc.webm
    ├── 1234567891-def.webm
    └── ...
```

#### metadata.jsonの構造

```json
{
  "backup_date": "2025-10-31T17:00:00.000Z",
  "backup_type": "daily-incremental",
  "recording_count": 20,
  "recordings": [
    {
      "id": "uuid-here",
      "file_path": "1234567890-abc.webm",
      "duration": 20.5,
      "transcription": "...",
      "created_at": "2025-10-31T10:30:00.000Z"
    }
  ]
}
```

---

## 復元手順

誤ってファイルを削除した場合の復元方法：

### 1. バックアップのダウンロード

1. GitHubの `Releases` → `Drafts` を開く
2. 復元したい日付のバックアップを選択
3. ZIPファイルをダウンロード
4. ZIPを解凍

### 2. ファイルの復元

#### Supabase CLIを使用する方法（推奨）

```bash
# バックアップを解凍
unzip backup-2025-10-31.zip -d backup-2025-10-31

# Storageにアップロード
cd backup-2025-10-31/files
supabase storage cp . supabase://recordings --recursive
```

#### Supabaseダッシュボードを使用する方法

1. Supabaseダッシュボードを開く
2. `Storage` → `recordings` バケットを開く
3. 解凍したファイルを手動でアップロード

### 3. データベースの復元（必要な場合）

`metadata.json`からデータベースレコードを復元：

```bash
# 復元スクリプトを作成（例）
node scripts/restore-metadata.js backup-2025-10-31/metadata.json
```

⚠️ **注意**: データベースのメタデータとStorageファイルの整合性を確認してください。

---

## トラブルシューティング

### バックアップが失敗する

#### 原因1: GitHubシークレットが設定されていない

**確認方法**:
- `Settings` → `Secrets and variables` → `Actions` で `SUPABASE_URL` と `SUPABASE_SERVICE_KEY` が設定されているか確認

**解決方法**:
- セットアップ手順に従ってシークレットを設定

#### 原因2: Supabase Service Keyの権限不足

**確認方法**:
- Supabaseダッシュボードで Service Role Key を再確認
- `service_role` キーであることを確認（`anon` キーではない）

**解決方法**:
- 正しい Service Role Key を設定

#### 原因3: Storageバケットが存在しない

**確認方法**:
- Supabaseダッシュボードで `Storage` → `recordings` バケットが存在するか確認

**解決方法**:
- バケットが存在しない場合は、マイグレーションを実行してバケットを作成

### バックアップファイルが生成されない

**原因**: 過去24時間以内に録音データが存在しない

**確認方法**:
```bash
npm run backup:daily
```
を実行して「バックアップ対象のデータがありません」というメッセージが表示されるか確認

**解決方法**:
- これは正常な動作です。録音データがある日のみバックアップが作成されます。

### Draftリリースが表示されない

**原因**: パブリックリポジトリの場合、Draft は作成者のみ表示されます

**確認方法**:
- リポジトリの `Settings` → `General` で Visibility を確認

**解決方法**:
- リポジトリメンバー（Owner/Admin）でログインして確認
- プライベートリポジトリに変更（推奨）

---

## セキュリティ

### Draft Releasesの公開範囲

- **プライベートリポジトリ**: リポジトリメンバーのみ閲覧可能
- **パブリックリポジトリ**: Draft は作成者とメンバーのみ閲覧可能（外部からは見えない）

### Service Role Keyの取り扱い

- **絶対にコードにコミットしない**
- GitHubシークレットまたは `.env.local`（`.gitignore`に追加済み）にのみ保存
- 定期的にキーをローテーション（Supabaseダッシュボードから再生成可能）

---

## 今後の改善案

### より長期的なバックアップ

90日以上の長期保存が必要な場合：

1. **外部ストレージへの転送**
   - AWS S3 Glacier（低コスト長期保存）
   - Google Cloud Storage Archive
   - Cloudflare R2（無料枠あり）

2. **月次フルバックアップ**
   - 月末に全データをバックアップ
   - 年間12ヶ月分を保持

### バックアップの暗号化

機密性の高いデータの場合：

```bash
# GPGで暗号化
gpg --symmetric --cipher-algo AES256 backup-2025-10-31.zip
```

---

## 関連ドキュメント

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Supabase Backup Strategies](https://supabase.com/docs/guides/platform/backups)
