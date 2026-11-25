import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Sale = {
  id: string;
  customer_id: string | null;
  sale_date: string | null;
  payment_method: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
  cash_amount?: number | string | null;
  upi_amount?: number | string | null;
};

type DailyClosing = {
  id?: string;
  closing_date: string | null;
  opening_cash: number | string | null;
  cash_sales: number | string | null;
  upi_sales: number | string | null;
  credit_sales: number | string | null;
  collections: number | string | null;
  expenses: number | string | null;
  closing_cash: number | string | null;
};

type Collection = {
  id: string;
  customer_id: string | null;
  collection_date: string | null;
  amount: number | string | null;
  payment_method: string | null;
};

type Expense = {
  id: string;
  expense_date: string | null;
  amount: number | string | null;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number | string | null;
  cost_rate: number | string | null;
  amount: number | string | null;
};

type Product = {
  id: string;
  product_name: string;
  purchase_rate: number | string | null;
  stock_qty: number | string | null;
};

type Customer = {
  id: string;
  customer_name: string;
  route: string | null;
  opening_balance: number | string | null;
};

type Purchase = {
  id: string;
  supplier_name: string | null;
  purchase_date: string | null;
  invoice_no: string | null;
  payment_method: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
};

type Supplier = {
  id: string;
  supplier_name: string | null;
  opening_balance: number | string | null;
};

type SupplierPayment = {
  id: string;
  supplier_id: string;
  payment_date: string | null;
  amount: number | string | null;
};

function getLocalDateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDDMMYYYY(value: string | null | undefined) {
  if (!value) return "-";

  const datePart = String(value).slice(0, 10);
  const parts = datePart.split("-");

  if (parts.length === 3 && /^\d{4}$/.test(parts[0])) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return String(value);
}

function money(value: number) {
  return `₹ ${Number(value || 0).toFixed(2)}`;
}

