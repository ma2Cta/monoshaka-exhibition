-- プレイリスト内の録音を一括で並び替えるカスタム関数
-- これにより、N回のAPI呼び出しが1回のRPC呼び出しに削減される

CREATE OR REPLACE FUNCTION reorder_playlist_recordings(
  p_playlist_id UUID,
  p_recording_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_recording_id UUID;
  v_index INTEGER;
BEGIN
  -- トランザクション内で処理
  -- 該当プレイリストの全てのorder_indexを一時的に負の値に設定
  -- これによりUNIQUE制約違反を回避
  UPDATE playlist_recordings
  SET order_index = -order_index - 1
  WHERE playlist_id = p_playlist_id;

  -- 新しい順序でorder_indexを更新
  FOR v_index IN 1..array_length(p_recording_ids, 1) LOOP
    v_recording_id := p_recording_ids[v_index];

    UPDATE playlist_recordings
    SET order_index = v_index - 1  -- 0始まりのインデックス
    WHERE playlist_id = p_playlist_id
      AND recording_id = v_recording_id;
  END LOOP;
END;
$$;

-- この関数を全員が実行可能にする（BASIC認証で保護されている）
GRANT EXECUTE ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) TO authenticated;
