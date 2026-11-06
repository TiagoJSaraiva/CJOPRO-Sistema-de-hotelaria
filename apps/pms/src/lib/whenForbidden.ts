/**
 * Dado opcional: quem não tem permissão fica sem ele, e a tela segue. Qualquer outra falha precisa
 * aparecer, porque uma lista vazia por erro parece ausência de dados e pode ser salva como tal.
 */
export function whenForbidden<T>(fallback: T) {
  return (error: unknown): T => {
    if ((error as { statusCode?: number } | null)?.statusCode === 403) {
      return fallback;
    }
    throw error;
  };
}
