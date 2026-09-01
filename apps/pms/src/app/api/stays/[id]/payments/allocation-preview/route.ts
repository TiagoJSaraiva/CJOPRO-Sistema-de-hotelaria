import { NextResponse } from "next/server";
import { previewStayPaymentAllocation } from "../../../../../../lib/adminApi";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as { amount?: number };
    const item = await previewStayPaymentAllocation(id, Number(payload.amount));
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & {
      statusCode?: number;
      details?: string;
    };
    return NextResponse.json(
      {
        message: parsedError?.message || "Falha ao sugerir a alocação.",
        details: parsedError?.details || null,
      },
      { status: Number(parsedError?.statusCode || 400) },
    );
  }
}
