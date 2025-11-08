'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import FileUploader from './FileUploader';
import type { Recording } from '@/lib/types';

interface UploadModalProps {
  playlistId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: (newRecordings: Recording[]) => void;
}

/**
 * 音声アップロード用モーダルダイアログ
 * FileUploader をモーダル形式でラップします
 */
export function UploadModal({
  playlistId,
  open,
  onOpenChange,
  onUploadComplete,
}: UploadModalProps) {
  function handleUploadComplete(newRecordings: Recording[]) {
    onUploadComplete(newRecordings);
    // アップロード完了後、モーダルを閉じる
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>音声ファイルをアップロード</DialogTitle>
          <DialogDescription>
            複数の音声ファイルを選択してプレイリストに追加できます。
            ドラッグ&ドロップで順序を変更できます。
          </DialogDescription>
        </DialogHeader>
        <FileUploader
          playlistId={playlistId}
          onUploadComplete={handleUploadComplete}
        />
      </DialogContent>
    </Dialog>
  );
}
