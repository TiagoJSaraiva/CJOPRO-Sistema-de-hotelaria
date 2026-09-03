import type { ReactNode } from "react";
import { PermissionTabs, type PermissionTabItem } from "./PermissionTabs";
import { DashboardEntityTabsProvider } from "./DashboardEntityTabsContext";
import { shouldPlaceTabsInFilterBar } from "./DashboardEntityTabsLayout";
import { UsageGuide, type UsageGuideDefinition } from "./UsageGuide";

type DashboardEntityPageShellProps = {
  title: string;
  activeTabKey: string;
  tabs: PermissionTabItem[];
  status?: string;
  statusContent?: ReactNode;
  usageGuide?: UsageGuideDefinition;
  children: ReactNode;
};

export function DashboardEntityPageShell({
  title,
  activeTabKey,
  tabs,
  status,
  statusContent,
  usageGuide,
  children,
}: DashboardEntityPageShellProps) {
  const placeTabsInFilterBar = shouldPlaceTabsInFilterBar(activeTabKey);

  return (
    <DashboardEntityTabsProvider value={{ activeTabKey, tabs }}>
      <section className="pms-page-stack">
        <section
          data-usage-guide={usageGuide ? `${usageGuide.id}-header` : undefined}
        >
          {usageGuide ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="pms-page-title">{title}</h1>
              <UsageGuide definition={usageGuide} />
            </div>
          ) : (
            <h1 className="pms-page-title">{title}</h1>
          )}
          {placeTabsInFilterBar ? null : (
            <PermissionTabs
              activeKey={activeTabKey}
              items={tabs}
              className="pms-entity-tabs-header"
            />
          )}
          {statusContent ||
            (status ? (
              <p className="pms-status-muted">Status: {status}</p>
            ) : null)}
        </section>

        {children}
      </section>
    </DashboardEntityTabsProvider>
  );
}
