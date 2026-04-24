import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ADMIN_NAV_ITEMS, PERMISSIONS } from "@hotel/shared";
import type { ReactNode } from "react";
import { getUserFromSession } from "../../lib/auth";
import { getActiveHotelCookieValue, listActiveHotelOptions, resolveActiveHotelForUser } from "../../lib/activeHotel";
import { logoutAction, setActiveHotelAction } from "./actions";
import { ActiveHotelSelector } from "./_components/ActiveHotelSelector";

const NAME_CONNECTORS = new Set(["da", "de", "do", "das", "dos", "e"]);

function formatUserDisplayName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length <= 2) {
    return name;
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const middleNames = parts.slice(1, -1).filter((part) => !NAME_CONNECTORS.has(part.toLowerCase()));

  if (!middleNames.length) {
    return `${firstName} ${lastName}`;
  }

  const abbreviatedMiddle = middleNames.map((part) => `${part.charAt(0).toUpperCase()}.`).join(" ");
  return `${firstName} ${abbreviatedMiddle} ${lastName}`;
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getUserFromSession();

  if (!user) {
    redirect("/login");
  }

  const moduleEntryAccess: Record<string, boolean> = {
    "/dashboard/hotels": user.permissions.includes(PERMISSIONS.HOTEL_READ) || user.permissions.includes(PERMISSIONS.HOTEL_CREATE),
    "/dashboard/rooms": user.permissions.includes(PERMISSIONS.ROOM_READ) || user.permissions.includes(PERMISSIONS.ROOM_CREATE),
    "/dashboard/customers": user.permissions.includes(PERMISSIONS.CUSTOMER_READ) || user.permissions.includes(PERMISSIONS.CUSTOMER_CREATE),
    "/dashboard/reservations": user.permissions.includes(PERMISSIONS.RESERVATION_READ) || user.permissions.includes(PERMISSIONS.RESERVATION_CREATE),
    "/dashboard/products": user.permissions.includes(PERMISSIONS.PRODUCT_READ) || user.permissions.includes(PERMISSIONS.PRODUCT_CREATE),
    "/dashboard/seasons": user.permissions.includes(PERMISSIONS.SEASON_READ) || user.permissions.includes(PERMISSIONS.SEASON_CREATE),
    "/dashboard/season-room-rates":
      user.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_READ) || user.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_CREATE),
    "/dashboard/users": user.permissions.includes(PERMISSIONS.USER_READ) || user.permissions.includes(PERMISSIONS.USER_CREATE),
    "/dashboard/roles": user.permissions.includes(PERMISSIONS.ROLE_READ) || user.permissions.includes(PERMISSIONS.ROLE_CREATE),
    "/dashboard/permissions": user.permissions.includes(PERMISSIONS.PERMISSION_READ) || user.permissions.includes(PERMISSIONS.PERMISSION_CREATE)
  };

  const navItems = ADMIN_NAV_ITEMS.filter((item) => moduleEntryAccess[item.href]);
  const userDisplayName = formatUserDisplayName(user.name);
  const activeHotelOptions = listActiveHotelOptions(user);
  const preferredHotelId = getActiveHotelCookieValue();
  const activeHotelId = resolveActiveHotelForUser(user, preferredHotelId);
  const navLinkClassName = "rounded-lg border border-[#d2d2d2] bg-white px-[0.7rem] py-[0.45rem] font-medium leading-none text-[#232323] no-underline";

  return (
    <main className="min-h-screen bg-[#f5f6f8] p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <Link href="/dashboard" aria-label="Voltar para inicio" className="inline-flex items-center">
            <Image src="/img/logo.png" alt="Logo" width={116} height={34} priority className="h-10 w-[116px]" />
          </Link>

          <nav className="flex flex-wrap gap-[0.55rem]">
            <Link href="/dashboard" className={navLinkClassName}>
              Inicio
            </Link>

            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClassName}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {activeHotelOptions.length > 1 ? (
            <ActiveHotelSelector options={activeHotelOptions} initialHotelId={activeHotelId} onChangeAction={setActiveHotelAction} />
          ) : null}

          <span className="whitespace-nowrap text-[0.95rem] text-[#3f3f3f]">{userDisplayName}</span>

          <form action={logoutAction}>
            <button type="submit" className="cursor-pointer rounded-lg border border-[#d0d0d0] bg-white px-[0.8rem] py-[0.45rem]">
              Sair
            </button>
          </form>
        </div>
      </header>

      {children}
    </main>
  );
}
