import { NextResponse, type NextRequest } from "next/server";
import {
  getOperationalPending,
  actOperationalPending,
  reconcileOperationalPending,
} from "../../../lib/adminApi";
function failure(cause: unknown) {
  const error = cause as Error & { statusCode?: number };
  return NextResponse.json(
    { message: error.message || "Falha na operação." },
    { status: error.statusCode || 500 },
  );
}
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await getOperationalPending(request.nextUrl.searchParams.toString()),
    );
  } catch (cause) {
    return failure(cause);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json(
      body.action === "reconcile"
        ? await reconcileOperationalPending()
        : await actOperationalPending(body),
    );
  } catch (cause) {
    return failure(cause);
  }
}
