'use client';

import { useState, useEffect } from 'react';
import { getRecordings } from '@/lib/supabase';

interface Stats {
  totalCount: number;
  totalDuration: number;
  todayCount: number;
  averageDuration: number;
}

export default function Statistics() {
  const [stats, setStats] = useState<Stats>({
    totalCount: 0,
    totalDuration: 0,
    todayCount: 0,
    averageDuration: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
    // 30秒ごとに統計情報を更新
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadStats() {
    try {
      const recordings = await getRecordings();

      // 今日の日付（JST）
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalDuration = 0;
      let todayCount = 0;

      recordings.forEach((recording) => {
        // 再生時間の合計
        if (recording.duration) {
          totalDuration += recording.duration;
        }

        // 本日の録音数
        const recordingDate = new Date(recording.created_at);
        recordingDate.setHours(0, 0, 0, 0);
        if (recordingDate.getTime() === today.getTime()) {
          todayCount++;
        }
      });

      const averageDuration = recordings.length > 0 ? totalDuration / recordings.length : 0;

      setStats({
        totalCount: recordings.length,
        totalDuration,
        todayCount,
        averageDuration,
      });
    } catch (err) {
      console.error('統計情報の取得に失敗しました:', err);
    } finally {
      setIsLoading(false);
    }
  }

  function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}時間${mins}分${secs}秒`;
    } else if (mins > 0) {
      return `${mins}分${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-sm animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-2">総録音数</h3>
        <p className="text-3xl font-bold text-gray-900">{stats.totalCount}</p>
        <p className="text-xs text-gray-500 mt-1">件</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-2">総再生時間</h3>
        <p className="text-3xl font-bold text-gray-900">
          {formatDuration(stats.totalDuration)}
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-2">本日の録音数</h3>
        <p className="text-3xl font-bold text-gray-900">{stats.todayCount}</p>
        <p className="text-xs text-gray-500 mt-1">件</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-2">平均再生時間</h3>
        <p className="text-3xl font-bold text-gray-900">
          {formatDuration(stats.averageDuration)}
        </p>
      </div>
    </div>
  );
}
