import { NextResponse } from "next/server";
import type { AdminStayPaymentBatchInput } from "@hotel/shared";
import { createStayPaymentBatch } from "../../../../../lib/adminApi";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as AdminStayPaymentBatchInput;
    return NextResponse.json(await createStayPaymentBatch(id, payload));
  } catch (error) {
    const parsed = error as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: parsed.message, details: parsed.details || null },
      { status: parsed.statusCode || 400 },
    );
  }
}
