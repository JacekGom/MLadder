"use client";

import { useState } from "react";

/** Shares or copies the current page's URL. */
export default function CopyLink({ label = "Udostępnij link" }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Drabinka muzyczna", url });
        return;
      } catch {
        // Cancelled or unsupported; fall back to copying.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <button className="button" onClick={onClick}>
      {copied ? "Skopiowano ✓" : label}
    </button>
  );
}
