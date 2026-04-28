import { describe, expect, it } from "vitest";
import {
  DASHBOARD_CREATE_FORM_GRID_CLASS,
  getDashboardCreateFormClassName,
  getDashboardFormFieldClassName
} from "../../../../src/app/dashboard/_components/formLayout";

describe("dashboard form layout", () => {
  it("usa grid padrao quando formClassName nao e informado", () => {
    expect(getDashboardCreateFormClassName()).toBe(DASHBOARD_CREATE_FORM_GRID_CLASS);
  });

  it("permite sobrescrever grid do formulario", () => {
    expect(getDashboardCreateFormClassName("grid gap-2")).toBe("grid gap-2");
  });

  it("retorna classe base para campo padrao", () => {
    expect(getDashboardFormFieldClassName()).toBe("pms-field");
  });

  it("aplica col-span em campos full-width", () => {
    expect(getDashboardFormFieldClassName({ fullWidth: true })).toBe("pms-field md:col-span-2");
  });

  it("concatena classes customizadas mantendo padrao", () => {
    expect(getDashboardFormFieldClassName({ fullWidth: true, className: "text-sm" })).toBe("pms-field md:col-span-2 text-sm");
  });
});
