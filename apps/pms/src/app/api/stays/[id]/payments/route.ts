import { NextResponse } from "next/server";
import { createStayPayment } from "../../../../../lib/adminApi";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const item = await createStayPayment(id, payload);
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: parsedError?.message || "Falha ao registrar pagamento.", details: parsedError?.details || null },
      { status: Number(parsedError?.statusCode || 400) }
    );
  }
}
