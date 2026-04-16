import { AdaptiveLoadingFallback } from "../../_components/AdaptiveLoadingFallback";

export default function HotelsLoading() {
  return (
    <section className="pms-surface-card">
      <AdaptiveLoadingFallback minHeight="24vh" label="Carregando hoteis..." />
    </section>
  );
}
