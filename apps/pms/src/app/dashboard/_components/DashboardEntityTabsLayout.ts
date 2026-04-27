export type DashboardEntityTabItem = {
  key: string;
  label: string;
  href: string;
  isVisible: boolean;
};

export function shouldPlaceTabsInFilterBar(activeTabKey: string) {
  return activeTabKey === "view";
}

export function shouldRenderEntityTabs(items: DashboardEntityTabItem[]) {
  return items.filter((item) => item.isVisible).length > 1;
}