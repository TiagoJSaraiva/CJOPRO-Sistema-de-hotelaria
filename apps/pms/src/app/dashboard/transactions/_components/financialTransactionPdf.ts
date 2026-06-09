import type { UserOptions } from "jspdf-autotable";
import {
  buildFinancialTransactionReportData,
  type FinancialTransactionReportData,
  type FinancialTransactionReportInput
} from "./financialTransactionReportData";

const TABLE_HEAD = [["Data", "Tipo", "Status", "Categoria", "Contraparte", "Centro de custo", "Referencia", "Valor"]];

function drawSummaryGrid(
  doc: {
    setFont: (fontName: string, fontStyle?: string) => unknown;
    setFontSize: (fontSize: number) => unknown;
    setTextColor: (r: number, g: number, b: number) => unknown;
    text: (text: string, x: number, y: number) => unknown;
  },
  report: FinancialTransactionReportData,
  startY: number
): number {
  const left = 12;
  const columnWidth = 68;
  const rowHeight = 10;

  report.summaryRows.forEach((item, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = left + column * columnWidth;
    const y = startY + row * rowHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(105, 117, 134);
    doc.text(item.label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(32, 41, 57);
    doc.text(item.value, x, y + 5);
  });

  return startY + Math.ceil(report.summaryRows.length / 4) * rowHeight + 6;
}

function drawFooter(doc: {
  getNumberOfPages: () => number;
  setPage: (pageNumber: number) => unknown;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont: (fontName: string, fontStyle?: string) => unknown;
  setFontSize: (fontSize: number) => unknown;
  setTextColor: (r: number, g: number, b: number) => unknown;
  text: (text: string, x: number, y: number, options?: { align?: "center" | "left" | "right" }) => unknown;
}) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(105, 117, 134);
    doc.text(`Pagina ${pageNumber}/${pageCount}`, pageWidth - 12, pageHeight - 8, { align: "right" });
  }
}

export async function generateFinancialTransactionsPdf(input: FinancialTransactionReportInput): Promise<FinancialTransactionReportData> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const report = buildFinancialTransactionReportData(input);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(18, 25, 38);
  doc.text(report.title, 12, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(82, 96, 109);
  doc.text(`Hotel: ${report.hotelLabel}`, 12, 23);
  doc.text(`Gerado por: ${report.generatedBy}`, 12, 29);
  doc.text(`Emitido em: ${report.generatedAtLabel}`, 12, 35);
  doc.text(`Escopo: ${report.scopeLabel} (${report.transactionCountLabel})`, 12, 41);

  const tableStartY = drawSummaryGrid(doc, report, 52);

  if (report.categoryRows.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(18, 25, 38);
    doc.text("Principais categorias de despesa", 12, tableStartY);

    const categoryOptions: UserOptions = {
      startY: tableStartY + 4,
      margin: { left: 12, right: 12 },
      theme: "grid",
      head: [["Categoria", "Valor", "Qtd.", "Participacao"]],
      body: report.categoryRows.map((item) => [item.category, item.amount, item.count, item.share]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [27, 122, 108], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 34, halign: "right" },
        2: { cellWidth: 18, halign: "right" },
        3: { cellWidth: 28, halign: "right" }
      }
    };
    autoTable(doc, categoryOptions);
  }

  const lastAutoTable = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  const transactionsStartY = Math.max((lastAutoTable?.finalY || tableStartY) + 10, tableStartY + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(18, 25, 38);
  doc.text("Lancamentos financeiros", 12, transactionsStartY);

  const transactionOptions: UserOptions = {
    startY: transactionsStartY + 4,
    margin: { left: 12, right: 12, bottom: 16 },
    theme: "striped",
    head: TABLE_HEAD,
    body: report.tableRows.length ? report.tableRows : [["-", "-", "-", "Sem lancamentos para este escopo.", "-", "-", "-", "-"]],
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.8, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [27, 122, 108], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 42 },
      4: { cellWidth: 50 },
      5: { cellWidth: 42 },
      6: { cellWidth: 36 },
      7: { cellWidth: 32, halign: "right" }
    }
  };
  autoTable(doc, transactionOptions);

  drawFooter(doc);
  doc.save(report.fileName);

  return report;
}
