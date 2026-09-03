"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useModalFocus } from "./useModalFocus";

export type UsageGuideStep = {
  id: string;
  target: string;
  title: string;
  description: string;
};

export type UsageGuideDefinition = {
  id: string;
  title: string;
  steps: UsageGuideStep[];
};

export function validateUsageGuideDefinition(
  definition: UsageGuideDefinition,
): string[] {
  const errors: string[] = [];
  const stepIds = new Set<string>();
  const targets = new Set<string>();
  if (!definition.id.trim()) errors.push("O guia precisa de um identificador.");
  if (!definition.title.trim()) errors.push("O guia precisa de um título.");
  if (!definition.steps.length)
    errors.push("O guia precisa de ao menos um passo.");
  for (const step of definition.steps) {
    if (!step.id.trim()) errors.push("Todo passo precisa de um identificador.");
    if (!step.target.trim())
      errors.push(`O passo ${step.id} precisa de um alvo.`);
    if (!step.title.trim())
      errors.push(`O passo ${step.id} precisa de um título.`);
    if (!step.description.trim())
      errors.push(`O passo ${step.id} precisa de uma descrição.`);
    if (stepIds.has(step.id)) errors.push(`Passo duplicado: ${step.id}.`);
    if (targets.has(step.target))
      errors.push(`Alvo duplicado: ${step.target}.`);
    stepIds.add(step.id);
    targets.add(step.target);
  }
  return errors;
}

type TargetRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const VIEWPORT_MARGIN = 16;
const TARGET_PADDING = 6;
const PANEL_WIDTH = 360;
const PANEL_ESTIMATED_HEIGHT = 250;

function findTarget(target: string): HTMLElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-usage-guide]"),
    ).find((element) => element.dataset.usageGuide === target) ?? null
  );
}

function isAvailableTarget(
  element: HTMLElement | null,
): element is HTMLElement {
  if (!element || !element.isConnected || element.hidden) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function getAvailableUsageGuideSteps(
  definition: UsageGuideDefinition,
): UsageGuideStep[] {
  const seenIds = new Set<string>();
  const seenTargets = new Set<string>();

  return definition.steps.filter((step) => {
    if (
      !step.id.trim() ||
      !step.target.trim() ||
      !step.title.trim() ||
      !step.description.trim() ||
      seenIds.has(step.id) ||
      seenTargets.has(step.target)
    ) {
      return false;
    }
    seenIds.add(step.id);
    seenTargets.add(step.target);
    return isAvailableTarget(findTarget(step.target));
  });
}

function readTargetRect(target: HTMLElement): TargetRect {
  const rect = target.getBoundingClientRect();
  const top = Math.max(VIEWPORT_MARGIN, rect.top - TARGET_PADDING);
  const left = Math.max(VIEWPORT_MARGIN, rect.left - TARGET_PADDING);
  const right = Math.min(
    window.innerWidth - VIEWPORT_MARGIN,
    rect.right + TARGET_PADDING,
  );
  const bottom = Math.min(
    window.innerHeight - VIEWPORT_MARGIN,
    rect.bottom + TARGET_PADDING,
  );
  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function getPanelStyle(rect: TargetRect | null): CSSProperties {
  const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  if (window.innerWidth < 640 || !rect) {
    return {
      left: VIEWPORT_MARGIN,
      right: VIEWPORT_MARGIN,
      bottom: VIEWPORT_MARGIN,
      width: "auto",
    };
  }

  const spaceBelow = window.innerHeight - rect.bottom;
  const top =
    spaceBelow >= PANEL_ESTIMATED_HEIGHT + VIEWPORT_MARGIN
      ? rect.bottom + 12
      : Math.max(VIEWPORT_MARGIN, rect.top - PANEL_ESTIMATED_HEIGHT - 12);
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left),
    window.innerWidth - width - VIEWPORT_MARGIN,
  );
  return { top, left, width };
}

