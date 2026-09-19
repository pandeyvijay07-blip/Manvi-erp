import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Sale = {
  id: string;
  customer_id: string | null;
  sale_date: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
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

type Product = {
  id: string;
  purchase_rate: number | string | null;
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

function getLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDDMMYYYY(iso: string | null | undefined) {
  if (!iso) return "-";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function parseDDMMYYYY(value: string): string | null {
  const text = value.trim();
  if (!text) return null;

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateKey(value: string | null): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const parsed = parseDDMMYYYY(text);
  return parsed;
}

function isDateInRange(value: string | null, fromDate: string, toDate: string) {
  const key = dateKey(value);
  if (!key) return false;
  return key >= fromDate && key <= toDate;
}

export default function Reports() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fromDate, setFromDate] = useState(
    getLocalISODate(firstDayOfMonth)
  );

  const [toDate, setToDate] = useState(
    getLocalISODate(today)
  );

  const [fromDateInput, setFromDateInput] = useState(
    formatDateDDMMYYYY(getLocalISODate(firstDayOfMonth))
  );

  const [toDateInput, setToDateInput] = useState(
    formatDateDDMMYYYY(getLocalISODate(today))
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

  const [products, setProducts] =
    useState<Product[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [loaded, setLoaded] =
    useState(false);

  // ==========================================
  // LOAD REPORTS
  // ==========================================

  async function loadReports(overrideFromDate?: string, overrideToDate?: string) {
    const startDate = overrideFromDate ?? fromDate;
    const endDate = overrideToDate ?? toDate;

    if (!startDate || !endDate) {
      alert(
        "Please select From Date and To Date."
      );
      return;
    }

    if (startDate > endDate) {
      alert(
        "From Date cannot be after To Date."
      );
      return;
    }

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
        productResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(`
            id,
            customer_id,
            sale_date,
            total_amount,
            paid_amount,
            balance_amount
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
            amount
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

        supabase
          .from("products")
          .select(`
            id,
            purchase_rate
          `),
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
        customerResult.error ||
        productResult.error;

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

      const allProducts =
        (productResult.data ||
          []) as Product[];

      // ========================================
      // FILTER DATE RANGE
      // ========================================

      const filteredSales =
        allSales.filter((row) =>
          isDateInRange(
            row.sale_date,
            startDate,
            endDate
          )
        );

      const filteredPurchases =
        allPurchases.filter((row) =>
          isDateInRange(
            row.purchase_date,
            startDate,
            endDate
          )
        );

      const filteredCollections =
        allCollections.filter((row) =>
          isDateInRange(
            row.collection_date,
            startDate,
            endDate
          )
        );

      const filteredExpenses =
        allExpenses.filter((row) =>
          isDateInRange(
            row.expense_date,
            startDate,
            endDate
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

      setProducts(allProducts);

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
  // PRODUCT COST MAP / FALLBACK
  // ==========================================

  const productCostMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          String(product.id),
          Number(product.purchase_rate) || 0,
        ])
      ),
    [products]
  );

  function getEffectiveCostRate(item: SaleItem) {
    const savedCost = Number(item.cost_rate);

    // Prefer the historical cost saved on the sale item.
    if (Number.isFinite(savedCost) && savedCost > 0) {
      return savedCost;
    }

    // Legacy sale items may have cost_rate = 0/null.
    // Fall back to the product's current purchase rate so
    // profit is not falsely shown as 100% margin.
    return productCostMap.get(String(item.product_id)) || 0;
  }

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
              getEffectiveCostRate(item);

            return (
              sum +
              quantity *
                costRate
            );
          },
          0
        ),
      [saleItems, productCostMap]
    );

  const missingCostItems = useMemo(
    () =>
      saleItems.filter((item) => {
        const savedCost = Number(item.cost_rate);
        const productCost =
          productCostMap.get(String(item.product_id)) || 0;
        return (!Number.isFinite(savedCost) || savedCost <= 0) && productCost <= 0;
      }).length,
    [saleItems, productCostMap]
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
            getEffectiveCostRate(item);

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
      productCostMap,
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
    const todayDate = getLocalISODate();
    const display = formatDateDDMMYYYY(todayDate);

    setFromDate(todayDate);
    setToDate(todayDate);
    setFromDateInput(display);
    setToDateInput(display);

    void loadReports(todayDate, todayDate);
  }

  // ==========================================
  // LOAD THIS MONTH
  // ==========================================

  function loadThisMonth() {
    const now = new Date();
    const first = getLocalISODate(
      new Date(now.getFullYear(), now.getMonth(), 1)
    );
    const last = getLocalISODate(now);

    setFromDate(first);
    setToDate(last);
    setFromDateInput(formatDateDDMMYYYY(first));
    setToDateInput(formatDateDDMMYYYY(last));

    void loadReports(first, last);
  }

  function handleFromDateInput(value: string) {
    const formatted = value.replace(/[^0-9]/g, "").slice(0, 8);
    let display = formatted;
    if (formatted.length > 4) {
      display = `${formatted.slice(0,2)}/${formatted.slice(2,4)}/${formatted.slice(4)}`;
    } else if (formatted.length > 2) {
      display = `${formatted.slice(0,2)}/${formatted.slice(2)}`;
    }
    setFromDateInput(display);
    const parsed = parseDDMMYYYY(display);
    if (parsed) setFromDate(parsed);
  }

  function handleToDateInput(value: string) {
    const formatted = value.replace(/[^0-9]/g, "").slice(0, 8);
    let display = formatted;
    if (formatted.length > 4) {
      display = `${formatted.slice(0,2)}/${formatted.slice(2,4)}/${formatted.slice(4)}`;
    } else if (formatted.length > 2) {
      display = `${formatted.slice(0,2)}/${formatted.slice(2)}`;
    }
    setToDateInput(display);
    const parsed = parseDDMMYYYY(display);
    if (parsed) setToDate(parsed);
  }

  function applyFromCalendar(value: string) {
    if (!value) return;
    setFromDate(value);
    setFromDateInput(formatDateDDMMYYYY(value));
  }

  function applyToCalendar(value: string) {
    if (!value) return;
    setToDate(value);
    setToDateInput(formatDateDDMMYYYY(value));
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
            onClick={() => {
              void loadReports();
            }}
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

            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                value={fromDateInput}
                onChange={(e) => handleFromDateInput(e.target.value)}
                placeholder="DD/MM/YYYY"
                maxLength={10}
                className="w-full rounded-lg border border-slate-300 p-3 pr-12"
              />
              <label className="absolute right-3 cursor-pointer text-slate-500 hover:text-blue-600" title="Choose date">
                <span className="text-xl">📅</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => applyFromCalendar(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Choose From Date"
                />
              </label>
            </div>

          </div>

          <div>

            <label className="mb-2 block font-semibold text-slate-700">
              To Date
            </label>

            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                value={toDateInput}
                onChange={(e) => handleToDateInput(e.target.value)}
                placeholder="DD/MM/YYYY"
                maxLength={10}
                className="w-full rounded-lg border border-slate-300 p-3 pr-12"
              />
              <label className="absolute right-3 cursor-pointer text-slate-500 hover:text-blue-600" title="Choose date">
                <span className="text-xl">📅</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => applyToCalendar(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Choose To Date"
                />
              </label>
            </div>

          </div>

          <div className="flex items-end">

            <button
              onClick={() => {
                const parsedFrom = parseDDMMYYYY(fromDateInput);
                const parsedTo = parseDDMMYYYY(toDateInput);
                if (!parsedFrom || !parsedTo) {
                  alert("Please enter valid dates in DD/MM/YYYY format.");
                  return;
                }
                setFromDate(parsedFrom);
                setToDate(parsedTo);
                void loadReports(parsedFrom, parsedTo);
              }}
              disabled={loading}
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

        {missingCostItems > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 shadow-lg">
            <p className="font-bold">Cost data missing for {missingCostItems} sold item(s).</p>
            <p className="mt-1 text-sm">Profit for those items cannot be exact until a purchase cost is available.</p>
          </div>
        )}

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
            Pending sales balance
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
          Sales − saved product
          cost (`cost_rate`).

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
                        {formatDateDDMMYYYY(
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
                        {formatDateDDMMYYYY(
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
                        {formatDateDDMMYYYY(
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
                        {formatDateDDMMYYYY(
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
            {formatDateDDMMYYYY(
              fromDate
            )}
          </strong>

          {" "}to{" "}

          <strong>
            {formatDateDDMMYYYY(
              toDate
            )}
          </strong>

        </div>

      )}

    </div>
  );
}