import {
  API_COMPONENT_SCHEMAS,
  API_ROUTE_CONTRACTS,
  ConsumptionContextOfferSchema,
  ConsumptionOfferSchema,
  MaintenanceOccurrenceDetailSchema,
  MaintenancePreventivePlanSchema,
  MaintenanceWorkOrderSchema,
} from "@hotel/shared/api-contract";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

// O Fastify só compila o serializador de uma resposta na primeira vez que a usa, e ele
// remove em silêncio o que o schema não declara. Testes com backend simulado nunca chegam
// a este ponto: as falhas abaixo só aparecem com a API real.

function allSchemas(): Array<[string, unknown]> {
  const routes = Object.entries(API_ROUTE_CONTRACTS).flatMap(
    ([route, contract]) =>
      Object.entries(contract.response).map(
        ([status, schema]): [string, unknown] => [`${route} ${status}`, schema],
      ),
  );
  const components = API_COMPONENT_SCHEMAS.map((schema): [string, unknown] => [
    String(schema.$id),
    schema,
  ]);
  return [...components, ...routes];
}

function findAllOf(node: unknown, path: string): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => findAllOf(item, `${path}/${index}`));
  }
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "allOf" ? [path] : findAllOf(value, `${path}/${key}`),
  );
}

async function serialize(schema: object, value: unknown): Promise<unknown> {
  const app = Fastify({ logger: false });
  for (const component of API_COMPONENT_SCHEMAS) app.addSchema(component);
  app.get("/probe", {
    schema: { response: { 200: schema } },
    handler: async () => value,
  });
  const response = await app.inject({ method: "GET", url: "/probe" });
  await app.close();
  if (response.statusCode !== 200) {
    throw new Error(`${response.statusCode}: ${response.body}`);
  }
  return JSON.parse(response.body);
}

const SOME_ID = "10000000-0000-4000-8000-000000000001";
const SOME_DATE = "2026-11-04T12:00:00.000Z";

type SchemaNode = {
  $ref?: string;
  anyOf?: SchemaNode[];
  const?: unknown;
  enum?: unknown[];
  type?: string;
  format?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
};

const COMPONENTS = Object.fromEntries(
  API_COMPONENT_SCHEMAS.map((schema) => [String(schema.$id), schema]),
) as Record<string, SchemaNode>;

// Monta um exemplo com todos os campos, percorrendo cada $ref e cada variante escolhida.
function sample(
  node: SchemaNode,
  pickNull: boolean,
  stack: string[] = [],
): unknown {
  if (node.$ref) {
    if (stack.includes(node.$ref)) return undefined;
    return sample(COMPONENTS[node.$ref]!, pickNull, [...stack, node.$ref]);
  }
  if (node.anyOf) {
    const nullBranch = node.anyOf.find((branch) => branch.type === "null");
    if (pickNull && nullBranch) return null;
    const branch = node.anyOf.find((candidate) => candidate.type !== "null");
    return sample(branch!, pickNull, stack);
  }
  if (node.const !== undefined) return node.const;
  if (node.enum) return node.enum[0];
  if (node.type === "object") {
    return Object.fromEntries(
      Object.entries(node.properties || {})
        .map(([key, value]) => [key, sample(value, pickNull, stack)] as const)
        .filter(([, value]) => value !== undefined),
    );
  }
  if (node.type === "array") {
    const item = sample(node.items || {}, pickNull, stack);
    return item === undefined ? [] : [item];
  }
  if (node.type === "number" || node.type === "integer") return 1;
  if (node.type === "boolean") return true;
  if (node.type === "null") return null;
  if (node.type === "string") {
    if (node.format === "uuid") return SOME_ID;
    if (node.format === "date") return "2026-11-04";
    if (node.format === "date-time") return SOME_DATE;
    return "x";
  }
  return {};
}

