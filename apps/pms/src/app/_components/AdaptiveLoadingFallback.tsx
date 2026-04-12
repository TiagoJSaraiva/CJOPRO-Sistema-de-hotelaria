import type { CSSProperties } from "react";

type AdaptiveLoadingFallbackProps = {
  label?: string;
  minHeight?: CSSProperties["minHeight"];
  labelDelayMs?: number;
  className?: string;
  style?: CSSProperties;
};

export function AdaptiveLoadingFallback({
  label = "Carregando...",
  minHeight = "180px",
  labelDelayMs = 0,
  className,
  style
}: AdaptiveLoadingFallbackProps) {
  const shouldDelayLabel = labelDelayMs > 0;

  return (
    <div
      className={className}
      style={{
        minHeight,
        width: "100%",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "1rem",
        containerType: "inline-size",
        ...style
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: "grid", justifyItems: "center", gap: "0.6rem" }}>
        <span
          aria-hidden="true"
          style={{
            width: "1.15rem",
            height: "1.15rem",
            borderRadius: "999px",
            border: "2px solid rgba(91, 100, 112, 0.25)",
            borderTopColor: "#5b6470",
            animation: "pms-spin 0.8s linear infinite"
          }}
        />
        <p
          style={{
            margin: 0,
            color: "#5b6470",
            fontWeight: 600,
            letterSpacing: "0.02em",
            fontSize: "clamp(0.95rem, 3.2cqi, 1.5rem)",
            opacity: shouldDelayLabel ? 0 : 1,
            animation: shouldDelayLabel ? "pms-fade-in 140ms ease forwards" : undefined,
            animationDelay: shouldDelayLabel ? `${labelDelayMs}ms` : undefined
          }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
