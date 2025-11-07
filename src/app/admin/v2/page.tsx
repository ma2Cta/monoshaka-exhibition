'use client';

import PlaylistManager from '@/components/admin/PlaylistManager';
import Header from '@/components/layout/Header';

export default function AdminV2Page() {
  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* 説明 */}
          <div>
            <h1 className="text-3xl font-bold mb-2">管理画面 v2</h1>
            <p className="text-muted-foreground">
              プレイリストの管理とループ再生を統合した新しい管理画面です
            </p>
          </div>

          {/* プレイリスト管理 */}
          <section>
            <PlaylistManager basePath="/admin/v2" />
          </section>
        </div>
      </div>
    </>
  );
}
