import { useCallback, useEffect, useState } from 'react';
import { errMsg } from './utils';

/** Paged list with a "load more" button. `fetcher` must be a stable function (declare it outside components). */
export function useLoadMore<T>(fetcher: (limit: number, offset: number) => Promise<{ rows: T[]; total: number }>, pageSize = 12) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number) => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetcher(pageSize, offset);
        setRows((prev) => (offset === 0 ? r.rows : [...prev, ...r.rows]));
        setTotal(r.total);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setLoading(false);
      }
    },
    [fetcher, pageSize],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return {
    rows,
    total,
    loading,
    error,
    hasMore: rows.length < total,
    loadMore: () => load(rows.length),
    retry: () => load(rows.length),
  };
}
