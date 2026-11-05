/**
 * Dia seguinte no calendário local de quem está reservando, no formato de
 * `input[type=date]`. É só uma orientação ao preencher: quem decide a data válida
 * é o servidor, com o relógio do hotel. `toISOString` não serve aqui porque usa
 * UTC e, à noite no Brasil, pularia um dia.
 */
export function nextLocalDate(now: Date): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${next.getFullYear()}-${month}-${day}`;
}
