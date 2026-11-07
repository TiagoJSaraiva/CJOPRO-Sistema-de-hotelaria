import { NextResponse } from "next/server";
import { executeStayCancel } from "../../../../../lib/adminApi";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as {
      reason?: string;
    };
    const item = await executeStayCancel(id, { reason: payload.reason || "" });
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & {
      statusCode?: number;
      details?: string;
    };
    return NextResponse.json(
      {
        message: parsedError?.message || "Falha ao cancelar estadia.",
        details: parsedError?.details || null,
      },
      { status: Number(parsedError?.statusCode || 400) },
    );
  }
}
