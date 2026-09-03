"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type ContextHelpProps = {
  label: string;
  children: string;
};

export function ContextHelp({ label, children }: ContextHelpProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 320 });
  const open = !dismissed && (hovered || focused || pinned);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(320, window.innerWidth - margin * 2);
    const left = Math.min(
      Math.max(margin, rect.left),
      window.innerWidth - width - margin,
    );
    const placeAbove = window.innerHeight - rect.bottom < 150;
    setPosition({
      top: placeAbove ? Math.max(margin, rect.top - 12) : rect.bottom + 8,
      left,
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinned(false);
        setHovered(false);
        setDismissed(true);
        triggerRef.current?.focus();
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (
        pinned &&
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target)
      ) {
        setPinned(false);
      }
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open, pinned, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Ajuda: ${label}`}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => {
          setDismissed(false);
          setHovered(true);
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => {
          setDismissed(false);
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          setDismissed(false);
        }}
        onClick={() => {
          if (pinned) {
            setPinned(false);
            setHovered(false);
            setDismissed(true);
          } else {
            setDismissed(false);
            setPinned(true);
          }
        }}
        className="ml-1 inline-grid h-6 w-6 cursor-help place-items-center rounded-full border border-[#0f766e] bg-white text-xs font-bold leading-none text-[#0a5f58]"
      >
        ?
      </button>
      {open
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className="fixed z-[1500] rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-normal leading-relaxed text-white shadow-lg"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                transform:
                  window.innerHeight -
                    triggerRef.current!.getBoundingClientRect().bottom <
                  150
                    ? "translateY(-100%)"
                    : undefined,
              }}
            >
              {children}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
