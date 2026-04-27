type DashboardStatusMessageProps = {
  status?: string;
  messages: Record<string, string>;
  detail?: string;
};

export function DashboardStatusMessage({ status, messages, detail }: DashboardStatusMessageProps) {
  if (!status || !messages[status]) {
    return null;
  }

  const isError = status.includes("error") || status.includes("forbidden") || status.includes("missing") || status.includes("conflict") || status.includes("not_found");
  const renderedText = detail && isError ? `${messages[status]} Detalhe tecnico: ${detail}` : messages[status];

  return <p className={`mb-0 ${isError ? "text-[#b00020]" : "text-[#1f6f51]"}`}>{renderedText}</p>;
}
