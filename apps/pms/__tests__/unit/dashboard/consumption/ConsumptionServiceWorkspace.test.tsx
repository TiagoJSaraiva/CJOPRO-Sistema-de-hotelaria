// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../../../src/app/dashboard/consumption/service/actions", () => ({
  actServiceOrderAction: vi.fn(),
  createServiceOrderAction: vi.fn(),
}));

import { ConsumptionServiceWorkspace } from "../../../../src/app/dashboard/consumption/service/ConsumptionServiceWorkspace";

afterEach(cleanup);

it("a previsão de entrega aparece no fuso do hotel", () => {
  render(
    <ConsumptionServiceWorkspace
      timeZone="Asia/Tokyo"
      items={[
        {
          id: "order-1",
          status: "received",
          version: 1,
          room_number: "102",
          point_name: "Café",
          mode: "room_service",
          expected_at: "2026-05-12T15:30:00.000Z",
          gross_amount: 16,
        },
      ]}
      stays={[]}
      context={null}
      canManage={false}
      canCancel={false}
    />,
  );
  expect(screen.getByText(/Previsão: 13\/05\/2026, 00:30:00/)).toBeTruthy();
});
