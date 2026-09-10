import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Sale = {
  id: string;
  customer_id: string | null;
  sale_date: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
  payment_method?: string | null;
  cash_amount?: number | string | null;
  upi_amount?: number | string | null;
};

type Purchase = {
  id: string;
  purchase_date: string | null;
  total_amount: number | string | null;
};

type Collection = {
  id: string;
  customer_id: string | null;
  collection_date: string | null;
  amount: number | string | null;
  payment_method?: string | null;
  cash_amount?: number | string | null;
  upi_amount?: number | string | null;
};

type Expense = {
  id: string;
  expense_date: string | null;
  amount: number | string | null;
  category?: string | null;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number | string | null;
  rate: number | string | null;
  cost_rate: number | string | null;
  amount: number | string | null;
};

type Customer = {
  id: string;
  customer_name: string;
};

type CustomerProfitRow = {
  customerId: string;
  customerName: string;
  sales: number;
  cost: number;
  grossProfit: number;
  paidAtSale: number;
  collections: number;
  outstanding: number;
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateDisplay(
  value: string | null
) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );
}

function formatDDMMYYYYInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(
    2,
    4
  )}/${digits.slice(4, 8)}`;
}

function parseDDMMYYYY(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!/^\d{8}$/.test(digits)) {
    return null;
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const test = new Date(
    year,
    month - 1,
    day
  );

  if (
    test.getFullYear() !== year ||
    test.getMonth() !== month - 1 ||
    test.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
}

function formatISOToDDMMYYYY(value: string) {
  const parts = value.slice(0, 10).split("-");

  if (
    parts.length === 3 &&
    /^\d{4}$/.test(parts[0])
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return "";
}


function isDateInRange(
  value: string | null,
  fromDate: string,
  toDate: string
) {
  if (!value) return false;

  /*
   * Handles both:
   * 2026-08-10
   * 2026-08-10T10:30:00
   */
  const datePart = value.substring(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      datePart
    )
  ) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const year =
      date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    const dateOnly = `${year}-${month}-${day}`;

    return (
      dateOnly >= fromDate &&
      dateOnly <= toDate
    );
  }

  return (
    datePart >= fromDate &&
    datePart <= toDate
  );
}

export default function Reports() {
  const today = new Date();

  const firstDayOfMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  );

  const [fromDate, setFromDate] =
    useState(
      formatDateInput(
        firstDayOfMonth
      )
    );

  const [toDate, setToDate] =
    useState(
      formatDateInput(today)
    );

  const [fromDateDisplay, setFromDateDisplay] =
    useState(
      formatDateInput(firstDayOfMonth)
        .split("-")
        .reverse()
        .join("/")
    );

  const [toDateDisplay, setToDateDisplay] =
    useState(
      formatDateInput(today)
        .split("-")
        .reverse()
        .join("/")
    );

  const [sales, setSales] =
    useState<Sale[]>([]);

  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [collections, setCollections] =
    useState<Collection[]>([]);

  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [saleItems, setSaleItems] =
    useState<SaleItem[]>([]);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [loaded, setLoaded] =
    useState(false);

  // ==========================================
  // LOAD REPORTS
  // ==========================================

  async function loadReports() {
    const normalizedFrom =
      parseDDMMYYYY(fromDateDisplay);
    const normalizedTo =
      parseDDMMYYYY(toDateDisplay);

    if (!normalizedFrom || !normalizedTo) {
      alert(
        "Please enter valid dates in DD/MM/YYYY format.\nExample: 09/09/2026"
      );
      return;
    }

    if (normalizedFrom > normalizedTo) {
      alert(
        "From Date cannot be after To Date."
      );
      return;
    }

    setFromDate(normalizedFrom);
    setToDate(normalizedTo);

    setLoading(true);

    try {
      // ========================================
      // LOAD ALL REQUIRED DATA
      // ========================================

      const [
        salesResult,
        purchaseResult,
        collectionResult,
        expenseResult,
        saleItemResult,
        customerResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(`
            id,
            customer_id,
            sale_date,
            total_amount,
            paid_amount,
            balance_amount,
            payment_method,
            cash_amount,
            upi_amount
          `)
          .order("sale_date", {
            ascending: false,
          }),

        supabase
          .from("purchases")
          .select(`
            id,
            purchase_date,
            total_amount
          `)
          .order("purchase_date", {
            ascending: false,
          }),

        supabase
          .from("collections")
          .select(`
            id,
            customer_id,
            collection_date,
            amount,
            payment_method,
            cash_amount,
            upi_amount
          `)
          .order("collection_date", {
            ascending: false,
          }),

        supabase
          .from("expenses")
          .select(`
            id,
            expense_date,
            amount,
            category
          `)
          .order("expense_date", {
            ascending: false,
          }),

        supabase
          .from("sale_items")
          .select(`
            id,
            sale_id,
            product_id,
            quantity,
            rate,
            cost_rate,
            amount
          `),

        supabase
          .from("customers")
          .select(`
            id,
            customer_name
          `)
          .order("customer_name", {
            ascending: true,
          }),
      ]);

      // ========================================
      // CHECK ERRORS
      // ========================================

      const firstError =
        salesResult.error ||
        purchaseResult.error ||
        collectionResult.error ||
        expenseResult.error ||
        saleItemResult.error ||
        customerResult.error;

      if (firstError) {
        throw firstError;
      }

      // ========================================
      // CONVERT DATA
      // ========================================

      const allSales =
        (salesResult.data ||
          []) as Sale[];

      const allPurchases =
        (purchaseResult.data ||
          []) as Purchase[];

      const allCollections =
        (collectionResult.data ||
          []) as Collection[];

      const allExpenses =
        (expenseResult.data ||
          []) as Expense[];

      const allSaleItems =
        (saleItemResult.data ||
          []) as SaleItem[];

      const allCustomers =
        (customerResult.data ||
          []) as Customer[];

      // ========================================
      // FILTER DATE RANGE
      // ========================================

      const filteredSales =
        allSales.filter((row) =>
          isDateInRange(
            row.sale_date,
            fromDate,
            toDate
          )
        );

      const filteredPurchases =
        allPurchases.filter((row) =>
          isDateInRange(
            row.purchase_date,
            fromDate,
            toDate
          )
        );

      const filteredCollections =
        allCollections.filter((row) =>
          isDateInRange(
            row.collection_date,
            fromDate,
            toDate
          )
        );

      const filteredExpenses =
        allExpenses.filter((row) =>
          isDateInRange(
            row.expense_date,
            fromDate,
            toDate
          )
        );

      // ========================================
      // ONLY SALE ITEMS BELONGING TO
      // SELECTED SALES
      // ========================================

      const selectedSaleIds =
        new Set(
          filteredSales.map((sale) =>
            String(sale.id)
          )
        );

      const filteredSaleItems =
        allSaleItems.filter((item) =>
          selectedSaleIds.has(
            String(item.sale_id)
          )
        );

      // ========================================
      // SAVE STATE
      // ========================================

      setSales(filteredSales);

      setPurchases(
        filteredPurchases
      );

      setCollections(
        filteredCollections
      );

      setExpenses(
        filteredExpenses
      );

      setSaleItems(
        filteredSaleItems
      );

      setCustomers(
        allCustomers
      );

      setLoaded(true);
    } catch (error) {
      console.error(
        "REPORT ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to load reports.";

      alert(
        "Reports Error: " +
          message
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    loadReports();
  }, []);

  // ==========================================
  // TOTAL SALES
  // ==========================================

  const totalSales = useMemo(
    () =>
      sales.reduce(
        (sum, row) =>
          sum +
          Number(
            row.total_amount || 0
          ),
        0
      ),
    [sales]
  );

  // ==========================================
  // TOTAL PURCHASES
  // ==========================================

  const totalPurchases = useMemo(
    () =>
      purchases.reduce(
        (sum, row) =>
          sum +
          Number(
            row.total_amount || 0
          ),
        0
      ),
    [purchases]
  );

  // ==========================================
  // TOTAL COLLECTIONS
  // ==========================================

  const totalCollections =
    useMemo(
      () =>
        collections.reduce(
          (sum, row) =>
            sum +
            Number(
              row.amount || 0
            ),
          0
        ),
      [collections]
    );

  const cashSalesReceived = useMemo(() =>
    sales.reduce((sum, row) => {
      const method = String(row.payment_method || "").trim().toLowerCase();
      const paid = Number(row.paid_amount || 0);
      const total = Number(row.total_amount || 0);
      const stored = Number(row.cash_amount || 0);
      const fallback = paid > 0 ? paid : total;
      return sum + (stored > 0 ? stored : method === "cash" ? fallback : 0);
    }, 0), [sales]);

  const upiSalesReceived = useMemo(() =>
    sales.reduce((sum, row) => {
      const method = String(row.payment_method || "").trim().toLowerCase();
      const paid = Number(row.paid_amount || 0);
      const total = Number(row.total_amount || 0);
      const stored = Number(row.upi_amount || 0);
      const fallback = paid > 0 ? paid : total;
      return sum + (stored > 0 ? stored : method === "upi" ? fallback : 0);
    }, 0), [sales]);

  const creditSalesOutstanding = useMemo(() =>
    sales.reduce((sum, row) => {
      const method = String(row.payment_method || "").trim().toLowerCase();
      return method === "credit" ? sum + Number(row.balance_amount || 0) : sum;
    }, 0), [sales]);

  const cashCollections = useMemo(() =>
    collections.reduce((sum, row) => {
      const method = String(row.payment_method || "").trim().toLowerCase();
      const total = Number(row.amount || 0);
      const stored = Number(row.cash_amount || 0);
      return sum + (stored > 0 ? stored : method === "cash" ? total : 0);
    }, 0), [collections]);

  const upiCollections = useMemo(() =>
    collections.reduce((sum, row) => {
      const method = String(row.payment_method || "").trim().toLowerCase();
      const total = Number(row.amount || 0);
      const stored = Number(row.upi_amount || 0);
      return sum + (stored > 0 ? stored : method === "upi" ? total : 0);
    }, 0), [collections]);

  const nonCashCollections = useMemo(() =>
    Math.max(0, totalCollections - cashCollections), [totalCollections, cashCollections]);

  // ==========================================
  // TOTAL EXPENSES
  // ==========================================

  const totalExpenses = useMemo(
    () =>
      expenses.reduce(
        (sum, row) =>
          sum +
          Number(
            row.amount || 0
          ),
        0
      ),
    [expenses]
  );

  // ==========================================
  // PAID AT SALE
  // ==========================================

  const paidAtSale = useMemo(
    () =>
      sales.reduce(
        (sum, row) =>
          sum +
          Number(
            row.paid_amount || 0
          ),
        0
      ),
    [sales]
  );

  // ==========================================
  // OUTSTANDING
  // ==========================================

  const totalOutstanding =
    useMemo(
      () =>
        sales.reduce(
          (sum, row) =>
            sum +
            Number(
              row.balance_amount || 0
            ),
          0
        ),
      [sales]
    );

  // ==========================================
  // COST OF GOODS SOLD
  // ==========================================

  const totalCostOfGoodsSold =
    useMemo(
      () =>
        saleItems.reduce(
          (sum, item) => {
            const quantity =
              Number(
                item.quantity || 0
              );

            const costRate =
              Number(
                item.cost_rate || 0
              );

            return (
              sum +
              quantity *
                costRate
            );
          },
          0
        ),
      [saleItems]
    );

  // ==========================================
  // GROSS PROFIT
  // ==========================================

  const grossProfit =
    totalSales -
    totalCostOfGoodsSold;

  // ==========================================
  // NET PROFIT
  // ==========================================

  const netProfit =
    grossProfit -
    totalExpenses;

  // ==========================================
  // TOTAL RECEIPTS
  // ==========================================

  const totalReceipts =
    paidAtSale +
    totalCollections;

  // ==========================================
  // CUSTOMER MAP
  // ==========================================

  const customerMap = useMemo(
    () =>
      new Map(
        customers.map(
          (customer) => [
            String(customer.id),
            customer.customer_name,
          ]
        )
      ),
    [customers]
  );

  // ==========================================
  // CUSTOMER-WISE PROFIT
  // ==========================================

  const customerProfitRows =
    useMemo(() => {
      const map =
        new Map<
          string,
          CustomerProfitRow
        >();

      // ----------------------------------------
      // CREATE CUSTOMER ROWS FROM SALES
      // ----------------------------------------

      sales.forEach((sale) => {
        const customerId =
          sale.customer_id;

        // Walk-in sales do not have
        // a customer ledger.
        if (!customerId) {
          return;
        }

        const key =
          String(customerId);

        if (!map.has(key)) {
          map.set(key, {
            customerId: key,
            customerName:
              customerMap.get(
                key
              ) ||
              "Unknown Customer",
            sales: 0,
            cost: 0,
            grossProfit: 0,
            paidAtSale: 0,
            collections: 0,
            outstanding: 0,
          });
        }

        const row =
          map.get(key)!;

        row.sales += Number(
          sale.total_amount || 0
        );

        row.paidAtSale +=
          Number(
            sale.paid_amount || 0
          );

        row.outstanding +=
          Number(
            sale.balance_amount ||
              0
          );
      });

      // ----------------------------------------
      // COST BY CUSTOMER
      // ----------------------------------------

      const saleMap =
        new Map<
          string,
          Sale
        >();

      sales.forEach((sale) => {
        saleMap.set(
          String(sale.id),
          sale
        );
      });

      saleItems.forEach(
        (item) => {
          const sale =
            saleMap.get(
              String(
                item.sale_id
              )
            );

          if (!sale) {
            return;
          }

          if (
            !sale.customer_id
          ) {
            return;
          }

          const key =
            String(
              sale.customer_id
            );

          if (!map.has(key)) {
            map.set(key, {
              customerId: key,
              customerName:
                customerMap.get(
                  key
                ) ||
                "Unknown Customer",
              sales: 0,
              cost: 0,
              grossProfit: 0,
              paidAtSale: 0,
              collections: 0,
              outstanding: 0,
            });
          }

          const quantity =
            Number(
              item.quantity || 0
            );

          const costRate =
            Number(
              item.cost_rate || 0
            );

          map.get(
            key
          )!.cost +=
            quantity *
            costRate;
        }
      );

      // ----------------------------------------
      // COLLECTIONS BY CUSTOMER
      // ----------------------------------------

      collections.forEach(
        (collection) => {
          if (
            !collection.customer_id
          ) {
            return;
          }

          const key =
            String(
              collection.customer_id
            );

          if (!map.has(key)) {
            map.set(key, {
              customerId: key,
              customerName:
                customerMap.get(
                  key
                ) ||
                "Unknown Customer",
              sales: 0,
              cost: 0,
              grossProfit: 0,
              paidAtSale: 0,
              collections: 0,
              outstanding: 0,
            });
          }

          map.get(
            key
          )!.collections +=
            Number(
              collection.amount ||
                0
            );
        }
      );

      // ----------------------------------------
      // CALCULATE GROSS PROFIT
      // ----------------------------------------

      map.forEach((row) => {
        row.grossProfit =
          row.sales -
          row.cost;
      });

      // ----------------------------------------
      // SORT BY SALES HIGH TO LOW
      // ----------------------------------------

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.sales - a.sales
      );
    }, [
      sales,
      saleItems,
      collections,
      customerMap,
    ]);

  // ==========================================
  // CUSTOMER TOTALS
  // ==========================================

  const customerProfitTotals =
    useMemo(() => {
      return customerProfitRows.reduce(
        (totals, row) => {
          totals.sales +=
            row.sales;

          totals.cost +=
            row.cost;

          totals.grossProfit +=
            row.grossProfit;

          totals.paidAtSale +=
            row.paidAtSale;

          totals.collections +=
            row.collections;

          totals.outstanding +=
            row.outstanding;

          return totals;
        },
        {
          sales: 0,
          cost: 0,
          grossProfit: 0,
          paidAtSale: 0,
          collections: 0,
          outstanding: 0,
        }
      );
    }, [customerProfitRows]);

  // ==========================================
  // LOAD TODAY
  // ==========================================

  function loadToday() {
    const todayDate =
      formatDateInput(
        new Date()
      );

    setFromDate(todayDate);
    setToDate(todayDate);
    setFromDateDisplay(
      formatISOToDDMMYYYY(todayDate)
    );
    setToDateDisplay(
      formatISOToDDMMYYYY(todayDate)
    );

    setTimeout(() => {
      loadReports();
    }, 50);
  }

  // ==========================================
  // LOAD THIS MONTH
  // ==========================================

  function loadThisMonth() {
    const now =
      new Date();

    const first =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

    const firstDate = formatDateInput(first);
    const nowDate = formatDateInput(now);

    setFromDate(firstDate);
    setToDate(nowDate);
    setFromDateDisplay(
      formatISOToDDMMYYYY(firstDate)
    );
    setToDateDisplay(
      formatISOToDDMMYYYY(nowDate)
    );

    setTimeout(() => {
      loadReports();
    }, 50);
  }

  return (
    <div className="p-6">

      {/* ======================================
          HEADER
      ======================================= */}

      <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <p className="text-sm font-semibold text-blue-100">
              MANVI MILK AGENCIES
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Reports Dashboard
            </h1>

            <p className="mt-2 text-sm text-blue-100">
              Sales, purchases,
              collections, expenses
              and profit analysis.
            </p>

          </div>

          <button
            onClick={
              loadReports
            }
            disabled={loading}
            className="rounded-xl bg-white px-5 py-3 font-bold text-blue-700 shadow hover:bg-blue-50 disabled:opacity-60"
          >
            {loading
              ? "Loading..."
              : "↻ Refresh Reports"}
          </button>

        </div>

      </div>

      {/* ======================================
          DATE FILTER
      ======================================= */}

      <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">

        <h2 className="mb-4 text-xl font-bold text-slate-800">
          Report Period
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

          <div>

            <label className="mb-2 block font-semibold text-slate-700">
              From Date
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={fromDateDisplay}
              onChange={(e) => {
                const display =
                  formatDDMMYYYYInput(
                    e.target.value
                  );

                setFromDateDisplay(display);

                const normalized =
                  parseDDMMYYYY(display);

                if (normalized) {
                  setFromDate(normalized);
                }
              }}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-full rounded-lg border border-slate-300 p-3"
            />

          </div>

          <div>

            <label className="mb-2 block font-semibold text-slate-700">
              To Date
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={toDateDisplay}
              onChange={(e) => {
                const display =
                  formatDDMMYYYYInput(
                    e.target.value
                  );

                setToDateDisplay(display);

                const normalized =
                  parseDDMMYYYY(display);

                if (normalized) {
                  setToDate(normalized);
                }
              }}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-full rounded-lg border border-slate-300 p-3"
            />

          </div>

          <div className="flex items-end">

            <button
              onClick={
                loadReports
              }
              disabled={
                loading
              }
              className="w-full rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading
                ? "Loading..."
                : "Load Report"}
            </button>

          </div>

          <div className="flex items-end gap-2">

            <button
              onClick={
                loadToday
              }
              disabled={
                loading
              }
              className="flex-1 rounded-lg bg-slate-700 px-4 py-3 font-bold text-white hover:bg-slate-800"
            >
              Today
            </button>

            <button
              onClick={
                loadThisMonth
              }
              disabled={
                loading
              }
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700"
            >
              Month
            </button>

          </div>

        </div>

        <p className="mt-3 text-sm text-slate-500">
          Date format:
          DD/MM/YYYY
        </p>

      </div>

      {/* ======================================
          SUMMARY CARDS
      ======================================= */}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">

        <div className="rounded-xl bg-blue-600 p-6 text-white shadow-lg">

          <h2 className="text-lg font-semibold">
            Total Sales
          </h2>

          <p className="mt-3 text-3xl font-bold">
            ₹{" "}
            {totalSales.toFixed(
              2
            )}
          </p>

          <p className="mt-2 text-sm text-blue-100">
            {sales.length} sales
            entries
          </p>

        </div>

        <div className="rounded-xl bg-red-600 p-6 text-white shadow-lg">

          <h2 className="text-lg font-semibold">
            Total Purchases
          </h2>

          <p className="mt-3 text-3xl font-bold">
            ₹{" "}
            {totalPurchases.toFixed(
              2
            )}
          </p>

          <p className="mt-2 text-sm text-red-100">
            {purchases.length} purchase
            entries
          </p>

        </div>

        <div className="rounded-xl bg-green-600 p-6 text-white shadow-lg">

          <h2 className="text-lg font-semibold">
            Total Collections
          </h2>

          <p className="mt-3 text-3xl font-bold">
            ₹{" "}
            {totalCollections.toFixed(
              2
            )}
          </p>

          <p className="mt-2 text-sm text-green-100">
            {collections.length} collection
            entries
          </p>

        </div>

        <div className="rounded-xl bg-orange-500 p-6 text-white shadow-lg">

          <h2 className="text-lg font-semibold">
            Total Expenses
          </h2>

          <p className="mt-3 text-3xl font-bold">
            ₹{" "}
            {totalExpenses.toFixed(
              2
            )}
          </p>

          <p className="mt-2 text-sm text-orange-100">
            {expenses.length} expense
            entries
          </p>

        </div>

        <div className="rounded-xl bg-gray-700 p-6 text-white shadow-lg">

          <h2 className="text-lg font-semibold">
            Cost of Goods Sold
          </h2>

          <p className="mt-3 text-3xl font-bold">
            ₹{" "}
            {totalCostOfGoodsSold.toFixed(
              2
            )}
          </p>

          <p className="mt-2 text-sm text-gray-300">
            Product cost for sold
            items
          </p>

        </div>

        <div className="rounded-xl bg-yellow-500 p-6 text-white shadow-lg">

          <h2 className="text-lg font-semibold">
            Outstanding Balance
          </h2>

          <p className="mt-3 text-3xl font-bold">
            ₹{" "}
            {totalOutstanding.toFixed(
              2
            )}
          </p>

          <p className="mt-2 text-sm text-yellow-100">
            Current balance on sales included in this report period
          </p>

        </div>

      </div>

      {/* ======================================
          PROFIT & LOSS
      ======================================= */}

      <div className="mt-10 rounded-2xl bg-white p-6 shadow-lg">

        <h2 className="text-2xl font-bold text-slate-800">
          Profit & Loss Summary
        </h2>

        <p className="mt-1 text-slate-500">
          Business profitability
          for the selected period.
        </p>

        <div className="mt-6">

          <div className="flex justify-between border-b py-4">

            <span className="font-medium">
              Total Sales
            </span>

            <span className="font-bold">
              ₹{" "}
              {totalSales.toFixed(
                2
              )}
            </span>

          </div>

          <div className="flex justify-between border-b py-4">

            <span>
              Less: Cost of Goods Sold
            </span>

            <span>
              ₹{" "}
              {totalCostOfGoodsSold.toFixed(
                2
              )}
            </span>

          </div>

          <div className="flex justify-between border-b py-4">

            <span className="font-bold">
              Gross Profit
            </span>

            <span className="text-xl font-bold text-purple-600">
              ₹{" "}
              {grossProfit.toFixed(
                2
              )}
            </span>

          </div>

          <div className="flex justify-between border-b py-4">

            <span>
              Less: Expenses
            </span>

            <span className="font-bold text-red-600">
              ₹{" "}
              {totalExpenses.toFixed(
                2
              )}
            </span>

          </div>

          <div className="flex justify-between py-5">

            <span className="text-xl font-bold">
              Net Profit
            </span>

            <span
              className={`text-2xl font-bold ${
                netProfit >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              ₹{" "}
              {netProfit.toFixed(
                2
              )}
            </span>

          </div>

        </div>

      </div>

      {/* ======================================
          RECEIPTS
      ======================================= */}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">

        <div className="rounded-xl bg-white p-6 shadow">

          <p className="text-slate-500">
            Paid at Sale
          </p>

          <p className="mt-2 text-2xl font-bold text-cyan-700">
            ₹{" "}
            {paidAtSale.toFixed(
              2
            )}
          </p>

        </div>

        <div className="rounded-xl bg-white p-6 shadow">

          <p className="text-slate-500">
            Collections Received
          </p>

          <p className="mt-2 text-2xl font-bold text-green-600">
            ₹{" "}
            {totalCollections.toFixed(
              2
            )}
          </p>

        </div>

        <div className="rounded-xl bg-white p-6 shadow">

          <p className="text-slate-500">
            Total Receipts
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-700">
            ₹{" "}
            {totalReceipts.toFixed(
              2
            )}
          </p>

        </div>

      </div>

      {/* ======================================
          PAYMENT BREAKDOWN
      ======================================= */}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">

        <div className="rounded-xl bg-emerald-50 p-5 shadow">
          <p className="text-slate-500">Cash Sales Received</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">₹ {cashSalesReceived.toFixed(2)}</p>
        </div>

        <div className="rounded-xl bg-blue-50 p-5 shadow">
          <p className="text-slate-500">UPI Sales Received</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">₹ {upiSalesReceived.toFixed(2)}</p>
        </div>

        <div className="rounded-xl bg-amber-50 p-5 shadow">
          <p className="text-slate-500">Credit Outstanding</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">₹ {creditSalesOutstanding.toFixed(2)}</p>
        </div>

        <div className="rounded-xl bg-teal-50 p-5 shadow">
          <p className="text-slate-500">Cash Collections</p>
          <p className="mt-2 text-2xl font-bold text-teal-700">₹ {cashCollections.toFixed(2)}</p>
          <p className="mt-1 text-xs text-slate-500">UPI Collections: ₹ {upiCollections.toFixed(2)}</p>
        </div>

      </div>

      {/* ======================================
          CUSTOMER-WISE PROFIT
      ======================================= */}

      <div className="mt-10 rounded-2xl bg-white p-6 shadow-lg">

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

          <div>

            <h2 className="text-2xl font-bold text-slate-800">
              Customer-wise Profit
            </h2>

            <p className="mt-1 text-slate-500">
              Sales, product cost,
              profit, payments and
              outstanding by customer.
            </p>

          </div>

          <div className="rounded-lg bg-purple-50 px-4 py-2 font-bold text-purple-700">
            {customerProfitRows.length} Customers
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1100px] border-collapse">

            <thead className="bg-purple-600 text-white">

              <tr>

                <th className="p-3 text-left">
                  Customer
                </th>

                <th className="p-3 text-right">
                  Sales
                </th>

                <th className="p-3 text-right">
                  Cost
                </th>

                <th className="p-3 text-right">
                  Gross Profit
                </th>

                <th className="p-3 text-right">
                  Paid at Sale
                </th>

                <th className="p-3 text-right">
                  Collections
                </th>

                <th className="p-3 text-right">
                  Outstanding
                </th>

              </tr>

            </thead>

            <tbody>

              {customerProfitRows.length ===
              0 ? (

                <tr>

                  <td
                    colSpan={7}
                    className="p-8 text-center text-gray-500"
                  >
                    No customer sales found
                    for the selected period.
                  </td>

                </tr>

              ) : (

                customerProfitRows.map(
                  (row) => (
                    <tr
                      key={
                        row.customerId
                      }
                      className="border-b hover:bg-slate-50"
                    >

                      <td className="p-3 font-semibold text-slate-800">
                        {row.customerName}
                      </td>

                      <td className="p-3 text-right font-semibold">
                        ₹{" "}
                        {row.sales.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-600">
                        ₹{" "}
                        {row.cost.toFixed(
                          2
                        )}
                      </td>

                      <td
                        className={`p-3 text-right font-bold ${
                          row.grossProfit >=
                          0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        ₹{" "}
                        {row.grossProfit.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-right text-cyan-700">
                        ₹{" "}
                        {row.paidAtSale.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-right text-purple-700">
                        ₹{" "}
                        {row.collections.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-right font-bold text-red-600">
                        ₹{" "}
                        {row.outstanding.toFixed(
                          2
                        )}
                      </td>

                    </tr>
                  )
                )

              )}

            </tbody>

            {customerProfitRows.length >
              0 && (

              <tfoot className="bg-slate-100 font-bold">

                <tr>

                  <td className="p-3">
                    TOTAL
                  </td>

                  <td className="p-3 text-right">
                    ₹{" "}
                    {customerProfitTotals.sales.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-3 text-right">
                    ₹{" "}
                    {customerProfitTotals.cost.toFixed(
                      2
                    )}
                  </td>

                  <td
                    className={`p-3 text-right ${
                      customerProfitTotals.grossProfit >=
                      0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    ₹{" "}
                    {customerProfitTotals.grossProfit.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-3 text-right text-cyan-700">
                    ₹{" "}
                    {customerProfitTotals.paidAtSale.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-3 text-right text-purple-700">
                    ₹{" "}
                    {customerProfitTotals.collections.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-3 text-right text-red-600">
                    ₹{" "}
                    {customerProfitTotals.outstanding.toFixed(
                      2
                    )}
                  </td>

                </tr>

              </tfoot>
            )}

          </table>

        </div>

        <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">

          <strong>
            Profit calculation:
          </strong>{" "}
          Sales − saved product cost (`cost_rate`).
          <br />
          <strong>Outstanding:</strong> current `balance_amount` of sales in the selected period.

        </div>

      </div>

      {/* ======================================
          SALES REPORT
      ======================================= */}

      <div className="mt-10 rounded-2xl bg-white p-6 shadow-lg">

        <div className="mb-4 flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-bold">
              Sales Report
            </h2>

            <p className="text-slate-500">
              Sales for selected date
              range.
            </p>

          </div>

          <div className="rounded-lg bg-blue-50 px-4 py-2 font-bold text-blue-700">
            Total: ₹{" "}
            {totalSales.toFixed(
              2
            )}
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead className="bg-blue-600 text-white">

              <tr>

                <th className="p-3 text-left">
                  Date
                </th>

                <th className="p-3 text-right">
                  Total
                </th>

                <th className="p-3 text-right">
                  Paid
                </th>

                <th className="p-3 text-right">
                  Balance
                </th>

              </tr>

            </thead>

            <tbody>

              {sales.length ===
              0 ? (

                <tr>

                  <td
                    colSpan={4}
                    className="p-8 text-center text-gray-500"
                  >
                    No sales found for
                    selected period.
                  </td>

                </tr>

              ) : (

                sales.map(
                  (sale) => (

                    <tr
                      key={sale.id}
                      className="border-b hover:bg-slate-50"
                    >

                      <td className="p-3">
                        {formatDateDisplay(
                          sale.sale_date
                        )}
                      </td>

                      <td className="p-3 text-right font-semibold">
                        ₹{" "}
                        {Number(
                          sale.total_amount ||
                            0
                        ).toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-right text-green-600">
                        ₹{" "}
                        {Number(
                          sale.paid_amount ||
                            0
                        ).toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-right text-red-600">
                        ₹{" "}
                        {Number(
                          sale.balance_amount ||
                            0
                        ).toFixed(
                          2
                        )}
                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ======================================
          PURCHASE REPORT
      ======================================= */}

      <div className="mt-10 rounded-2xl bg-white p-6 shadow-lg">

        <div className="mb-4 flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-bold">
              Purchase Report
            </h2>

            <p className="text-slate-500">
              Purchases for selected
              date range.
            </p>

          </div>

          <div className="rounded-lg bg-red-50 px-4 py-2 font-bold text-red-600">
            Total: ₹{" "}
            {totalPurchases.toFixed(
              2
            )}
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead className="bg-red-600 text-white">

              <tr>

                <th className="p-3 text-left">
                  Date
                </th>

                <th className="p-3 text-right">
                  Total Amount
                </th>

              </tr>

            </thead>

            <tbody>

              {purchases.length ===
              0 ? (

                <tr>

                  <td
                    colSpan={2}
                    className="p-8 text-center text-gray-500"
                  >
                    No purchases found
                    for selected period.
                  </td>

                </tr>

              ) : (

                purchases.map(
                  (purchase) => (

                    <tr
                      key={
                        purchase.id
                      }
                      className="border-b hover:bg-slate-50"
                    >

                      <td className="p-3">
                        {formatDateDisplay(
                          purchase.purchase_date
                        )}
                      </td>

                      <td className="p-3 text-right font-semibold">
                        ₹{" "}
                        {Number(
                          purchase.total_amount ||
                            0
                        ).toFixed(
                          2
                        )}
                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ======================================
          COLLECTION REPORT
      ======================================= */}

      <div className="mt-10 rounded-2xl bg-white p-6 shadow-lg">

        <div className="mb-4 flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-bold">
              Collection Report
            </h2>

            <p className="text-slate-500">
              Customer payments for
              selected period.
            </p>

          </div>

          <div className="rounded-lg bg-green-50 px-4 py-2 font-bold text-green-600">
            Total: ₹{" "}
            {totalCollections.toFixed(
              2
            )}
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead className="bg-green-600 text-white">

              <tr>

                <th className="p-3 text-left">
                  Date
                </th>

                <th className="p-3 text-right">
                  Amount
                </th>

              </tr>

            </thead>

            <tbody>

              {collections.length ===
              0 ? (

                <tr>

                  <td
                    colSpan={2}
                    className="p-8 text-center text-gray-500"
                  >
                    No collections found
                    for selected period.
                  </td>

                </tr>

              ) : (

                collections.map(
                  (collection) => (

                    <tr
                      key={
                        collection.id
                      }
                      className="border-b hover:bg-slate-50"
                    >

                      <td className="p-3">
                        {formatDateDisplay(
                          collection.collection_date
                        )}
                      </td>

                      <td className="p-3 text-right font-semibold text-green-600">
                        ₹{" "}
                        {Number(
                          collection.amount ||
                            0
                        ).toFixed(
                          2
                        )}
                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ======================================
          EXPENSE REPORT
      ======================================= */}

      <div className="mt-10 rounded-2xl bg-white p-6 shadow-lg">

        <div className="mb-4 flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-bold">
              Expense Report
            </h2>

            <p className="text-slate-500">
              Business expenses for
              selected period.
            </p>

          </div>

          <div className="rounded-lg bg-orange-50 px-4 py-2 font-bold text-orange-600">
            Total: ₹{" "}
            {totalExpenses.toFixed(
              2
            )}
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead className="bg-orange-500 text-white">

              <tr>

                <th className="p-3 text-left">
                  Date
                </th>

                <th className="p-3 text-left">
                  Category
                </th>

                <th className="p-3 text-right">
                  Amount
                </th>

              </tr>

            </thead>

            <tbody>

              {expenses.length ===
              0 ? (

                <tr>

                  <td
                    colSpan={3}
                    className="p-8 text-center text-gray-500"
                  >
                    No expenses found
                    for selected period.
                  </td>

                </tr>

              ) : (

                expenses.map(
                  (expense) => (

                    <tr
                      key={
                        expense.id
                      }
                      className="border-b hover:bg-slate-50"
                    >

                      <td className="p-3">
                        {formatDateDisplay(
                          expense.expense_date
                        )}
                      </td>

                      <td className="p-3">
                        {expense.category ||
                          "-"}
                      </td>

                      <td className="p-3 text-right font-semibold text-red-600">
                        ₹{" "}
                        {Number(
                          expense.amount ||
                            0
                        ).toFixed(
                          2
                        )}
                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ======================================
          REPORT STATUS
      ======================================= */}

      {loaded && (

        <div className="mt-8 rounded-xl bg-blue-50 p-4 text-center text-sm font-medium text-blue-700">

          Report loaded for{" "}

          <strong>
            {formatDateDisplay(
              fromDate
            )}
          </strong>

          {" "}to{" "}

          <strong>
            {formatDateDisplay(
              toDate
            )}
          </strong>

        </div>

      )}

    </div>
  );
}