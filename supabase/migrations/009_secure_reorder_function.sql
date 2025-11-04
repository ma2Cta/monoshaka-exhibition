-- 並び替え関数にセキュリティバリデーションを追加
-- 指定されたrecording_idsが実際にそのplaylistに属しているか確認することで、
-- 悪意のあるユーザーが他のプレイリストのデータを変更できないようにする

CREATE OR REPLACE FUNCTION reorder_playlist_recordings(
  p_playlist_id UUID,
  p_recording_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- 関数の所有者権限で実行
AS $$
DECLARE
  v_recording_id UUID;
  v_index INTEGER;
  v_existing_count INTEGER;
  v_provided_count INTEGER;
BEGIN
  -- セキュリティチェック1: プレイリストが存在するか確認
  IF NOT EXISTS (SELECT 1 FROM playlists WHERE id = p_playlist_id) THEN
    RAISE EXCEPTION 'プレイリストが存在しません';
  END IF;

  -- セキュリティチェック2: 指定されたすべてのrecording_idsがこのplaylistに属しているか確認
  SELECT COUNT(*)
  INTO v_existing_count
  FROM playlist_recordings
  WHERE playlist_id = p_playlist_id
    AND recording_id = ANY(p_recording_ids);

  v_provided_count := array_length(p_recording_ids, 1);

  IF v_existing_count != v_provided_count THEN
    RAISE EXCEPTION '指定された録音の一部がこのプレイリストに属していません';
  END IF;

  -- ここから実際の並び替え処理
  -- トランザクション内で処理（関数は自動的にトランザクション内で実行される）

  -- 該当プレイリストの全てのorder_indexを一時的に負の値に設定
  -- これによりUNIQUE制約違反を回避
  UPDATE playlist_recordings
  SET order_index = -order_index - 1
  WHERE playlist_id = p_playlist_id;

  -- 新しい順序でorder_indexを更新
  FOR v_index IN 1..v_provided_count LOOP
    v_recording_id := p_recording_ids[v_index];

    UPDATE playlist_recordings
    SET order_index = v_index - 1  -- 0始まりのインデックス
    WHERE playlist_id = p_playlist_id
      AND recording_id = v_recording_id;
  END LOOP;
END;
$$;

-- 既存の権限を取り消して再設定
REVOKE EXECUTE ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) TO authenticated;

-- セキュリティに関するコメントを追加
COMMENT ON FUNCTION reorder_playlist_recordings(UUID, UUID[]) IS
'プレイリスト内の録音を並び替える関数。
セキュリティ: 指定されたrecording_idsがplaylist_idに実際に属しているかをバリデーションしている。
Next.jsのmiddlewareでBASIC認証を行っているが、追加の防御層として関数内でもチェックを実施。';
