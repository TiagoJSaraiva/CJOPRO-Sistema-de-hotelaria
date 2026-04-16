"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  delayMs?: number;
  minVisibleMs?: number;
  lockUntilUnmount?: boolean;
  style?: CSSProperties;
  className?: string;
};

export function PendingSubmitButton({
  children,
  pendingLabel = "Carregando...",
  delayMs = 200,
  minVisibleMs = 320,
  lockUntilUnmount = false,
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

    if (lockUntilUnmount && startedAtRef.current !== null) {
      setIsVisualPending(true);
      setShowSpinner(true);
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
  }, [pending, delayMs, minVisibleMs, lockUntilUnmount]);

  return (
    <button
      type="submit"
      disabled={pending || isVisualPending}
      aria-busy={isVisualPending}
      className={`inline-flex min-h-[2.35rem] min-w-36 items-center justify-center rounded-lg border-0 bg-[#0f6d5f] px-[0.8rem] py-[0.6rem] font-semibold text-white ${
        pending || isVisualPending ? "cursor-not-allowed opacity-[0.88]" : "cursor-pointer"
      } ${className ?? ""}`}
      style={style}
    >
      {isVisualPending && showSpinner ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-[pms-spin_0.8s_linear_infinite] rounded-full border-2 border-[rgba(255,255,255,0.35)] border-t-white"
        />
      ) : isVisualPending ? (
        pendingLabel
      ) : (
        children
      )}
    </button>
  );
}