function GuideBackdrop({ rect }: { rect: TargetRect | null }) {
  if (!rect) {
    return <div className="fixed inset-0 bg-[rgba(9,18,31,0.68)]" />;
  }

  const backdropClassName = "fixed bg-[rgba(9,18,31,0.68)]";
  return (
    <>
      <div
        className={backdropClassName}
        style={{ inset: `0 0 auto 0`, height: rect.top }}
      />
      <div
        className={backdropClassName}
        style={{
          top: rect.top,
          left: 0,
          width: rect.left,
          height: rect.height,
        }}
      />
      <div
        className={backdropClassName}
        style={{
          top: rect.top,
          left: rect.right,
          right: 0,
          height: rect.height,
        }}
      />
      <div
        className={backdropClassName}
        style={{ top: rect.bottom, left: 0, right: 0, bottom: 0 }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-lg ring-4 ring-[#38bdf8] ring-offset-2 ring-offset-white"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />
    </>
  );
}

export function UsageGuide({
  definition,
}: {
  definition: UsageGuideDefinition;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [availableSteps, setAvailableSteps] = useState<UsageGuideStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocus<HTMLDivElement>(open, () => setOpen(false));

  const refreshAvailableSteps = useCallback(() => {
    const steps = getAvailableUsageGuideSteps(definition);
    setAvailableSteps(steps);
    return steps;
  }, [definition]);

  useEffect(() => {
    refreshAvailableSteps();
  }, [refreshAvailableSteps]);

  const currentStep = availableSteps[currentIndex] ?? null;

  const updatePosition = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }
    const target = findTarget(currentStep.target);
    setTargetRect(isAvailableTarget(target) ? readTargetRect(target) : null);
  }, [currentStep]);

  useEffect(() => {
    if (!open || !currentStep) return;
    const target = findTarget(currentStep.target);
    if (!isAvailableTarget(target)) {
      const steps = refreshAvailableSteps();
      if (!steps.length) setOpen(false);
      else setCurrentIndex((index) => Math.min(index, steps.length - 1));
      return;
    }

    target.scrollIntoView({ block: "center", inline: "nearest" });
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [currentStep, open, refreshAvailableSteps, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const panelStyle = useMemo(
    () => (typeof window === "undefined" ? {} : getPanelStyle(targetRect)),
    [targetRect],
  );

  if (!availableSteps.length) return null;

  function startGuide() {
    const steps = refreshAvailableSteps();
    if (!steps.length) return;
    setCurrentIndex(0);
    setOpen(true);
  }

  function closeGuide() {
    setOpen(false);
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  }

  const isLastStep = currentIndex === availableSteps.length - 1;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={startGuide}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#0f766e] bg-white px-3 py-2 text-sm font-semibold text-[#0a5f58]"
      >
        <span aria-hidden="true">?</span>
        Guia desta página
      </button>

      {open && currentStep
        ? createPortal(
            <div className="fixed inset-0 z-[1600]">
              <GuideBackdrop rect={targetRect} />
              <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                className="fixed z-[1601] grid max-h-[calc(100vh-2rem)] gap-3 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.3)]"
                style={panelStyle}
                data-usage-guide-dialog={definition.id}
              >
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
                      {definition.title} · Passo {currentIndex + 1} de{" "}
                      {availableSteps.length}
                    </p>
                    <h2 id={titleId} className="mb-0 mt-1 text-lg">
                      {currentStep.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeGuide}
                    className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                  >
                    Fechar
                  </button>
                </header>
                <p
                  id={descriptionId}
                  className="m-0 leading-relaxed text-slate-700"
                >
                  {currentStep.description}
                </p>
                <footer className="flex justify-between gap-3">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((index) => index - 1)}
                    className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      isLastStep
                        ? closeGuide()
                        : setCurrentIndex((index) => index + 1)
                    }
                    className="cursor-pointer rounded-lg bg-[#102a43] px-3 py-2 font-semibold text-white"
                  >
                    {isLastStep ? "Concluir" : "Próximo"}
                  </button>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
