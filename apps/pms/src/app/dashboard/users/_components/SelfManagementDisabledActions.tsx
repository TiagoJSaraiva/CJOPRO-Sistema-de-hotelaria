"use client";

import { useState } from "react";

type SelfManagementDisabledActionsProps = {
  showEdit: boolean;
  showDelete: boolean;
};

const tooltipMessage = "Voce nao pode gerenciar sua conta por aqui. Va na pagina";

export function SelfManagementDisabledActions({ showEdit, showDelete }: SelfManagementDisabledActionsProps) {
  const [isHovering, setIsHovering] = useState(false);

  if (!showEdit && !showDelete) {
    return null;
  }

  return (
    <div
      style={{ position: "relative", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-label="Acoes indisponiveis para a propria conta"
    >
      {showEdit ? (
        <button
          type="button"
          disabled
          style={{
            border: "1px solid #94a3b8",
            color: "#64748b",
            background: "#f8fafc",
            borderRadius: "8px",
            padding: "0.45rem 0.65rem",
            cursor: "not-allowed",
            opacity: 0.95
          }}
        >
          Editar dados
        </button>
      ) : null}

      {showDelete ? (
        <button
          type="button"
          disabled
          style={{
            border: "1px solid #f1a1a1",
            color: "#b45353",
            background: "#fff6f6",
            borderRadius: "8px",
            padding: "0.45rem 0.65rem",
            cursor: "not-allowed",
            opacity: 0.95
          }}
        >
          Apagar dados
        </button>
      ) : null}

      {isHovering ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.5rem)",
            zIndex: 20,
            maxWidth: "360px",
            border: "1px solid #d6dce7",
            borderRadius: "10px",
            background: "#fff",
            color: "#1f2937",
            padding: "0.55rem 0.7rem",
            boxShadow: "0 8px 20px rgba(15, 23, 42, 0.12)",
            fontSize: "0.9rem",
            lineHeight: 1.35
          }}
          role="tooltip"
        >
          {tooltipMessage} <strong>Inicio</strong> para mais opcoes de gerenciamento de conta.
        </div>
      ) : null}
    </div>
  );
}
