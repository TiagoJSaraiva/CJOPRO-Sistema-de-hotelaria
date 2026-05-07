import { NextResponse } from "next/server";
import { createReservationsCalendarBooking } from "../../../../lib/adminApi";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const item = await createReservationsCalendarBooking(payload);
    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao confirmar reserva.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
