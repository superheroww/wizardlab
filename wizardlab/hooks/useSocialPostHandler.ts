"use client";

import { useRouter } from "next/navigation";
import type { SocialEngageRow } from "@/app/admin/social-metrics/types";

export function useSocialPostHandler() {
  const router = useRouter();

  async function copyToClipboard(text: string) {
    try {
      // Prefer modern API when in secure context
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      // Fallback for desktop browsers that block navigator.clipboard
      const textarea = document.createElement("textarea");
      textarea.value = text;

      // Prevent scrolling to bottom on desktop
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "-9999px";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch (err) {
      console.error("clipboard_fallback_failed", err);
      return false;
    }
  }

  async function handlePost(row: SocialEngageRow) {
    if (!row?.id) return;

    const text = row.ai_reply_draft?.trim();

    if (text) {
      const ok = await copyToClipboard(text);
      if (!ok) {
        console.error("social_post: clipboard_failed");
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