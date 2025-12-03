interface StatCardProps {
  label: string;
  value: string | number;
  helperText?: string;
}

export function StatCard({ label, value, helperText }: StatCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="mt-1 text-lg font-semibold text-neutral-900">
        {value}
      </span>
      {helperText ? (
        <span className="mt-1 text-xs text-neutral-500">{helperText}</span>
      ) : null}
    </div>
  );
}
