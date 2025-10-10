import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabaseの環境変数が設定されていません');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * 録音をSupabase Storageにアップロードし、データベースにレコードを作成する
 * @param blob 録音のBlobデータ
 * @param duration 録音の長さ（秒）
 * @returns アップロードされた録音のレコード
 */
export async function uploadRecording(blob: Blob, duration: number) {
  // ファイル名を生成（タイムスタンプ + ランダム文字列）
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const fileName = `${timestamp}-${random}.webm`;

  // 1. Storageにファイルをアップロード
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('recordings')
    .upload(fileName, blob, {
      contentType: 'audio/webm',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`アップロードエラー: ${uploadError.message}`);
  }

  // 2. データベースにレコードを作成
  const { data: recordData, error: recordError } = await supabase
    .from('recordings')
    .insert({
      file_path: uploadData.path,
      duration,
    })
    .select()
    .single();

  if (recordError) {
    // データベース挿入に失敗した場合、アップロードしたファイルを削除
    await supabase.storage.from('recordings').remove([uploadData.path]);
    throw new Error(`データベースエラー: ${recordError.message}`);
  }

  return recordData;
}

/**
 * すべての録音を取得する（作成日時の昇順）
 * @returns 録音のリスト
 */
export async function getRecordings() {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`取得エラー: ${error.message}`);
  }

  return data;
}

/**
 * 録音のPublic URLを取得する
 * @param filePath ファイルパス
 * @returns Public URL
 */
export function getRecordingUrl(filePath: string): string {
  const { data } = supabase.storage.from('recordings').getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * 録音を削除する
 * @param id 録音のID
 * @param filePath ファイルパス
 */
export async function deleteRecording(id: string, filePath: string) {
  console.log('deleteRecording呼び出し:', { id, filePath });

  // 1. データベースからレコードを削除
  console.log('データベースから削除を試行...');
  const { data: dbData, error: dbError } = await supabase
    .from('recordings')
    .delete()
    .eq('id', id)
    .select();

  console.log('データベース削除結果:', { dbData, dbError });

  if (dbError) {
    console.error('データベース削除エラー:', dbError);
    throw new Error(`データベース削除エラー: ${dbError.message} (code: ${dbError.code})`);
  }

  // 2. Storageからファイルを削除
  console.log('Storageから削除を試行...', filePath);
  const { data: storageData, error: storageError } = await supabase.storage
    .from('recordings')
    .remove([filePath]);

  console.log('Storage削除結果:', { storageData, storageError });

  if (storageError) {
    console.error('Storage削除エラー:', storageError);
    throw new Error(`ストレージ削除エラー: ${storageError.message}`);
  }

  console.log('削除完了');
}
