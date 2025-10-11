'use client';

import PlaylistManager from '@/components/admin/PlaylistManager';

export default function AdminPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* ヘッダー */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">管理画面</h1>
          <p className="text-muted-foreground mt-2">
            プレイリストと録音データを管理します
          </p>
        </div>

        {/* プレイリスト管理 */}
        <section>
          <PlaylistManager />
        </section>
      </div>
    </div>
  );
}
