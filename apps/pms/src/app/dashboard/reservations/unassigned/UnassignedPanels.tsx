"use client";

import { useRouter } from "next/navigation";
import { ReservationArrivalPanel } from "../_components/ReservationArrivalPanel";
import { ClosureSettlement } from "../_components/StayClosurePanel";

type CashSession = { id: string; registerName: string } | null;

export function UnassignedGuarantee({
  reservationId,
  canManagePrearrival,
  publicSiteUrl,
  cashSession,
}: {
  reservationId: string;
  canManagePrearrival: boolean;
  publicSiteUrl: string;
  cashSession: CashSession;
}) {
  const router = useRouter();
  return (
    <ReservationArrivalPanel
      reservationId={reservationId}
      canManageGuarantees
      canManagePrearrival={canManagePrearrival}
      publicSiteUrl={publicSiteUrl}
      cashSession={cashSession}
      onGuaranteeRegistered={() => router.refresh()}
    />
  );
}

export function UnassignedSettlement({
  reservationId,
  balance,
  canSettle,
  cashSession,
}: {
  reservationId: string;
  balance: number;
  canSettle: boolean;
  cashSession: CashSession;
}) {
  const router = useRouter();
  return (
    <ClosureSettlement
      key={balance}
      reservationId={reservationId}
      balance={balance}
      canSettle={canSettle}
      cashSession={cashSession}
      onSettled={() => router.refresh()}
    />
  );
}
