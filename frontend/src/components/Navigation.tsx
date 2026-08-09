"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  PenIcon,
  ChartIcon,
  BookIcon,
  UserIcon,
  HistoryIcon,
} from "./ui/icons";

const primaryItems = [
  { name: "首页", href: "/", icon: HomeIcon },
  { name: "申论批改", href: "/essay", icon: PenIcon },
  { name: "能力测评", href: "/assessment", icon: ChartIcon },
  { name: "题库练习", href: "/practice", icon: BookIcon },
  { name: "学习档案", href: "/profile", icon: UserIcon },
];

const secondaryItems = [{ name: "批改历史", href: "/history", icon: HistoryIcon }];

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const renderItem = (item: (typeof primaryItems)[number], onNavigate?: () => void) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
          active
            ? "bg-surface-muted text-ink font-medium"
            : "text-ink-secondary hover:text-ink hover:bg-surface-muted"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent" />
        )}
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <>
      {/* 桌面端：左侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:flex w-60 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2.5 h-16 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-white font-serif font-bold text-lg">智</span>
          </div>
          <span className="font-serif font-semibold text-ink text-[15px] leading-tight">
            智考公考伴侣
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {primaryItems.map((item) => renderItem(item))}
          <div className="pt-4 mt-4 border-t border-border space-y-1">
            {secondaryItems.map((item) => renderItem(item))}
          </div>
        </nav>

        <div className="px-5 py-4 text-xs text-ink-tertiary border-t border-border leading-relaxed">
          AI 驱动的申论智能批改平台
        </div>
      </aside>

      {/* 移动端：顶部细条品牌栏 */}
      <div className="lg:hidden sticky top-0 z-30 h-14 bg-surface/95 backdrop-blur border-b border-border flex items-center gap-2.5 px-4">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <span className="text-white font-serif font-bold text-sm">智</span>
        </div>
        <span className="font-serif font-semibold text-ink text-[15px]">
          智考公考伴侣
        </span>
      </div>

      {/* 移动端：底部 Tab 栏 */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {primaryItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors duration-150 ${
                  active
                    ? "text-accent font-medium"
                    : "text-ink-tertiary hover:text-ink"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
