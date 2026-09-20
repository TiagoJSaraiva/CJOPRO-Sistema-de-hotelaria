import { PERMISSIONS, type TrainingEnvironment } from "@hotel/shared";
import { DashboardAccessDeniedCard } from "../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../_components/UsageGuide";
import { getUserFromSession } from "../../../lib/auth";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";
import { actTrainingClockAction } from "./actions";

const guide: UsageGuideDefinition = {
  id: "local-training-clock",
  title: "Relógio do treinamento",
  steps: [
    {
      id: "status",
      target: "training-clock-status",
      title: "Compare os dois relógios",
      description:
        "O tempo operacional move reservas, prazos e fechamentos; autenticação e auditoria continuam no tempo real.",
    },
    {
      id: "controls",
      target: "training-clock-controls",
      title: "Controle o cenário local",
      description:
        "Congele ou avance o tempo para concluir exercícios sem que as datas escapem durante a apresentação.",
    },
  ],
};

const format = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "full",
    timeStyle: "medium",
  });

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getUserFromSession();
  if (
    process.env.LOCAL_TRAINING_ENABLED !== "true" ||
    !user?.permissions.includes(PERMISSIONS.TRAINING_ENVIRONMENT_MANAGE)
  ) {
    return (
      <DashboardAccessDeniedCard
        title="Treinamento local"
        message="Este recurso existe somente no ambiente local e exige permissão de gerência."
      />
    );
  }
  const environment =
    await requestOperationsFinanceEndpoint<TrainingEnvironment>(
      "training/environment",
      "GET",
    );
  return (
    <DashboardEntityPageShell
      title="Treinamento local"
      activeTabKey="clock"
      tabs={[
        {
          key: "clock",
          label: "Relógio operacional",
          href: "/dashboard/training",
          isVisible: true,
        },
      ]}
      usageGuide={guide}
      status={(await searchParams).status}
    >
      <section
        className="pms-surface-card"
        data-usage-guide="training-clock-status"
      >
        <h2 className="mt-0">Estado do cenário</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-medium">Cenário</dt>
            <dd>
              {environment.scenario_key || "Base local"}
              {environment.scenario_version
                ? ` · versão ${environment.scenario_version}`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Modo</dt>
            <dd>
              {environment.clock_mode === "frozen" ? "Congelado" : "Tempo real"}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Tempo operacional</dt>
            <dd>{format(environment.operational_now)}</dd>
          </div>
          <div>
            <dt className="font-medium">Tempo real</dt>
            <dd>{format(environment.real_now)}</dd>
          </div>
        </dl>
        {environment.clock_mode === "frozen" ? (
          <p
            role="status"
            className="rounded-lg border border-blue-300 bg-blue-50 p-3"
          >
            O relógio operacional está congelado. Sessões e controles de
            segurança continuam usando o tempo real.
          </p>
        ) : null}
      </section>
      <section
        className="pms-surface-card"
        data-usage-guide="training-clock-controls"
      >
        <h2 className="mt-0">Controles</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <form
            action={actTrainingClockAction}
            className="grid gap-2 rounded border p-3"
          >
            <input
              type="hidden"
              name="expected_version"
              value={environment.version}
            />
            <input type="hidden" name="action" value="freeze" />
            <input
              type="hidden"
              name="reason"
              value="Congelamento solicitado na página de treinamento"
            />
            <strong>Congelar agora</strong>
            <p>Fixa o tempo operacional no instante real atual.</p>
            <button
              className="pms-button-primary"
              disabled={environment.clock_mode === "frozen"}
            >
              Congelar
            </button>
          </form>
          <form
            action={actTrainingClockAction}
            className="grid gap-2 rounded border p-3"
          >
            <input
              type="hidden"
              name="expected_version"
              value={environment.version}
            />
            <input type="hidden" name="action" value="set" />
            <input
              type="hidden"
              name="reason"
              value="Data definida na página de treinamento"
            />
            <label className="pms-field">
              Definir data e hora
              <input
                className="pms-field-input"
                type="datetime-local"
                name="at"
                required
              />
            </label>
            <button className="pms-button-primary">Definir e congelar</button>
          </form>
          <form
            action={actTrainingClockAction}
            className="grid gap-2 rounded border p-3"
          >
            <input
              type="hidden"
              name="expected_version"
              value={environment.version}
            />
            <input type="hidden" name="action" value="advance" />
            <input
              type="hidden"
              name="reason"
              value="Avanço solicitado na página de treinamento"
            />
            <label className="pms-field">
              Quantidade
              <input
                className="pms-field-input"
                type="number"
                name="amount"
                min="1"
                max="3650"
                required
              />
            </label>
            <label className="pms-field">
              Unidade
              <select className="pms-field-input" name="unit">
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
              </select>
            </label>
            <button
              className="pms-button-primary"
              disabled={environment.clock_mode !== "frozen"}
            >
              Avançar
            </button>
          </form>
        </div>
        <form
          action={actTrainingClockAction}
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3"
        >
          <input
            type="hidden"
            name="expected_version"
            value={environment.version}
          />
          <input type="hidden" name="action" value="resume" />
          <input
            type="hidden"
            name="reason"
            value="Retomada solicitada na página de treinamento"
          />
          <p>
            <strong>Atenção:</strong> retomar o tempo real pode tornar reservas,
            garantias, lotes e fechamentos imediatamente vencidos.
          </p>
          <button
            className="pms-button-secondary"
            disabled={environment.clock_mode === "live"}
          >
            Retomar tempo real
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          A restauração destrutiva de cenários existe somente no comando{" "}
          <code>pnpm training reset</code>; ela nunca é oferecida nesta página.
        </p>
      </section>
    </DashboardEntityPageShell>
  );
}
