import type { ReactNode } from "react";

import { AdminNav } from "@/components/layout/AdminNav";

export const metadata = {
  title: "Admin · Wizardlab",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
