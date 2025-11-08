"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScrollToTopProps {
  /**
   * スクロール位置がこの値を超えたらボタンを表示（デフォルト: 300px）
   */
  threshold?: number;
  /**
   * ボタンの表示位置（デフォルト: right-bottom）
   */
  position?: "right-bottom" | "left-bottom";
}

export function ScrollToTop({
  threshold = 300,
  position = "right-bottom",
}: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);

    // 初期状態をチェック
    toggleVisibility();

    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const positionClasses =
    position === "right-bottom" ? "right-6 bottom-6" : "left-6 bottom-6";

  return (
    <div
      className={`fixed ${positionClasses} z-50 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <Button
        onClick={scrollToTop}
        size="lg"
        className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-shadow"
        aria-label="ページトップに戻る"
      >
        <ArrowUp className="h-6 w-6" />
      </Button>
    </div>
  );
}
