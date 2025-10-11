/**
 * 本番環境用のユーザーを作成するスクリプト
 *
 * 前提条件:
 * .env.local ファイルに以下の本番環境用の環境変数を設定:
 * - PROD_SUPABASE_URL: 本番SupabaseプロジェクトのURL
 * - PROD_SUPABASE_SERVICE_ROLE_KEY: 本番環境のサービスロールキー
 *
 * 使い方:
 * npm run user:create:prod <USER_ID> <PASSWORD>
 *
 * 例:
 * npm run user:create:prod admin securepass123
 *
 * または直接実行:
 * USER_ID=admin PASSWORD=securepass123 npx tsx scripts/create-prod-user.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// .env.localファイルを読み込み
config({ path: ".env.local" });

// コマンドライン引数から取得(npm run経由の場合)
const args = process.argv.slice(2);
const userId = process.env.USER_ID || args[0];
const password = process.env.PASSWORD || args[1];

// 本番環境用の環境変数から取得
const supabaseUrl = process.env.PROD_SUPABASE_URL;
const supabaseServiceKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;

// 必須パラメータのチェック
if (!userId || !password) {
  console.error("エラー: ユーザーIDとパスワードが必要です");
  console.error("\n使用方法:");
  console.error("  npm run user:create:prod <USER_ID> <PASSWORD>");
  console.error("\n例:");
  console.error("  npm run user:create:prod admin securepass123");
  console.error("\nまたは:");
  console.error(
    "  USER_ID=admin PASSWORD=securepass123 npx tsx scripts/create-prod-user.ts"
  );
  process.exit(1);
}

// パスワードの強度チェック
if (password.length < 8) {
  console.error("エラー: パスワードは8文字以上である必要があります");
  process.exit(1);
}

if (!supabaseUrl) {
  console.error(
    "エラー: PROD_SUPABASE_URL 環境変数が設定されていません"
  );
  console.error("\n設定方法:");
  console.error("1. Supabaseダッシュボードで本番プロジェクトのURLを確認");
  console.error("2. .env.local ファイルに追加:");
  console.error("   PROD_SUPABASE_URL=https://your-project.supabase.co");
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error(
    "エラー: PROD_SUPABASE_SERVICE_ROLE_KEY 環境変数が設定されていません"
  );
  console.error("\n設定方法:");
  console.error("1. Supabaseダッシュボード > Settings > API から Service Role Key を取得");
  console.error("2. .env.local ファイルに追加:");
  console.error("   PROD_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...(長いキー)");
  console.error("\n⚠️  注意: Service Role Keyは絶対にGitにコミットしないでください!");
  process.exit(1);
}

// URLの検証(本番環境チェック)
if (supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost")) {
  console.error("エラー: ローカル環境のURLが設定されています");
  console.error(
    "PROD_SUPABASE_URL に本番環境用のSupabase URLを設定してください"
  );
  console.error(`現在の設定: ${supabaseUrl}`);
  process.exit(1);
}

if (!supabaseUrl.startsWith("https://")) {
  console.error("エラー: URLはhttps://から始まる必要があります");
  console.error(`現在の設定: ${supabaseUrl}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ユーザーIDをメールアドレス形式に変換
function userIdToEmail(userId: string): string {
  return `${userId}@monoshaka.local`;
}

async function createProdUser() {
  const email = userIdToEmail(userId);

  console.log("本番環境にユーザーを作成しています...");
  console.log(`接続先: ${supabaseUrl}`);
  console.log(`ユーザーID: ${userId}`);
  console.log(`(内部メールアドレス: ${email})`);
  console.log("");

  // 確認メッセージ
  console.log("⚠️  本番環境へのユーザー作成を実行します");
  console.log("");

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // メール確認をスキップ
  });

  if (error) {
    console.error("エラー:", error.message);
    if (error.message.includes("already registered")) {
      console.error("このユーザーIDは既に登録されています");
    }
    process.exit(1);
  }

  console.log("✓ 本番環境へのユーザー作成に成功しました");
  console.log("Supabase Auth User ID:", data.user.id);
  console.log("");
  console.log("作成されたユーザー情報:");
  console.log(`  ユーザーID: ${userId}`);
  console.log(`  パスワード: ${password}`);
  console.log("");
  console.log("このログイン情報を安全に保管してください。");
}

createProdUser();
