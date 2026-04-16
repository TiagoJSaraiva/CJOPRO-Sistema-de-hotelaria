type QueryWithEq<TQuery> = {
  eq: (column: string, value: string) => TQuery;
};

/**
 * Helper para aplicar filtro de hotel_id em queries Supabase.
 * Se activeHotelId for null, retorna a query sem modificação (acesso global).
 * Se activeHotelId for uma string, filtra por `hotel_id = activeHotelId`.
 *
 * @param query - Query builder do Supabase
 * @param activeHotelId - ID do hotel ativo (null para acesso global)
 * @param columnName - Nome da coluna a filtrar (padrão: 'hotel_id')
 * @returns Query builder com filtro aplicado (ou sem modificação se activeHotelId for null)
 */
export function applyHotelContextFilter<TQuery extends QueryWithEq<TQuery>>(
  query: TQuery,
  activeHotelId: string | null,
  columnName: string = "hotel_id"
): TQuery {
  if (activeHotelId === null) {
    return query;
  }

  return query.eq(columnName, activeHotelId);
}
