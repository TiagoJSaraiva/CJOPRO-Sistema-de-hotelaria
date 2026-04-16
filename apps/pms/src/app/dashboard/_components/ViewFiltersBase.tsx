"use client";

import type { ReactNode } from "react";

type ViewFiltersActionsBarProps = {
  appliedFilterCount: number;
  onOpen: () => void;
  onClear: () => void;
  children?: ReactNode;
};

type ViewFiltersModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  children: ReactNode;
};

const overlayClassName = "fixed inset-0 z-[1000] grid place-items-center bg-[rgba(9,18,31,0.45)] p-4";
const panelClassName = "grid max-h-[82vh] w-full max-w-[760px] gap-[0.9rem] overflow-auto rounded-xl border border-[#d9dfe7] bg-white p-4";

export const viewFiltersFieldClassName = "w-full min-w-0 rounded-lg border border-[#d2d2d2] p-[0.55rem]";

export function ViewFiltersActionsBar({ appliedFilterCount, onOpen, onClear, children }: ViewFiltersActionsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-[220px] flex-1">{children}</div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="cursor-pointer rounded-lg border border-[#0f766e] bg-white px-[0.7rem] py-[0.45rem] font-semibold text-[#0a5f58]"
        >
          Filtrar dados{appliedFilterCount ? ` (${appliedFilterCount})` : ""}
        </button>

        {appliedFilterCount ? (
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer rounded-lg border border-[#d2d6db] bg-white px-[0.7rem] py-[0.45rem] text-[#334155]"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ViewFiltersModal({ title, open, onClose, onApply, onClear, children }: ViewFiltersModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={overlayClassName} role="dialog" aria-modal="true" aria-label={title}>
      <section className={panelClassName}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="m-0">{title}</h3>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-[#d2d6db] bg-white px-[0.55rem] py-[0.35rem]"
          >
            Fechar
          </button>
        </header>

        {children}

        <footer className="flex flex-wrap justify-end gap-[0.6rem]">
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer rounded-lg border border-[#d2d6db] bg-white px-[0.8rem] py-[0.5rem]"
          >
            Limpar
          </button>

          <button
            type="button"
            onClick={onApply}
            className="cursor-pointer rounded-lg border border-[#14564c] bg-[#1b7a6c] px-[0.8rem] py-[0.5rem] text-white"
          >
            Aplicar filtros
          </button>
        </footer>
      </section>
    </div>
  );
}
