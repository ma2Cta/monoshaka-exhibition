"use client";

import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  showNav?: boolean;
}

export default function Header({ showNav = true }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                monoshaka
              </span>
            </Link>

            {showNav && (
              <nav className="flex gap-4">
                <Link
                  href="/record"
                  className={`text-sm hover:text-foreground transition-colors ${
                    pathname === "/record"
                      ? "font-bold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  録音
                </Link>
                <Link
                  href="/record/feedback"
                  className={`text-sm hover:text-foreground transition-colors ${
                    pathname === "/record/feedback"
                      ? "font-bold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  録音（FB付）
                </Link>
                <Link
                  href="/play"
                  className={`text-sm hover:text-foreground transition-colors ${
                    pathname === "/play"
                      ? "font-bold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  再生
                </Link>
                <Link
                  href="/admin"
                  className={`text-sm hover:text-foreground transition-colors ${
                    pathname?.startsWith("/admin") &&
                    !pathname?.startsWith("/admin/v2")
                      ? "font-bold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  管理
                </Link>
                <Link
                  href="/admin/v2"
                  className={`text-sm hover:text-foreground transition-colors ${
                    pathname?.startsWith("/admin/v2")
                      ? "font-bold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  新管理（プレイリストから再生可能）
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
