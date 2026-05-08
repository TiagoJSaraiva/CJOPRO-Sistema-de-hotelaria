"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const STATUS_COLORS: Record<string, string> = {
  pending: "#0ea5e9",
  confirmed: "#22c55e",
  checked_in: "#16a34a",
  checked_out: "#86efac",
  canceled: "#f97316",
  no_show: "#a3a3a3",
  blocked: "#ef4444",
  maintenance: "#ef4444"
};

type SelectionSide = "checkin" | "checkout" | "full";
type CellOccupancy = {
  left: boolean;
  right: boolean;
};

function statusLabel(status: ReservationStatus | null): string {
  if (!status) return "N/A";
  return status.replace("_", " ");
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
  const prevHref = `/dashboard/reservations_calendar/view?start_date=${addDaysIso(startDate, -CALENDAR_WINDOW_DAYS)}`;
  const nextHref = `/dashboard/reservations_calendar/view?start_date=${addDaysIso(startDate, CALENDAR_WINDOW_DAYS)}`;

  const selectedCellsPayload = Array.from(selectedCells).map((key) => {
    const [cellKey, side] = key;
    const [room_id = "", date = ""] = cellKey.split("::");
    return { room_id, date, side };
  });
  const roomsCount = new Set(selectedCellsPayload.map((item) => item.room_id)).size;

  async function postJson<T>(url: string, payload: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const dataResponse = await response.json();
    if (!response.ok) {
      throw new Error(String(dataResponse?.message || "Falha na operacao."));
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
      throw new Error(String(dataResponse?.message || "Falha na operacao."));
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
      setError(requestError instanceof Error ? requestError.message : "Falha ao executar acao operacional.");
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
    <section className="pms-surface-card">
      <div className="mb-4 flex items-center justify-center">
        <div className="flex items-center gap-3 text-2xl font-semibold">
          <Link href={prevHref} className="rounded border border-[#d8d8d8] px-3 no-underline">
            {"<"}
          </Link>
          <span>{rangeLabel}</span>
          <Link href={nextHref} className="rounded border border-[#d8d8d8] px-3 no-underline">
            {">"}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-4">
        <div className="overflow-auto rounded border border-[#d8d8d8] bg-white">
          <div style={{ width: LEFT_PANEL_WIDTH + data.days.length * CELL_WIDTH }} className="relative">
            <div className="sticky top-0 z-20 grid border-b border-[#dfdfdf] bg-[#fafafa]" style={{ gridTemplateColumns: `${LEFT_PANEL_WIDTH}px repeat(${data.days.length}, ${CELL_WIDTH}px)` }}>
              <div className="px-3 py-2 text-sm font-semibold">Quarto</div>
              {data.days.map((day) => (
                <div key={day.date} className="border-l border-[#ececec] px-1 py-1 text-center text-xs font-semibold">
                  <div>{String(day.day_number).padStart(2, "0")}</div>
                  <div>{day.weekday_short}</div>
                </div>
              ))}
            </div>

            <div>
              {data.rooms.map((room) => (
                <div key={room.room_id} className="relative grid border-b border-[#efefef]" style={{ gridTemplateColumns: `${LEFT_PANEL_WIDTH}px repeat(${data.days.length}, ${CELL_WIDTH}px)`, height: ROW_HEIGHT }}>
                  <div className="border-r border-[#efefef] px-3 py-2">
                    <p className="m-0 text-sm font-semibold">{room.room_type.toUpperCase()}</p>
                    <p className="m-0 text-sm">
                      {room.room_number} | {room.max_occupancy} hospedes
                    </p>
                  </div>
                  {data.days.map((day) => {
                    const key = `${room.room_id}::${day.date}`;
                    const occupied = occupiedCellsBySide.get(key) || { left: false, right: false };
                    const hasAnyOccupiedSide = occupied.left || occupied.right;
                    const selectedSide = selectedCells.get(key);
                    const selected =
                      selectedSide === "full"
                        ? "#bbf7d0"
                        : selectedSide === "checkin"
                          ? "linear-gradient(90deg, transparent 0%, transparent 50%, #bbf7d0 50%, #bbf7d0 100%)"
                          : selectedSide === "checkout"
                            ? "linear-gradient(90deg, #bbf7d0 0%, #bbf7d0 50%, transparent 50%, transparent 100%)"
                            : "transparent";
                    return (
                      <button
                        key={`${room.room_id}-${day.date}`}
                        type="button"
                        className="border-l border-[#f2f2f2]"
                        style={{ background: selected, cursor: "pointer" }}
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
                        className="pointer-events-auto absolute cursor-pointer rounded border-[2px] border-[#0f172a] text-left text-[11px] text-white"
                        style={{
                          left: block.left,
                          top: 0,
                          width: block.width,
                          height: BLOCK_HEIGHT,
                          backgroundColor: STATUS_COLORS[block.stay.stay_status || "pending"] || STATUS_COLORS.pending
                        }}
                        onClick={() => {
                          setCandidateStayIds([]);
                          setSelectedStayId(block.stay.id);
                        }}
                      >
                        <span className="block truncate px-2 py-1">{block.stay.reservation_code || "Sem codigo"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded border border-[#d8d8d8] bg-white p-3">
          <h3 className="mt-0">Painel</h3>
          {error ? <p className="rounded bg-[#fee2e2] p-2 text-sm text-[#7f1d1d]">{error}</p> : null}

          {candidateStayIds.length > 1 ? (
            <div>
              <p className="text-sm">Existem multiplas estadias nesta data. Escolha uma:</p>
              <div className="flex flex-col gap-2">
                {candidateStayIds.map((stayId) => {
                  const stay = data.stays.find((item) => item.id === stayId);
                  if (!stay) return null;
                  return (
                    <button key={stay.id} type="button" className="cursor-pointer rounded border border-[#d8d8d8] bg-white px-2 py-2 text-left" onClick={() => setSelectedStayId(stay.id)}>
                      <strong>{stay.reservation_code || "Sem codigo"}</strong>
                      <div className="text-xs">{statusLabel(stay.stay_status)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectedStay ? (
            <div className="text-sm">
              {panelLoading ? <p>Carregando painel operacional...</p> : null}
              {panelData ? (
                <div className="space-y-3">
                  <div>
                    <p><strong>Reserva:</strong> {panelData.stay.reservation_code || "Sem codigo"}</p>
                    <p><strong>Titular:</strong> {panelData.stay.customer_name || "Nao informado"}</p>
                    <p><strong>Status:</strong> {statusLabel(panelData.stay.stay_status)}</p>
                    <p><strong>Check-in esperado:</strong> {panelData.stay.checkin_date_expected}</p>
                    <p><strong>Check-out esperado:</strong> {panelData.stay.checkout_date_expected}</p>
                    <p><strong>Check-in real:</strong> {panelData.stay.checkin_date_actual || "-"}</p>
                    <p><strong>Check-out real:</strong> {panelData.stay.checkout_date_actual || "-"}</p>
                  </div>

                  <div className="rounded bg-[#f8fafc] p-2 text-xs">
                    <p className="m-0"><strong>Pagamento estadia:</strong> {panelData.stay.stay_payment_status}</p>
                    <p className="m-0"><strong>Total:</strong> R$ {panelData.stay.total_price_estimated.toFixed(2)}</p>
                    <p className="m-0"><strong>Pago:</strong> R$ {panelData.stay.total_paid.toFixed(2)}</p>
                    <p className="m-0"><strong>Saldo:</strong> R$ {(panelData.stay.total_price_estimated - panelData.stay.total_paid).toFixed(2)}</p>
                  </div>

                  <div className="rounded bg-[#f8fafc] p-2 text-xs">
                    <p className="m-0"><strong>Pagamento reserva:</strong> {panelData.reservation.payment_status}</p>
                    <p className="m-0"><strong>Total reserva:</strong> R$ {panelData.reservation.total_due.toFixed(2)}</p>
                    <p className="m-0"><strong>Pago reserva:</strong> R$ {panelData.reservation.total_paid.toFixed(2)}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="m-0 text-xs font-semibold">Registrar pagamento</p>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="Valor"
                      className="pms-field-input"
                    />
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="pms-field-input">
                      <option value="cash">cash</option>
                      <option value="card">card</option>
                      <option value="pix">pix</option>
                      <option value="bank_transfer">bank_transfer</option>
                    </select>
                    <input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Observacao (opcional)" className="pms-field-input" />
                    <button type="button" onClick={handleAddPayment} disabled={isPending || !paymentAmount} className="cursor-pointer rounded border border-[#d8d8d8] bg-white px-2 py-1">
                      Registrar pagamento
                    </button>
                  </div>

                  <div className="space-y-1">
                    <p className="m-0 text-xs font-semibold">Acoes operacionais</p>
                    <button
                      type="button"
                      onClick={() => handleStayAction("checkin")}
                      disabled={isPending || !panelData.eligibility.can_checkin}
                      className="mr-2 cursor-pointer rounded border border-[#d8d8d8] bg-white px-2 py-1 text-xs disabled:cursor-not-allowed"
                      title={panelData.eligibility.checkin_block_reason || ""}
                    >
                      Check-in
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStayAction("checkout")}
                      disabled={isPending || !panelData.eligibility.can_checkout}
                      className="mr-2 cursor-pointer rounded border border-[#d8d8d8] bg-white px-2 py-1 text-xs disabled:cursor-not-allowed"
                      title={panelData.eligibility.checkout_block_reason || ""}
                    >
                      Check-out
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStayAction("no-show")}
                      disabled={isPending || !panelData.eligibility.can_no_show}
                      className="mr-2 cursor-pointer rounded border border-[#d8d8d8] bg-white px-2 py-1 text-xs disabled:cursor-not-allowed"
                      title={panelData.eligibility.no_show_block_reason || ""}
                    >
                      No-show
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStayAction("cancel")}
                      disabled={isPending || !panelData.eligibility.can_cancel}
                      className="cursor-pointer rounded border border-[#d8d8d8] bg-white px-2 py-1 text-xs disabled:cursor-not-allowed"
                      title={panelData.eligibility.cancel_block_reason || ""}
                    >
                      Cancelar
                    </button>
                  </div>

                  {panelData.payments.length ? (
                    <div>
                      <p className="m-0 text-xs font-semibold">Historico de pagamentos</p>
                      <div className="mt-1 max-h-32 overflow-auto text-xs">
                        {panelData.payments.map((payment) => (
                          <p key={payment.id} className="m-0">
                            {payment.paid_at.slice(0, 10)} - {payment.method} - R$ {payment.amount.toFixed(2)}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <p><strong>Reserva:</strong> {selectedStay.reservation_code || "Sem codigo"}</p>
                  <p><strong>Status:</strong> {statusLabel(selectedStay.stay_status)}</p>
                  <p><strong>Titular:</strong> {selectedStay.customer_name || "Nao informado"}</p>
                  <p><strong>Check-in:</strong> {selectedStay.checkin_date_expected}</p>
                  <p><strong>Check-out:</strong> {selectedStay.checkout_date_expected}</p>
                </div>
              )}
            </div>
          ) : null}

          {!selectedStay && !candidateStayIds.length ? (
            <div className="space-y-2 text-sm">
              <p><strong>Selecao:</strong> {selectedCells.size} celulas, {roomsCount} quarto(s)</p>
              <p className="rounded bg-[#eff6ff] p-2 text-xs text-[#1e3a8a]">
                Os hospedes serao vinculados no check-in desta estadia.
              </p>
              <label className="block">
                <span className="mb-1 block">Origem</span>
                <select value={reservationSource} onChange={(event) => setReservationSource(event.target.value as ReservationSource)} className="pms-field-input">
                  <option value="front_desk">front_desk</option>
                  <option value="website">website</option>
                  <option value="phone">phone</option>
                  <option value="agency">agency</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block">Observacoes</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="pms-field-input" />
              </label>
              <div>
                <span className="mb-1 block">Titular</span>
                <div className="mb-2 flex gap-2">
                  <button type="button" className="rounded border border-[#d8d8d8] px-2 py-1" onClick={() => setBookingMode("existing")}>Existente</button>
                  <button type="button" className="rounded border border-[#d8d8d8] px-2 py-1" onClick={() => setBookingMode("create_inline")}>Novo cliente</button>
                </div>
                {bookingMode === "existing" ? (
                  <select value={existingCustomerId} onChange={(event) => setExistingCustomerId(event.target.value)} className="pms-field-input">
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.full_name} - {customer.document_number}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input placeholder="Nome completo" value={inlineCustomer.full_name} onChange={(event) => setInlineCustomer((prev) => ({ ...prev, full_name: event.target.value }))} className="pms-field-input" />
                    <input placeholder="Documento" value={inlineCustomer.document_number} onChange={(event) => setInlineCustomer((prev) => ({ ...prev, document_number: event.target.value }))} className="pms-field-input" />
                    <input placeholder="Tipo doc (cpf)" value={inlineCustomer.document_type} onChange={(event) => setInlineCustomer((prev) => ({ ...prev, document_type: event.target.value }))} className="pms-field-input" />
                    <input type="date" value={inlineCustomer.birth_date} onChange={(event) => setInlineCustomer((prev) => ({ ...prev, birth_date: event.target.value }))} className="pms-field-input" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleSimulate} disabled={isPending || !selectedCells.size} className="cursor-pointer rounded border border-[#d8d8d8] bg-white px-3 py-2">
                  Simular
                </button>
                <button type="button" onClick={handleConfirm} disabled={isPending || !selectedCells.size} className="cursor-pointer rounded border border-[#166534] bg-[#16a34a] px-3 py-2 text-white">
                  Confirmar reserva
                </button>
              </div>

              {simulation ? (
                <div className="rounded bg-[#f8fafc] p-2 text-xs">
                  <p className="m-0"><strong>Total:</strong> R$ {simulation.total_price.toFixed(2)}</p>
                  <p className="m-0"><strong>Diarias:</strong> {simulation.nights_count}</p>
                  <p className="m-0"><strong>Quartos:</strong> {simulation.rooms_count}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
