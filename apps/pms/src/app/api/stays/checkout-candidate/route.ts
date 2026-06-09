import { NextResponse } from "next/server";
import { getStayCheckoutCandidateByRoomNumber } from "../../../../lib/adminApi";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const roomNumber = url.searchParams.get("room_number") || "";
    const item = await getStayCheckoutCandidateByRoomNumber(roomNumber);
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: parsedError?.message || "Falha ao localizar estadia para checkout.", details: parsedError?.details || null },
      { status: Number(parsedError?.statusCode || 400) }
    );
  }
}
