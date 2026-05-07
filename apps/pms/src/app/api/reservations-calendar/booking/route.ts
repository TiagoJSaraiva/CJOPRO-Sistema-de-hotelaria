import { NextResponse } from "next/server";
import { createReservationsCalendarBooking } from "../../../../lib/adminApi";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const item = await createReservationsCalendarBooking(payload);
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & { statusCode?: number; details?: string };
    const message = parsedError?.message || "Falha ao confirmar reserva.";
    const status = Number(parsedError?.statusCode || 400);
    return NextResponse.json({ message, details: parsedError?.details || null }, { status });
  }
}
