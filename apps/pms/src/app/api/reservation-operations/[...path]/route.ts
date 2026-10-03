import { NextResponse, type NextRequest } from "next/server";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";

type Context = { params: Promise<{ path: string[] }> };
async function proxy(
  request: NextRequest,
  context: Context,
  method: "GET" | "POST",
) {
  const { path } = await context.params;
  const [id, action] = path;
  if (
    !id ||
    !/^[a-z0-9-]+$/i.test(id) ||
    path.length > 2 ||
    (method === "GET"
      ? Boolean(action)
      : !["guarantees", "prearrival-links"].includes(action || ""))
  ) {
    return NextResponse.json(
      { message: "Operação inválida." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await requestOperationsFinanceEndpoint<unknown>(
        `reservations/${path.join("/")}`,
        method,
        method === "POST" ? await request.json() : undefined,
      ),
    );
  } catch (cause) {
    const error = cause as Error & { statusCode?: number; details?: string };
    return NextResponse.json(
      { message: error.message, details: error.details || null },
      { status: error.statusCode || 500 },
    );
  }
}
export function GET(request: NextRequest, context: Context) {
  return proxy(request, context, "GET");
}
export function POST(request: NextRequest, context: Context) {
  return proxy(request, context, "POST");
}
