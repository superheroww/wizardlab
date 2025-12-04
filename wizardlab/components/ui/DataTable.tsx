"use client";

import React from "react";

export interface ColumnDef {
  key: string;
  label: string;
  isNumeric?: boolean;
}

interface DataTableProps {
  columns: ColumnDef[];
  rows: Record<string, React.ReactNode>[];
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (key: string) => void;
  emptyMessage?: string;
}

export function DataTable({
  columns,
  rows,
  sortKey,
  sortDirection,
  onSortChange,
  emptyMessage = "No data to display.",
}: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-neutral-50 text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-500 sm:text-xs">
          <tr>
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              const indicator = isSorted
                ? sortDirection === "asc"
                  ? "▲"
                  : "▼"
                : " ";

              return (
                <th key={column.key} className="px-3 py-2">
                  {onSortChange ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-neutral-600 transition hover:text-neutral-900"
                      onClick={() => onSortChange(column.key)}
                    >
                      <span>{column.label}</span>
                      <span aria-hidden className="text-[0.65rem]">
                        {indicator}
                      </span>
                    </button>
                  ) : (
                    <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-neutral-600">
                      {column.label}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-4 text-center text-sm text-neutral-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="hover:bg-neutral-50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-2 text-sm ${
                      column.isNumeric ? "text-right tabular-nums" : "text-left"
                    }`}
                  >
                    {row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
