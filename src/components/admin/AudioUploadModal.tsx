'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AudioFileUploader from './AudioFileUploader';

interface AudioUploadModalProps {
  playlistId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}

/**
 * 音声アップロード用モーダルダイアログ
 * AudioFileUploader をモーダル形式でラップします
 */
export function AudioUploadModal({
  playlistId,
  open,
  onOpenChange,
  onUploadComplete,
}: AudioUploadModalProps) {
  function handleUploadComplete() {
    onUploadComplete();
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
        <AudioFileUploader
          playlistId={playlistId}
          onUploadComplete={handleUploadComplete}
        />
      </DialogContent>
    </Dialog>
  );
}
