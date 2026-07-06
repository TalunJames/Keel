import { useState, useEffect, useCallback } from "react";

function readPref(key, defaultValue) {
  try {
    const stored = localStorage.getItem("keel:" + key);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem("keel:" + key, JSON.stringify(value));
  } catch { /* quota */ }
}

export function usePref(key, defaultValue) {
  const [v, setV] = useState(() => readPref(key, defaultValue));
  useEffect(() => {
    writePref(key, v);
  }, [key, v]);
  return [v, setV];
}

function readScopedMap(baseKey) {
  const raw = readPref(baseKey, null);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  // Migrate legacy flat array/object prefs to per-scope map.
  if (raw != null) return { all: raw };
  return {};
}

/** Per-scope preferences (e.g. home layout per selected client). */
export function useScopedPref(baseKey, scope, defaultValue) {
  const scopeKey = scope || "all";
  const [map, setMap] = useState(() => readScopedMap(baseKey));

  const value = map[scopeKey] ?? defaultValue;

  const setValue = useCallback((next) => {
    setMap((prev) => {
      const current = prev[scopeKey] ?? defaultValue;
      const resolved = typeof next === "function" ? next(current) : next;
      return { ...prev, [scopeKey]: resolved };
    });
  }, [scopeKey, defaultValue]);

  useEffect(() => {
    writePref(baseKey, map);
  }, [baseKey, map]);

  return [value, setValue];
}
