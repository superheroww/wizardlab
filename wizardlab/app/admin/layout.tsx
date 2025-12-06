import type { ReactNode } from "react";

export const metadata = {
  title: "Admin · Wizardlab",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
  );
}
