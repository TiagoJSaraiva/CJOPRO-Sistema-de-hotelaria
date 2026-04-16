import { AdaptiveLoadingFallback } from "../../_components/AdaptiveLoadingFallback";

export default function UsersLoading() {
  return (
    <section className="pms-surface-card">
      <AdaptiveLoadingFallback minHeight="24vh" label="Carregando usuarios..." />
    </section>
  );
}
