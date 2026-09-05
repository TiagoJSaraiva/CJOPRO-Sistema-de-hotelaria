import { InventoryWorkspace } from "../_components/InventoryWorkspace";
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  return (
    <InventoryWorkspace tab="counts" status={(await searchParams)?.status} />
  );
}
