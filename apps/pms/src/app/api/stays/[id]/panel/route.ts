import { NextResponse } from "next/server";
import { getStayOperationalPanel } from "../../../../../lib/adminApi";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const item = await getStayOperationalPanel(params.id);
    return NextResponse.json(item);
  } catch (error) {
    const parsedError = error as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: parsedError?.message || "Falha ao carregar painel da estadia.", details: parsedError?.details || null },
      { status: Number(parsedError?.statusCode || 400) }
    );
  }
}

