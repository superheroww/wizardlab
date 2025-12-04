const STATUS_SEQUENCE = [
  "pending",
  "ready",
  "ignored",
  "error",
  "duplicate_semantic",
  "posted",
] as const;

export type KnownStatus = (typeof STATUS_SEQUENCE)[number];

type StatusMeta = {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
};

const STATUS_META: Record<string, StatusMeta> = {
  pending: {
    label: "Pending",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-100",
    dot: "bg-amber-500",
  },
  ready: {
    label: "Ready",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-100",
    dot: "bg-emerald-500",
  },
  ignored: {
    label: "Ignored",
    bg: "bg-neutral-50",
    text: "text-neutral-600",
    border: "border-neutral-200",
    dot: "bg-neutral-400",
  },
  error: {
    label: "Error",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-100",
    dot: "bg-rose-400",
  },
  duplicate_semantic: {
    label: "Duplicates",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-100",
    dot: "bg-purple-400",
  },
  posted: {
    label: "Posted",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-500",
  },
  unknown: {
    label: "Other",
    bg: "bg-neutral-50",
    text: "text-neutral-600",
    border: "border-neutral-200",
    dot: "bg-neutral-400",
  },
};

export function getStatusMeta(status?: string | null): StatusMeta {
  const normalized = normalizeStatus(status);
  return STATUS_META[normalized] ?? STATUS_META.unknown;
}

export function normalizeStatus(status?: string | null): string {
  if (!status) return "unknown";
  const normalized = status.toLowerCase();
  if (normalized === "duplicate") return "duplicate_semantic";
  return normalized;
}

export function isKnownStatus(value: string): value is KnownStatus {
  return STATUS_SEQUENCE.includes(value as KnownStatus);
}

export function getStatusSequence(): KnownStatus[] {
  return [...STATUS_SEQUENCE];
}
