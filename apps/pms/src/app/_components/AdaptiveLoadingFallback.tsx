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
      className={`grid w-full place-items-center p-4 text-center [container-type:inline-size] ${className ?? ""}`}
      style={{
        minHeight,
        ...style
      }}
      role="status"
      aria-live="polite"
    >
      <div className="grid justify-items-center gap-[0.6rem]">
        <span
          aria-hidden="true"
          className="h-[1.15rem] w-[1.15rem] animate-[pms-spin_0.8s_linear_infinite] rounded-full border-2 border-[rgba(91,100,112,0.25)] border-t-[#5b6470]"
        />
        <p
          className="m-0 text-[clamp(0.95rem,3.2cqi,1.5rem)] font-semibold tracking-[0.02em] text-[#5b6470]"
          style={{
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
