'use client';

import { useRouter } from "next/navigation";
import type { SocialEngageRow } from "@/app/admin/social-metrics/types";

export function useSocialPostHandler() {
  const router = useRouter();

  async function handlePost(row: SocialEngageRow) {
    if (!row?.id) return;

    const text = row.ai_reply_draft?.trim();
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.error("social_post: clipboard_failed", error);
      }
    } else {
      console.warn("social_post: missing_reply_text", { id: row.id });
    }

    if (row.permalink) {
      window.open(row.permalink, "_blank", "noopener,noreferrer");
    }

    try {
      const response = await fetch("/api/social/mark-posted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      if (!response.ok) {
        console.error("social_post: mark_posted_failed", {
          id: row.id,
          status: response.status,
        });
      }
    } catch (error) {
      console.error("social_post: mark_posted_error", { id: row.id, error });
    } finally {
      router.refresh();
    }
  }

  return { handlePost };
}
