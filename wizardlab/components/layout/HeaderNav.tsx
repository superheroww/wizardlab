"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { TOOL_NAV_ITEMS } from "@/lib/toolsNav";

export function HeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-neutral-900"
        >
          WizardLab
        </Link>

        <nav className="hidden items-center gap-2 text-sm font-medium text-neutral-700 sm:flex">
          {TOOL_NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`rounded-full px-3 py-1 transition ${
                isActive(item.href)
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-md border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 sm:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="border-t border-neutral-200 bg-white sm:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 text-sm font-medium text-neutral-800">
            {TOOL_NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2 transition ${
                  isActive(item.href) ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"
                }`}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
