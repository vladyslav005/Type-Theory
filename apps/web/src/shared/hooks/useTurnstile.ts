import {useCallback, useEffect, useRef, useState} from "react";
import {env} from "@/shared/lib/env.ts";
import {loadTurnstile} from "@/shared/lib/turnstile.ts";

export function useTurnstile(active: boolean) {
  const [token, setToken] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !env.VITE_TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstile().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: env.VITE_TURNSTILE_SITE_KEY!,
        callback: setToken,
        "expired-callback": () => setToken(null),
        "error-callback": () => setToken(null),
      });
    }).catch(() => setToken(null));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      setToken(null);
    };
  }, [active]);

  // A Turnstile token is single-use; get a fresh one for the next attempt.
  const reset = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    setToken(null);
  }, []);

  return {enabled: !!env.VITE_TURNSTILE_SITE_KEY, token, containerRef, reset, ready: !env.VITE_TURNSTILE_SITE_KEY || !!token};
}
