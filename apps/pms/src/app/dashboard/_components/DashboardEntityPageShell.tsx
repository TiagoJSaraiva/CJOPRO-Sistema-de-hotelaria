import type { ReactNode } from "react";
import { PermissionTabs, type PermissionTabItem } from "./PermissionTabs";
import { DashboardEntityTabsProvider } from "./DashboardEntityTabsContext";
import { shouldPlaceTabsInFilterBar } from "./DashboardEntityTabsLayout";

type DashboardEntityPageShellProps = {
  title: string;
  activeTabKey: string;
  tabs: PermissionTabItem[];
  status?: string;
  statusContent?: ReactNode;
  children: ReactNode;
};

export function DashboardEntityPageShell({ title, activeTabKey, tabs, status, statusContent, children }: DashboardEntityPageShellProps) {
  const placeTabsInFilterBar = shouldPlaceTabsInFilterBar(activeTabKey);

  return (
    <DashboardEntityTabsProvider value={{ activeTabKey, tabs }}>
      <section className="pms-page-stack">
        <section>
          <h1 className="pms-page-title">{title}</h1>
          {placeTabsInFilterBar ? null : <PermissionTabs activeKey={activeTabKey} items={tabs} className="pms-entity-tabs-header" />}
          {statusContent || (status ? <p className="pms-status-muted">Status: {status}</p> : null)}
        </section>

        {children}
      </section>
    </DashboardEntityTabsProvider>
  );
}
