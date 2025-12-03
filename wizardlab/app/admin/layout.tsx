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
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">WizardLab Admin</h1>
        <p className="text-sm text-neutral-500">
          Internal dashboards for mix events and social engagement.
        </p>
      </header>
      {children}
    </div>
  );
}
