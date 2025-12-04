import type { Metadata } from "next";
import "./globals.css";
import { HeaderNav } from "@/components/layout/HeaderNav";

export const metadata: Metadata = {
  title: "Wizardlab",
  description: "Lab for Wizardfolio experiments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <HeaderNav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
