"use client";

import type { CSSProperties, ReactNode } from "react";

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

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(9, 18, 31, 0.45)",
  display: "grid",
  placeItems: "center",
  zIndex: 1000,
  padding: "1rem"
};

const panelStyle: CSSProperties = {
  width: "min(760px, 100%)",
  maxHeight: "82vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: "12px",
  border: "1px solid #d9dfe7",
  padding: "1rem",
  display: "grid",
  gap: "0.9rem"
};

export const viewFiltersFieldStyle: CSSProperties = {
  border: "1px solid #d2d2d2",
  borderRadius: "8px",
  padding: "0.55rem"
};

export function ViewFiltersActionsBar({ appliedFilterCount, onOpen, onClear, children }: ViewFiltersActionsBarProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: "220px" }}>{children}</div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onOpen}
          style={{
            border: "1px solid #0f766e",
            borderRadius: "8px",
            background: "#fff",
            color: "#0a5f58",
            padding: "0.45rem 0.7rem",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Filtrar dados{appliedFilterCount ? ` (${appliedFilterCount})` : ""}
        </button>

        {appliedFilterCount ? (
          <button
            type="button"
            onClick={onClear}
            style={{
              border: "1px solid #d2d6db",
              borderRadius: "8px",
              background: "#fff",
              color: "#334155",
              padding: "0.45rem 0.7rem",
              cursor: "pointer"
            }}
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
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={title}>
      <section style={panelStyle}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>

          <button
            type="button"
            onClick={onClose}
            style={{ border: "1px solid #d2d6db", borderRadius: "8px", background: "#fff", padding: "0.35rem 0.55rem", cursor: "pointer" }}
          >
            Fechar
          </button>
        </header>

        {children}

        <footer style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onClear}
            style={{ border: "1px solid #d2d6db", borderRadius: "8px", background: "#fff", padding: "0.5rem 0.8rem", cursor: "pointer" }}
          >
            Limpar
          </button>

          <button
            type="button"
            onClick={onApply}
            style={{ border: "1px solid #14564c", borderRadius: "8px", background: "#1b7a6c", color: "#fff", padding: "0.5rem 0.8rem", cursor: "pointer" }}
          >
            Aplicar filtros
          </button>
        </footer>
      </section>
    </div>
  );
}
