import { useState, useEffect } from "react";

export function usePref(key, defaultValue) {
  const [v, setV] = useState(() => {
    try {
      const stored = localStorage.getItem("keel:" + key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("keel:" + key, JSON.stringify(v));
    } catch { /* quota */ }
  }, [key, v]);
  return [v, setV];
}
