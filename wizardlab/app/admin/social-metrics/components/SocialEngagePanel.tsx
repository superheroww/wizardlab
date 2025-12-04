"use client";

import { useState } from "react";
import type { SocialEngageRow } from "../types";
import SocialEngageDrawer from "./SocialEngageDrawer";
import SocialEngageTable from "./SocialEngageTable";

type Props = {
  rows: SocialEngageRow[];
  filterMode?: "status" | "none";
};

export default function SocialEngagePanel({
  rows,
  filterMode = "none",
}: Props) {
  const [selectedRow, setSelectedRow] = useState<SocialEngageRow | null>(null);

  return (
    <>
      <SocialEngageTable
        rows={rows}
        filterMode={filterMode}
        onViewRow={(row) => setSelectedRow(row)}
      />
      <SocialEngageDrawer
        open={!!selectedRow}
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
      />
    </>
  );
}
