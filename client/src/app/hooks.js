import { useState, useEffect, useCallback } from "react";
import { request } from "../services/api.js";
export function useData(url) {
  const [state, set] = useState({
    loading: true,
    data: null,
    error: null,
    meta: null,
  });
  const [version, bump] = useState(0);
  useEffect(() => {
    let valid = true;
    if (!url) {
      set({ loading: false, data: null, error: null });
      return;
    }
    set((s) => ({ ...s, loading: true, error: null }));
    request(url)
      .then(
        (j) =>
          valid &&
          set({ loading: false, data: j.data, meta: j.meta, error: null }),
      )
      .catch((error) => valid && set({ loading: false, data: null, error }));
    return () => {
      valid = false;
    };
  }, [url, version]);
  return { ...state, reload: useCallback(() => bump((n) => n + 1), []) };
}
