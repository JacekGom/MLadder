"use client";

import Link from "next/link";
import CopyLink from "@/components/CopyLink";
import { useEffect, useMemo, useState } from "react";
import { LADDER_SIZES, type LadderSize, type TrackSummary } from "@/lib/tracks";

type Props = { top: TrackSummary[]; topError: boolean };

export default function LadderBuilder({ top, topError }: Props) {
  const [size, setSize] = useState<LadderSize>(8);
  const [selected, setSelected] = useState<TrackSummary[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((t) => t.id)), [selected]);
  const full = selected.length >= size;

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError(false);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        setResults((await res.json()).tracks);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function toggle(t: TrackSummary) {
    setSelected((prev) =>
      prev.some((p) => p.id === t.id)
        ? prev.filter((p) => p.id !== t.id)
        : prev.length < size
          ? [...prev, t]
          : prev,
    );
  }

  function changeSize(next: LadderSize) {
    setSize(next);
    // Keep the first picks if the ladder got smaller.
    setSelected((prev) => prev.slice(0, next));
  }

  function fillFromTop() {
    setSelected((prev) => {
      const ids = new Set(prev.map((t) => t.id));
      const extra = top.filter((t) => !ids.has(t.id)).slice(0, size - prev.length);
      return [...prev, ...extra];
    });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/ladders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: selected, name, message }),
      });
      if (res.status === 401) {
        window.location.href = "/api/auth/login?next=/new";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error ?? String(res.status));
        (err as Error & { detail?: string }).detail = data.detail;
        throw err;
      }
      setShareUrl(`${window.location.origin}/l/${data.token}`);
    } catch (e) {
      setSubmitError(
        (e as Error).message === "db_not_configured"
          ? "Baza danych nie jest skonfigurowana (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
          : `Nie udało się zapisać drabinki. ${
              (e as Error & { detail?: string }).detail ?? (e as Error).message
            }`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (shareUrl) {
    return (
      <section className="stack">
        <p>Gotowe! Wyślij ten link osobie, która ma rozstrzygnąć drabinkę:</p>
        <input className="input" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
        <CopyLink url={shareUrl} text={message.trim() || null} title={name || undefined} />
        {message.trim() && (
          <p className="muted small">„Kopiuj link” skopiuje też Twoją wiadomość.</p>
        )}
        <div>
          <Link className="button secondary" href="/">
            Strona główna
          </Link>
        </div>
      </section>
    );
  }

  const searching = query.trim().length > 0;
  const list = searching ? results : top;

  return (
    <section className="stack">
      <div>
        <div className="label">Rozmiar drabinki</div>
        <div className="segmented" role="radiogroup">
          {LADDER_SIZES.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={size === s}
              className={size === s ? "active" : ""}
              onClick={() => changeSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <label className="stack-sm">
        <span className="label">Nazwa drabinki (opcjonalnie)</span>
        <input
          className="input"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Jesienne hity"
        />
      </label>
      <label className="stack-sm">
        <span className="label">Wiadomość dla odbiorcy (opcjonalnie)</span>
        <input
          className="input"
          maxLength={280}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="np. Która najlepsza na jesień?"
        />
      </label>

      <div className="sticky-bar">
        <span>
          Wybrano <strong>{selected.length}</strong> z {size}
        </span>
        <button className="button" disabled={!full || submitting} onClick={submit}>
          {submitting ? "Zapisuję…" : "Utwórz link"}
        </button>
      </div>
      {submitError && <p className="error">{submitError}</p>}

      {selected.length > 0 && (
        <details>
          <summary className="muted">Pokaż wybrane ({selected.length})</summary>
          <TrackList tracks={selected} selectedIds={selectedIds} full={full} onToggle={toggle} />
        </details>
      )}

      <input
        className="input"
        type="search"
        placeholder="🔍 Szukaj dowolnej piosenki w Spotify"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {searching ? (
        <>
          <p className="label">Wyniki wyszukiwania</p>
          {loading && <p className="muted">Szukam…</p>}
          {searchError && <p className="error">Wyszukiwanie nie powiodło się.</p>}
          {!loading && !searchError && results.length === 0 && (
            <p className="muted">Nic nie znaleziono.</p>
          )}
        </>
      ) : (
        <>
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <p className="label" style={{ margin: 0 }}>
              Twoje top 50 z ostatniego miesiąca
            </p>
            {top.length > 0 && !full && (
              <button className="button secondary" onClick={fillFromTop}>
                Uzupełnij z top ({size - selected.length})
              </button>
            )}
          </div>
          {topError && <p className="error">Nie udało się pobrać Twoich top utworów.</p>}
          {!topError && top.length === 0 && (
            <p className="muted">
              Spotify nie ma jeszcze Twoich top utworów z ostatniego miesiąca. Użyj wyszukiwarki.
            </p>
          )}
        </>
      )}

      <TrackList tracks={list} selectedIds={selectedIds} full={full} onToggle={toggle} />
    </section>
  );
}

function TrackList({
  tracks,
  selectedIds,
  full,
  onToggle,
}: {
  tracks: TrackSummary[];
  selectedIds: Set<string>;
  full: boolean;
  onToggle: (t: TrackSummary) => void;
}) {
  return (
    <ul className="tracks">
      {tracks.map((t) => {
        const isSelected = selectedIds.has(t.id);
        return (
          <li key={t.id}>
            <button
              className={`track${isSelected ? " selected" : ""}`}
              disabled={!isSelected && full}
              aria-pressed={isSelected}
              onClick={() => onToggle(t)}
            >
              {t.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.image} alt="" width={48} height={48} />
              ) : (
                <span className="cover-placeholder" />
              )}
              <span className="track-text">
                <span className="track-name">{t.name}</span>
                <span className="muted">{t.artists}</span>
              </span>
              <span className="check" aria-hidden>
                {isSelected ? "✓" : "+"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
