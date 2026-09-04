"use client";

export function PrintStatementButton() {
  return (
    <button
      type="button"
      className="pms-button-secondary print:hidden"
      onClick={() => window.print()}
    >
      Imprimir extrato
    </button>
  );
}
