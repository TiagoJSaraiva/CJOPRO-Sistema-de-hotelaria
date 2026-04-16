import { AdaptiveLoadingFallback } from "../../_components/AdaptiveLoadingFallback";

export default function PermissionsLoading() {
  return (
    <section className="pms-surface-card">
      <AdaptiveLoadingFallback minHeight="24vh" label="Carregando permissoes..." />
    </section>
  );
}