describe("serializadores do contrato da API", () => {
  it("serializa de verdade todas as respostas, com anuláveis preenchidos e nulos", async () => {
    // Compilar não basta: um $ref dentro de anyOf só falha ao responder. Cada schema é
    // compilado uma só vez, porque isso pesa e atrasaria os testes em paralelo.
    const app = Fastify({ logger: false });
    for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);

    const seen = new Set<unknown>();
    const probes: Array<{ name: string; url: string; status: number }> = [];
    Object.entries(API_ROUTE_CONTRACTS).forEach(([route, contract], index) => {
      for (const [status, schema] of Object.entries(contract.response)) {
        if (seen.has(schema)) continue;
        seen.add(schema);
        const url = `/probe/${index}/${status}`;
        const filled = sample(schema as SchemaNode, false);
        const nulled = sample(schema as SchemaNode, true);
        app.get<{ Querystring: { nulled?: string } }>(url, {
          schema: { response: { [status]: schema as object } },
          handler: async (request, reply) =>
            reply
              .code(Number(status))
              .send(request.query.nulled ? nulled : filled),
        });
        probes.push({
          name: `${route} ${status}`,
          url,
          status: Number(status),
        });
      }
    });

    const failures: string[] = [];
    for (const probe of probes) {
      for (const url of [probe.url, `${probe.url}?nulled=1`]) {
        const response = await app.inject({ method: "GET", url });
        if (response.statusCode !== probe.status) {
          failures.push(`${probe.name}: ${response.body.slice(0, 160)}`);
        }
      }
    }
    await app.close();

    expect(failures).toEqual([]);
    expect(probes.length).toBeGreaterThan(100);
  }, 120_000);

  it("não usa allOf, que descarta campos ou quebra em tempo de execução", () => {
    // Em allOf com partes additionalProperties:false, cada parte remove os campos da
    // outra; com $ref, o serializador falha ao resolver a referência durante a resposta.
    const found = allSchemas().flatMap(([name, schema]) =>
      findAllOf(schema, name),
    );

    expect(found).toEqual([]);
  });

  it("preserva identificador e campos do plano preventivo", async () => {
    const plan = {
      id: SOME_ID,
      hotel_id: SOME_ID,
      name: "Revisão do ar-condicionado",
      category_id: SOME_ID,
      assigned_to: SOME_ID,
      instructions: "Inspecionar filtros",
      recurrence_unit: "monthly",
      recurrence_interval: 1,
      recurrence_day: 4,
      starts_on: "2026-11-04",
      local_time: "09:00:00",
      generation_lead_days: 1,
      completion_due_hours: 24,
      next_due_date: "2026-12-04",
      status: "active",
      tasks: [],
      created_at: SOME_DATE,
      updated_at: SOME_DATE,
    };

    const output = await serialize(MaintenancePreventivePlanSchema, plan);

    expect(output).toMatchObject({
      id: SOME_ID,
      name: plan.name,
      next_due_date: plan.next_due_date,
      status: "active",
    });
  });

  it("preserva ordens, inspeções e eventos no detalhe da ocorrência", async () => {
    const detail = {
      id: SOME_ID,
      occurrence_number: 1,
      code: "MAN-000001",
      kind: "defect",
      priority: "normal",
      status: "triaged",
      description: "Vazamento",
      category_id: SOME_ID,
      category_name: "Hidráulica",
      room_id: SOME_ID,
      room_number: "103",
      location_id: null,
      location_name: null,
      stay_id: null,
      reported_by: SOME_ID,
      reporter_name: "Recepção",
      blocking_recommended: false,
      liability_status: "not_applicable",
      active_block: false,
      open_work_orders: 0,
      created_at: SOME_DATE,
      updated_at: SOME_DATE,
      discovered_at: SOME_DATE,
      triaged_by: SOME_ID,
      triaged_at: SOME_DATE,
      suspected_party: null,
      confirmed_party: null,
      liability_notes: null,
      duplicate_of_id: null,
      canceled_reason: null,
      resolved_at: null,
      work_orders: [],
      inspections: [],
      events: [],
      attachments: [],
      room_blocks: [],
    };

    const output = await serialize(MaintenanceOccurrenceDetailSchema, detail);

    expect(output).toMatchObject({
      id: SOME_ID,
      code: "MAN-000001",
      discovered_at: SOME_DATE,
      work_orders: [],
      events: [],
      room_blocks: [],
    });
  });

  it("preserva checklist, agenda, fornecedor e versão da ordem de serviço", async () => {
    const order = {
      id: SOME_ID,
      occurrence_id: SOME_ID,
      title: "Trocar registro",
      instructions: "Fechar a água",
      priority: "normal",
      status: "waiting",
      assigned_to: null,
      assignee_name: null,
      due_at: null,
      waiting_reason: "vendor",
      waiting_notes: null,
      requires_inspection: false,
      diagnosis: null,
      resolution_notes: null,
      started_at: null,
      completed_at: null,
      supplier_id: SOME_ID,
      supplier_name: "Fornecedor",
      contract_id: null,
      contract_number: null,
      supplier_status: "sent",
      supplier_external_reference: null,
      version: 3,
      waiting_episode: {
        id: SOME_ID,
        owner_id: SOME_ID,
        owner_name: "Supervisor",
        next_follow_up_at: SOME_DATE,
        version: 1,
        started_at: SOME_DATE,
      },
      schedule: {
        id: SOME_ID,
        planned_start: SOME_DATE,
        planned_end: SOME_DATE,
        estimated_minutes: 60,
        access_kind: "room",
        version: 1,
      },
      checklist: [
        {
          id: SOME_ID,
          work_order_id: SOME_ID,
          position: 1,
          description: "Testar vazão",
          is_required: true,
          completed_by: null,
          completed_at: null,
          completion_notes: null,
        },
      ],
      created_at: SOME_DATE,
      updated_at: SOME_DATE,
    };

    expect(await serialize(MaintenanceWorkOrderSchema, order)).toEqual(order);
  });

  it("preserva as decisões de ciclo de vida, que têm campos livres", async () => {
    const schema =
      MaintenanceOccurrenceDetailSchema.properties.lifecycle_decisions;
    const decisions = [
      { id: SOME_ID, status: "draft", options: [{ kind: "repair" }] },
    ];

    expect(await serialize(schema, decisions)).toEqual(decisions);
  });

  it("aceita o recorte da revisão que o contexto de consumo devolve", async () => {
    const schema = ConsumptionContextOfferSchema.properties.revision;
    const revision = {
      id: SOME_ID,
      version: 1,
      starts_on: "2026-10-01",
      ends_on: null,
      commercial_model: "revenue_share",
      fixed_rent: null,
      rent_frequency: null,
      commission_percentage: 20,
      minimum_guarantee: null,
      payment_recipient: "both",
      currency: "BRL",
    };

    expect(await serialize(schema, revision)).toEqual(revision);
  });

  it("devolve o total pago e o exigido ao registrar a garantia", async () => {
    const contract =
      API_ROUTE_CONTRACTS["POST /admin/reservations/:id/guarantees"];
    const result = {
      ok: true,
      result: "ok",
      id: SOME_ID,
      paid: 250,
      required: 250,
    };

    expect(await serialize(contract.response[200], result)).toEqual(result);
  });

  it("preserva a versão da conta no painel da estadia", async () => {
    const stay =
      API_ROUTE_CONTRACTS["GET /admin/stays/:id/panel"].response[200];
    const body = sample(stay as SchemaNode, false) as {
      item: { stay: { account_version: number } };
    };
    body.item.stay.account_version = 7;

    const output = (await serialize(stay, body)) as typeof body;

    expect(output.item.stay.account_version).toBe(7);
  });

  it("serializa a política resolvida da oferta de consumo", async () => {
    const policy = {
      allowed_modes: ["stay_folio"],
      default_mode: "stay_folio",
      source: "inherit",
    };
    const schema = ConsumptionOfferSchema.properties.resolved_policy;

    expect(await serialize(schema, policy)).toEqual(policy);
  });
});
