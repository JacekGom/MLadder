"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Removes a ladder from the profile (and from the database once both sides did). */
export default function DeleteLadderButton({ token, label }: { token: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm(`Usunąć „${label}” z Twojego profilu?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ladders/${token}/delete`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      window.alert("Nie udało się usunąć drabinki.");
      setBusy(false);
    }
  }
  return (
    <button
      className="icon-button"
      onClick={remove}
      disabled={busy}
      aria-label={`Usuń ${label}`}
      title="Usuń z profilu"
    >
      🗑
    </button>
  );
}
