import { createClient } from './supabase-client';
import { Database, Recording, Playlist } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * クライアントコンポーネントで使用するSupabaseクライアント
 * 認証セッション管理に対応
 */
function getSupabaseClient(): SupabaseClient<Database> {
  return createClient();
}

/**
 * 録音をSupabase Storageにアップロードし、データベースにレコードを作成する
 * @param blob 録音のBlobデータ
 * @param duration 録音の長さ（秒）
 * @param transcription 文字起こしテキスト（オプショナル）
 * @param playlistId プレイリストID（指定した場合、そのプレイリスト専用のパスに保存）
 * @returns アップロードされた録音のレコード
 */
export async function uploadRecording(
  blob: Blob,
  duration: number,
  transcription?: string,
  playlistId?: string
) {
  const supabase = getSupabaseClient();

  // ファイル名を生成（タイムスタンプ + ランダム文字列）
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);

  // Blobのタイプから拡張子を決定（MP4優先、WebMフォールバック対応）
  const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const fileName = `${timestamp}-${random}.${extension}`;

  // ファイルパスを決定（プレイリストIDがある場合はそのディレクトリ内に保存）
  const filePath = playlistId ? `playlist-${playlistId}/${fileName}` : fileName;

  // 1. Storageにファイルをアップロード
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('recordings')
    .upload(filePath, blob, {
      contentType: blob.type, // Blobのタイプを使用
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

  const result = await ((supabase as unknown as SupabaseClient<Database>)
    .from('recordings')
    .insert(insertData as unknown as never)
    .select()
    .single() as unknown);

  const { data: recordData, error: recordError } = result as { data: Recording | null; error: unknown };

  if (recordError) {
    // データベース挿入に失敗した場合、アップロードしたファイルを削除
    await supabase.storage.from('recordings').remove([uploadData.path]);
    const errorMessage = recordError instanceof Error ? recordError.message : String(recordError);
    throw new Error(`データベースエラー: ${errorMessage}`);
  }

  if (!recordData) {
    throw new Error('録音データの作成に失敗しました');
  }

  return recordData;
}

/**
 * すべての録音を取得する（作成日時の昇順）
 * @returns 録音のリスト
 */
export async function getRecordings(): Promise<Recording[]> {
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
  const { data } = supabase.storage.from('recordings').getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * 録音を削除する
 * @param id 録音のID
 * @param filePath ファイルパス
 */
export async function deleteRecording(id: string, filePath: string) {
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
  const insertData: Database['public']['Tables']['playlists']['Insert'] = {
    name,
    is_active: false,
  };

  const result = await ((supabase as unknown as SupabaseClient<Database>)
    .from('playlists')
    .insert(insertData as unknown as never)
    .select()
    .single() as unknown);

  const { data, error } = result as { data: Playlist | null; error: unknown };

  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`作成エラー: ${errorMessage}`);
  }

  if (!data) {
    throw new Error('プレイリストの作成に失敗しました');
  }

  return data;
}

/**
 * プレイリストを削除する
 * プレイリスト内のファイルも削除する
 * @param id プレイリストID
 */
export async function deletePlaylist(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  // プレイリストディレクトリ内のファイルをリスト
  const folderPath = `playlist-${id}`;
  const { data: files, error: listError } = await supabase.storage
    .from('recordings')
    .list(folderPath);

  // ファイルが存在する場合、すべて削除
  if (!listError && files && files.length > 0) {
    const filePaths = files.map(file => `${folderPath}/${file.name}`);
    const { error: removeError } = await supabase.storage
      .from('recordings')
      .remove(filePaths);

    if (removeError) {
      console.error('ファイル削除エラー:', removeError);
    }
  }

  // プレイリストを削除
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
  const supabase = getSupabaseClient();
  const result = await ((supabase as unknown as SupabaseClient<Database>)
    .from('playlists')
    .update({ is_active: true } as unknown as never)
    .eq('id', id) as unknown);

  const { error } = result as { error: unknown };

  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`更新エラー: ${errorMessage}`);
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
  const supabase = getSupabaseClient();
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

  type PlaylistRecordingWithRecording = {
    id: string;
    order_index: number;
    recordings: Recording | Recording[] | null;
  };

  for (const item of (data as unknown as PlaylistRecordingWithRecording[]) || []) {
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
  const supabase = getSupabaseClient();
  // 現在のプレイリストの最大order_indexを取得
  const { data: maxOrderData } = await supabase
    .from('playlist_recordings')
    .select('order_index')
    .eq('playlist_id', playlistId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrderIndex = maxOrderData ? (maxOrderData as { order_index: number }).order_index + 1 : 0;

  const insertData: Database['public']['Tables']['playlist_recordings']['Insert'] = {
    playlist_id: playlistId,
    recording_id: recordingId,
    order_index: nextOrderIndex,
  };

  const result = await ((supabase as unknown as SupabaseClient<Database>)
    .from('playlist_recordings')
    .insert(insertData as unknown as never)
    .select() as unknown);

  const { error } = result as { error: unknown };

  if (error) {
    // エラー情報を取得
    const errorObj = error as { code?: string; message?: string };
    // 既に追加されている場合のエラーを処理
    if (errorObj.code === '23505') {
      throw new Error('この録音は既にプレイリストに追加されています');
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`追加エラー: ${errorMessage}`);
  }
}

/**
 * プレイリストから録音を削除する
 * @param playlistRecordingId playlist_recordingsのID
 */
export async function removeRecordingFromPlaylist(
  playlistRecordingId: string
): Promise<void> {
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
  // 各録音のorder_indexを更新
  const updates = recordingIds.map((recordingId, index) =>
    (supabase as unknown as SupabaseClient<Database>)
      .from('playlist_recordings')
      .update({ order_index: index } as unknown as never)
      .eq('playlist_id', playlistId)
      .eq('recording_id', recordingId)
  );

  const results = await Promise.all(updates);

  const errors = results.filter((result) => {
    const r = result as { error?: unknown };
    return r.error;
  });
  if (errors.length > 0) {
    const firstError = (errors[0] as { error?: unknown }).error;
    const errorMessage = firstError instanceof Error ? firstError.message : String(firstError);
    throw new Error(`並び替えエラー: ${errorMessage}`);
  }
}
