import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * クライアントコンポーネント用のSupabaseクライアントを作成
 * ブラウザでのセッション管理にクッキーを使用
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as SupabaseClient<Database>;
}
