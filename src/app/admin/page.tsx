'use client';

import PlaylistManager from '@/components/admin/PlaylistManager';

export default function AdminPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* プレイリスト管理 */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">プレイリスト管理</h2>
          <PlaylistManager />
        </section>
      </div>
    </div>
  );
}
