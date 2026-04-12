import { AdaptiveLoadingFallback } from "../../_components/AdaptiveLoadingFallback";

export default function HotelsLoading() {
  return (
    <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <AdaptiveLoadingFallback minHeight="24vh" label="Carregando hoteis..." />
    </section>
  );
}
