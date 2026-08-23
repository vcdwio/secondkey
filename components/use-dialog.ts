"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,summary,[tabindex]:not([tabindex="-1"])';

/**
 * Keeps a dialog behaving like a dialog: Escape closes it, Tab stays inside it,
 * and focus returns to whatever opened it.
 */
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement as HTMLElement | null;

    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;

      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null,
      );
      if (items.length === 0) return;

      const start = items[0];
      const end = items[items.length - 1];
      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        start.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      opener.current?.focus();
    };
  }, [open, onClose]);

  return ref;
}
