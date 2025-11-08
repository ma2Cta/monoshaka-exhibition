/**
 * 日次全体バックアップスクリプト
 *
 * 全ての録音ファイルとメタデータをバックアップします。
 *
 * 前提条件:
 * - 環境変数に以下を設定:
 *   SUPABASE_URL: SupabaseプロジェクトのURL
 *   SUPABASE_SERVICE_KEY: Service Role Key
 *
 * 使い方:
 * npm run backup:daily
 *
 * 出力:
 * backup-YYYY-MM-DD.zip ファイルが生成されます
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";

// 環境変数を読み込み
config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// 必須パラメータのチェック
if (!supabaseUrl) {
  console.error("エラー: SUPABASE_URL 環境変数が設定されていません");
  console.error("\n設定方法:");
  console.error("1. .env.local ファイルに追加:");
  console.error("   SUPABASE_URL=https://your-project.supabase.co");
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error("エラー: SUPABASE_SERVICE_KEY 環境変数が設定されていません");
  console.error("\n設定方法:");
  console.error("1. Supabaseダッシュボード > Settings > API から Service Role Key を取得");
  console.error("2. .env.local ファイルに追加:");
  console.error("   SUPABASE_SERVICE_KEY=eyJhbGc...(長いキー)");
  console.error("\n⚠️  注意: Service Role Keyは絶対にGitにコミットしないでください!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * 全ての録音データを取得
 */
async function getAllRecordings() {
  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`録音データの取得に失敗しました: ${error.message}`);
  }

  return data || [];
}

/**
 * Storageからファイルをダウンロード
 */
async function downloadFile(filePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from("recordings")
    .download(filePath);

  if (error) {
    throw new Error(`ファイルのダウンロードに失敗しました (${filePath}): ${error.message}`);
  }

  return data;
}

/**
 * バックアップを実行
 */
async function runBackup() {
  console.log("=== 日次全体バックアップを開始 ===\n");
  console.log(`接続先: ${supabaseUrl}`);
  console.log(`実行時刻: ${new Date().toISOString()}\n`);

  // 1. 全ての録音データを取得
  console.log("📊 全ての録音データを取得中...");
  const recordings = await getAllRecordings();
  console.log(`✓ ${recordings.length}件の録音を発見\n`);

  if (recordings.length === 0) {
    console.log("バックアップ対象のデータがありません。処理を終了します。");
    return;
  }

  // 2. 出力ディレクトリを準備
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const backupDir = path.join(process.cwd(), "backup-temp", today);
  const filesDir = path.join(backupDir, "files");

  // ディレクトリが存在する場合は削除して再作成
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true });
  }
  fs.mkdirSync(filesDir, { recursive: true });

  // 3. メタデータをJSONとして保存
  console.log("💾 メタデータを保存中...");
  const metadataPath = path.join(backupDir, "metadata.json");
  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        backup_date: new Date().toISOString(),
        backup_type: "daily-full",
        recording_count: recordings.length,
        recordings,
      },
      null,
      2
    )
  );
  console.log(`✓ メタデータを保存: ${metadataPath}\n`);

  // 4. 各ファイルをダウンロード
  console.log("📥 録音ファイルをダウンロード中...");
  let downloadedCount = 0;
  let failedCount = 0;

  for (const recording of recordings) {
    try {
      const filePath = recording.file_path;
      const fileName = path.basename(filePath);

      console.log(`  - ${fileName} をダウンロード中...`);
      const blob = await downloadFile(filePath);

      // Blobをバッファに変換
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // ファイルとして保存
      const outputPath = path.join(filesDir, fileName);
      fs.writeFileSync(outputPath, buffer);

      downloadedCount++;
    } catch (error) {
      console.error(`  ✗ エラー: ${error instanceof Error ? error.message : String(error)}`);
      failedCount++;
    }
  }

  console.log(`\n✓ ${downloadedCount}件のファイルをダウンロード完了`);
  if (failedCount > 0) {
    console.log(`⚠️  ${failedCount}件のファイルのダウンロードに失敗しました\n`);
  }

  // 5. ZIPファイルを作成
  console.log("📦 ZIPファイルを作成中...");
  const zipPath = path.join(process.cwd(), `backup-${today}.zip`);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // 最大圧縮
    });

    output.on("close", () => {
      console.log(`✓ ZIPファイル作成完了: ${zipPath}`);
      console.log(`  サイズ: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB\n`);
      resolve();
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(backupDir, false);
    archive.finalize();
  });

  // 6. 一時ディレクトリを削除
  fs.rmSync(path.join(process.cwd(), "backup-temp"), { recursive: true });
  console.log("🧹 一時ファイルを削除\n");

  console.log("=== バックアップ完了 ===");
  console.log(`出力ファイル: ${zipPath}`);
}

// バックアップを実行
runBackup().catch((error) => {
  console.error("\n❌ バックアップ中にエラーが発生しました:");
  console.error(error);
  process.exit(1);
});
