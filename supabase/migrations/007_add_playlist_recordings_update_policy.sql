-- playlist_recordingsテーブルにUPDATEポリシーを追加
-- order_indexの更新を許可する

-- 新しいポリシー: playlist_recordings - 全員が更新可能
CREATE POLICY "playlist_recordings_update_all" ON playlist_recordings
  FOR UPDATE USING (true);
