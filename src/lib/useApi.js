import { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";

export function useApi(path, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    if (!enabled || !path) {
      setLoading(false);
      return Promise.resolve(null);
    }
    setLoading(true);
    setError(null);
    return api(path)
      .then((d) => {
        setData(d);
        setLoading(false);
        return d;
      })
      .catch((e) => {
        setError(e);
        setLoading(false);
        return null;
      });
  }, [path, enabled]);

  useEffect(() => {
    reload();
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
