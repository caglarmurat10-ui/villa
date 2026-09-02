import { useCallback, useEffect, useState } from "react";
import { api, SessionExpiredError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function useApi<T>(path: string, deps: unknown[] = []) {
  const { logout } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(path);
      setData(result);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        await logout();
        return;
      }
      setError(err instanceof Error ? err.message : "Veri alınamadı.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
