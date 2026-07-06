import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api.js";

export function useApi(path, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);
  // Monotonic request id: only the newest request is allowed to write state, so
  // a slow older response can't clobber the result of a newer path/params.
  const reqIdRef = useRef(0);

  const reload = useCallback(() => {
    if (!enabled || !path) {
      setLoading(false);
      return Promise.resolve(null);
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    return api(path)
      .then((d) => {
        if (reqId !== reqIdRef.current) return d;
        setData(d);
        setLoading(false);
        return d;
      })
      .catch((e) => {
        if (reqId !== reqIdRef.current) return null;
        setError(e);
        setLoading(false);
        return null;
      });
  }, [path, enabled]);

  useEffect(() => {
    reload();
    // Invalidate the in-flight request when deps change or on unmount so its
    // response is ignored.
    return () => { reqIdRef.current++; };
  }, [reload, ...deps]);

  return { data, loading, error, reload, empty: !loading && !error && isEmpty(data) };
}

function isEmpty(data) {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (data.items) return !data.items.length;
  if (data.polls) return !data.polls.length;
  if (data.races) return !data.races.length;
  if (data.announcements) return !data.announcements?.length && !data.tasks?.length;
  return false;
}
