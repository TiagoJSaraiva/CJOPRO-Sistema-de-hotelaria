import {
  expect,
  findInvariantViolations,
  prepareScenario,
  test,
} from "./support";

// Varredura: toda fixture do curso precisa nascer respeitando as regras do negócio.
// Uma lição que começa com dados impossíveis ensina e testa a coisa errada.
const SCENARIOS = [
  "orientation",
  "reservations-arrival",
  "channels",
  "governance-maintenance",
  "warranty",
  "consumption-account",
  "inventory-procurement",
  "cash-close",
  "partner-settlement",
  "integrated-shift",
];

for (const scenario of SCENARIOS) {
  test(`invariantes no cenário ${scenario}`, async () => {
    await prepareScenario(scenario);
    expect(findInvariantViolations()).toEqual([]);
  });
}
