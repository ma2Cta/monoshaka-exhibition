"use client";

import PlaylistManager from "@/components/playlist/PlaylistManager";
import Header from "@/components/layout/Header";

export default function Home() {
  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* プレイリスト管理 */}
          <section>
            <PlaylistManager />
          </section>
        </div>
      </div>
    </>
  );
}
