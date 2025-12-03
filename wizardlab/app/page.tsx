import type { Metadata } from "next";
import Link from "next/link";

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <LandingCard
          title="Mix events analytics"
          description="View ETF mix events, top symbols, and popular combinations."
          href="/admin/mix-events"
        />
        <LandingCard
          title="Social metrics"
          description="Monitor Reddit triggers and social engagement."
          href="/admin/social-metrics"
        />
        <LandingCard
          title="ETF holdings explorer"
          description="Inspect raw ETF holdings by fund and underlying symbol."
          href="/admin/etf-holdings"
        />
      </div>
    </div>
  );
}

function LandingCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-600">{description}</p>
      </div>
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Open
        </Link>
      </div>
    </div>
  );
}
