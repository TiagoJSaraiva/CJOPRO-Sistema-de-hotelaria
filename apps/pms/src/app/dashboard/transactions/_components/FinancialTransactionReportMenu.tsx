"use client";

import { useState } from "react";
import type { AdminFinancialTransaction } from "@hotel/shared";
import { generateFinancialTransactionsPdf } from "./financialTransactionPdf";
import type { FinancialTransactionReportScope } from "./financialTransactionReportData";

type FinancialTransactionReportMenuProps = {
  allTransactions: AdminFinancialTransaction[];
  filteredTransactions: AdminFinancialTransaction[];
  hotelLabel: string;
  generatedBy: string;
  hasActiveHotel: boolean;
  referenceDate: Date;
};

const menuButtonClassName =
  "cursor-pointer rounded-lg border border-[#14564c] bg-white px-[0.75rem] py-[0.5rem] font-semibold text-[#0a5f58]";

function getScopeLabel(scope: FinancialTransactionReportScope): string {
  return scope === "filtered" ? "Recorte filtrado" : "Todas do hotel";
}

export function FinancialTransactionReportMenu({
  allTransactions,
  filteredTransactions,
  hotelLabel,
  generatedBy,
  hasActiveHotel,
  referenceDate
}: FinancialTransactionReportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatingScope, setGeneratingScope] = useState<FinancialTransactionReportScope | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isGenerating = generatingScope !== null;
  const isDisabled = !hasActiveHotel || isGenerating;

  const handleGenerate = async (scope: FinancialTransactionReportScope) => {
    setIsOpen(false);
    setGeneratingScope(scope);
    setErrorMessage(null);

    try {
      await generateFinancialTransactionsPdf({
        transactions: scope === "filtered" ? filteredTransactions : allTransactions,
        scope,
        totalTransactions: allTransactions.length,
        hotelLabel,
        generatedBy,
        generatedAt: new Date(),
        referenceDate
      });
    } catch {
      setErrorMessage("Nao foi possivel gerar o relatorio.");
    } finally {
      setGeneratingScope(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={!hasActiveHotel ? "Selecione um hotel ativo para gerar relatorio." : undefined}
        onClick={() => setIsOpen((current) => !current)}
        className={`${menuButtonClassName} ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {generatingScope ? `Gerando ${getScopeLabel(generatingScope)}...` : "Gerar relatorio"}
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Opcoes de relatorio financeiro"
          className="absolute right-0 z-20 mt-2 grid min-w-[210px] overflow-hidden rounded-lg border border-[#d9dfe7] bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleGenerate("filtered")}
            className="cursor-pointer rounded-md border-0 bg-white px-3 py-2 text-left text-[0.9rem] text-[#202939] hover:bg-[#eef7f5]"
          >
            Recorte filtrado
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleGenerate("all")}
            className="cursor-pointer rounded-md border-0 bg-white px-3 py-2 text-left text-[0.9rem] text-[#202939] hover:bg-[#eef7f5]"
          >
            Todas do hotel
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <p role="status" className="absolute right-0 mt-2 w-[240px] text-right text-[0.8rem] text-[#b42318]">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
