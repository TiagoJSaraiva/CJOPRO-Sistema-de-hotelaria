import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Reserva direta",
  description: "Cotação e pré-reserva direta do hotel",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
