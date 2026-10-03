import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getReservationsCalendar,
  listCustomers,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import {
  getReservationsCalendarAccess,
  getReservationsCalendarDefaultRoute,
} from "../access";
import { ReservationsCalendarBoard } from "../_components/ReservationsCalendarBoard";
import { CALENDAR_WINDOW_DAYS } from "../_components/calendarUtils";
import { PERMISSIONS, type CashRegisterListView } from "@hotel/shared";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";
import { reservationsOperationsGuide } from "../usageGuide";
import { reservationOperationsTabs } from "../stage6Tabs";

type ReservationsCalendarViewPageProps = {
  searchParams?: Promise<{
    start_date?: string;
  }>;
};

function resolveStartDate(rawValue: string | undefined): string | undefined {
  const value = String(rawValue || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return undefined;
}

export default async function ReservationsCalendarViewPage({
  searchParams,
}: ReservationsCalendarViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getReservationsCalendarAccess(user);

  if (!access.canAccess) {
    const fallback = getReservationsCalendarDefaultRoute(access);
    if (fallback) {
      redirect(fallback);
    }
    return (
      <DashboardAccessDeniedCard
        title="Calendário de Reservas"
        message="Sem permissão para visualizar o calendário de reservas."
      />
    );
  }

  const requestedStartDate = resolveStartDate(resolvedSearchParams?.start_date);
  const canRelocate =
    user?.permissions.includes(PERMISSIONS.RESERVATION_RELOCATE) || false;
  const canOverrideReadiness =
    user?.permissions.includes(PERMISSIONS.GOVERNANCE_READINESS_OVERRIDE) ||
    false;
  const canExecuteGovernance =
    user?.permissions.includes(PERMISSIONS.GOVERNANCE_EXECUTE) || false;
  const cashRegistersRequest =
    user?.permissions.includes(PERMISSIONS.RESERVATION_GUARANTEES_MANAGE) &&
    user.permissions.includes(PERMISSIONS.CASH_MANAGEMENT_READ)
      ? requestOperationsFinanceEndpoint<CashRegisterListView>(
          "cash-registers",
          "GET",
        ).catch(() => null)
      : Promise.resolve(null);
  const [data, customers, cashRegisters] = await Promise.all([
    getReservationsCalendar(requestedStartDate, CALENDAR_WINDOW_DAYS),
    listCustomers(),
    cashRegistersRequest,
  ]);
  const startDate = data.window_start;
  const cashSession = cashRegisters?.registers
    .filter((register) => register.kind === "reception")
    .find(
      (register) =>
        register.active_session?.status === "open" &&
        register.active_session.operator_id === user?.id,
    );

  return (
    <DashboardEntityPageShell
      title="Calendário de Reservas"
      activeTabKey="calendar"
      tabs={reservationOperationsTabs(user)}
      usageGuide={reservationsOperationsGuide({
        canRelocate,
        canOverrideReadiness,
        canExecuteGovernance,
      })}
    >
      <ReservationsCalendarBoard
        data={data}
        startDate={startDate}
        customers={customers}
        publicSiteUrl={process.env.PUBLIC_SITE_URL || "http://localhost:3000"}
        cashSession={
          cashSession?.active_session
            ? {
                id: cashSession.active_session.id,
                registerName: cashSession.name,
              }
            : null
        }
        canReadArrival={
          user?.permissions.includes(PERMISSIONS.RESERVATION_READ) || false
        }
        canManageGuarantees={
          user?.permissions.includes(
            PERMISSIONS.RESERVATION_GUARANTEES_MANAGE,
          ) || false
        }
        canManagePrearrival={
          user?.permissions.includes(PERMISSIONS.PREARRIVAL_MANAGE) || false
        }
        canPostConsumption={
          user?.permissions.includes(PERMISSIONS.CONSUMPTION_POST) || false
        }
        canRelocate={canRelocate}
        canOverrideReadiness={canOverrideReadiness}
        canExecuteGovernance={canExecuteGovernance}
      />
    </DashboardEntityPageShell>
  );
}
