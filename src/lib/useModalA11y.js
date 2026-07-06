import { useEffect, useRef } from "react";

// Shared modal accessibility hook: closes on Escape, moves initial focus into
// the dialog, and traps Tab focus within it. Returns a ref to attach to the
// dialog container. Pass the onClose handler used by the modal.
export function useModalA11y(onClose) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return undefined;

    const previouslyFocused = document.activeElement;

    const focusable = () =>
      Array.from(
        node.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Move focus into the dialog.
    const first = focusable()[0];
    if (first) first.focus();
    else if (node.setAttribute) { node.setAttribute("tabindex", "-1"); node.focus(); }

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === "Tab") {
        const items = focusable();
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return dialogRef;
}
