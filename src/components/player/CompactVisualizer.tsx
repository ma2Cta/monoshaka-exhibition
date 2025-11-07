'use client';

import { useMemo } from 'react';

interface CompactVisualizerProps {
  isPlaying: boolean;
}

/**
 * コンパクトな音声ビジュアライザー (150px × 40px)
 * 再生中のみアニメーションが動きます
 */
export function CompactVisualizer({ isPlaying }: CompactVisualizerProps) {
  // 波形アニメーションの高さを固定（初回のみ生成）
  const waveHeights = useMemo(() => {
    return Array.from({ length: 10 }, () => Math.random() * 80 + 20);
  }, []);

  // 各縦棒のアニメーション速度を固定（初回のみ生成）
  const waveAnimationDurations = useMemo(() => {
    return Array.from({ length: 10 }, () => Math.random() * 0.5 + 0.5);
  }, []);

  return (
    <div className="flex items-center justify-center gap-1 h-10" style={{ width: '150px' }}>
      {waveHeights.map((height, i) => (
        <div
          key={i}
          className={`w-2 bg-primary rounded-full ${isPlaying ? 'animate-pulse' : ''}`}
          style={{
            height: `${height}%`,
            animationDelay: `${i * 0.05}s`,
            animationDuration: `${waveAnimationDurations[i]}s`,
          }}
        />
      ))}
    </div>
  );
}
