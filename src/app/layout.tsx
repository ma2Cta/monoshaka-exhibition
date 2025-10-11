import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "音声録音アプリ - 芸術祭展示",
  description: "小説の一節を読み上げて録音するアプリケーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
