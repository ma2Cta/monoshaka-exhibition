# 芸術祭 音声録音・ループ再生アプリケーション 要件定義書

## プロジェクト概要

芸術祭での展示用に、来場者が小説の一節を音声で録音し、それらを自動的に連続再生するウェブアプリケーション。

### 目的

- 来場者が小説の一節を読み上げて録音
- 録音された音声を自動的に連続ループ再生
- 管理者が表示する節を切り替え可能

### 制約条件

- 実装期間: 2 週間以内
- 予算: できるだけ低コスト（月額$25 以内を目標）
- 想定規模: 1 日 100 人 × 30 日 = 3,000 録音
- 日本からのアクセスで十分な速度

---

## 技術スタック

### フロントエンド

- **フレームワーク**: Next.js 14+ (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **UI コンポーネント**: shadcn/ui（必要に応じて）

### バックエンド

- **BaaS**: Supabase
  - データベース: PostgreSQL
  - ストレージ: Supabase Storage
  - 認証: Supabase Auth
  - リージョン: 東京

### ホスティング

- **Vercel**: フロントエンドのホスティング（無料枠）

### 音声処理

- **録音**: MediaRecorder API (ブラウザ標準)
- **再生**: HTMLAudioElement + Web Audio API
- **形式**: WebM (audio/webm, 128kbps)

---

## システム構成

```

┌─────────────────┐
│ 来場者端末 │ ← 録音 UI（認証なし）
└─────────────────┘
│
┌─────────────────┐
│ ループ再生端末 │ ← 再生 UI（認証なし、展示用ディスプレイ）
└─────────────────┘
│
┌─────────────────┐
│ 管理端末 │ ← 管理 UI（要認証）
└─────────────────┘
│
┌────▼─────┐
│ Vercel │
└────┬─────┘
│
┌────▼─────────┐
│ Supabase │
│ ├ Auth │
│ ├ Database │
│ └ Storage │
└──────────────┘

```

---

## データベース設計

### テーブル構成

#### 1. recordings（録音データ）

```sql
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_path TEXT NOT NULL,
  duration FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_recordings_created_at ON recordings(created_at);
```

**カラム説明:**

- `id`: 録音のユニーク ID
- `file_path`: Supabase Storage 内のファイルパス
- `duration`: 録音の長さ（秒）
- `created_at`: 録音日時

### Row Level Security (RLS) ポリシー

```sql
-- recordings: 全員読み取り可・挿入可、管理者のみ削除可
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recordings_select_all" ON recordings
  FOR SELECT USING (true);

CREATE POLICY "recordings_insert_all" ON recordings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "recordings_delete_admin" ON recordings
  FOR DELETE USING (auth.role() = 'authenticated');
```

### ストレージバケット

```sql
-- recordingsバケット: 音声ファイル保存用
-- パス構成: {timestamp}-{random}.webm
```

**ストレージポリシー:**

- 全員: ファイルアップロード可
- 全員: ファイル読み取り可（Public URL）
- 管理者のみ: ファイル削除可

---

## 機能要件

### 1. 来場者画面（録音画面）

#### URL

- `/` または `/record`

#### 画面フロー

1. **録音**

   - 「録音開始」ボタン
   - マイクへのアクセス許可を要求
   - 録音中は「録音中...」表示とタイマー表示
   - 「録音停止」ボタンで終了
   - 最大録音時間: 60 秒（自動停止）

2. **再生確認**

   - 録音した音声をその場で再生
   - 「やり直す」ボタンで再録音
   - 「送信する」ボタンでアップロード

3. **アップロード**
   - Supabase Storage にファイルアップロード
   - データベースに録音レコード作成
   - 完了後「ありがとうございました」メッセージ
   - 「もう一度録音する」ボタンで最初に戻る

#### 技術仕様

- **録音形式**: WebM, audio/webm
- **ビットレート**: 128kbps
- **サンプリングレート**: 48kHz
- **ファイル名形式**: `{timestamp}-{random}.webm`

#### エラーハンドリング

- マイクアクセス拒否時: エラーメッセージ表示
- アップロード失敗時: リトライボタン表示
- ネットワークエラー時: 適切なエラーメッセージ

---

### 2. ループ再生画面（展示用ディスプレイ）

#### URL

- `/play` または `/loop`

#### 機能

1. **自動再生**

   - ページ読み込み時に自動的に再生開始
   - 全ての録音を連続再生
   - 最後の録音が終わったら最初に戻る（無限ループ）

2. **リアルタイム更新**

   - 10 秒ごとに新しい録音をチェック
   - 新録音があれば次のループから自動的に追加

3. **UI 表示**
   - 現在再生中の番号（例: 3 / 25）
   - シンプルで視認性の高いデザイン
   - フルスクリーン表示推奨

#### 技術仕様

- **再生方式**: 動的連続再生（サーバー結合なし）
- **更新間隔**: 10 秒
- **シームレス化**: ダブルバッファリング + クロスフェード（0.5 秒）

#### 再生ロジック

```typescript
// 疑似コード
1. 全録音を created_at 昇順で取得
2. Signed URL を生成
3. audio要素で順次再生
4. onEnded イベントで次の音声へ
5. 10秒ごとに録音リストを再取得
```

---

### 3. 管理画面

#### URL

- `/admin`（認証必須）

#### 認証

- Supabase Auth（Email + Password）
- 未認証時は自動的にログイン画面へリダイレクト

#### 機能

##### 3-1. 録音の管理

- **録音一覧表示**

  - 作成日時、再生時間を表示
  - 再生ボタン（その場で確認可能）

- **録音の削除**

  - 個別削除ボタン
  - 確認ダイアログ表示
  - Storage からもファイル削除

- **一括削除**
  - 全録音を削除
  - 確認ダイアログ表示

##### 3-2. 統計情報

- 総録音数
- 総再生時間
- 本日の録音数

---

## 非機能要件

### パフォーマンス

- 録音開始: 1 秒以内
- アップロード完了: 5 秒以内（通常の音声サイズ）
- 再生開始: 2 秒以内
- 管理画面の読み込み: 3 秒以内

### セキュリティ

- 来場者画面: 認証不要（誰でもアクセス可）
- 管理画面: 認証必須
- HTTPS 通信
- Row Level Security 有効化
- 悪意のあるファイルアップロード対策（MIME type チェック）

### 可用性

- 稼働率: 99%以上（Vercel/Supabase の標準 SLA）
- エラー時の自動リトライ機構

### スケーラビリティ

- 同時録音ユーザー: 10 人程度を想定
- 総録音数: 3,000 件まで対応
- ストレージ使用量: 約 150MB（平均 30 秒 × 128kbps × 3,000 件）

### ブラウザ対応

- Chrome/Edge: 最新版（推奨）
- Safari: 最新版
- Firefox: 最新版
- モバイルブラウザ: iOS Safari, Chrome

---

## 環境変数

### `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## ディレクトリ構成

```
project-root/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # 来場者画面（録音）
│   │   ├── play/
│   │   │   └── page.tsx             # ループ再生画面
│   │   ├── admin/
│   │   │   ├── layout.tsx           # 認証チェック
│   │   │   └── page.tsx             # 管理画面
│   │   └── layout.tsx
│   ├── components/
│   │   ├── recorder/
│   │   │   ├── AudioRecorder.tsx    # 録音コンポーネント
│   │   │   └── RecordingPreview.tsx # 再生確認
│   │   ├── player/
│   │   │   └── LoopPlayer.tsx       # ループ再生
│   │   └── admin/
│   │       └── RecordingList.tsx    # 録音一覧
│   ├── lib/
│   │   ├── supabase.ts              # Supabase client
│   │   └── types.ts                 # 型定義
│   └── hooks/
│       ├── useRecorder.ts           # 録音ロジック
│       └── usePlayer.ts             # 再生ロジック
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # 初期DBスキーマ
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## 実装の優先順位

### Phase 1: 基本機能（Week 1）

1. ✅ プロジェクトセットアップ（Next.js + Supabase）
2. ✅ データベーススキーマ作成
3. ✅ 来場者画面（録音 → アップロード）
4. ✅ ループ再生画面（基本版）

### Phase 2: 管理機能（Week 2）

5. ✅ 管理画面（認証）
6. ✅ 録音の管理機能

### Phase 3: 改善・調整

8. ✅ UI/UX の改善
9. ✅ エラーハンドリング強化
10. ✅ パフォーマンス最適化
11. ✅ 本番デプロイ・動作確認

---

## デプロイ手順

### Supabase セットアップ

1. Supabase プロジェクト作成（シンガポールリージョン）
2. SQL エディタでマイグレーション実行
3. Storage バケット「recordings」作成
4. 環境変数をコピー

### Vercel デプロイ

1. GitHub リポジトリ作成
2. Vercel プロジェクト作成
3. 環境変数設定
4. 自動デプロイ設定

---

## テストシナリオ

### 来場者画面

- [ ] マイクアクセスを許可して録音できる
- [ ] 録音した音声を再生できる
- [ ] 録音をアップロードできる
- [ ] エラー時に適切なメッセージが表示される

### ループ再生画面

- [ ] 自動的に再生が開始される
- [ ] 全ての録音が順番に再生される
- [ ] ループが正常に動作する
- [ ] 新しい録音が自動的に追加される

### 管理画面

- [ ] ログインできる
- [ ] 録音を再生・削除できる
- [ ] 統計情報が表示される

---

## 運用想定

### 展示開始前

1. ループ再生画面を展示ディスプレイで全画面表示
2. 来場者用タブレット/PC を設置

### 展示期間中

1. 定期的に録音数を確認
2. 不適切な録音があれば削除

### トラブル対応

- 再生が止まった場合: ページリロード
- 録音できない場合: ブラウザのマイク許可確認
- アップロードエラー: ネットワーク接続確認

---

## 今後の拡張可能性

- [ ] 録音の承認フロー（管理者が確認してから再生）
- [ ] 来場者へのメール通知（録音をシェア）
- [ ] 音声の自動フィルタリング（無音検出、ノイズ除去）
- [ ] 多言語対応
- [ ] アナリティクス（訪問者数、録音完了率など）

---

## 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
