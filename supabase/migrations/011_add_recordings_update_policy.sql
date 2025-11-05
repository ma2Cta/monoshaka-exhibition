-- recordingsテーブルのUPDATEポリシーを追加
-- 文字起こしの編集機能に必要

-- RLS ポリシー: 全員が更新可能（BASIC認証で保護済み）
CREATE POLICY "recordings_update_all" ON recordings
  FOR UPDATE USING (true);
