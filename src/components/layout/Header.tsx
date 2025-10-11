'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  title?: string;
  showNav?: boolean;
}

export default function Header({ title, showNav = true }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            {title && <h1 className="text-xl font-semibold">{title}</h1>}

            {showNav && (
              <nav className="flex gap-4">
                <Link
                  href="/"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  録音
                </Link>
                <Link
                  href="/play"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  再生
                </Link>
                <Link
                  href="/admin"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  管理
                </Link>
              </nav>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </Button>
        </div>
      </div>
    </header>
  );
}
