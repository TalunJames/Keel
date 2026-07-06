import { useState, useEffect, useRef, useCallback } from "react";
import { ALL_MODULES } from "./modules.js";

const APP_SECTIONS = new Set([
  ...ALL_MODULES.map((m) => m.id),
  "admin",
  "account",
  "new-client",
]);

export function sectionFromPath(pathname = window.location.pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  const section = path.slice(1);
  return APP_SECTIONS.has(section) ? section : null;
}

export function sectionPath(section) {
  return section === "home" ? "/" : `/${section}`;
}

/** Keeps workspace tab (section) in sync with browser history so back/forward work. */
export function useSectionHistory(defaultSection = "home") {
  const isFirst = useRef(true);
  const skipPush = useRef(false);
  const [section, setSectionState] = useState(() => sectionFromPath() || defaultSection);

  const setSection = useCallback((next) => {
    setSectionState(next);
  }, []);

  useEffect(() => {
    const onPopState = (e) => {
      skipPush.current = true;
      const next = e.state?.section ?? sectionFromPath();
      setSectionState(APP_SECTIONS.has(next) ? next : defaultSection);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [defaultSection]);

  useEffect(() => {
    const url = sectionPath(section);
    const state = { section };

    if (skipPush.current) {
      skipPush.current = false;
      return;
    }

    if (isFirst.current) {
      isFirst.current = false;
      history.replaceState(state, "", url);
      return;
    }

    history.pushState(state, "", url);
  }, [section]);

  return [section, setSection];
}
