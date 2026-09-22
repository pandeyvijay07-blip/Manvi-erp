alter table public.products
  add column if not exists supplier_id uuid;

with latest_product_supplier as (
  select distinct on (pi.product_id)
    pi.product_id,
    s.id as supplier_id
  from public.purchase_items pi
  join public.purchases pu on pu.id = pi.purchase_id
  join public.suppliers s
    on lower(trim(s.supplier_name)) = lower(trim(pu.supplier_name))
  order by
    pi.product_id,
    pu.purchase_date desc nulls last,
    pu.id desc
)
update public.products p
set supplier_id = lps.supplier_id
from latest_product_supplier lps
where p.id = lps.product_id
  and p.supplier_id is null;

alter table public.products
  drop constraint if exists products_supplier_id_fkey;

alter table public.products
  add constraint products_supplier_id_fkey
  foreign key (supplier_id)
  references public.suppliers(id)
  on update cascade
  on delete restrict;

create index if not exists products_supplier_id_idx
  on public.products(supplier_id);