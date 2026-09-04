import { NextResponse } from "next/server";
import { getStayAccount } from "../../../../../lib/adminApi";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await getStayAccount(id));
  } catch (error) {
    const parsed = error as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: parsed.message, details: parsed.details || null },
      { status: parsed.statusCode || 400 },
    );
  }
}
