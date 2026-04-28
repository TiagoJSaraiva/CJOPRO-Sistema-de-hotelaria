import type { ReactNode } from "react";
import { getDashboardCreateFormClassName } from "./formLayout";

type DashboardCreateFormCardProps = {
  title: string;
  submitLabel: string;
  action: (formData: FormData) => Promise<void>;
  resetKey?: string;
  formClassName?: string;
  children: ReactNode;
};

export function DashboardCreateFormCard({
  title,
  submitLabel,
  action,
  resetKey,
  formClassName,
  children
}: DashboardCreateFormCardProps) {
  return (
    <article className="pms-surface-card">
      <h3 className="mt-0">{title}</h3>
      <form key={resetKey} action={action} className={getDashboardCreateFormClassName(formClassName)}>
        {children}
        <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
          {submitLabel}
        </button>
      </form>
    </article>
  );
}
