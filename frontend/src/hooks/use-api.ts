'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFull, errorMessage } from '@/lib/client';

/** Fetches `path` (skipped when null) and exposes data/meta/loading/error + reload. */
export function useApi<T = unknown>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<{ page?: number; limit?: number; total?: number; unread?: number } | undefined>();
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) { setData(null); setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true); setError(null);
    try {
      const r = await apiFull<T>(path);
      if (mine === seq.current) { setData(r.data); setMeta(r.meta); }
    } catch (e) {
      if (mine === seq.current) setError(errorMessage(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => { void load(); }, [load]);
  return { data, meta, loading, error, reload: load, setData };
}
