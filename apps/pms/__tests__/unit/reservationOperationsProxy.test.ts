import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: vi.fn(),
}));
import { requestOperationsFinanceEndpoint } from "../../src/lib/adminApi";
import {
  GET,
  POST,
} from "../../src/app/api/reservation-operations/[...path]/route";
const id = "90000000-0000-4000-8000-000000000001";
it("proxy preserves endpoint, payload and backend errors", async () => {
  vi.mocked(requestOperationsFinanceEndpoint).mockResolvedValue({
    arrival: { guest_count: 2 },
  });
  expect(
    (
      await GET(new NextRequest("http://localhost/api"), {
        params: Promise.resolve({ path: [id] }),
      })
    ).status,
  ).toBe(200);
  expect(requestOperationsFinanceEndpoint).toHaveBeenCalledWith(
    `reservations/${id}`,
    "GET",
    undefined,
  );
  await POST(
    new NextRequest("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ expires_in_hours: 24 }),
    }),
    { params: Promise.resolve({ path: [id, "prearrival-links"] }) },
  );
  expect(requestOperationsFinanceEndpoint).toHaveBeenCalledWith(
    `reservations/${id}/prearrival-links`,
    "POST",
    { expires_in_hours: 24 },
  );
  vi.mocked(requestOperationsFinanceEndpoint).mockRejectedValue(
    Object.assign(new Error("Sem acesso"), { statusCode: 403 }),
  );
  const denied = await GET(new NextRequest("http://localhost/api"), {
    params: Promise.resolve({ path: [id] }),
  });
  expect(denied.status).toBe(403);
  expect(await denied.json()).toMatchObject({ message: "Sem acesso" });
});
it("rejects unsupported operations before calling backend", async () => {
  vi.mocked(requestOperationsFinanceEndpoint).mockClear();
  for (const path of [
    [],
    ["../auth"],
    [id, "delete"],
    [id, "guarantees", "extra"],
  ]) {
    expect(
      (
        await POST(
          new NextRequest("http://localhost/api", {
            method: "POST",
            body: "{}",
          }),
          { params: Promise.resolve({ path }) },
        )
      ).status,
    ).toBe(400);
  }
  expect(requestOperationsFinanceEndpoint).not.toHaveBeenCalled();
});
