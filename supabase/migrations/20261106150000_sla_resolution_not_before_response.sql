-- QA-088: a política de SLA aceitava resolver antes de responder, e a ocorrência herdava prazos invertidos.
-- NOT VALID mantém a migration aplicável se já houver linha invertida: ela continua como está até ser
-- alterada, e toda escrita nova passa pela regra.
alter table public.maintenance_sla_policies
  add constraint maintenance_sla_policies_resolution_after_response
  check (resolution_hours >= response_hours) not valid;
