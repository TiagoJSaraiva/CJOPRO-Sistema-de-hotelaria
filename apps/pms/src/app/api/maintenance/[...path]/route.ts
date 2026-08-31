import { NextResponse, type NextRequest } from "next/server";
import { requestMaintenanceEndpoint } from "../../../../lib/adminApi";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(
  request: NextRequest,
  context: RouteContext,
  method: "GET" | "POST" | "PUT",
) {
  const { path } = await context.params;
  const query = request.nextUrl.searchParams.toString();
  const endpoint = `${path.join("/")}${query ? `?${query}` : ""}`;
  try {
    const body =
      method === "GET" ? undefined : await request.json().catch(() => ({}));
    return NextResponse.json(
      await requestMaintenanceEndpoint<unknown>(endpoint, method, body),
    );
  } catch (requestError) {
    const error = requestError as Error & {
      statusCode?: number;
      details?: string;
    };
    return NextResponse.json(
      {
        message: error.message || "Falha na operação de manutenção.",
        details: error.details || null,
      },
      { status: error.statusCode || 500 },
    );
  }
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET");
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST");
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "PUT");
}
