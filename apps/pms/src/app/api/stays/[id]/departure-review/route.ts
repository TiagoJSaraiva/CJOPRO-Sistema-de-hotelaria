import { NextResponse } from "next/server";
import { getStayDepartureReview } from "../../../../../lib/adminApi";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await getStayDepartureReview(id));
  } catch (error) {
    const parsed = error as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      {
        message: parsed.message || "Falha ao conferir a saída.",
        details: parsed.details || null,
      },
      { status: Number(parsed.statusCode || 400) },
    );
  }
}
