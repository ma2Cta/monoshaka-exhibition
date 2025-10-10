'use client';

import Statistics from '@/components/admin/Statistics';
import RecordingList from '@/components/admin/RecordingList';

export default function AdminPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* 統計情報 */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">統計情報</h2>
          <Statistics />
        </section>

        {/* 録音一覧 */}
        <section>
          <RecordingList />
        </section>
      </div>
    </div>
  );
}
