import Link from "next/link";

type PermissionTabItem = {
  key: string;
  label: string;
  href: string;
  isVisible: boolean;
};

type PermissionTabsProps = {
  activeKey: string;
  items: PermissionTabItem[];
};

export function PermissionTabs({ activeKey, items }: PermissionTabsProps) {
  const visibleItems = items.filter((item) => item.isVisible);

  if (visibleItems.length <= 1) {
    return null;
  }

  return (
    <nav className="flex flex-wrap gap-[0.55rem]">
      {visibleItems.map((item) => {
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