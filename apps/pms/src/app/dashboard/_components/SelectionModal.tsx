"use client";

import type { CSSProperties } from "react";

type SelectionModalItem = {
  id: string;
  label: string;
  description?: string;
};

type SelectionModalProps = {
  open: boolean;
  title: string;
  items: SelectionModalItem[];
  emptyMessage: string;
  onSelect: (id: string) => void;
  onClose: () => void;
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
  width: "min(620px, 100%)",
  maxHeight: "75vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: "12px",
  border: "1px solid #d9dfe7",
  padding: "1rem",
  display: "grid",
  gap: "0.75rem"
};

export function SelectionModal({ open, title, items, emptyMessage, onSelect, onClose }: SelectionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={title}>
      <section style={panelStyle}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "1px solid #d2d6db", borderRadius: "8px", background: "#fff", padding: "0.35rem 0.55rem", cursor: "pointer" }}
          >
            Fechar
          </button>
        </header>

        {items.length ? (
          <div style={{ display: "grid", gap: "0.55rem" }}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                style={{
                  textAlign: "left",
                  border: "1px solid #d5dce7",
                  background: "#f9fbff",
                  borderRadius: "10px",
                  padding: "0.6rem 0.75rem",
                  cursor: "pointer"
                }}
              >
                <strong>{item.label}</strong>
                {item.description ? <p style={{ margin: "0.25rem 0 0", color: "#526070" }}>{item.description}</p> : null}
              </button>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: "#5f6b7a" }}>{emptyMessage}</p>
        )}
      </section>
    </div>
  );
}
