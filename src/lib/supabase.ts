import { createClient } from '@supabase/supabase-js';
import { Database, Recording, Playlist } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabaseの環境変数が設定されていません');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 録音をSupabase Storageにアップロードし、データベースにレコードを作成する
 * @param blob 録音のBlobデータ
 * @param duration 録音の長さ（秒）
 * @param transcription 文字起こしテキスト（オプショナル）
 * @returns アップロードされた録音のレコード
 */
export async function uploadRecording(blob: Blob, duration: number, transcription?: string) {
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
  const insertData: Database['public']['Tables']['recordings']['Insert'] = {
    file_path: uploadData.path,
    duration,
    transcription: transcription || null,
  };

  const { data: recordData, error: recordError } = await supabase
    .from('recordings')
    .insert(insertData)
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
export async function getRecordings(): Promise<Recording[]> {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`取得エラー: ${error.message}`);
  }

  return data || [];
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

// ========================================
// プレイリスト関連の関数
// ========================================

/**
 * すべてのプレイリストを取得する（作成日時の降順）
 * @returns プレイリストのリスト
 */
export async function getPlaylists(): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`取得エラー: ${error.message}`);
  }

  return data || [];
}

/**
 * 有効なプレイリストを取得する
 * @returns 有効なプレイリスト（なければnull）
 */
export async function getActivePlaylist(): Promise<Playlist | null> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`取得エラー: ${error.message}`);
  }

  return data;
}

/**
 * プレイリストをIDで取得する
 * @param id プレイリストID
 * @returns プレイリスト
 */
export async function getPlaylistById(id: string): Promise<Playlist> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`取得エラー: ${error.message}`);
  }

  return data;
}

/**
 * プレイリストを作成する
 * @param name プレイリスト名
 * @returns 作成されたプレイリスト
 */
export async function createPlaylist(name: string): Promise<Playlist> {
  const insertData: Database['public']['Tables']['playlists']['Insert'] = {
    name,
    is_active: false,
  };

  const { data, error } = await supabase
    .from('playlists')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`作成エラー: ${error.message}`);
  }

  return data;
}

/**
 * プレイリストを削除する
 * @param id プレイリストID
 */
export async function deletePlaylist(id: string): Promise<void> {
  const { error } = await supabase.from('playlists').delete().eq('id', id);

  if (error) {
    throw new Error(`削除エラー: ${error.message}`);
  }
}

/**
 * 有効なプレイリストを設定する（他のプレイリストは自動的に無効化される）
 * @param id プレイリストID
 */
export async function setActivePlaylist(id: string): Promise<void> {
  const { error } = await supabase
    .from('playlists')
    .update({ is_active: true })
    .eq('id', id);

  if (error) {
    throw new Error(`更新エラー: ${error.message}`);
  }
}

/**
 * プレイリストの録音を取得する（再生順序で）
 * @param playlistId プレイリストID
 * @returns 録音のリスト
 */
export async function getPlaylistRecordings(
  playlistId: string
): Promise<(Recording & { order_index: number; playlist_recording_id: string })[]> {
  const { data, error } = await supabase
    .from('playlist_recordings')
    .select(`
      id,
      order_index,
      recordings (
        id,
        file_path,
        duration,
        transcription,
        created_at
      )
    `)
    .eq('playlist_id', playlistId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`取得エラー: ${error.message}`);
  }

  // データの形式を整形
  const result: (Recording & { order_index: number; playlist_recording_id: string })[] = [];

  for (const item of data || []) {
    // Supabaseは外部キーのリレーションを配列として返すが、実際は単一オブジェクト
    const recording = Array.isArray(item.recordings) ? item.recordings[0] : item.recordings;
    if (recording) {
      result.push({
        id: recording.id,
        file_path: recording.file_path,
        duration: recording.duration,
        transcription: recording.transcription,
        created_at: recording.created_at,
        order_index: item.order_index,
        playlist_recording_id: item.id,
      });
    }
  }

  return result;
}

/**
 * プレイリストに録音を追加する
 * @param playlistId プレイリストID
 * @param recordingId 録音ID
 */
export async function addRecordingToPlaylist(
  playlistId: string,
  recordingId: string
): Promise<void> {
  // 現在のプレイリストの最大order_indexを取得
  const { data: maxOrderData } = await supabase
    .from('playlist_recordings')
    .select('order_index')
    .eq('playlist_id', playlistId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrderIndex = maxOrderData ? maxOrderData.order_index + 1 : 0;

  const insertData: Database['public']['Tables']['playlist_recordings']['Insert'] = {
    playlist_id: playlistId,
    recording_id: recordingId,
    order_index: nextOrderIndex,
  };

  const { error } = await supabase
    .from('playlist_recordings')
    .insert(insertData)
    .select();

  if (error) {
    // 既に追加されている場合のエラーを処理
    if (error.code === '23505') {
      throw new Error('この録音は既にプレイリストに追加されています');
    }
    throw new Error(`追加エラー: ${error.message}`);
  }
}

/**
 * プレイリストから録音を削除する
 * @param playlistRecordingId playlist_recordingsのID
 */
export async function removeRecordingFromPlaylist(
  playlistRecordingId: string
): Promise<void> {
  const { error } = await supabase
    .from('playlist_recordings')
    .delete()
    .eq('id', playlistRecordingId);

  if (error) {
    throw new Error(`削除エラー: ${error.message}`);
  }
}

/**
 * プレイリスト内の録音の順序を更新する
 * @param playlistId プレイリストID
 * @param recordingIds 新しい順序の録音IDの配列
 */
export async function reorderPlaylistRecordings(
  playlistId: string,
  recordingIds: string[]
): Promise<void> {
  // 各録音のorder_indexを更新
  const updates = recordingIds.map((recordingId, index) =>
    supabase
      .from('playlist_recordings')
      .update({ order_index: index })
      .eq('playlist_id', playlistId)
      .eq('recording_id', recordingId)
  );

  const results = await Promise.all(updates);

  const errors = results.filter((result) => result.error);
  if (errors.length > 0) {
    throw new Error(`並び替えエラー: ${errors[0].error?.message}`);
  }
}
