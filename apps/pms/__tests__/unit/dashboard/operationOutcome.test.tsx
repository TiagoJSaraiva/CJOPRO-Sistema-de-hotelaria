// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardStatusMessage } from "../../../src/app/dashboard/_components/DashboardStatusMessage";
import { OperationStatus } from "../../../src/app/dashboard/_components/OperationStatus";
import {
  failureStatus,
  operationOutcome,
} from "../../../src/app/dashboard/_components/operationOutcome";

afterEach(() => cleanup());

describe("resultado da operação", () => {
  it("sem código, não mostra nada", () => {
    expect(operationOutcome(undefined)).toBeNull();
    expect(operationOutcome("")).toBeNull();
    const { container } = render(<OperationStatus />);
    expect(container.textContent).toBe("");
  });

  it.each(["updated", "order-created", "reservation-room-assigned"])(
    "%s é um sucesso",
    (code) => {
      expect(operationOutcome(code)?.tone).toBe("success");
    },
  );

  it.each([
    "invalid",
    "forbidden",
    "not-found",
    "conflict",
    "version-conflict",
    "self-approval",
    "cash-session-required",
    "unavailable",
  ])("%s é uma falha", (code) => {
    expect(operationOutcome(code)?.tone).toBe("error");
  });

  it("código desconhecido não aparece cru nem como sucesso", () => {
    render(<OperationStatus status="Pagamento aprovado pelo banco" />);
    const message = screen.getByRole("status");
    expect(message.textContent).toContain("Não foi possível identificar");
    expect(message.textContent).not.toContain("Pagamento aprovado");
    expect(message.className).not.toContain("success");
  });

  it("propriedades herdadas não passam por código conhecido", () => {
    expect(operationOutcome("constructor")?.tone).toBe("notice");
    expect(operationOutcome("toString")?.tone).toBe("notice");
  });

  it("falha é anunciada como alerta, e sucesso como situação", () => {
    render(<OperationStatus status="conflict" />);
    expect(screen.getByRole("alert").className).toContain("error");
    cleanup();
    render(<OperationStatus status="updated" />);
    expect(screen.getByRole("status").className).toContain("success");
  });

  it("a tela pode dar a própria mensagem a um código", () => {
    expect(
      operationOutcome("conflict", {
        conflict: { tone: "error", message: "Conflito no estoque." },
      })?.message,
    ).toBe("Conflito no estoque.");
  });
});

describe("falha do backend", () => {
  it.each([
    [400, "invalid"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [500, "unavailable"],
    [503, "unavailable"],
  ])("HTTP %i vira %s", (statusCode, code) => {
    expect(failureStatus({ statusCode })).toBe(code);
  });

  it("o detalhe conhecido vale mais que o HTTP", () => {
    expect(
      failureStatus({ statusCode: 409, details: "version_conflict" }),
    ).toBe("version-conflict");
    expect(
      failureStatus({ statusCode: 409, details: "cash_session_required" }),
    ).toBe("cash-session-required");
    expect(failureStatus({ statusCode: 409, details: "self_approval" })).toBe(
      "self-approval",
    );
  });

  it("a quantidade acima do pedido tem explicação própria", () => {
    expect(
      failureStatus({ statusCode: 400, details: "invalid_quantity" }),
    ).toBe("quantity-exceeded");
    expect(operationOutcome("quantity-exceeded")?.message).toContain(
      "saldo do pedido",
    );
  });

  it("detalhe desconhecido cai no HTTP", () => {
    expect(failureStatus({ statusCode: 409, details: "other" })).toBe(
      "conflict",
    );
    expect(failureStatus({ statusCode: 409, details: "constructor" })).toBe(
      "conflict",
    );
  });

  it("erro sem resposta do backend é indisponibilidade", () => {
    expect(failureStatus(new Error("fetch failed"))).toBe("unavailable");
    expect(failureStatus(undefined)).toBe("unavailable");
  });
});

describe("mensagem por entidade", () => {
  const messages = { created: "Criado.", create_error: "Falhou." };

  it("falha é alerta e sucesso é situação", () => {
    render(
      <DashboardStatusMessage status="create_error" messages={messages} />,
    );
    expect(screen.getByRole("alert").textContent).toBe("Falhou.");
    cleanup();
    render(<DashboardStatusMessage status="created" messages={messages} />);
    expect(screen.getByRole("status").textContent).toBe("Criado.");
  });
});
