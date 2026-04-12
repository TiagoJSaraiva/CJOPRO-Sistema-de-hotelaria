import { AdaptiveLoadingFallback } from "../_components/AdaptiveLoadingFallback";

export default function DashboardLoading() {
  return (
    <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <AdaptiveLoadingFallback minHeight="28vh" label="Carregando..." />
    </section>
  );
}
