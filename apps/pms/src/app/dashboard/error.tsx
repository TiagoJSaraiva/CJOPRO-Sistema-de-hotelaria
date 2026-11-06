"use client";

import Link from "next/link";

/**
 * Sem este limite, uma falha ao carregar qualquer tela do painel termina em uma página técnica
 * do Next, sem saída. Não mostra `error.message`, que em produção vem oculta e não ajuda a equipe.
 */
export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <section className="pms-surface-card" role="alert">
      <h1 className="mt-0">Não foi possível carregar esta tela</h1>
      <p>
        Tente de novo. Se o erro continuar, volte ao início e avise o
        responsável pelo sistema.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="pms-button-primary" onClick={reset}>
          Tentar novamente
        </button>
        <Link className="pms-button-secondary inline-flex" href="/dashboard">
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}
