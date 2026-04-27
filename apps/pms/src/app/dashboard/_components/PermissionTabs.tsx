import Link from "next/link";
import { shouldRenderEntityTabs, type DashboardEntityTabItem } from "./DashboardEntityTabsLayout";

export type PermissionTabItem = DashboardEntityTabItem;

type PermissionTabsProps = {
  activeKey: string;
  items: PermissionTabItem[];
  className?: string;
};

export function PermissionTabs({ activeKey, items, className }: PermissionTabsProps) {
  if (!shouldRenderEntityTabs(items)) {
    return null;
  }

  return (
    <nav className={`flex flex-wrap gap-[0.55rem]${className ? ` ${className}` : ""}`}>
      {items
        .filter((item) => item.isVisible)
        .map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={item.href}
            className={`rounded-full border px-[0.85rem] py-[0.45rem] font-semibold leading-none no-underline ${
              isActive ? "border-[#0f766e] bg-[#dff7f4] text-[#1d2939]" : "border-[#d2d6db] bg-white text-[#1d2939]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}