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
      className="relative flex flex-wrap items-center gap-2"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-label="Acoes indisponiveis para a propria conta"
    >
      {showEdit ? (
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border border-[#94a3b8] bg-[#f8fafc] px-[0.65rem] py-[0.45rem] text-[#64748b] opacity-95"
        >
          Editar dados
        </button>
      ) : null}

      {showDelete ? (
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border border-[#f1a1a1] bg-[#fff6f6] px-[0.65rem] py-[0.45rem] text-[#b45353] opacity-95"
        >
          Apagar dados
        </button>
      ) : null}

      {isHovering ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-20 max-w-[360px] rounded-[10px] border border-[#d6dce7] bg-white px-[0.7rem] py-[0.55rem] text-[0.9rem] leading-[1.35] text-[#1f2937] shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
          role="tooltip"
        >
          {tooltipMessage} <strong>Inicio</strong> para mais opcoes de gerenciamento de conta.
        </div>
      ) : null}
    </div>
  );
}
