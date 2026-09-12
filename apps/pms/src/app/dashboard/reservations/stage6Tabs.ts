import { PERMISSIONS, type AuthUser } from "@hotel/shared";

export function reservationOperationsTabs(user: AuthUser | null) {
  const has = (permission: string) =>
    !!user?.permissions.includes(permission as never);
  return [
    {
      key: "calendar",
      label: "Calendário",
      href: "/dashboard/reservations/view",
      isVisible: has(PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS),
    },
    {
      key: "arrivals",
      label: "Chegadas",
      href: "/dashboard/reservations/prearrival",
      isVisible: has(PERMISSIONS.PREARRIVAL_MANAGE),
    },
    {
      key: "rates",
      label: "Planos tarifários",
      href: "/dashboard/reservations/rates",
      isVisible: has(PERMISSIONS.RATE_PLANS_MANAGE),
    },
    {
      key: "channels",
      label: "Canais",
      href: "/dashboard/reservations/channels",
      isVisible: has(PERMISSIONS.BOOKING_CHANNELS_MANAGE),
    },
    {
      key: "analytics",
      label: "Indicadores",
      href: "/dashboard/reservations/analytics",
      isVisible: has(PERMISSIONS.INTEGRATED_ANALYTICS_READ),
    },
    {
      key: "checkout",
      label: "Checkout",
      href: "/dashboard/reservations/checkout",
      isVisible: has(PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS),
    },
  ];
}
