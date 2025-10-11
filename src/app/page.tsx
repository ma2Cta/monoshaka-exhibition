'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl mb-2">音声録音アプリ</CardTitle>
          <CardDescription className="text-lg">
            小説の一節を読み上げて録音するアプリケーション
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              このアプリでは、提示される小説の一節を読み上げて録音することができます。
            </p>
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full max-w-md"
                onClick={() => router.push('/record')}
              >
                録音を開始する
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full max-w-md"
                onClick={() => router.push('/play')}
              >
                再生画面
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full max-w-md"
                onClick={() => router.push('/admin')}
              >
                管理画面
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
