"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AdminMaintenanceAnalytics } from "@hotel/shared";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function MaintenanceAnalyticsExports({
  analytics,
  rows,
}: {
  analytics: AdminMaintenanceAnalytics;
  rows: Array<Record<string, unknown>>;
}) {
  function exportCsv() {
    const columns = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row))),
    );
    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      columns.map(escape).join(","),
      ...rows.map((row) =>
        columns.map((column) => escape(row[column])).join(","),
      ),
    ].join("\r\n");
    download(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
      "manutencao-indicadores.csv",
    );
  }
  function exportPdf() {
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(18);
    document.text("Resumo executivo de manutenção", 14, 16);
    document.setFontSize(9);
    document.text(
      `Filtros: ${
        Object.entries(analytics.filters)
          .map(([key, value]) => `${key}=${value}`)
          .join(", ") || "nenhum"
      }`,
      14,
      23,
    );
    autoTable(document, {
      startY: 28,
      head: [["Backlog", "Críticas", "SLA", "Preventivas", "Bloqueio (dias)"]],
      body: [
        [
          analytics.backlog,
          analytics.critical_open,
          `${analytics.sla_compliance_rate}%`,
          `${analytics.preventive_compliance_rate}%`,
          analytics.blocked_room_days,
        ],
      ],
    });
    const columns = rows[0] ? Object.keys(rows[0]).slice(0, 8) : [];
    autoTable(document, {
      startY: (document as jsPDF & { lastAutoTable?: { finalY: number } })
        .lastAutoTable?.finalY
        ? (document as jsPDF & { lastAutoTable: { finalY: number } })
            .lastAutoTable.finalY + 8
        : 55,
      head: [columns],
      body: rows
        .slice(0, 100)
        .map((row) => columns.map((column) => String(row[column] ?? ""))),
      styles: { fontSize: 6 },
    });
    document.save("manutencao-resumo-executivo.pdf");
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={exportCsv}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
      >
        Exportar CSV detalhado
      </button>
      <button
        type="button"
        onClick={exportPdf}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Exportar PDF executivo
      </button>
    </div>
  );
}
