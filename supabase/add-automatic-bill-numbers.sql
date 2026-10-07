BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.purchase_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.sales_bill_number_seq START WITH 1;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS purchase_no text;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS bill_no text;

WITH missing_numbers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY purchase_date NULLS FIRST, id)
      + COALESCE(
          (
            SELECT MAX(SUBSTRING(purchase_no FROM '^PUR-([0-9]+)$')::bigint)
            FROM public.purchases
            WHERE purchase_no ~ '^PUR-[0-9]+$'
          ),
          0
        ) AS number
  FROM public.purchases
  WHERE purchase_no IS NULL
)
UPDATE public.purchases AS purchase
SET purchase_no = 'PUR-' || LPAD(missing_numbers.number::text, 6, '0')
FROM missing_numbers
WHERE purchase.id = missing_numbers.id;

WITH missing_numbers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY sale_date NULLS FIRST, id)
      + COALESCE(
          (
            SELECT MAX(SUBSTRING(bill_no FROM '^SAL-([0-9]+)$')::bigint)
            FROM public.sales
            WHERE bill_no ~ '^SAL-[0-9]+$'
          ),
          0
        ) AS number
  FROM public.sales
  WHERE bill_no IS NULL
)
UPDATE public.sales AS sale
SET bill_no = 'SAL-' || LPAD(missing_numbers.number::text, 6, '0')
FROM missing_numbers
WHERE sale.id = missing_numbers.id;

SELECT SETVAL(
  'public.purchase_number_seq',
  COALESCE(
    (SELECT MAX(SUBSTRING(purchase_no FROM '^PUR-([0-9]+)$')::bigint)
     FROM public.purchases
     WHERE purchase_no ~ '^PUR-[0-9]+$'),
    0
  ) + 1,
  false
);

SELECT SETVAL(
  'public.sales_bill_number_seq',
  COALESCE(
    (SELECT MAX(SUBSTRING(bill_no FROM '^SAL-([0-9]+)$')::bigint)
     FROM public.sales
     WHERE bill_no ~ '^SAL-[0-9]+$'),
    0
  ) + 1,
  false
);

ALTER TABLE public.purchases
  ALTER COLUMN purchase_no SET DEFAULT (
    'PUR-' || LPAD(NEXTVAL('public.purchase_number_seq')::text, 6, '0')
  );

ALTER TABLE public.purchases
  ALTER COLUMN purchase_no SET NOT NULL;

ALTER TABLE public.sales
  ALTER COLUMN bill_no SET DEFAULT (
    'SAL-' || LPAD(NEXTVAL('public.sales_bill_number_seq')::text, 6, '0')
  );

ALTER TABLE public.sales
  ALTER COLUMN bill_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_purchase_no_unique
  ON public.purchases (purchase_no)
  WHERE purchase_no IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_bill_no_unique
  ON public.sales (bill_no)
  WHERE bill_no IS NOT NULL;

GRANT USAGE, SELECT ON SEQUENCE public.purchase_number_seq
  TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public.sales_bill_number_seq
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reserve_purchase_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'PUR-' || LPAD(NEXTVAL('public.purchase_number_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.reserve_sales_bill_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'SAL-' || LPAD(NEXTVAL('public.sales_bill_number_seq')::text, 6, '0');
$$;

REVOKE ALL ON FUNCTION public.reserve_purchase_number() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_sales_bill_number() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.reserve_purchase_number()
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reserve_sales_bill_number()
  TO authenticated, service_role;

COMMIT;
