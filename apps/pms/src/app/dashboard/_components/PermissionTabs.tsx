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
    <nav style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
      {visibleItems.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={item.href}
            style={{
              textDecoration: "none",
              borderRadius: "999px",
              border: isActive ? "1px solid #0f766e" : "1px solid #d2d6db",
              background: isActive ? "#dff7f4" : "#fff",
              color: "#1d2939",
              fontWeight: 600,
              padding: "0.45rem 0.85rem",
              lineHeight: 1
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}