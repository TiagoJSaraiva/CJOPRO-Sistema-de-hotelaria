"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminReservationCalendarResponse, ReservationStatus } from "@hotel/shared";
import { addDaysIso, CALENDAR_WINDOW_DAYS, formatDateRangeLabel } from "./calendarUtils";

type ReservationsCalendarBoardProps = {
  data: AdminReservationCalendarResponse;
  startDate: string;
};

const CELL_WIDTH = 44;
const ROW_HEIGHT = 42;
const LEFT_PANEL_WIDTH = 200;

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

function statusLabel(status: ReservationStatus | null): string {
  if (!status) return "N/A";
  return status.replace("_", " ");
}

export function ReservationsCalendarBoard({ data, startDate }: ReservationsCalendarBoardProps) {
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);
  const [candidateStayIds, setCandidateStayIds] = useState<string[]>([]);

  const selectedStay = useMemo(() => data.stays.find((item) => item.id === selectedStayId) || null, [data.stays, selectedStayId]);
  const daysMap = useMemo(() => new Map(data.days.map((day, index) => [day.date, index])), [data.days]);
  const roomIndexMap = useMemo(() => new Map(data.rooms.map((room, index) => [room.room_id, index])), [data.rooms]);

  const overlayBlocks = useMemo(() => {
    return data.stays
      .map((stay) => {
        const roomIndex = roomIndexMap.get(stay.room_id);
        const startIndex = daysMap.get(stay.start_date);
        const endIndex = daysMap.get(stay.end_date);
        if (roomIndex === undefined || startIndex === undefined || endIndex === undefined) return null;

        const leftOffset = LEFT_PANEL_WIDTH + startIndex * CELL_WIDTH + (stay.start_half === "right" ? CELL_WIDTH / 2 : 0);
        const rightOffset = (endIndex + 1) * CELL_WIDTH - (stay.end_half === "left" ? CELL_WIDTH / 2 : 0);
        const width = Math.max(8, rightOffset - (startIndex * CELL_WIDTH + (stay.start_half === "right" ? CELL_WIDTH / 2 : 0)));
        const top = roomIndex * ROW_HEIGHT + 6;

        return {
          stay,
          left: leftOffset,
          top,
          width
        };
      })
      .filter(Boolean) as Array<{ stay: AdminReservationCalendarResponse["stays"][number]; left: number; top: number; width: number }>;
  }, [data.stays, daysMap, roomIndexMap]);

  const rangeLabel = formatDateRangeLabel(data.days);
  const prevHref = `/dashboard/reservations_calendar/view?start_date=${addDaysIso(startDate, -CALENDAR_WINDOW_DAYS)}`;
  const nextHref = `/dashboard/reservations_calendar/view?start_date=${addDaysIso(startDate, CALENDAR_WINDOW_DAYS)}`;

  return (
    <section className="pms-surface-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {data.legend.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-2 text-sm">
              <span style={{ backgroundColor: item.color }} className="inline-block h-4 w-4 rounded-full" />
              {item.label}
            </span>
          ))}
        </div>
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

      <div className="grid grid-cols-[1fr_280px] gap-4">
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

            <div className="relative">
              {data.rooms.map((room) => (
                <div
                  key={room.room_id}
                  className="grid border-b border-[#efefef]"
                  style={{ gridTemplateColumns: `${LEFT_PANEL_WIDTH}px repeat(${data.days.length}, ${CELL_WIDTH}px)`, minHeight: ROW_HEIGHT }}
                >
                  <div className="border-r border-[#efefef] px-3 py-2">
                    <p className="m-0 text-sm font-semibold">{room.room_type.toUpperCase()}</p>
                    <p className="m-0 text-sm">{room.room_number}</p>
                  </div>
                  {data.days.map((day) => (
                    <button
                      key={`${room.room_id}-${day.date}`}
                      type="button"
                      className="border-l border-[#f2f2f2] bg-transparent"
                      onClick={() => {
                        const candidates = data.stays.filter(
                          (stay) => stay.room_id === room.room_id && day.date >= stay.start_date && day.date <= stay.end_date
                        );
                        if (candidates.length === 1) {
                          const first = candidates[0];
                          if (!first) return;
                          setCandidateStayIds([]);
                          setSelectedStayId(first.id);
                          return;
                        }
                        if (candidates.length > 1) {
                          setCandidateStayIds(candidates.map((item) => item.id));
                          setSelectedStayId(null);
                        }
                      }}
                    />
                  ))}
                </div>
              ))}

              <div className="pointer-events-none absolute inset-0 z-10">
                {overlayBlocks.map((block) => (
                  <button
                    key={block.stay.id}
                    type="button"
                    className="pointer-events-auto absolute h-[30px] cursor-pointer rounded border-[3px] border-[#0f172a] text-left text-[11px] text-white"
                    style={{
                      left: block.left,
                      top: block.top,
                      width: block.width,
                      backgroundColor: STATUS_COLORS[block.stay.reservation_status || "pending"] || STATUS_COLORS.pending
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
          </div>
        </div>

        <aside className="rounded border border-[#d8d8d8] bg-white p-3">
          <h3 className="mt-0">Detalhes</h3>
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
                      <div className="text-xs">{statusLabel(stay.reservation_status)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!candidateStayIds.length && !selectedStay ? <p className="text-sm text-[#666]">Clique em um bloco para ver detalhes da estadia.</p> : null}

          {selectedStay ? (
            <div className="text-sm">
              <p>
                <strong>Reserva:</strong> {selectedStay.reservation_code || "Sem codigo"}
              </p>
              <p>
                <strong>Status:</strong> {statusLabel(selectedStay.reservation_status)}
              </p>
              <p>
                <strong>Hospede:</strong> {selectedStay.customer_name || "Nao informado"}
              </p>
              <p>
                <strong>Check-in:</strong> {selectedStay.checkin_date_expected}
              </p>
              <p>
                <strong>Check-out:</strong> {selectedStay.checkout_date_expected}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
