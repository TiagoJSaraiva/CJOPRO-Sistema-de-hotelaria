import { NextResponse } from "next/server";
import { simulateStayRelocation } from "../../../../../../lib/adminApi";
type Params = { params: Promise<{ id: string }> };
export async function POST(_request: Request, { params }: Params) {
  try {
    return NextResponse.json(await simulateStayRelocation((await params).id));
  } catch (cause) {
    const error = cause as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: error.message, details: error.details || null },
      { status: error.statusCode || 400 },
    );
  }
}
