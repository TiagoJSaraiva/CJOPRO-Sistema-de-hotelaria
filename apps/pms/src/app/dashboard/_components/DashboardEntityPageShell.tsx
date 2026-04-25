import type { ReactNode } from "react";
import { PermissionTabs, type PermissionTabItem } from "./PermissionTabs";

type DashboardEntityPageShellProps = {
  title: string;
  activeTabKey: string;
  tabs: PermissionTabItem[];
  status?: string;
  statusContent?: ReactNode;
  children: ReactNode;
};

export function DashboardEntityPageShell({ title, activeTabKey, tabs, status, statusContent, children }: DashboardEntityPageShellProps) {
  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">{title}</h1>
        <PermissionTabs activeKey={activeTabKey} items={tabs} />
        {statusContent || (status ? <p className="pms-status-muted">Status: {status}</p> : null)}
      </section>

      {children}
    </section>
  );
}
