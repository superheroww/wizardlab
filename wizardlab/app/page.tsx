import type { Metadata } from "next";
import Link from "next/link";

import { TOOL_NAV_ITEMS, type ToolNavItem } from "@/lib/toolsNav";

export const metadata: Metadata = {
  title: "WizardLab tools",
  description: "Internal dashboards for mix events and social engagement.",
};

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">WizardLab tools</h1>
        <p className="text-sm text-neutral-600">
          Internal dashboards for mix events and social engagement.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOL_NAV_ITEMS.map((tool) => (
          <LandingCard key={tool.id} tool={tool} />
        ))}
      </section>
    </div>
  );
}

function LandingCard({ tool }: { tool: ToolNavItem }) {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">{tool.title}</h2>
        <p className="text-sm text-neutral-600">{tool.description}</p>
      </div>
      <div className="mt-4">
        <Link
          href={tool.href}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Open →
        </Link>
      </div>
    </div>
  );
}
