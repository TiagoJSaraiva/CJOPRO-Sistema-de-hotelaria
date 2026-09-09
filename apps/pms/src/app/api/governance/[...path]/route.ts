import { NextResponse, type NextRequest } from "next/server";
import { requestGovernanceEndpoint } from "../../../../lib/adminApi";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(
  request: NextRequest,
  context: RouteContext,
  method: "GET" | "POST",
) {
  const { path } = await context.params;
  const query = request.nextUrl.searchParams.toString();
  try {
    const body =
      method === "GET" ? undefined : await request.json().catch(() => ({}));
    return NextResponse.json(
      await requestGovernanceEndpoint<unknown>(
        `${path.join("/")}${query ? `?${query}` : ""}`,
        method,
        body,
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

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET");
}
export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST");
}
