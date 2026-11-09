"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Defaults to the current page. */
  url?: string;
  /** Optional text copied/shared above the link (e.g. the ladder message). */
  text?: string | null;
  title?: string;
};

/**
 * "Kopiuj link" copies the message (if any) and the link, ready to paste
 * into a chat. "Udostępnij" opens the phone's share sheet where available.
 */
export default function CopyLink({ url, text, title = "Drabinka muzyczna" }: Props) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  const link = () => url ?? window.location.href;

  async function copy() {
    const value = text ? `${text}\n${link()}` : link();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Older browsers / non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function share() {
    try {
      await navigator.share({ title, text: text ?? undefined, url: link() });
    } catch {
      // Cancelled.
    }
  }

  return (
    <div className="row">
      <button className="button" onClick={copy}>
        {copied ? "Skopiowano ✓" : "📋 Kopiuj link"}
      </button>
      {canShare && (
        <button className="button secondary" onClick={share}>
          Udostępnij
        </button>
      )}
    </div>
  );
}