function numberValue(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function isToday(
  value: string | null | undefined,
  today: string
) {
  return !!value && String(value).slice(0, 10) === today;
}

type DashboardProps = {
  employeeOnly?: boolean;
};

export default function Dashboard({ employeeOnly = false }: DashboardProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [dailyClosings, setDailyClosings] = useState<DailyClosing[]>([]);

  const today = getLocalDateISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const [routeFilter, setRouteFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage("");

    try {
      /*
       * Load each area separately.
       *
       * This keeps Dashboard usable even when one optional
       * query has a schema/RLS problem.
       */
      const [
        salesResult,
        collectionsResult,
        expensesResult,
        itemsResult,
        productsResult,
        customersResult,
        purchasesResult,
        suppliersResult,
        supplierPaymentsResult,
        dailyClosingsResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, customer_id, sale_date, payment_method, total_amount, paid_amount, balance_amount, cash_amount, upi_amount"
          )
          .order("sale_date", { ascending: false }),

        supabase
          .from("collections")
          .select(
            "id, customer_id, collection_date, amount, payment_method"
          )
          .order("collection_date", { ascending: false }),

        supabase
          .from("expenses")
          .select("id, expense_date, amount")
          .order("expense_date", { ascending: false }),

        supabase
          .from("sale_items")
          .select(
            "id, sale_id, product_id, quantity, cost_rate, amount"
          ),

        supabase
          .from("products")
          .select(
            "id, product_name, purchase_rate, stock_qty"
          )
          .order("product_name"),

        supabase
          .from("customers")
          .select(
            "id, customer_name, route, opening_balance"
          )
          .order("customer_name"),

        supabase
          .from("purchases")
          .select(
            "id, supplier_name, purchase_date, invoice_no, payment_method, total_amount, paid_amount, balance_amount"
          )
          .order("purchase_date", { ascending: false }),

        supabase
          .from("suppliers")
          .select(
            "id, supplier_name, opening_balance"
          )
          .order("supplier_name"),

        supabase
          .from("supplier_payments")
          .select("id, supplier_id, payment_date, amount")
          .order("payment_date", { ascending: false }),

        supabase
          .from("daily_closings")
          .select(
            "id, closing_date, opening_cash, cash_sales, upi_sales, credit_sales, collections, expenses, closing_cash"
          )
          .order("closing_date", { ascending: false }),
      ]);

      const errors = [
        salesResult.error,
        collectionsResult.error,
        expensesResult.error,
        itemsResult.error,
        productsResult.error,
        customersResult.error,
        purchasesResult.error,
        suppliersResult.error,
        supplierPaymentsResult.error,
        dailyClosingsResult.error,
      ].filter(Boolean);

      /*
       * Core dashboard data remains visible when possible.
       * Any query errors are shown in one compact warning.
       */
      setSales(
        errors.includes(salesResult.error)
          ? []
          : ((salesResult.data || []) as Sale[])
      );

      setCollections(
        errors.includes(collectionsResult.error)
          ? []
          : ((collectionsResult.data || []) as Collection[])
      );

      setExpenses(
        errors.includes(expensesResult.error)
          ? []
          : ((expensesResult.data || []) as Expense[])
      );

      setSaleItems(
        errors.includes(itemsResult.error)
          ? []
          : ((itemsResult.data || []) as SaleItem[])
      );

      setProducts(
        errors.includes(productsResult.error)
          ? []
          : ((productsResult.data || []) as Product[])
      );

      setCustomers(
        errors.includes(customersResult.error)
          ? []
          : ((customersResult.data || []) as Customer[])
      );

      setPurchases(
        errors.includes(purchasesResult.error)
          ? []
          : ((purchasesResult.data || []) as Purchase[])
      );

      setSuppliers(
        errors.includes(suppliersResult.error)
          ? []
          : ((suppliersResult.data || []) as Supplier[])
      );

      setSupplierPayments(
        errors.includes(supplierPaymentsResult.error)
          ? []
          : ((supplierPaymentsResult.data || []) as SupplierPayment[])
      );

      setDailyClosings(
        errors.includes(dailyClosingsResult.error)
          ? []
          : ((dailyClosingsResult.data || []) as DailyClosing[])
      );

      if (errors.length > 0) {
        const messages = errors
          .map((error: any) => error?.message)
          .filter(Boolean);

        setErrorMessage(
          messages.length
            ? messages.join(" • ")
            : "Some dashboard data could not be loaded."
        );
      }

      setLastUpdated(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (error: any) {
      console.error(
        "Dashboard load error:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const todaySales = useMemo(
    () =>
      sales.filter((row) =>
        isToday(row.sale_date, selectedDate)
      ),
    [sales, selectedDate]
  );

  const todayCollections = useMemo(
    () =>
      collections.filter((row) =>
        isToday(
          row.collection_date,
          selectedDate
        )
      ),
    [collections, selectedDate]
  );

  const todayExpenses = useMemo(
    () =>
      expenses.filter((row) =>
        isToday(
          row.expense_date,
          selectedDate
        )
      ),
    [expenses, selectedDate]
  );

  const todayPurchases = useMemo(
    () =>
      purchases.filter((row) =>
        isToday(
          row.purchase_date,
          selectedDate
        )
      ),
    [purchases, selectedDate]
  );

  const totalSales = useMemo(
    () =>
      todaySales.reduce(
        (sum, row) =>
          sum +
          numberValue(row.total_amount),
        0
      ),
    [todaySales]
  );

  const cashSales = useMemo(
    () =>
      todaySales.reduce((sum, row) => {
        const method = String(
          row.payment_method || ""
        )
          .trim()
          .toLowerCase();

        const paid = numberValue(
          row.paid_amount
        );

        /*
         * Older records can have paid_amount = 0
         * while balance_amount contains the outstanding.
         */
        const effectivePaid =
          paid > 0
            ? paid
            : Math.max(
                numberValue(row.total_amount) -
                  numberValue(row.balance_amount),
                0
              );

        if (method === "split") {
          return sum + numberValue(row.cash_amount);
        }

        return method === "cash"
          ? sum + effectivePaid
          : sum;
      }, 0),
    [todaySales]
  );

  const upiSales = useMemo(
    () =>
      todaySales.reduce((sum, row) => {
        const method = String(
          row.payment_method || ""
        )
          .trim()
          .toLowerCase();

        const paid = numberValue(
          row.paid_amount
        );

        const effectivePaid =
          paid > 0
            ? paid
            : Math.max(
                numberValue(row.total_amount) -
                  numberValue(row.balance_amount),
                0
              );

        if (method === "split") {
          return sum + numberValue(row.upi_amount);
        }

        return method === "upi"
          ? sum + effectivePaid
          : sum;
      }, 0),
    [todaySales]
  );

  const creditOutstandingToday = useMemo(
    () =>
      todaySales.reduce((sum, row) => {
        const method = String(
          row.payment_method || ""
        )
          .trim()
          .toLowerCase();

        return method === "credit"
          ? sum + numberValue(row.balance_amount)
          : sum;
      }, 0),
    [todaySales]
  );

  const totalCollections = useMemo(
    () =>
      todayCollections.reduce(
        (sum, row) =>
          sum + numberValue(row.amount),
        0
      ),
    [todayCollections]
  );

  const cashCollections = useMemo(
    () =>
      todayCollections.reduce(
        (sum, row) => {
          const method = String(
            row.payment_method || "cash"
          )
            .trim()
            .toLowerCase();

          return method === "cash"
            ? sum + numberValue(row.amount)
            : sum;
        },
        0
      ),
    [todayCollections]
  );

  const nonCashCollections =
    Math.max(
      totalCollections -
        cashCollections,
      0
    );

  const totalExpenses = useMemo(
    () =>
      todayExpenses.reduce(
        (sum, row) =>
          sum + numberValue(row.amount),
        0
      ),
    [todayExpenses]
  );

  const totalPurchases = useMemo(
    () =>
      todayPurchases.reduce(
        (sum, row) =>
          sum +
          numberValue(row.total_amount),
        0
      ),
    [todayPurchases]
  );

  const cashPurchasePayments = useMemo(
    () =>
      todayPurchases.reduce(
        (sum, row) => {
          const method = String(
            row.payment_method || ""
          )
            .trim()
            .toLowerCase();

          return method === "cash"
            ? sum +
                numberValue(
                  row.paid_amount
                )
            : sum;
        },
        0
      ),
    [todayPurchases]
  );

  const outstandingBalance = useMemo(() => {
    const openingByCustomer =
      new Map(
        customers.map((customer) => [
          String(customer.id),
          Math.max(
            numberValue(
              customer.opening_balance
            ),
            0
          ),
        ])
      );

    const salesBalanceByCustomer =
      new Map<string, number>();

    sales.forEach((row) => {
      if (!row.customer_id) {
        return;
      }

      const key = String(
        row.customer_id
      );

      salesBalanceByCustomer.set(
        key,
        (salesBalanceByCustomer.get(
          key
        ) || 0) +
          Math.max(
            numberValue(
              row.balance_amount
            ),
            0
          )
      );
    });

    const customerIds =
      new Set<string>([
        ...openingByCustomer.keys(),
        ...salesBalanceByCustomer.keys(),
      ]);

    let total = 0;

    customerIds.forEach((id) => {
      total +=
        (openingByCustomer.get(id) || 0) +
        (salesBalanceByCustomer.get(id) || 0);
    });

    return total;
  }, [sales, customers]);

  const supplierOutstanding = useMemo(() => {
    // Supplier balance follows the MANVI ERP supplier ledger model:
    // Opening balance + all milk purchases - actual supplier payments.
    // Purchase-level paid_amount/balance_amount are NOT used here because
    // actual payments are recorded in supplier_payments. This prevents the
    // same payment from being counted twice.
    const paymentsBySupplier = new Map<string, number>();

    supplierPayments.forEach((payment) => {
      const supplierId = String(payment.supplier_id || "");
      if (!supplierId) return;

      paymentsBySupplier.set(
        supplierId,
        (paymentsBySupplier.get(supplierId) || 0) +
          numberValue(payment.amount)
      );
    });

    const purchasesBySupplier = new Map<string, number>();

    purchases.forEach((purchase) => {
      const name = String(purchase.supplier_name || "")
        .trim()
        .toLowerCase();
      if (!name) return;

      purchasesBySupplier.set(
        name,
        (purchasesBySupplier.get(name) || 0) +
          numberValue(purchase.total_amount)
      );
    });

    return suppliers.reduce((sum, supplier) => {
      const name = String(supplier.supplier_name || "")
        .trim()
        .toLowerCase();

      const opening = numberValue(supplier.opening_balance);
      const purchaseTotal = purchasesBySupplier.get(name) || 0;
      const paymentsTotal = paymentsBySupplier.get(String(supplier.id)) || 0;

      return sum + opening + purchaseTotal - paymentsTotal;
    }, 0);
  }, [purchases, suppliers, supplierPayments]);

  const supplierOutstandingLabel =
    supplierOutstanding > 0.005
      ? `Payable ${money(supplierOutstanding)}`
      : supplierOutstanding < -0.005
      ? `Credit ${money(Math.abs(supplierOutstanding))}`
      : "Settled ₹ 0.00";

  const productCostMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          String(product.id),
          numberValue(
            product.purchase_rate
          ),
        ])
      ),
    [products]
  );

  const saleMap = useMemo(
    () =>
      new Map(
        sales.map((sale) => [
          String(sale.id),
          sale,
        ])
      ),
    [sales]
  );

  const lowStockProducts =
    useMemo(
      () =>
        products
          .filter(
            (product) =>
              numberValue(
                product.stock_qty
              ) <= 0
          )
          .slice(0, 5),
      [products]
    );

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

  const recentSales =
    todaySales.slice(0, 6);

  const recentCollections =
    todayCollections.slice(0, 6);

  const recentPurchases =
    todayPurchases.slice(0, 6);

  /*
   * DAILY ROUTE COMPLETION
   * A route customer is counted as entered when at least one sale
   * exists for that customer on the selected dashboard date.
   * Collections are counted from the collections table only; sale
   * payments remain part of the sale entry and are not duplicated.
   * Current outstanding follows the same opening + unpaid-sales
   * calculation used elsewhere in this dashboard.
   */
  const routeOptions = useMemo(() => {
    const routes = new Set<string>();

    customers.forEach((customer) => {
      const route = String(customer.route || "").trim();
      if (route) routes.add(route);
    });

    return Array.from(routes).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [customers]);

  const routeOverviewRows = useMemo(() => {
    const dailySalesByCustomer = new Map<
      string,
      { count: number; amount: number }
    >();

    todaySales.forEach((sale) => {
      if (!sale.customer_id) return;
      const customerId = String(sale.customer_id);
      const current = dailySalesByCustomer.get(customerId) || {
        count: 0,
        amount: 0,
      };
      current.count += 1;
      current.amount += numberValue(sale.total_amount);
      dailySalesByCustomer.set(customerId, current);
    });

    const dailyCollectionsByCustomer = new Map<
      string,
      { count: number; amount: number }
    >();

    todayCollections.forEach((collection) => {
      if (!collection.customer_id) return;
      const customerId = String(collection.customer_id);
      const current = dailyCollectionsByCustomer.get(customerId) || {
        count: 0,
        amount: 0,
      };
      current.count += 1;
      current.amount += numberValue(collection.amount);
      dailyCollectionsByCustomer.set(customerId, current);
    });

    const allSalesBalanceByCustomer = new Map<string, number>();
    sales.forEach((sale) => {
      if (!sale.customer_id) return;
      const customerId = String(sale.customer_id);
      allSalesBalanceByCustomer.set(
        customerId,
        (allSalesBalanceByCustomer.get(customerId) || 0) +
          Math.max(numberValue(sale.balance_amount), 0)
      );
    });

    return customers
      .filter((customer) => String(customer.route || "").trim())
      .filter((customer) =>
        routeFilter === "ALL"
          ? true
          : String(customer.route || "").trim().toLowerCase() ===
            routeFilter.trim().toLowerCase()
      )
      .map((customer) => {
        const customerId = String(customer.id);
        const dailySale = dailySalesByCustomer.get(customerId);
        const dailyCollection = dailyCollectionsByCustomer.get(customerId);
        const outstanding =
          numberValue(customer.opening_balance) +
          (allSalesBalanceByCustomer.get(customerId) || 0);

        return {
          id: customer.id,
          customer_name: customer.customer_name,
          route: String(customer.route || "").trim(),
          saleCount: dailySale?.count || 0,
          saleAmount: dailySale?.amount || 0,
          collectionCount: dailyCollection?.count || 0,
          collectionAmount: dailyCollection?.amount || 0,
          outstanding,
        };
      })
      .sort((a, b) =>
        a.route.localeCompare(b.route, undefined, {
          numeric: true,
          sensitivity: "base",
        }) || a.customer_name.localeCompare(b.customer_name)
      );
  }, [customers, todaySales, todayCollections, sales, routeFilter]);

  const routeSaleEnteredCount = routeOverviewRows.filter(
    (row) => row.saleCount > 0
  ).length;
  const routeSaleMissingCount = Math.max(
    routeOverviewRows.length - routeSaleEnteredCount,
    0
  );
  const routeCollectionCustomerCount = routeOverviewRows.filter(
    (row) => row.collectionAmount > 0
  ).length;
  const routePendingCustomerCount = routeOverviewRows.filter(
    (row) => row.outstanding > 0.005
  ).length;
  const routePendingAmount = routeOverviewRows.reduce(
    (sum, row) => sum + Math.max(row.outstanding, 0),
    0
  );

  /*
   * Physical cash view for the current day.
   * Opening cash from previous saved closing is not loaded here,
   * so this card deliberately shows the movement components only.
   */
  const todayCashMovement =
    cashSales +
    cashCollections -
    cashPurchasePayments -
    totalExpenses;

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-slate-50 px-3 pt-3 pb-28 sm:px-4 sm:pt-4 md:p-6 md:pb-6">
      {/* HEADER */}
      <div className="mb-4 w-full min-w-0 max-w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-4 sm:p-5 md:mb-6 md:p-6 text-white shadow-lg">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-100">
              MANVI MILK AGENCIES
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-blue-100">
              Business control for{" "}
              {formatDDMMYYYY(selectedDate)}
            </p>

            {lastUpdated && (
              <p className="mt-1 text-xs text-blue-100">
                Updated at {lastUpdated}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-3 text-center font-bold text-blue-700 shadow hover:bg-blue-50 disabled:opacity-60 md:w-auto md:px-5"
          >
            {loading
              ? "Loading..."
              : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* DATE SELECTOR */}
      <div className="mb-5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-700">Dashboard Date</p>
            <p className="text-xs text-slate-500">
              View the complete dashboard for any business date.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 md:flex md:items-center">
            <button
              type="button"
              onClick={() => {
                const d = new Date(`${selectedDate}T12:00:00`);
                d.setDate(d.getDate() - 1);
                setSelectedDate(getLocalDateISO(d));
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-700 hover:bg-slate-50"
            >
              ← Previous
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className={`rounded-xl px-3 py-2 font-bold ${
                selectedDate === today
                  ? "bg-blue-600 text-white"
                  : "border border-blue-200 bg-blue-50 text-blue-700"
              }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => {
                const d = new Date(`${selectedDate}T12:00:00`);
                d.setDate(d.getDate() + 1);
                setSelectedDate(getLocalDateISO(d));
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-700 hover:bg-slate-50"
            >
              Next →
            </button>
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 outline-none focus:border-blue-500 md:w-auto"
          />
        </div>

        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-center text-sm font-bold text-blue-800">
          Showing: {formatDDMMYYYY(selectedDate)}
          {selectedDate === today ? " • Today" : ""}
        </div>
      </div>

      {!employeeOnly && (
        <>
          {/* DAILY CLOSING */}
      {(() => {
        const closing = dailyClosings.find(
          (row) => String(row.closing_date || "").slice(0, 10) === selectedDate
        );

        const opening =
          closing ? numberValue(closing.opening_cash) : 0;

        const savedClosing =
          closing ? numberValue(closing.closing_cash) : null;

        return (
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
            <SmallCard
              title="Opening Cash"
              value={money(opening)}
            />
            <SmallCard
              title="Cash Sales"
              value={money(cashSales)}
            />
            <SmallCard
              title="Collections"
              value={money(totalCollections)}
            />
            <SmallCard
              title="Closing Cash"
              value={
                savedClosing === null
                  ? "Not Saved"
                  : money(savedClosing)
              }
              footer={
                savedClosing === null
                  ? "No saved daily closing for this date"
                  : "Saved Daily Closing"
              }
            />
          </div>
        );
      })()}

        </>

      )}

      {/* DATA WARNING */}
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-800">
          <p>
            Some dashboard data could not be loaded.
          </p>

          <p className="mt-1 break-words font-normal">
            {errorMessage}
          </p>
        </div>
      )}

      {/* PRIMARY CARDS */}
      {employeeOnly ? (
        <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title={selectedDate === today ? "Today's Sales" : "Selected Date Sales"}
            value={money(totalSales)}
            subtitle={`${todaySales.length} sale entries`}
          />
          <MetricCard
            title={selectedDate === today ? "Today's Collections" : "Selected Date Collections"}
            value={money(totalCollections)}
            subtitle={`${todayCollections.length} collection entries`}
          />
          <MetricCard
            title="Customer Outstanding"
            value={money(outstandingBalance)}
            subtitle="Current pending customer balance"
          />
        </div>
      ) : (
        <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          <MetricCard title={selectedDate === today ? "Today's Sales" : "Selected Date Sales"} value={money(totalSales)} subtitle={`${todaySales.length} sale entries`} />
          <MetricCard title={selectedDate === today ? "Today's Purchase" : "Selected Date Purchase"} value={money(totalPurchases)} subtitle={`${todayPurchases.length} purchase entries`} />
          <MetricCard title={selectedDate === today ? "Today's Collections" : "Selected Date Collections"} value={money(totalCollections)} subtitle={`${todayCollections.length} collection entries`} />
          <MetricCard title="Customer Outstanding" value={money(outstandingBalance)} subtitle="Current pending customer balance" />
        </div>
      )}

      {/* DAILY ROUTE COMPLETION & CUSTOMER FOLLOW-UP */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Daily Route Completion
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Check which route customers have a sale entry, who is missing,
              and which customers have a collection recorded for {formatDDMMYYYY(selectedDate)}.
            </p>
          </div>

          <div className="w-full sm:w-56">
            <label htmlFor="dashboard-route-filter" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Filter Route
            </label>
            <select
              id="dashboard-route-filter"
              value={routeFilter}
              onChange={(event) => setRouteFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="ALL">All Routes</option>
              {routeOptions.map((route) => (
                <option key={route} value={route}>{route}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <SmallCard title="Route Customers" value={String(routeOverviewRows.length)} />
          <SmallCard title="Sale Entered" value={String(routeSaleEnteredCount)} footer="At least one sale on selected date" />
          <SmallCard title="Sale Missing" value={String(routeSaleMissingCount)} footer="No sale entry on selected date" />
          <SmallCard title="Collection Recorded" value={String(routeCollectionCustomerCount)} footer="Customer has collection entry" />
          <SmallCard title="Customers with Due" value={`${routePendingCustomerCount} • ${money(routePendingAmount)}`} footer="Current outstanding from customer ledger" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">Sale Entered</span>
          <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">Sale Missing</span>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">Collection Recorded</span>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">No Collection Entry</span>
        </div>

        {/* MOBILE ROUTE CARDS */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:hidden">
          {routeOverviewRows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              {routeOptions.length === 0
                ? "No customer routes are configured yet. Add a route in Customers to see daily route completion."
                : "No customers found for this route."}
            </div>
          ) : (
            routeOverviewRows.map((row) => (
              <article key={row.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-bold uppercase tracking-wide text-slate-500">{row.route}</p>
                    <h3 className="mt-1 break-words text-base font-bold text-slate-800">{row.customer_name}</h3>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    row.saleCount > 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}>
                    {row.saleCount > 0 ? `Entered (${row.saleCount})` : "Missing"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="min-w-0 rounded-lg bg-slate-50 p-2.5">
                    <p className="text-xs font-semibold text-slate-500">Sale Amount</p>
                    <p className="mt-1 break-words text-sm font-bold text-slate-800">{money(row.saleAmount)}</p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-slate-50 p-2.5">
                    <p className="text-xs font-semibold text-slate-500">Collected</p>
                    <p className="mt-1 break-words text-sm font-bold text-blue-700">{money(row.collectionAmount)}</p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-slate-50 p-2.5">
                    <p className="text-xs font-semibold text-slate-500">Collection Status</p>
                    <p className={`mt-1 break-words text-sm font-bold ${
                      row.collectionCount > 0 ? "text-blue-700" : "text-amber-700"
                    }`}>
                      {row.collectionCount > 0 ? `Recorded (${row.collectionCount})` : "No entry"}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-slate-50 p-2.5">
                    <p className="text-xs font-semibold text-slate-500">Current Outstanding</p>
                    <p className="mt-1 break-words text-sm font-bold text-slate-800">
                      {row.outstanding < -0.005
                        ? `Credit ${money(Math.abs(row.outstanding))}`
                        : money(Math.max(row.outstanding, 0))}
                    </p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {/* DESKTOP ROUTE TABLE */}
        <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-slate-800 text-left text-white">
                <th className="p-3">Route</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Daily Sale</th>
                <th className="p-3 text-right">Sale Amount</th>
                <th className="p-3">Collection</th>
                <th className="p-3 text-right">Collected</th>
                <th className="p-3 text-right">Current Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {routeOverviewRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    {routeOptions.length === 0
                      ? "No customer routes are configured yet. Add a route in Customers to see daily route completion."
                      : "No customers found for this route."}
                  </td>
                </tr>
              ) : (
                routeOverviewRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 even:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-600">{row.route}</td>
                    <td className="p-3 font-semibold text-slate-800">{row.customer_name}</td>
                    <td className="p-3">
                      {row.saleCount > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Entered ({row.saleCount})</span>
                      ) : (
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">Missing</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-700">{money(row.saleAmount)}</td>
                    <td className="p-3">
                      {row.collectionCount > 0 ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">Recorded ({row.collectionCount})</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">No entry</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-semibold text-blue-700">{money(row.collectionAmount)}</td>
                    <td className="p-3 text-right font-bold text-slate-800">
                      {row.outstanding < -0.005
                        ? `Credit ${money(Math.abs(row.outstanding))}`
                        : money(Math.max(row.outstanding, 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/sales" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
            Open Sales
          </Link>
          <Link to="/collections" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100">
            Open Collections
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Note: “Sale Missing” means no sales record exists for that customer on the selected date. “No entry” means no record exists in the Collections table for that date. Current outstanding is the customer ledger balance, not just the selected day’s sale.
        </p>
      </section>

      {!employeeOnly && (
        <>
          {/* MASTER COUNTS */}
      <div className="mt-3 grid w-full min-w-0 max-w-full grid-cols-2 gap-2.5 sm:gap-3 md:mt-4 md:grid-cols-4">
        <SmallCard
          title="Customers"
          value={String(
            customers.length
          )}
        />

        <SmallCard
          title="Suppliers"
          value={String(
            suppliers.length
          )}
        />

        <SmallCard
          title="Products"
          value={String(
            products.length
          )}
        />

        <SmallCard
          title="Supplier Outstanding"
          value={supplierOutstandingLabel}
        />
      </div>

        </>
      )}

      {!employeeOnly && (
        <>
          {/* PAYMENT CARDS */}
      <div className="mt-3 grid w-full min-w-0 max-w-full grid-cols-2 gap-2.5 sm:gap-3 md:mt-4 md:grid-cols-2 xl:grid-cols-4">
        <SmallCard
          title="Cash Sales"
          value={money(cashSales)}
        />

        <SmallCard
          title="UPI Sales"
          value={money(upiSales)}
        />

        <SmallCard
          title="Credit Outstanding Today"
          value={money(
            creditOutstandingToday
          )}
        />

        <SmallCard
          title="Cash Collections"
          value={money(
            cashCollections
          )}
          footer={`Non-cash: ${money(
            nonCashCollections
          )}`}
        />
      </div>

        </>

      )}

      {!employeeOnly && (
        <>
          {/* CASH MOVEMENT */}
      <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              Physical Cash Movement
            </p>

            <p className="mt-1 text-xs text-slate-600">
              Cash Sales + Cash Collections − Cash Purchase Payments − Expenses
            </p>
          </div>

          <p className="text-3xl font-bold text-blue-800">
            {money(todayCashMovement)}
          </p>
        </div>
      </div>

        </>

      )}

      {/* QUICK ACTIONS */}
      {employeeOnly ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <QuickAction to="/sales" label="+ New Sale" />
          <QuickAction to="/collections" label="+ Collection" />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <QuickAction to="/sales" label="+ New Sale" />
          <QuickAction to="/purchases" label="+ Purchase" />
          <QuickAction to="/collections" label="+ Collection" />
          <QuickAction to="/expenses" label="+ Expense" />
        </div>
      )}

      {/* TODAY SALES / PURCHASES */}
      <div className="mt-5 grid w-full min-w-0 max-w-full grid-cols-1 gap-4 md:mt-6 md:gap-6 xl:grid-cols-2">
        <div className="min-w-0 w-full max-w-full rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {selectedDate === today ? "Today's Sales" : "Selected Date Sales"}
              </h2>

              <p className="text-sm text-slate-500">
                {formatDDMMYYYY(selectedDate)}
              </p>
            </div>

            <Link
              to="/sales"
              className="font-semibold text-blue-600 hover:text-blue-800"
            >
              View Sales
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px]">
              <thead>
                <tr className="border-b bg-blue-600 text-left text-white">
                  <th className="p-3">
                    Date
                  </th>

                  <th className="p-3">
                    Customer
                  </th>

                  <th className="p-3">
                    Payment
                  </th>

                  <th className="p-3 text-right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentSales.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-slate-500"
                    >
                      No sales today.
                    </td>
                  </tr>
                ) : (
                  recentSales.map(
                    (sale) => (
                      <tr
                        key={sale.id}
                        className="border-b"
                      >
                        <td className="p-3">
                          {formatDDMMYYYY(
                            sale.sale_date
                          )}
                        </td>

                        <td className="p-3 font-semibold">
                          {customerMap.get(
                            String(
                              sale.customer_id
                            )
                          ) ||
                            "Walk-in"}
                        </td>

                        <td className="p-3">
                          {sale.payment_method ||
                            "Cash"}
                        </td>

                        <td className="p-3 text-right font-bold">
                          {money(
                            numberValue(
                              sale.total_amount
                            )
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

        {!employeeOnly && (
        <div className="min-w-0 w-full max-w-full rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {selectedDate === today ? "Today's Purchases" : "Selected Date Purchases"}
              </h2>

              <p className="text-sm text-slate-500">
                {formatDDMMYYYY(selectedDate)}
              </p>
            </div>

            <Link
              to="/purchases"
              className="font-semibold text-blue-600 hover:text-blue-800"
            >
              View Purchases
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b bg-purple-600 text-left text-white">
                  <th className="p-3">
                    Date
                  </th>

                  <th className="p-3">
                    Supplier
                  </th>

                  <th className="p-3">
                    Invoice
                  </th>

                  <th className="p-3 text-right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentPurchases.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-slate-500"
                    >
                      No purchases today.
                    </td>
                  </tr>
                ) : (
                  recentPurchases.map(
                    (purchase) => (
                      <tr
                        key={purchase.id}
                        className="border-b"
                      >
                        <td className="p-3">
                          {formatDDMMYYYY(
                            purchase.purchase_date
                          )}
                        </td>

                        <td className="p-3 font-semibold">
                          {purchase.supplier_name ||
                            "Supplier"}
                        </td>

                        <td className="p-3">
                          {purchase.invoice_no ||
                            "-"}
                        </td>

                        <td className="p-3 text-right font-bold">
                          {money(
                            numberValue(
                              purchase.total_amount
                            )
                          )}
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>        )}

      </div>

      {/* COLLECTIONS */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {selectedDate === today ? "Today's Collections" : "Selected Date Collections"}
            </h2>

            <p className="text-sm text-slate-500">
              Cash and non-cash receipts
            </p>
          </div>

          <Link
            to="/collections"
            className="font-semibold text-blue-600 hover:text-blue-800"
          >
            View Collections
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="border-b bg-emerald-600 text-left text-white">
                <th className="p-3">
                  Date
                </th>

                <th className="p-3">
                  Customer
                </th>

                <th className="p-3">
                  Payment
                </th>

                <th className="p-3 text-right">
                  Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {recentCollections.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-center text-slate-500"
                  >
                    No collections today.
                  </td>
                </tr>
              ) : (
                recentCollections.map(
                  (collection) => (
                    <tr
                      key={collection.id}
                      className="border-b"
                    >
                      <td className="p-3">
                        {formatDDMMYYYY(
                          collection.collection_date
                        )}
                      </td>

                      <td className="p-3 font-semibold">
                        {customerMap.get(
                          String(
                            collection.customer_id
                          )
                        ) ||
                          "Unknown"}
                      </td>

                      <td className="p-3">
                        {collection.payment_method ||
                          "Cash"}
                      </td>

                      <td className="p-3 text-right font-bold text-emerald-700">
                        {money(
                          numberValue(
                            collection.amount
                          )
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

      {/* STOCK */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Stock Status
            </h2>

            <p className="text-sm text-slate-500">
              Products currently at zero stock
            </p>
          </div>

          <Link
            to="/products"
            className="font-semibold text-blue-600 hover:text-blue-800"
          >
            View Products
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {lowStockProducts.length ===
          0 ? (
            <div className="rounded-xl bg-green-50 p-4 font-semibold text-green-700 md:col-span-2 xl:col-span-5">
              No zero-stock products.
            </div>
          ) : (
            lowStockProducts.map(
              (product) => (
                <div
                  key={product.id}
                  className="rounded-xl border border-red-200 bg-red-50 p-4"
                >
                  <p className="font-bold text-slate-800">
                    {product.product_name}
                  </p>

                  <p className="mt-1 text-sm font-semibold text-red-600">
                    Stock:{" "}
                    {numberValue(
                      product.stock_qty
                    )}
                  </p>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="min-w-0 w-full max-w-full rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4 md:p-5">
      <p className="text-sm font-semibold text-slate-500">
        {title}
      </p>

      <p className="mt-1 break-words text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

function SmallCard({
  title,
  value,
  footer,
}: {
  title: string;
  value: string;
  footer?: string;
}) {
  return (
    <div className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl bg-blue-50 p-3 ring-1 ring-blue-100 sm:p-4 md:p-5">
      <p className="text-sm font-semibold text-slate-500">
        {title}
      </p>

      <p className="mt-1 break-words text-xl font-bold leading-tight text-blue-700 sm:text-2xl">
        {value}
      </p>

      {footer && (
        <p className="mt-1 text-xs text-slate-500">
          {footer}
        </p>
      )}
    </div>
  );
}

function QuickAction({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl bg-blue-600 px-4 py-3 text-center font-bold text-white shadow-sm transition hover:bg-blue-700"
    >
      {label}
    </Link>
  );
}
