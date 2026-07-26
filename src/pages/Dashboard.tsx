import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Sale = {
  id: string | number;
  customer_id?: string | number | null;
  customer_name?: string | null;
  product_id?: string | number | null;
  product_name?: string | null;
  quantity?: number | string | null;
  total?: number | string | null;
  created_at?: string | null;
};

type Collection = {
  id: string | number;
  amount?: number | string | null;
  created_at?: string | null;
};

type Expense = {
  id: string | number;
  amount?: number | string | null;
  expense_name?: string | null;
  created_at?: string | null;
};

type Customer = {
  id: string | number;
  customer_name?: string | null;
  name?: string | null;
};

type Product = {
  id: string | number;
  product_name?: string | null;
  name?: string | null;
  brand?: string | null;
  stock?: number | string | null;
  selling_price?: number | string | null;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const shortId = (value?: string | number | null) => {
  if (!value) return "Walk-in Customer";
  return String(value).slice(0, 8);
};

const isToday = (value?: string | null) => {
  if (!value) return false;

  const date = new Date(value);
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

export default function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [totalSales, setTotalSales] = useState(0);
  const [totalCollections, setTotalCollections] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [profit, setProfit] = useState(0);

  const [salesCount, setSalesCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [productCount, setProductCount] = useState(0);

  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [
        salesResult,
        collectionsResult,
        expensesResult,
        customersResult,
        productsResult,
      ] = await Promise.all([
        supabase.from("sales").select("*"),
        supabase.from("collections").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("customers").select("*"),
        supabase.from("products").select("*"),
      ]);

      const firstError =
        salesResult.error ||
        collectionsResult.error ||
        expensesResult.error ||
        customersResult.error ||
        productsResult.error;

      if (firstError) {
        throw firstError;
      }

      const salesRows = (salesResult.data || []) as Sale[];
      const collectionRows = (collectionsResult.data || []) as Collection[];
      const expenseRows = (expensesResult.data || []) as Expense[];
      const customerRows = (customersResult.data || []) as Customer[];
      const productRows = (productsResult.data || []) as Product[];

      const totalSaleAmount = salesRows.reduce(
        (sum, row) => sum + Number(row.total || 0),
        0,
      );

      const totalCollectionAmount = collectionRows.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
      );

      const totalExpenseAmount = expenseRows.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
      );

      setSales(salesRows);
      setCollections(collectionRows);
      setExpenses(expenseRows);
      setCustomers(customerRows);
      setProducts(productRows);

      setTotalSales(totalSaleAmount);
      setTotalCollections(totalCollectionAmount);
      setTotalExpenses(totalExpenseAmount);
      setProfit(totalSaleAmount - totalExpenseAmount);

      setSalesCount(salesRows.length);
      setCustomerCount(customerRows.length);
      setProductCount(productRows.length);

      setRecentSales(
        [...salesRows]
          .sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime(),
          )
          .slice(0, 8),
      );

      setLowStock(
        productRows
          .filter((item) => Number(item.stock || 0) <= 10)
          .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
          .slice(0, 8),
      );
    } catch (error) {
      console.error("Unable to load dashboard:", error);
      setLoadError("Unable to load dashboard data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const customerMap = useMemo(
    () =>
      new Map(
        customers.map((customer) => [
          String(customer.id),
          customer.customer_name || customer.name || "Customer",
        ]),
      ),
    [customers],
  );

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          String(product.id),
          product.product_name || product.name || "Product",
        ]),
      ),
    [products],
  );

  const todaySales = useMemo(
    () =>
      sales
        .filter((sale) => isToday(sale.created_at))
        .reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    [sales],
  );

  const todayCollections = useMemo(
    () =>
      collections
        .filter((collection) => isToday(collection.created_at))
        .reduce((sum, collection) => sum + Number(collection.amount || 0), 0),
    [collections],
  );

  const todayExpenses = useMemo(
    () =>
      expenses
        .filter((expense) => isToday(expense.created_at))
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses],
  );

  const todayProfit = todaySales - todayExpenses;

  const maxChartValue = Math.max(
    ...recentSales.map((sale) => Number(sale.total || 0)),
    1,
  );

  const statCards = [
    {
      title: "Today's Sales",
      value: formatCurrency(todaySales),
      icon: "₹",
      color: "bg-blue-600",
      caption: `${sales.filter((sale) => isToday(sale.created_at)).length} sale entries today`,
    },
    {
      title: "Today's Collections",
      value: formatCurrency(todayCollections),
      icon: "↙",
      color: "bg-emerald-600",
      caption: "Cash, UPI and bank receipts",
    },
    {
      title: "Today's Expenses",
      value: formatCurrency(todayExpenses),
      icon: "↗",
      color: "bg-rose-600",
      caption: "Recorded business expenses",
    },
    {
      title: "Today's Profit",
      value: formatCurrency(todayProfit),
      icon: "↗",
      color: "bg-violet-600",
      caption: "Sales less recorded expenses",
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-100">MANVI MILK AGENCIES</p>
            <h1 className="mt-1 text-3xl font-bold">Business Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">
              Monitor sales, collections, expenses, products, and stock from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Refreshing..." : "↻ Refresh Dashboard"}
          </button>
        </div>
      </section>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {loadError}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.title}</p>
                <p className="mt-2 text-2xl font-bold text-slate-800">{card.value}</p>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold text-white ${card.color}`}
              >
                {card.icon}
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">{card.caption}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Total Customers</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{customerCount}</p>
          <p className="mt-2 text-xs text-slate-500">Customer records in your ERP</p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Total Products</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{productCount}</p>
          <p className="mt-2 text-xs text-slate-500">Products currently maintained</p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Sales Entries</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{salesCount}</p>
          <p className="mt-2 text-xs text-slate-500">Total recorded sale transactions</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="xl:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Recent Sales Overview</h2>
              <p className="text-sm text-slate-500">Latest sale amounts</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {recentSales.length} recent entries
            </span>
          </div>

          <div className="mt-6 flex h-52 items-end gap-2 overflow-x-auto border-b border-slate-200 pb-2">
            {recentSales.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                No sales data available yet.
              </div>
            ) : (
              recentSales
                .slice()
                .reverse()
                .map((sale) => {
                  const amount = Number(sale.total || 0);
                  const height = Math.max((amount / maxChartValue) * 100, 6);

                  return (
                    <div
                      key={sale.id}
                      className="group flex min-w-[48px] flex-1 flex-col items-center justify-end gap-2"
                      title={`${formatCurrency(amount)} • ${formatDateTime(sale.created_at)}`}
                    >
                      <div className="relative flex h-40 w-full items-end justify-center">
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-cyan-400 transition group-hover:from-blue-800 group-hover:to-cyan-500"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {formatDateTime(sale.created_at).split(",")[0]}
                      </span>
                    </div>
                  );
                })
            )}
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Quick Actions</h2>
          <p className="mt-1 text-sm text-slate-500">Fast daily business entry</p>

          <div className="mt-5 grid gap-3">
            <Link
              to="/sales"
              className="rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              + New Sale
            </Link>
            <Link
              to="/purchases"
              className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              + New Purchase
            </Link>
            <Link
              to="/collections"
              className="rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              + Receive Collection
            </Link>
            <Link
              to="/customers"
              className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              + Add Customer
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="xl:col-span-2 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div class
