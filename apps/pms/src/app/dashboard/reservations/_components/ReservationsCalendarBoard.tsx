"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminCustomer,
  AdminReservationCalendarBookingCreateInput,
  AdminReservationCalendarBookingCreateResponse,
  AdminReservationCalendarResponse,
  AdminStayOperationalPanelResponse,
  ReservationSource,
  ReservationStatus
} from "@hotel/shared";
import { translateReservationSource } from "@hotel/shared";
import { addDaysIso, CALENDAR_WINDOW_DAYS, formatDateRangeLabel } from "./calendarUtils";
import { computeStayBlockLayout } from "./stayBlockLayout";

type ReservationsCalendarBoardProps = {
  data: AdminReservationCalendarResponse;
  startDate: string;
  customers: AdminCustomer[];
};

const CELL_WIDTH = 44;
const ROW_HEIGHT = 58;
const LEFT_PANEL_WIDTH = 200;
const BLOCK_HEIGHT = 30;
const BLOCK_VERTICAL_GAP = Math.max(0, (ROW_HEIGHT - BLOCK_HEIGHT) / 2);

type StatusMeta = {
  label: string;
  color: string;
  toneClassName: string;
};

const DEFAULT_STATUS_META: StatusMeta = {
  label: "Pendente",
  color: "#f59e0b",
  toneClassName: "border-[#f5c56e] bg-[#fff8e8] text-[#8a5a00]"
};

const STATUS_META: Record<string, StatusMeta> = {
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
    label: "Manutenção",
    color: "#ef4444",
    toneClassName: "border-[#f2a2a2] bg-[#fff2f2] text-[#a12b2b]"
  }
};

const LEGEND_ITEMS: Array<{ key: string; label: string }> = [
  { key: "confirmed", label: "Confirmada" },
  { key: "checked_in", label: "Checked-in" },
  { key: "checked_out", label: "Checked-out" },
  { key: "no_show", label: "No-show" },
  { key: "canceled", label: "Cancelada" },
  { key: "blocked", label: "Bloqueada" }
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago",
  refunded: "Estornado"
};

const secondaryButtonClassName =
  "cursor-pointer rounded-lg border border-[#d2d6db] bg-white px-[0.75rem] py-[0.5rem] font-semibold text-[#344054] disabled:cursor-not-allowed disabled:bg-[#eef2f6] disabled:text-[#98a2b3]";
const primaryButtonClassName =
  "cursor-pointer rounded-lg border border-[#14564c] bg-[#1b7a6c] px-[0.75rem] py-[0.5rem] font-semibold text-white disabled:cursor-not-allowed disabled:border-[#d2d6db] disabled:bg-[#eef2f6] disabled:text-[#98a2b3]";
const panelActionButtonClassName =
  "cursor-pointer rounded-lg border border-[#d2d6db] bg-white px-[0.65rem] py-[0.45rem] text-[0.82rem] font-semibold text-[#344054] disabled:cursor-not-allowed disabled:bg-[#eef2f6] disabled:text-[#98a2b3]";

type SelectionSide = "checkin" | "checkout" | "full";
type CellOccupancy = {
  left: boolean;
  right: boolean;
};

function statusLabel(status: ReservationStatus | null): string {
  if (!status) return "N/A";
  return STATUS_META[status]?.label || status.replaceAll("_", " ");
}

function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] || status;
}

function paymentMethodLabel(method: string): string {
  if (method === "cash") return "Dinheiro";
  if (method === "card") return "Cartao";
  if (method === "credit_card") return "Cartao de credito";
  if (method === "debit_card") return "Cartao de debito";
  if (method === "pix") return "Pix";
  if (method === "bank_transfer") return "Transferencia bancaria";
  return method;
}

