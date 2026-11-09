"use client";

import { useEffect, useState } from "react";

/**
 * Links opened from Messenger, Instagram etc. load in that app's own
 * browser, which keeps its own cookies: every visit means logging in to
 * Spotify again (with a code sent by e-mail). Suggest the real browser.
 */
export default function InAppBrowserHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|Snapchat|TikTok/i.test(navigator.userAgent));
  }, []);
  if (!show) return null;
  return (
    <div className="notice" style={{ margin: 12 }}>
      <span>
        Otwórz tę stronę w Safari lub Chrome (menu ⋯ → „Otwórz w przeglądarce”). W przeglądarce
        tej aplikacji logowanie do Spotify nie jest zapamiętywane.
      </span>
      <button className="notice-close" onClick={() => setShow(false)} aria-label="Zamknij">
        ×
      </button>
    </div>
  );
}
