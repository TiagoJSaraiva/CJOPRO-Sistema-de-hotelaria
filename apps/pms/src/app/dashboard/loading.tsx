import { AdaptiveLoadingFallback } from "../_components/AdaptiveLoadingFallback";

export default function DashboardLoading() {
  return (
    <section className="pms-surface-card">
      <AdaptiveLoadingFallback minHeight="28vh" label="Carregando..." />
    </section>
  );
}
