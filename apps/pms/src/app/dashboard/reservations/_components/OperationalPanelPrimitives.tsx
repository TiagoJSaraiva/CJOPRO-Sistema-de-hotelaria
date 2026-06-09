import type { ReactNode } from "react";
import type { ReservationStatus } from "@hotel/shared";

export type StatusMeta = {
  label: string;
  color: string;
  toneClassName: string;
};

export const DEFAULT_STATUS_META: StatusMeta = {
  label: "Pendente",
  color: "#f59e0b",
  toneClassName: "border-[#f5c56e] bg-[#fff8e8] text-[#8a5a00]"
};

export const STATUS_META: Record<string, StatusMeta> = {
  pending: DEFAULT_STATUS_META,
  confirmed: {
    label: "Confirmada",
    color: "#16a34a",
    toneClassName: "border-[#93d6b5] bg-[#effaf4] text-[#176c43]"
  },
  checked_in: {
    label: "Checked-in",
    color: "#2563eb",
    toneClassName: "border-[#9cc9ff] bg-[#eef6ff] text-[#1b5fa7]"
  },
  checked_out: {
    label: "Checked-out",
    color: "#0f766e",
    toneClassName: "border-[#99d8d1] bg-[#edfafa] text-[#0a5f58]"
  },
  canceled: {
    label: "Cancelada",
    color: "#f97316",
    toneClassName: "border-[#fdba74] bg-[#fff7ed] text-[#9a4b00]"
  },
  no_show: {
    label: "No-show",
    color: "#94a3b8",
    toneClassName: "border-[#d2d6db] bg-[#f4f6f8] text-[#52606d]"
  },
  blocked: {
    label: "Bloqueada",
    color: "#ef4444",
    toneClassName: "border-[#f2a2a2] bg-[#fff2f2] text-[#a12b2b]"
  },
  maintenance: {
    label: "Manutencao",
    color: "#ef4444",
    toneClassName: "border-[#f2a2a2] bg-[#fff2f2] text-[#a12b2b]"
  }
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago",
  refunded: "Estornado"
};

export function statusLabel(status: ReservationStatus | null): string {
  if (!status) return "N/A";
  return STATUS_META[status]?.label || status.replaceAll("_", " ");
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] || status;
}

export function paymentMethodLabel(method: string): string {
  if (method === "cash") return "Dinheiro";
  if (method === "card") return "Cartao";
  if (method === "credit_card") return "Cartao de credito";
  if (method === "debit_card") return "Cartao de debito";
  if (method === "pix") return "Pix";
  if (method === "bank_transfer") return "Transferencia bancaria";
  return method;
}

export function formatMoney(amount: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }
  return value;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function StatusPill({ status }: { status: ReservationStatus | string | null }) {
  const meta = STATUS_META[status || "pending"] ?? DEFAULT_STATUS_META;

  return <span className={`rounded-full border px-[0.55rem] py-[0.2rem] text-[0.76rem] font-semibold ${meta.toneClassName}`}>{meta.label}</span>;
}

export function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#697586]">{label}</span>
      <strong className="mt-[0.2rem] block truncate text-[0.92rem] font-semibold text-[#202939]">{value}</strong>
    </div>
  );
}

export function PanelSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg border border-[#e4e7ec] bg-white p-3">
      <div>
        <h4 className="m-0 text-[0.95rem] font-semibold text-[#121926]">{title}</h4>
        {description ? <p className="mb-0 mt-[0.25rem] text-[0.82rem] text-[#697586]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function PaymentSummaryCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "good" | "danger" }) {
  const toneClassName = {
    neutral: "border-[#e4e7ec] bg-[#f8fafc] text-[#202939]",
    good: "border-[#b6e4cb] bg-[#f1fbf5] text-[#176c43]",
    danger: "border-[#f3b2b2] bg-[#fff5f5] text-[#b42318]"
  }[tone];

  return (
    <article className={`rounded-lg border p-3 ${toneClassName}`}>
      <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#697586]">{label}</span>
      <strong className="mt-1 block truncate text-[0.98rem] leading-tight">{value}</strong>
      <span className="mt-1 block truncate text-[0.76rem] text-[#52606d]">{detail}</span>
    </article>
  );
}
