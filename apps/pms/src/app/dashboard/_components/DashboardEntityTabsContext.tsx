"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DashboardEntityTabItem } from "./DashboardEntityTabsLayout";

type DashboardEntityTabsContextValue = {
  activeTabKey: string;
  tabs: DashboardEntityTabItem[];
};

const DashboardEntityTabsContext = createContext<DashboardEntityTabsContextValue | null>(null);

type DashboardEntityTabsProviderProps = {
  value: DashboardEntityTabsContextValue;
  children: ReactNode;
};

export function DashboardEntityTabsProvider({ value, children }: DashboardEntityTabsProviderProps) {
  return <DashboardEntityTabsContext.Provider value={value}>{children}</DashboardEntityTabsContext.Provider>;
}

export function useDashboardEntityTabs() {
  return useContext(DashboardEntityTabsContext);
}