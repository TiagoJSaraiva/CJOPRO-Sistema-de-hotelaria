import type { ReactNode } from "react";
import { getDashboardFormFieldClassName } from "./formLayout";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  fullWidth?: boolean;
  className?: string;
};

export function FormField({
  label,
  htmlFor,
  children,
  fullWidth = false,
  className,
}: FormFieldProps) {
  return (
    <div className={getDashboardFormFieldClassName({ fullWidth, className })}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
