import { NextResponse } from "next/server";
import { executeStayNoShow } from "../../../../../lib/adminApi";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const item = await executeStayNoShow(id);
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: parsedError?.message || "Falha ao aplicar no-show.", details: parsedError?.details || null },
      { status: Number(parsedError?.statusCode || 400) }
    );
  }
}
