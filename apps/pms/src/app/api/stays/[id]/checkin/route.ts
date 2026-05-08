import { NextResponse } from "next/server";
import { executeStayCheckin } from "../../../../../lib/adminApi";

type Params = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, { params }: Params) {
  try {
    const item = await executeStayCheckin(params.id);
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: parsedError?.message || "Falha ao executar check-in.", details: parsedError?.details || null },
      { status: Number(parsedError?.statusCode || 400) }
    );
  }
}

