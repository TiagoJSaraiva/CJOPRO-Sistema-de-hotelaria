select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','partner-settlement',2,
  'Parceiro sintético com acordo vigente e venda elegível para apuração.',
  '80000000-0000-4000-8000-000000000002'
);

update public.consumption_management_settings
set settlement_tracking_starts_on=(
      date_trunc('month',public.hotel_operational_date(hotel_id))::date-interval '1 month'
    )::date,
    last_changed_by='80000000-0000-4000-8000-000000000010'
where hotel_id='10000000-0000-4000-8000-000000000001';

insert into public.business_organizations(
  id,hotel_id,legal_name,trade_name,tax_id,currency,email,phone,created_by
) values(
  'a3000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Sabores Escola Ltda.','Sabores Escola','88.888.888/0001-88','BRL',
  'financeiro@sabores.example','(11) 3000-0200',
  '80000000-0000-4000-8000-000000000002'
);
insert into public.commercial_partners(
  id,hotel_id,trade_name,legal_name,tax_id,email,phone,notes,is_active,
  last_changed_by,organization_id
) values(
  'a3010000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Sabores Escola','Sabores Escola Ltda.','88.888.888/0001-88',
  'financeiro@sabores.example','(11) 3000-0200',
  'Parceiro exclusivamente sintético do curso.',true,
  '80000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000001'
);
insert into public.commercial_partner_contacts(
  id,hotel_id,partner_id,name,role,purpose,email,is_primary,last_changed_by
) values(
  'a3020000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a3010000-0000-4000-8000-000000000001','Contato Financeiro Escola',
  'Financeiro','financial','contato@sabores.example',true,
  '80000000-0000-4000-8000-000000000002'
);
insert into public.commercial_agreements(
  id,hotel_id,partner_id,internal_number,last_changed_by
) values(
  'a3030000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a3010000-0000-4000-8000-000000000001','AUR-PAR-001',
  '80000000-0000-4000-8000-000000000002'
);
insert into public.commercial_agreement_revisions(
  id,hotel_id,agreement_id,version,starts_on,ends_on,status,
  commercial_model,fixed_rent,rent_frequency,commission_percentage,
  minimum_guarantee,payment_recipient,currency,notes,last_changed_by
) values(
  'a3040000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a3030000-0000-4000-8000-000000000001',1,
  (date_trunc('month',public.hotel_operational_date('10000000-0000-4000-8000-000000000001'))::date-interval '1 month')::date,
  null,'draft','revenue_share',null,null,20,null,'both','BRL',
  'Comissão sintética de vinte por cento.',
  '80000000-0000-4000-8000-000000000002'
);
insert into public.commercial_agreement_revision_points(
  id,hotel_id,revision_id,point_id,last_changed_by
) values(
  'a3050000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a3040000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  '80000000-0000-4000-8000-000000000002'
);

do $$ begin
  if public.activate_commercial_agreement_revision(
    '10000000-0000-4000-8000-000000000001',
    'a3040000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000002'
  ) <> 'ok' then
    raise exception 'partner-settlement agreement activation failed';
  end if;
end $$;

insert into public.products(
  id,hotel_id,name,category_id,description,internal_code,kind,sales_unit,
  unit_price,status,provider_type,commercial_partner_id
) values(
  'a3060000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','Cesta de boas-vindas parceira',
  '41000000-0000-4000-8000-000000000002',
  'Serviço sintético atribuído ao parceiro do curso.','PAR-CESTA-001',
  'service','unit',100,'active','partner',
  'a3010000-0000-4000-8000-000000000001'
);
insert into public.consumption_offers(
  id,hotel_id,point_id,product_id,display_order,is_active,policy_source,
  commercial_agreement_id,last_changed_by
) values(
  'a3070000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  'a3060000-0000-4000-8000-000000000001',20,true,'inherit',
  'a3030000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000002'
);

insert into public.consumption_orders(
  id,hotel_id,stay_id,reservation_id,point_id,guest_customer_id,disposition,
  billing_mode,payment_method,payment_reference,currency,gross_amount,
  discount_amount,net_amount,reservation_code_snapshot,room_number_snapshot,
  guest_name_snapshot,point_name_snapshot,notes,occurred_at,posted_at,posted_by,
  idempotency_key,request_fingerprint,is_legacy
) values(
  'a3080000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000002','charged','hotel_immediate','pix',
  'PIX-TREINO-PARCEIRO','BRL',200,0,200,'LOCAL-AUR-002','102','Bruno Exemplo',
  'Café Aurora','Venda sintética elegível à apuração.',
  ((date_trunc('month',public.hotel_operational_date('10000000-0000-4000-8000-000000000001'))::date-15)+time '15:00') at time zone 'America/Sao_Paulo',
  public.hotel_operational_now('10000000-0000-4000-8000-000000000001'),
  '80000000-0000-4000-8000-000000000004',
  'a3080000-0000-4000-8000-000000000002','training:partner-order',false
);
insert into public.consumption_order_items(
  id,hotel_id,order_id,offer_id,product_id,category_id,commercial_partner_id,
  commercial_agreement_id,commercial_revision_id,quantity,charged_unit_price,
  discount_amount,product_name_snapshot,product_internal_code_snapshot,
  product_kind_snapshot,sales_unit_snapshot,category_name_snapshot,
  provider_type_snapshot,partner_name_snapshot,agreement_number_snapshot,
  commercial_revision_version_snapshot,commercial_terms_snapshot,
  billing_policy_snapshot,version_token,notes
) values(
  'a3090000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a3080000-0000-4000-8000-000000000001',
  'a3070000-0000-4000-8000-000000000001',
  'a3060000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000002',
  'a3010000-0000-4000-8000-000000000001',
  'a3030000-0000-4000-8000-000000000001',
  'a3040000-0000-4000-8000-000000000001',2,100,0,
  'Cesta de boas-vindas parceira','PAR-CESTA-001','service','unit',
  'Alimentacao','partner','Sabores Escola','AUR-PAR-001',1,
  jsonb_build_object('commission_percentage',20,'payment_recipient','both'),
  jsonb_build_object('source','agreement'),'training:partner-item',
  'Item sintético para cálculo de comissão.'
);

do $$ begin
  if not exists(
    select 1 from public.commercial_agreement_revisions
    where id='a3040000-0000-4000-8000-000000000001' and status='activated'
  ) or not exists(
    select 1 from public.consumption_order_items
    where id='a3090000-0000-4000-8000-000000000001'
      and provider_type_snapshot='partner'
  ) then
    raise exception 'partner-settlement fixture is incomplete';
  end if;
end $$;
