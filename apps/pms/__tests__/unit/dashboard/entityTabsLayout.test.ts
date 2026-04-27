import { describe, expect, it } from "vitest";
import {
  shouldPlaceTabsInFilterBar,
  shouldRenderEntityTabs,
  type DashboardEntityTabItem
} from "../../../src/app/dashboard/_components/DashboardEntityTabsLayout";

describe("dashboard entity tabs layout", () => {
  it("posiciona abas na barra de filtros quando aba ativa e view", () => {
    expect(shouldPlaceTabsInFilterBar("view")).toBe(true);
  });

  it("mantem abas no header para outras abas", () => {
    expect(shouldPlaceTabsInFilterBar("create")).toBe(false);
    expect(shouldPlaceTabsInFilterBar("edit")).toBe(false);
  });

  it("renderiza abas apenas quando ha mais de uma aba visivel", () => {
    const hiddenAndVisible: DashboardEntityTabItem[] = [
      { key: "create", label: "Criar entidade", href: "/dashboard/entities/create", isVisible: false },
      { key: "view", label: "Ver entidades", href: "/dashboard/entities/view", isVisible: true }
    ];

    const twoVisible: DashboardEntityTabItem[] = [
      { key: "create", label: "Criar entidade", href: "/dashboard/entities/create", isVisible: true },
      { key: "view", label: "Ver entidades", href: "/dashboard/entities/view", isVisible: true }
    ];

    expect(shouldRenderEntityTabs(hiddenAndVisible)).toBe(false);
    expect(shouldRenderEntityTabs(twoVisible)).toBe(true);
  });
});
