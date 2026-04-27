import type { ReactNode } from "react";

type DashboardEntityListItemFrameProps = {
  title: string;
  subtitle?: string;
  actions: ReactNode;
  children?: ReactNode;
};

export function DashboardEntityListItemFrame({ title, subtitle, actions, children }: DashboardEntityListItemFrameProps) {
  return (
    <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="mb-[0.2rem] mt-0">{title}</h3>
          {subtitle ? <p className="m-0 text-[#555]">{subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      {children}
    </article>
  );
}
