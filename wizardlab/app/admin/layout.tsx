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
    <div className="flex flex-col gap-6">
      {children}
    </div>
  );
}