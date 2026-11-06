/** Dinheiro só entra na sessão de caixa de quem recebe: sem ela, a opção fica indisponível. */
export function CashMethodOption({ hasSession }: { hasSession: boolean }) {
  return (
    <option value="cash" disabled={!hasSession}>
      {hasSession ? "Dinheiro" : "Dinheiro (exige sua sessão de caixa aberta)"}
    </option>
  );
}
