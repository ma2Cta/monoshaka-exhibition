/**
 * ローカル環境用のユーザーを作成するスクリプト
 *
 * 使い方:
 * npx tsx scripts/create-test-user.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ユーザーIDをメールアドレス形式に変換
function userIdToEmail(userId: string): string {
  return `${userId}@monoshaka.local`;
}

async function createTestUser() {
  const userId = 'testuser';
  const password = 'password123';
  const email = userIdToEmail(userId);

  console.log('テストユーザーを作成しています...');
  console.log(`ユーザーID: ${userId}`);
  console.log(`パスワード: ${password}`);
  console.log(`(内部メールアドレス: ${email})`);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // メール確認をスキップ
  });

  if (error) {
    console.error('エラー:', error);
    process.exit(1);
  }

  console.log('✓ テストユーザーの作成に成功しました');
  console.log('Supabase Auth User ID:', data.user.id);
  console.log('\n以下の情報でログインできます:');
  console.log(`  ユーザーID: ${userId}`);
  console.log(`  パスワード: ${password}`);
}

createTestUser();
