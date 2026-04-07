import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "@hotel/shared";
import type { ReactNode } from "react";
import { getUserFromSession } from "../../lib/auth";
import { logoutAction } from "./actions";

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

  const navItems = ADMIN_NAV_ITEMS.filter((item) => user.permissions.includes(item.permission));
  const userDisplayName = formatUserDisplayName(user.name);

  return (
    <main style={{ minHeight: "100vh", padding: "1.25rem", background: "#f5f6f8" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: 0, flexWrap: "wrap" }}>
          <Link href="/dashboard" aria-label="Voltar para inicio" style={{ display: "inline-flex", alignItems: "center" }}>
            <Image src="/img/logo.png" alt="Logo" width={116} height={34} priority style={{ width: "116px", height: "40px" }} />
          </Link>

          <nav style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            <Link
              href="/dashboard"
              style={{
                textDecoration: "none",
                color: "#232323",
                fontWeight: 500,
                border: "1px solid #d2d2d2",
                background: "#fff",
                borderRadius: "8px",
                padding: "0.45rem 0.7rem",
                lineHeight: 1
              }}
            >
              Inicio
            </Link>

            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: "none",
                  color: "#232323",
                  fontWeight: 500,
                  border: "1px solid #d2d2d2",
                  background: "#fff",
                  borderRadius: "8px",
                  padding: "0.45rem 0.7rem",
                  lineHeight: 1
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ color: "#3f3f3f", fontSize: "0.95rem", whiteSpace: "nowrap" }}>{userDisplayName}</span>

          <form action={logoutAction}>
            <button
              type="submit"
              style={{ border: "1px solid #d0d0d0", background: "#fff", borderRadius: "8px", padding: "0.45rem 0.8rem", cursor: "pointer" }}
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      {children}
    </main>
  );
}
