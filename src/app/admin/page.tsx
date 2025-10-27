'use client';

import PlaylistManager from '@/components/admin/PlaylistManager';
import Header from '@/components/layout/Header';

export default function AdminPage() {
  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* 説明 */}
          <div>
            <p className="text-muted-foreground">
              プレイリストと録音データを管理します
            </p>
          </div>

          {/* プレイリスト管理 */}
          <section>
            <PlaylistManager />
          </section>
        </div>
      </div>
    </>
  );
}
