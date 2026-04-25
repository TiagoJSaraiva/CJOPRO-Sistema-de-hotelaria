import type { ReactNode } from "react";

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
  formClassName = "grid gap-[0.65rem] md:grid-cols-2",
  children
}: DashboardCreateFormCardProps) {
  return (
    <article className="pms-surface-card">
      <h3 className="mt-0">{title}</h3>
      <form key={resetKey} action={action} className={formClassName}>
        {children}
        <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
          {submitLabel}
        </button>
      </form>
    </article>
  );
}
