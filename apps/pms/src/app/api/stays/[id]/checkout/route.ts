import { NextResponse } from "next/server";
import { executeStayCheckout } from "../../../../../lib/adminApi";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as {
      maintenance_acknowledged_occurrence_ids?: string[];
      maintenance_acknowledgement_note?: string;
    };
    const item = await executeStayCheckout(id, payload);
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: parsedError?.message || "Falha ao executar checkout.", details: parsedError?.details || null },
      { status: Number(parsedError?.statusCode || 400) }
    );
  }
}
