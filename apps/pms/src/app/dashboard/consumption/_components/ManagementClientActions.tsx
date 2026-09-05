"use client";

import type { AdminConsumptionAnalyticsRow } from "@hotel/shared";

export function AnalyticsExportButton({
  rows,
  filename,
}: {
  rows: AdminConsumptionAnalyticsRow[];
  filename: string;
}) {
  function download() {
    const escape = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const lines = [
      ["Dimensão", "Venda bruta", "Venda líquida", "Comandas"],
      ...rows.map((row) => [
        row.label,
        row.gross_sales,
        row.operational_net,
        row.order_count,
      ]),
    ].map((line) => line.map(escape).join(","));
    const blob = new Blob([`\ufeff${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <button type="button" className="pms-button-secondary" onClick={download}>
      Exportar CSV
    </button>
  );
}

export function ConfirmSubmitButton({
  children,
  message,
  className = "pms-button-primary",
}: {
  children: string;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function PrintManagementReportButton() {
  return (
    <button
      type="button"
      className="pms-button-secondary"
      onClick={() => window.print()}
    >
      Imprimir demonstrativo
    </button>
  );
}