function formatMoney(amount: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }
  return value;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6";

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusPill({ status }: { status: ReservationStatus | string | null }) {
  const meta = STATUS_META[status || "pending"] ?? DEFAULT_STATUS_META;

  return <span className={`rounded-full border px-[0.55rem] py-[0.2rem] text-[0.76rem] font-semibold ${meta.toneClassName}`}>{meta.label}</span>;
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "good" | "danger" | "warning";
}) {
  const toneClassName = {
    neutral: "border-[#d9dfe7] bg-white text-[#202939]",
    good: "border-[#b6e4cb] bg-[#f1fbf5] text-[#176c43]",
    danger: "border-[#f3b2b2] bg-[#fff5f5] text-[#b42318]",
    warning: "border-[#f5d08a] bg-[#fff9eb] text-[#8a5a00]"
  }[tone];

  return (
    <article className={`rounded-lg border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${toneClassName}`}>
      <span className="block text-[0.76rem] font-semibold uppercase tracking-[0.05em] text-[#697586]">{label}</span>
      <strong className="mt-2 block text-[1.45rem] leading-tight">{value}</strong>
      <p className="mb-0 mt-2 text-[0.86rem] text-[#52606d]">{detail}</p>
    </article>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#697586]">{label}</span>
      <strong className="mt-[0.2rem] block truncate text-[0.92rem] font-semibold text-[#202939]">{value}</strong>
    </div>
  );
}

function PanelSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
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

function PaymentSummaryCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "good" | "danger" }) {
  const toneClassName = {
    neutral: "border-[#e4e7ec] bg-[#f8fafc] text-[#202939]",
    good: "border-[#b6e4cb] bg-[#f1fbf5] text-[#176c43]",
    danger: "border-[#f3b2b2] bg-[#fff5f5] text-[#b42318]"
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClassName}`}>
      <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#697586]">{label}</span>
      <strong className="mt-[0.2rem] block text-[0.98rem]">{value}</strong>
      <span className="mt-[0.15rem] block text-[0.78rem] text-[#697586]">{detail}</span>
    </div>
  );
}

function getSegmentButtonClassName(active: boolean): string {
  return active
    ? "rounded-md border border-[#0f766e] bg-[#ddf5f2] px-[0.65rem] py-[0.45rem] font-semibold text-[#0a5f58]"
    : "rounded-md border border-transparent bg-transparent px-[0.65rem] py-[0.45rem] font-semibold text-[#52606d]";
}

function getSelectedCellBackground(selectedSide: SelectionSide | undefined): string | undefined {
  if (selectedSide === "full") return "#c7f8df";
  if (selectedSide === "checkin") return "linear-gradient(90deg, transparent 0%, transparent 50%, #c7f8df 50%, #c7f8df 100%)";
  if (selectedSide === "checkout") return "linear-gradient(90deg, #c7f8df 0%, #c7f8df 50%, transparent 50%, transparent 100%)";
  return undefined;
}

export function ReservationsCalendarBoard({ data, startDate, customers }: ReservationsCalendarBoardProps) {
  const router = useRouter();
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);
  const [candidateStayIds, setCandidateStayIds] = useState<string[]>([]);
  const [selectedCells, setSelectedCells] = useState<Map<string, SelectionSide>>(new Map());
  const [simulation, setSimulation] = useState<AdminReservationCalendarBookingCreateResponse | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelData, setPanelData] = useState<AdminStayOperationalPanelResponse | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [bookingMode, setBookingMode] = useState<"existing" | "create_inline">("existing");
  const [existingCustomerId, setExistingCustomerId] = useState<string>(customers[0]?.id || "");
  const [reservationSource, setReservationSource] = useState<ReservationSource>("front_desk");
  const [notes, setNotes] = useState("");
  const [inlineCustomer, setInlineCustomer] = useState({
    full_name: "",
    document_number: "",
    document_type: "cpf",
    birth_date: "",
    email: "",
    mobile_phone: "",
    phone: "",
    nationality: "",
    notes: ""
  });

  const selectedStay = useMemo(() => data.stays.find((item) => item.id === selectedStayId) || null, [data.stays, selectedStayId]);
  const daysMap = useMemo(() => new Map(data.days.map((day, index) => [day.date, index])), [data.days]);
  const occupiedCellsBySide = useMemo(() => {
    const map = new Map<string, CellOccupancy>();
    const mark = (roomId: string, date: string, side: "left" | "right" | "full") => {
      const key = `${roomId}::${date}`;
      const current = map.get(key) || { left: false, right: false };
      if (side === "full") {
        current.left = true;
        current.right = true;
      } else {
        current[side] = true;
      }
      map.set(key, current);
    };

    for (const stay of data.stays) {
      for (const day of data.days) {
        if (day.date >= stay.start_date && day.date <= stay.end_date) {
          if (day.date === stay.start_date && stay.start_half) {
            mark(stay.room_id, day.date, stay.start_half);
            continue;
          }
          if (day.date === stay.end_date && stay.end_half) {
            mark(stay.room_id, day.date, stay.end_half);
            continue;
          }
          mark(stay.room_id, day.date, "full");
        }
      }
    }
    for (const block of data.blocks) {
      for (const day of data.days) {
        if (day.date >= block.start_date && day.date <= block.end_date) {
          mark(block.room_id, day.date, "full");
        }
      }
    }
    return map;
  }, [data.stays, data.blocks, data.days]);

  const stayBlocksByRoom = useMemo(() => {
    const grouped = new Map<string, Array<{ stay: AdminReservationCalendarResponse["stays"][number]; left: number; width: number }>>();
    for (const stay of data.stays) {
      const startIndex = daysMap.get(stay.start_date);
      const endIndex = daysMap.get(stay.end_date);
      if (startIndex === undefined || endIndex === undefined) continue;
      const layout = computeStayBlockLayout({
        startIndex,
        endIndex,
        startHalf: stay.start_half,
        endHalf: stay.end_half,
        cellWidth: CELL_WIDTH
      });
      const list = grouped.get(stay.room_id) || [];
      list.push({ stay, left: layout.left, width: layout.width });
      grouped.set(stay.room_id, list);
    }
    return grouped;
  }, [data.stays, daysMap]);

  const rangeLabel = formatDateRangeLabel(data.days);
  const prevHref = `/dashboard/reservations/view?start_date=${addDaysIso(startDate, -CALENDAR_WINDOW_DAYS)}`;
  const nextHref = `/dashboard/reservations/view?start_date=${addDaysIso(startDate, CALENDAR_WINDOW_DAYS)}`;

  const selectedCellsPayload = useMemo(
    () =>
      Array.from(selectedCells).map((key) => {
        const [cellKey, side] = key;
        const [room_id = "", date = ""] = cellKey.split("::");
        return { room_id, date, side };
      }),
    [selectedCells]
  );
  const roomsCount = useMemo(() => new Set(selectedCellsPayload.map((item) => item.room_id)).size, [selectedCellsPayload]);
  const calendarSummary = useMemo(() => {
    const totalRoomDays = Math.max(data.rooms.length * data.days.length, 1);
    const occupiedRoomDays = Array.from(occupiedCellsBySide.values()).filter((cell) => cell.left || cell.right).length;
    const projectedRevenue = data.stays.reduce((sum, stay) => sum + Number(stay.total_price_estimated || 0), 0);
    const paidRevenue = data.stays.reduce((sum, stay) => sum + Number(stay.total_paid || 0), 0);
    const openBalance = Math.max(projectedRevenue - paidRevenue, 0);
    const activeStays = data.stays.filter((stay) => {
      const status = stay.stay_status || "pending";
      return status !== "checked_out" && status !== "canceled" && status !== "no_show";
    }).length;

    return {
      occupancyRate: (occupiedRoomDays / totalRoomDays) * 100,
      occupiedRoomDays,
      totalRoomDays,
      projectedRevenue,
      openBalance,
      activeStays
    };
  }, [data.rooms.length, data.days.length, data.stays, occupiedCellsBySide]);

  async function postJson<T>(url: string, payload: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const dataResponse = await response.json();
    if (!response.ok) {
      throw new Error(String(dataResponse?.message || "Falha na operação."));
    }
    return dataResponse as T;
  }

  async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    const dataResponse = await response.json();
    if (!response.ok) {
      throw new Error(String(dataResponse?.message || "Falha na operação."));
    }
    return dataResponse as T;
  }

  function buildBookingPayload(): AdminReservationCalendarBookingCreateInput {
    const booking_customer =
      bookingMode === "existing"
        ? { mode: "existing" as const, customer_id: existingCustomerId }
        : {
            mode: "create_inline" as const,
            full_name: inlineCustomer.full_name,
            document_number: inlineCustomer.document_number,
            document_type: inlineCustomer.document_type,
            birth_date: inlineCustomer.birth_date,
            email: inlineCustomer.email || null,
            mobile_phone: inlineCustomer.mobile_phone || null,
            phone: inlineCustomer.phone || null,
            nationality: inlineCustomer.nationality || null,
            notes: inlineCustomer.notes || null
          };

    return {
      booking_customer,
      selected_cells: selectedCellsPayload,
      reservation_source: reservationSource || null,
      notes: notes || null
    };
  }

  async function handleSimulate() {
    try {
      setError(null);
      setIsPending(true);
      const payload = buildBookingPayload();
      const result = await postJson<AdminReservationCalendarBookingCreateResponse>("/api/reservations-calendar/simulate", payload);
      setSimulation(result);
    } catch (requestError) {
      setSimulation(null);
      setError(requestError instanceof Error ? requestError.message : "Falha ao simular reserva.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleConfirm() {
    try {
      setError(null);
      setIsPending(true);
      const payload = buildBookingPayload();
      const result = await postJson<AdminReservationCalendarBookingCreateResponse>("/api/reservations-calendar/booking", payload);
      setSimulation(result);
      setSelectedCells(new Map());
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao confirmar reserva.");
    } finally {
      setIsPending(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadPanel() {
      if (!selectedStayId) {
        setPanelData(null);
        return;
      }
      try {
        setPanelLoading(true);
        const panel = await getJson<AdminStayOperationalPanelResponse>(`/api/stays/${selectedStayId}/panel`);
        if (!cancelled) {
          setPanelData(panel);
        }
      } catch (requestError) {
        if (!cancelled) {
          setPanelData(null);
          setError(requestError instanceof Error ? requestError.message : "Falha ao carregar painel da estadia.");
        }
      } finally {
        if (!cancelled) {
          setPanelLoading(false);
        }
      }
    }
    void loadPanel();
    return () => {
      cancelled = true;
    };
  }, [selectedStayId]);

  async function handleStayAction(action: "checkin" | "checkout" | "no-show" | "cancel") {
    if (!selectedStayId) return;
    try {
      setError(null);
      setIsPending(true);
      const panel = await postJson<AdminStayOperationalPanelResponse>(`/api/stays/${selectedStayId}/${action}`, {});
      setPanelData(panel);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao executar ação operacional.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleAddPayment() {
    if (!selectedStayId) return;
    try {
      setError(null);
      setIsPending(true);
      const amount = Number(paymentAmount || "0");
      const panel = await postJson<AdminStayOperationalPanelResponse>(`/api/stays/${selectedStayId}/payments`, {
        amount,
        method: paymentMethod,
        note: paymentNote || null
      });
      setPanelData(panel);
      setPaymentAmount("");
      setPaymentNote("");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao registrar pagamento.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="grid gap-4" data-testid="reservations-calendar-board">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="reservation-summary-metrics">
        <MetricCard
          label="Ocupação do recorte"
          value={formatPercent(calendarSummary.occupancyRate)}
          detail={`${calendarSummary.occupiedRoomDays} de ${calendarSummary.totalRoomDays} diárias mapeadas`}
          tone={calendarSummary.occupancyRate > 75 ? "good" : calendarSummary.occupancyRate > 45 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Estadias ativas"
          value={String(calendarSummary.activeStays)}
          detail={`${data.stays.length} reserva(s) no calendário`}
          tone={calendarSummary.activeStays ? "good" : "neutral"}
        />
        <MetricCard
          label="Bloqueios"
          value={String(data.blocks.length)}
          detail={`${data.rooms.length} quarto(s) no mapa operacional`}
          tone={data.blocks.length ? "danger" : "neutral"}
        />
      </section>

      <section className="rounded-lg border border-[#d9dfe7] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[1rem] font-semibold text-[#121926]">Mapa de disponibilidade</h2>
            <p className="mb-0 mt-[0.25rem] text-[0.88rem] text-[#697586]">Selecione células livres para montar uma reserva ou abra uma estadia existente.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={prevHref}
              aria-label="Período anterior"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d2d6db] bg-white text-[#344054] no-underline"
            >
              <ChevronIcon direction="left" />
            </Link>
            <span className="rounded-lg border border-[#d9dfe7] bg-[#f8fafc] px-3 py-[0.55rem] text-[0.9rem] font-semibold text-[#202939]">{rangeLabel}</span>
            <Link
              href={nextHref}
              aria-label="Próximo período"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d2d6db] bg-white text-[#344054] no-underline"
            >
              <ChevronIcon direction="right" />
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.84rem] text-[#52606d]">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-2 rounded-full border border-[#eef2f6] bg-[#f8fafc] px-[0.6rem] py-[0.25rem]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: (STATUS_META[item.key] ?? DEFAULT_STATUS_META).color }} />
              {item.label}
            </span>
          ))}
        </div>
      </section>

      <p className="pms-status-muted">
        Exibindo {data.rooms.length} quarto(s), {data.stays.length} estadia(s) e {data.blocks.length} bloqueio(s) no período.
      </p>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-lg border border-[#d9dfe7] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]" data-testid="reservation-calendar-grid">
          <div className="overflow-auto">
            <div style={{ width: LEFT_PANEL_WIDTH + data.days.length * CELL_WIDTH }} className="relative">
              <div
                className="sticky top-0 z-20 grid border-b border-[#d9dfe7] bg-[#f8fafc]"
                style={{ gridTemplateColumns: `${LEFT_PANEL_WIDTH}px repeat(${data.days.length}, ${CELL_WIDTH}px)` }}
              >
                <div className="sticky left-0 z-30 bg-[#f8fafc] px-3 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-[#697586]">Quarto</div>
                {data.days.map((day) => (
                  <div key={day.date} className="border-l border-[#e4e7ec] px-1 py-1 text-center text-[0.72rem] font-semibold text-[#52606d]">
                    <div className="text-[#202939]">{String(day.day_number).padStart(2, "0")}</div>
                    <div>{day.weekday_short}</div>
                  </div>
                ))}
              </div>

              <div>
                {data.rooms.map((room) => (
                  <div
                    key={room.room_id}
                    className="relative grid border-b border-[#eef2f6] transition-colors hover:bg-[#fcfcfd]"
                    style={{ gridTemplateColumns: `${LEFT_PANEL_WIDTH}px repeat(${data.days.length}, ${CELL_WIDTH}px)`, height: ROW_HEIGHT }}
                  >
                    <div className="sticky left-0 z-10 border-r border-[#e4e7ec] bg-white px-3 py-2">
                      <p className="m-0 truncate text-[0.85rem] font-semibold text-[#202939]">{room.room_type.toUpperCase()}</p>
                      <p className="m-0 truncate text-[0.78rem] text-[#697586]">
                        {room.room_number} | {room.max_occupancy} hospedes
                      </p>
                    </div>
                    {data.days.map((day) => {
                      const key = `${room.room_id}::${day.date}`;
                      const occupied = occupiedCellsBySide.get(key) || { left: false, right: false };
                      const hasAnyOccupiedSide = occupied.left || occupied.right;
                      const selectedSide = selectedCells.get(key);
                      const selectedBackground = getSelectedCellBackground(selectedSide);
                      const cellLabel = `${room.room_number} em ${formatDateDisplay(day.date)}`;
                      return (
                        <button
                          key={`${room.room_id}-${day.date}`}
                          type="button"
                          aria-label={hasAnyOccupiedSide ? `Abrir ou selecionar ${cellLabel}` : `Selecionar ${cellLabel}`}
                          title={hasAnyOccupiedSide ? `Abrir ou selecionar ${cellLabel}` : `Selecionar ${cellLabel}`}
                          className="border-l border-[#eef2f6] bg-white transition-colors hover:bg-[#f0fdfa] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0f766e]"
                          style={{ background: selectedBackground, cursor: "pointer" }}
                          onClick={() => {
                            if (occupied.left && occupied.right) {
                              const candidates = data.stays.filter((stay) => stay.room_id === room.room_id && day.date >= stay.start_date && day.date <= stay.end_date);
                              if (candidates.length === 1) {
                                setCandidateStayIds([]);
                                setSelectedStayId(candidates[0]!.id);
                                setSimulation(null);
                                return;
                              }
                              if (candidates.length > 1) {
                                setCandidateStayIds(candidates.map((item) => item.id));
                                setSelectedStayId(null);
                              }
                              return;
                            }

                            let sideToToggle: SelectionSide = "full";
                            if (hasAnyOccupiedSide) {
                              sideToToggle = occupied.right ? "checkout" : "checkin";
                            }

                            setCandidateStayIds([]);
                            setSelectedStayId(null);
                            setPanelData(null);
                            setSimulation(null);
                            setSelectedCells((previous) => {
                              const next = new Map(previous);
                              if (next.get(key) === sideToToggle) next.delete(key);
                              else next.set(key, sideToToggle);
                              return next;
                            });
                          }}
                        />
                      );
                    })}

                    <div className="pointer-events-none absolute left-[200px] right-0 z-10" style={{ top: BLOCK_VERTICAL_GAP, height: BLOCK_HEIGHT }}>
                      {(stayBlocksByRoom.get(room.room_id) || []).map((block) => (
                        <button
                          key={block.stay.id}
                          type="button"
                          aria-label={`Abrir reserva ${block.stay.reservation_code || "sem código"} no quarto ${room.room_number}`}
                          className="pointer-events-auto absolute cursor-pointer rounded-md border border-white/70 text-left text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(15,23,42,0.12)] focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:ring-offset-1"
                          style={{
                            left: block.left,
                            top: 0,
                            width: block.width,
                            height: BLOCK_HEIGHT,
                            backgroundColor: (STATUS_META[block.stay.stay_status || "pending"] ?? DEFAULT_STATUS_META).color
                          }}
                          onClick={() => {
                            setCandidateStayIds([]);
                            setSelectedStayId(block.stay.id);
                          }}
                        >
                          <span className="block truncate px-2 py-1">{block.stay.reservation_code || "Sem código"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-4 rounded-lg border border-[#d9dfe7] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]" data-testid="reservation-side-panel">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-[1rem] font-semibold text-[#121926]">Painel operacional</h3>
              <p className="mb-0 mt-[0.25rem] text-[0.84rem] text-[#697586]">
                {selectedStay ? "Acompanhe a estadia selecionada." : "Monte uma nova reserva a partir do mapa."}
              </p>
            </div>
            <span className="rounded-full border border-[#e4e7ec] bg-[#f8fafc] px-[0.55rem] py-[0.2rem] text-[0.76rem] font-semibold text-[#52606d]">
              {selectedStay ? "Selecionada" : selectedCells.size ? "Em seleção" : "Livre"}
            </span>
          </header>

          {error ? <p className="m-0 rounded-lg border border-[#f2a2a2] bg-[#fff2f2] p-3 text-[0.86rem] text-[#a12b2b]">{error}</p> : null}

          {candidateStayIds.length > 1 ? (
            <PanelSection title="Multiplas estadias" description="Escolha qual estadia deseja abrir nesta data.">
              <div className="grid gap-2">
                {candidateStayIds.map((stayId) => {
                  const stay = data.stays.find((item) => item.id === stayId);
                  if (!stay) return null;
                  return (
                    <button
                      key={stay.id}
                      type="button"
                      className="cursor-pointer rounded-lg border border-[#d9dfe7] bg-white px-3 py-2 text-left hover:bg-[#f8fafc]"
                      onClick={() => setSelectedStayId(stay.id)}
                    >
                      <strong className="block text-[0.9rem] text-[#202939]">{stay.reservation_code || "Sem código"}</strong>
                      <span className="mt-[0.15rem] block text-[0.78rem] text-[#697586]">{statusLabel(stay.stay_status)}</span>
                    </button>
                  );
                })}
              </div>
            </PanelSection>
          ) : null}

          {selectedStay ? (
            <div className="grid gap-4 text-sm">
              {panelLoading ? <p className="pms-status-muted">Carregando painel operacional...</p> : null}
              {panelData ? (
                <>
                  <PanelSection title="Dados da estadia">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[1rem] text-[#121926]">{panelData.stay.reservation_code || "Sem código"}</strong>
                      <StatusPill status={panelData.stay.stay_status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <DetailItem label="Titular" value={panelData.stay.customer_name || "Não informado"} />
                      <DetailItem label="Quarto" value={`${panelData.stay.room_number} - ${panelData.stay.room_type}`} />
                      <DetailItem label="Check-in previsto" value={formatDateDisplay(panelData.stay.checkin_date_expected)} />
                      <DetailItem label="Check-out previsto" value={formatDateDisplay(panelData.stay.checkout_date_expected)} />
                      <DetailItem label="Check-in real" value={formatDateDisplay(panelData.stay.checkin_date_actual)} />
                      <DetailItem label="Check-out real" value={formatDateDisplay(panelData.stay.checkout_date_actual)} />
                    </div>
                  </PanelSection>

                  <PanelSection title="Financeiro">
                    <div className="grid grid-cols-2 gap-2">
                      <PaymentSummaryCard
                        label="Total estadia"
                        value={formatMoney(panelData.stay.total_price_estimated)}
                        detail={paymentStatusLabel(panelData.stay.stay_payment_status)}
                        tone={panelData.stay.stay_payment_status === "paid" ? "good" : "neutral"}
                      />
                      <PaymentSummaryCard
                        label="Saldo"
                        value={formatMoney(Math.max(panelData.stay.total_price_estimated - panelData.stay.total_paid, 0))}
                        detail={`${formatMoney(panelData.stay.total_paid)} pago`}
                        tone={panelData.stay.total_price_estimated - panelData.stay.total_paid > 0 ? "danger" : "good"}
                      />
                      <PaymentSummaryCard
                        label="Total reserva"
                        value={formatMoney(panelData.reservation.total_due)}
                        detail={paymentStatusLabel(panelData.reservation.payment_status)}
                      />
                      <PaymentSummaryCard label="Pago reserva" value={formatMoney(panelData.reservation.total_paid)} detail="Consolidado" tone={panelData.reservation.total_paid > 0 ? "good" : "neutral"} />
                    </div>
                  </PanelSection>

                  <PanelSection title="Registrar pagamento">
                    <label className="pms-field">
                      <span>Valor</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        placeholder="Valor"
                        className="pms-field-input w-full"
                      />
                    </label>
                    <label className="pms-field">
                      <span>Metodo</span>
                      <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="pms-field-input w-full">
                        <option value="cash">{paymentMethodLabel("cash")}</option>
                        <option value="pix">{paymentMethodLabel("pix")}</option>
                        <option value="credit_card">{paymentMethodLabel("credit_card")}</option>
                        <option value="debit_card">{paymentMethodLabel("debit_card")}</option>
                        <option value="bank_transfer">{paymentMethodLabel("bank_transfer")}</option>
                      </select>
                    </label>
                    <label className="pms-field">
                      <span>Observação</span>
                      <input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Opcional" className="pms-field-input w-full" />
                    </label>
                    <button type="button" onClick={handleAddPayment} disabled={isPending || !paymentAmount} className={primaryButtonClassName}>
                      Registrar pagamento
                    </button>
                  </PanelSection>

                  <PanelSection title="Ações operacionais">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleStayAction("checkin")}
                        disabled={isPending || !panelData.eligibility.can_checkin}
                        className={panelActionButtonClassName}
                        title={panelData.eligibility.checkin_block_reason || ""}
                      >
                        Check-in
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStayAction("checkout")}
                        disabled={isPending || !panelData.eligibility.can_checkout}
                        className={panelActionButtonClassName}
                        title={panelData.eligibility.checkout_block_reason || ""}
                      >
                        Check-out
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStayAction("no-show")}
                        disabled={isPending || !panelData.eligibility.can_no_show}
                        className={panelActionButtonClassName}
                        title={panelData.eligibility.no_show_block_reason || ""}
                      >
                        No-show
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStayAction("cancel")}
                        disabled={isPending || !panelData.eligibility.can_cancel}
                        className={panelActionButtonClassName}
                        title={panelData.eligibility.cancel_block_reason || ""}
                      >
                        Cancelar
                      </button>
                    </div>
                  </PanelSection>

                  {panelData.payments.length ? (
                    <PanelSection title="Historico de pagamentos">
                      <div className="max-h-36 overflow-auto rounded-lg border border-[#eef2f6]">
                        {panelData.payments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between gap-3 border-b border-[#eef2f6] px-3 py-2 last:border-b-0">
                            <div className="min-w-0">
                              <strong className="block text-[0.82rem] text-[#202939]">{paymentMethodLabel(payment.method)}</strong>
                              <span className="block text-[0.75rem] text-[#697586]">{formatDateDisplay(payment.paid_at)}</span>
                            </div>
                            <span className="whitespace-nowrap text-[0.82rem] font-semibold text-[#176c43]">{formatMoney(payment.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </PanelSection>
                  ) : null}
                </>
              ) : (
                <PanelSection title="Dados da reserva">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[1rem] text-[#121926]">{selectedStay.reservation_code || "Sem código"}</strong>
                    <StatusPill status={selectedStay.stay_status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem label="Titular" value={selectedStay.customer_name || "Não informado"} />
                    <DetailItem label="Check-in" value={formatDateDisplay(selectedStay.checkin_date_expected)} />
                    <DetailItem label="Check-out" value={formatDateDisplay(selectedStay.checkout_date_expected)} />
                    <DetailItem label="Pagamento" value={paymentStatusLabel(selectedStay.stay_payment_status)} />
                  </div>
                </PanelSection>
              )}
            </div>
          ) : null}

          {!selectedStay && !candidateStayIds.length ? (
            <div className="grid gap-4 text-sm">
              <PanelSection title="Nova reserva" description="Selecione uma ou mais células livres no mapa para habilitar a simulação.">
                <div className="grid grid-cols-2 gap-2">
                  <PaymentSummaryCard label="Células" value={String(selectedCells.size)} detail="Selecionadas" />
                  <PaymentSummaryCard label="Quartos" value={String(roomsCount)} detail="No recorte" />
                </div>
                <p className="m-0 rounded-lg border border-[#b7d8ff] bg-[#eff6ff] p-3 text-[0.82rem] text-[#1e3a8a]">
                  Os hospedes serao vinculados no check-in desta estadia.
                </p>
              </PanelSection>

              <PanelSection title="Origem e observações">
                <label className="pms-field">
                  <span>Origem</span>
                  <select value={reservationSource} onChange={(event) => setReservationSource(event.target.value as ReservationSource)} className="pms-field-input w-full">
                    <option value="front_desk">{translateReservationSource("front_desk")}</option>
                    <option value="website">{translateReservationSource("website")}</option>
                    <option value="phone">{translateReservationSource("phone")}</option>
                    <option value="agency">{translateReservationSource("agency")}</option>
                  </select>
                </label>
                <label className="pms-field">
                  <span>Observações</span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="pms-field-input w-full resize-y" />
                </label>
              </PanelSection>

              <PanelSection title="Titular">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f8fafc] p-1">
                  <button type="button" className={getSegmentButtonClassName(bookingMode === "existing")} onClick={() => setBookingMode("existing")}>
                    Existente
                  </button>
                  <button type="button" className={getSegmentButtonClassName(bookingMode === "create_inline")} onClick={() => setBookingMode("create_inline")}>
                    Novo cliente
                  </button>
                </div>
                {bookingMode === "existing" ? (
                  <select value={existingCustomerId} onChange={(event) => setExistingCustomerId(event.target.value)} className="pms-field-input w-full">
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.full_name} - {customer.document_number}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid gap-2">
                    <input placeholder="Nome completo" value={inlineCustomer.full_name} onChange={(event) => setInlineCustomer((prev) => ({ ...prev, full_name: event.target.value }))} className="pms-field-input w-full" />
                    <input placeholder="Documento" value={inlineCustomer.document_number} onChange={(event) => setInlineCustomer((prev) => ({ ...prev, document_number: event.target.value }))} className="pms-field-input w-full" />
                    <input placeholder="Tipo doc (cpf)" value={inlineCustomer.document_type} onChange={(event) => setInlineCustomer((prev) => ({ ...prev, document_type: event.target.value }))} className="pms-field-input w-full" />
                    <input type="date" value={inlineCustomer.birth_date} onChange={(event) => setInlineCustomer((prev) => ({ ...prev, birth_date: event.target.value }))} className="pms-field-input w-full" />
                  </div>
                )}
              </PanelSection>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleSimulate} disabled={isPending || !selectedCells.size} className={secondaryButtonClassName}>
                  Simular
                </button>
                <button type="button" onClick={handleConfirm} disabled={isPending || !selectedCells.size} className={primaryButtonClassName}>
                  Confirmar reserva
                </button>
              </div>

              {simulation ? (
                <PanelSection title="Resultado da simulação">
                  <div className="grid grid-cols-3 gap-2">
                    <PaymentSummaryCard label="Total" value={formatMoney(simulation.total_price)} detail="Previsto" tone="good" />
                    <PaymentSummaryCard label="Diárias" value={String(simulation.nights_count)} detail="Calculadas" />
                    <PaymentSummaryCard label="Quartos" value={String(simulation.rooms_count)} detail="Selecionados" />
                  </div>
                </PanelSection>
              ) : null}
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  );
}
