import { AdaptiveLoadingFallback } from "../../_components/AdaptiveLoadingFallback";

export default function RolesLoading() {
  return (
    <section className="pms-surface-card">
      <AdaptiveLoadingFallback minHeight="24vh" label="Carregando roles..." />
    </section>
  );
}
