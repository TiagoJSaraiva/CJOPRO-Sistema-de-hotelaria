import { NextResponse } from "next/server";
import { relocateStay } from "../../../../../lib/adminApi";
type Params = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Params) {
  try {
    return NextResponse.json(
      await relocateStay((await params).id, await request.json()),
    );
  } catch (cause) {
    const error = cause as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: error.message, details: error.details || null },
      { status: error.statusCode || 400 },
    );
  }
}
