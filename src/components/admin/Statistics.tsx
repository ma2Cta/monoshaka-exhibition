'use client';

import { useMemo } from 'react';
import { Recording } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Music, Clock, Calendar, TrendingUp } from 'lucide-react';

interface Stats {
  totalCount: number;
  totalDuration: number;
  todayCount: number;
  averageDuration: number;
}

interface StatisticsProps {
  recordings?: Recording[];
  isLoading?: boolean;
}

export default function Statistics({ recordings = [], isLoading = false }: StatisticsProps) {
  const stats = useMemo<Stats>(() => {
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

    return {
      totalCount: recordings.length,
      totalDuration,
      todayCount,
      averageDuration,
    };
  }, [recordings]);

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
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">総録音数</CardTitle>
          <Music className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalCount}</div>
          <p className="text-xs text-muted-foreground">件</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">総再生時間</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(stats.totalDuration)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">本日の録音数</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.todayCount}</div>
          <p className="text-xs text-muted-foreground">件</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">平均再生時間</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(stats.averageDuration)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
