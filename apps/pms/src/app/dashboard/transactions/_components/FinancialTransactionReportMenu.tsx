"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
  referenceDate,
}: FinancialTransactionReportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatingScope, setGeneratingScope] =
    useState<FinancialTransactionReportScope | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isGenerating = generatingScope !== null;
  const isDisabled = !hasActiveHotel || isGenerating;

  useEffect(() => {
    if (isOpen) {
      itemRefs.current[0]?.focus();
    }
  }, [isOpen]);

  const closeMenuAndFocusTrigger = () => {
    triggerRef.current?.focus();
    setIsOpen(false);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenuAndFocusTrigger();
      return;
    }

    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }

    const items = itemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    const currentIndex = items.findIndex(
      (item) => item === document.activeElement,
    );
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown")
      nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp")
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  };

  const handleGenerate = async (scope: FinancialTransactionReportScope) => {
    setIsOpen(false);
    setGeneratingScope(scope);
    setErrorMessage(null);

    try {
      await generateFinancialTransactionsPdf({
        transactions:
          scope === "filtered" ? filteredTransactions : allTransactions,
        scope,
        totalTransactions: allTransactions.length,
        hotelLabel,
        generatedBy,
        generatedAt: new Date(),
        referenceDate,
      });
    } catch {
      setErrorMessage("Não foi possível gerar o relatório.");
    } finally {
      setGeneratingScope(null);
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={
          !hasActiveHotel
            ? "Selecione um hotel ativo para gerar relatório."
            : undefined
        }
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className={`${menuButtonClassName} ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {generatingScope
          ? `Gerando ${getScopeLabel(generatingScope)}...`
          : "Gerar relatório"}
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Opções de relatório financeiro"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 z-20 mt-2 grid min-w-[210px] overflow-hidden rounded-lg border border-[#d9dfe7] bg-white p-1 shadow-lg"
        >
          <button
            ref={(element) => {
              itemRefs.current[0] = element;
            }}
            type="button"
            role="menuitem"
            onClick={() => void handleGenerate("filtered")}
            className="cursor-pointer rounded-md border-0 bg-white px-3 py-2 text-left text-[0.9rem] text-[#202939] hover:bg-[#eef7f5]"
          >
            Recorte filtrado
          </button>
          <button
            ref={(element) => {
              itemRefs.current[1] = element;
            }}
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
        <p
          role="status"
          className="absolute right-0 mt-2 w-[240px] text-right text-[0.8rem] text-[#b42318]"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
