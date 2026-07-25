"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/materials", label: "자재 마스터" },
  { href: "/orders", label: "도급발주" },
  { href: "/consigned-reqs", label: "사급청구" },
  { href: "/issues", label: "출고기록" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  pathname,
  userEmail,
  onNavigate,
}: {
  pathname: string;
  userEmail: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col gap-0.5 px-4 py-5">
        <span className="text-sm font-semibold text-sidebar-foreground">
          자재 대시보드
        </span>
        <span className="text-xs text-sidebar-foreground/80">HANYANGENG USA</span>
      </div>
      <nav aria-label="주 메뉴" className="flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3 border-t border-sidebar-border px-4 py-4">
        {userEmail ? (
          <span className="truncate text-xs text-sidebar-foreground/80">
            {userEmail}
          </span>
        ) : null}
        <LogoutButton />
      </div>
    </div>
  );
}

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block md:h-full md:w-[240px] md:shrink-0 md:overflow-y-auto md:border-r md:border-sidebar-border lg:w-[260px]">
        <SidebarContent pathname={pathname} userEmail={userEmail} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
        <span className="text-sm font-semibold text-sidebar-foreground">
          자재 대시보드
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          aria-expanded={open}
          className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative flex h-full w-[260px] max-w-[80vw] flex-col bg-sidebar">
            <div className="flex shrink-0 items-center justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SidebarContent
                pathname={pathname}
                userEmail={userEmail}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
