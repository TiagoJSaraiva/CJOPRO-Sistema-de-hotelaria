import { NextResponse } from "next/server";
import { executeStayCheckout } from "../../../../../lib/adminApi";
import type { AdminStayCheckoutInput } from "@hotel/shared";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as AdminStayCheckoutInput;
    const item = await executeStayCheckout(id, payload);
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & {
      statusCode?: number;
      details?: string;
    };
    return NextResponse.json(
      {
        message: parsedError?.message || "Falha ao executar checkout.",
        details: parsedError?.details || null,
      },
      { status: Number(parsedError?.statusCode || 400) },
    );
  }
}
