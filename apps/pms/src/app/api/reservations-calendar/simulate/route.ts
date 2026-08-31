import { NextResponse } from "next/server";
import { simulateReservationsCalendarBooking } from "../../../../lib/adminApi";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const item = await simulateReservationsCalendarBooking(payload);
    return NextResponse.json(item);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao simular reserva.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
