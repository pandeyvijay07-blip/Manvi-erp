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
  sale_date?: string | null;
};

type Collection = {
  id: string | number;
  amount?: number | string | null;
  created_at?: string | null;
  collection_date?: string | null;
};

type Expense = {
  id: string | number;
  amount?: number | string | null;
  category?: string | null;
  expense_date?: string | null;
  created_at?: string | null;
};

type Customer = {
  id: string | number;
  name?: string | null;
  customer_name?: string | null;
};

type Product = {
  id: string | number;
  product_name?: string | null;
  name?: string | null;
  brand?: string | null;
  stock?: number | string | null;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const dateValue = (value?: string | null) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isToday = (value?: string | null) => {
  const date = dateValue(value);
  if (!date) return false;

  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

const displayDate = (value?: string | null) => {
  const date = dateValue(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

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

      setSales((salesResult.data || []) as Sale[]);
      setCollections((collectionsResult.data || []) as Collection[]);
      setExpenses((expensesResult.data || []) as Expense[]);
      setCustomers((customersResult.data || []) as Customer[]);
      setProducts((productsResult.data || []) as Product[]);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Unable to load dashboard data. Please check your Supabase tables and try again.",
      );
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
          customer.name || customer.customer_name || "Customer",
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
        .filter((sale) => isToday(sale.created_at || sale.sale_date))
        .reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    [sales],
  );

  const todayCollections = useMemo(
    () =>
      collections
        .filter((item) => isToday(item.created_at || item.collection_date))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [collections],
  );

  const todayExpenses = useMemo(
    () =>
      expenses
        .filter((item) => isToday(item.created_at || item.expense_date))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [expenses],
  );

  const todayProfit = todaySales - todayExpenses;

  const recentSales = useMemo(
    () =>
      [...sales]
        .sort(
          (a, b) =>
            new Date(b.created_at || b.sale_date || 0).getTime() -
            new Date(a.created_at || a.sale_date || 0).getTime(),
        )
        .slice(0, 8),
    [sales],
  );

  const lowStock = useMemo(
    () =>
      products
        .filter((product) => Number(product.stock || 0) <= 10)
        .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
        .slice(0, 8),
    [products],
  );

  const summaryCards = [
    {
      title: "Today's Sales",
      value: money(todaySales),
      note: "Sales recorded today",
      color: "bg-blue-600",
      icon: "₹",
    },
    {
      title: "Collections",
      value: money(todayCollections),
      note: "Cash, UPI and bank receipts",
      color: "bg-emerald-600",
      icon: "↓",
    },
    {
      title: "Expenses",
      value: money(todayExpenses),
      note: "Business expenses today",
      color: "bg-rose-600",
      icon: "↑",
    },
    {
      title: "Profit",
      value: money(todayProfit),
      note: "Sales less expenses",
      color: "bg-violet-600",
      icon: "↗",
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-100">
              MANVI MILK AGENCIES
            </p>
            <h1 className="mt-1 text-3xl font-bold">Business Dashboard</h1>
            <p className="mt-2 text-sm text-blue-100">
              Sales, stock, collections, expenses and business activity.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {card.title}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-800">
                  {loading ? "—" : card.value}
                </p>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold text-white ${card.color}`}
              >
                {card.icon}
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">{card.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">
            Total Customers
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {loading ? "—" : customers.length}
          </p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Total Products</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {loading ? "—" : products.length}
          </p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Sales Entries</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {loading ? "—" : sales.length}
          </p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="xl:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Recent Sales
              </h2>
              <p className="text-sm text-slate-500">
                Latest recorded transactions
              </p>
            </div>

            <Link
              to="/sales"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              New Sale →
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-2 py-3 font-semibold">Customer</th>
                  <th className="px-2 py-3 font-semibold">Product</th>
                  <th className="px-2 py-3 text-right font-semibold">Qty</th>
                  <th className="px-2 py-3 text-right font-semibold">Total</th>
                  <th className="px-2 py-3 font-semibold">Date</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-8 text-center text-slate-500"
                    >
                      Loading sales...
                    </td>
                  </tr>
                ) : recentSales.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-8 text-center text-slate-500"
                    >
                      No sales have been recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentSales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-2 py-3 font-medium text-slate-700">
                        {sale.customer_name ||
                          customerMap.get(String(sale.customer_id)) ||
                          "Walk-in Customer"}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {sale.product_name ||
                          productMap.get(String(sale.product_id)) ||
                          "Product"}
                      </td>
                      <td className="px-2 py-3 text-right text-slate-600">
                        {sale.quantity || 0}
                      </td>
                      <td className="px-2 py-3 text-right font-semibold text-slate-800">
                        {money(Number(sale.total || 0))}
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-500">
                        {displayDate(sale.created_at || sale.sale_date)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Quick Actions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Fast daily business entries
          </p>

          <div className="mt-5 grid gap-3">
            <Link
              to="/sales"
              className="rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-blue-800"
            >
              + New Sale
            </Link>

            <Link
              to="/purchases"
              className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-emerald-700"
            >
              + New Purchase
            </Link>

            <Link
              to="/collections"
              className="rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-violet-700"
            >
              + Collection
            </Link>

            <Link
              to="/customers"
              className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              + Add Customer
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="xl:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Low Stock Alert
              </h2>
              <p className="text-sm text-slate-500">
                Products with stock of 10 or below
              </p>
            </div>

            <Link
              to="/products"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              Manage Products →
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-2 py-3 font-semibold">Product</th>
                  <th className="px-2 py-3 font-semibold">Brand</th>
                  <th className="px-2 py-3 text-right font-semibold">Stock</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-8 text-center text-slate-500"
                    >
                      Loading stock...
                    </td>
                  </tr>
                ) : lowStock.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-8 text-center font-medium text-emerald-600"
                    >
                      All products have sufficient stock.
                    </td>
                  </tr>
                ) : (
                  lowStock.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-2 py-3 font-medium text-slate-700">
                        {product.product_name || product.name || "Product"}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {product.brand || "—"}
                      </td>
                      <td className="px-2 py-3 text-right font-bold text-rose-600">
                        {Number(product.stock || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-800">
            Business Summary
          </h2>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-500">Total Sales</span>
              <span className="font-bold text-slate-800">
                {money(
                  sales.reduce(
                    (sum, sale) => sum + Number(sale.total || 0),
                    0,
                  ),
                )}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-500">Collections</span>
              <span className="font-bold text-emerald-600">
                {money(
                  collections.reduce(
                    (sum, item) => sum + Number(item.amount || 0),
                    0,
                  ),
                )}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-500">Expenses</span>
              <span className="font-bold text-rose-600">
                {money(
                  expenses.reduce(
                    (sum, item) => sum + Number(item.amount || 0),
                    0,
                  ),
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Outstanding</span>
              <span className="font-bold text-amber-600">
                {money(
                  sales.reduce(
                    (sum, sale) => sum + Number(sale.total || 0),
                    0,
                  ) -
                    collections.reduce(
                      (sum, item) => sum + Number(item.amount || 0),
                      0,
                    ),
                )}
              </span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
