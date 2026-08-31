export const DASHBOARD_CREATE_FORM_GRID_CLASS =
  "grid gap-[0.65rem] md:grid-cols-2";

type FormFieldClassNameOptions = {
  fullWidth?: boolean;
  className?: string;
};

export function getDashboardCreateFormClassName(formClassName?: string) {
  return formClassName ?? DASHBOARD_CREATE_FORM_GRID_CLASS;
}

export function getDashboardFormFieldClassName({
  fullWidth = false,
  className,
}: FormFieldClassNameOptions = {}) {
  const classNames = ["pms-field"];

  if (fullWidth) {
    classNames.push("md:col-span-2");
  }

  if (className) {
    classNames.push(className);
  }

  return classNames.join(" ");
}
