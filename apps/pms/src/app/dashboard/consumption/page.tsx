import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getConsumptionAccess, getConsumptionDefaultRoute } from "./access";

export default async function ConsumptionPage() {
  const access = getConsumptionAccess(await getUserFromSession());
  const route = getConsumptionDefaultRoute(access);
  if (route) redirect(route);
  return (
    <section className="pms-surface-card">
      <h1 className="pms-page-title">Vendas e consumo</h1>
      <p>Sem permissão para visualizar este módulo.</p>
    </section>
  );
}
