import { NextResponse } from "next/server";
import {
  getStayAccount,
  getStayCheckoutCandidateByRoomNumber,
  getStayDepartureReview,
} from "../../../../lib/adminApi";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const roomNumber = url.searchParams.get("room_number") || "";
    const item = await getStayCheckoutCandidateByRoomNumber(roomNumber);
    const account = await getStayAccount(item.stay.id);
    const departureReview = await getStayDepartureReview(item.stay.id);
    return NextResponse.json({
      ...item,
      account,
      departure_review: departureReview,
    });
  } catch (error) {
    const parsedError = error as Error & {
      statusCode?: number;
      details?: string;
    };
    return NextResponse.json(
      {
        message:
          parsedError?.message || "Falha ao localizar estadia para checkout.",
        details: parsedError?.details || null,
      },
      { status: Number(parsedError?.statusCode || 400) },
    );
  }
}
