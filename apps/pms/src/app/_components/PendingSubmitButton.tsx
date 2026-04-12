"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  delayMs?: number;
  minVisibleMs?: number;
  style?: CSSProperties;
  className?: string;
};

const spinnerStyle: CSSProperties = {
  width: "1rem",
  height: "1rem",
  borderRadius: "999px",
  border: "2px solid rgba(255, 255, 255, 0.35)",
  borderTopColor: "#ffffff",
  animation: "pms-spin 0.8s linear infinite"
};

export function PendingSubmitButton({
  children,
  pendingLabel = "Carregando...",
  delayMs = 200,
  minVisibleMs = 320,
  style,
  className
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [isVisualPending, setIsVisualPending] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const spinnerTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  function clearTimers() {
    if (spinnerTimerRef.current !== null) {
      window.clearTimeout(spinnerTimerRef.current);
      spinnerTimerRef.current = null;
    }

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  useEffect(() => {
    clearTimers();

    if (pending) {
      startedAtRef.current = Date.now();
      setIsVisualPending(true);

      if (delayMs <= 0) {
        setShowSpinner(true);
      } else {
        setShowSpinner(false);
        spinnerTimerRef.current = window.setTimeout(() => {
          setShowSpinner(true);
        }, delayMs);
      }

      return () => clearTimers();
    }

    const startedAt = startedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(minVisibleMs - elapsed, 0);

    hideTimerRef.current = window.setTimeout(() => {
      setIsVisualPending(false);
      setShowSpinner(false);
      startedAtRef.current = null;
    }, remaining);

    return () => clearTimers();
  }, [pending, delayMs, minVisibleMs]);

  return (
    <button
      type="submit"
      disabled={pending || isVisualPending}
      aria-busy={isVisualPending}
      className={className}
      style={{
        border: 0,
        borderRadius: "8px",
        padding: "0.6rem 0.8rem",
        background: "#0f6d5f",
        color: "#fff",
        fontWeight: 600,
        cursor: pending || isVisualPending ? "not-allowed" : "pointer",
        opacity: pending || isVisualPending ? 0.88 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "9rem",
        minHeight: "2.35rem",
        ...style
      }}
    >
      {isVisualPending && showSpinner ? (
        <span style={spinnerStyle} aria-hidden="true" />
      ) : isVisualPending ? (
        pendingLabel
      ) : (
        children
      )}
    </button>
  );
}
