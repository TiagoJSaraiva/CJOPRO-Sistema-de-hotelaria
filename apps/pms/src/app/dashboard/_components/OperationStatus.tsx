import { operationOutcome, type OperationOutcome } from "./operationOutcome";

const TONE_CLASS: Record<OperationOutcome["tone"], string> = {
  success: "pms-status-success",
  error: "pms-status-error",
  notice: "pms-status-muted",
};

export function OperationStatus({
  status,
  local,
}: {
  status?: string | null;
  local?: Record<string, OperationOutcome>;
}) {
  const outcome = operationOutcome(status, local);
  if (!outcome) return null;
  return (
    <p
      role={outcome.tone === "error" ? "alert" : "status"}
      className={TONE_CLASS[outcome.tone]}
    >
      {outcome.message}
    </p>
  );
}
