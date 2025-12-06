"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TOOL_NAV_ITEMS } from "@/lib/toolsNav";

export function AdminNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav className="flex flex-wrap gap-2">
      {TOOL_NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`rounded-full px-3 py-1 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 ${
            isActive(item.href)
              ? "bg-neutral-900 text-white"
              : "border border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:text-neutral-900"
          }`}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
