import { AdaptiveLoadingFallback } from "../../_components/AdaptiveLoadingFallback";

export default function ReservationsCalendarLoading() {
  return <AdaptiveLoadingFallback minHeight="40vh" label="Carregando calendário de reservas..." />;
}
