'use client';

import { getStatusMeta } from "@/lib/social/statusMeta";

type StatusPillProps = {
  status?: string | null;
  count?: number;
  variant?: "full" | "compact";
  className?: string;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function StatusPill({
  status,
  count,
  variant = "full",
  className,
}: StatusPillProps) {
  const meta = getStatusMeta(status);
  const sizeClasses =
    variant === "compact"
      ? "px-2.5 py-0.5 text-[0.7rem]"
      : "px-3 py-1 text-xs sm:text-sm";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border font-medium capitalize shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
        meta.bg,
        meta.text,
        meta.border,
        sizeClasses,
        className
      )}
    >
      <span
        aria-hidden
        className={cx("h-1.5 w-1.5 rounded-full", meta.dot)}
      />
      <span className="whitespace-nowrap">
        {meta.label}
        {typeof count === "number" ? (
          <span className="ml-1 font-normal text-neutral-500">
            &middot; {count}
          </span>
        ) : null}
      </span>
    </span>
  );
}
