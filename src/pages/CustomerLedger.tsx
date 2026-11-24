import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  customer_name: string;
  opening_balance: number;
};

type SaleRow = {
  id: string;
  sale_no: number | null;
  sale_date: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
};

type CollectionRow = {
  id: string;
  collection_date: string | null;
  amount: number | string | null;
  payment_method?: string | null;
  remarks?: string | null;
};

type LedgerEntry = {
  id: string;
  date: string;
  type: "Opening Balance" | "Sale" | "Collection";
  reference: string;
  debit: number;
  credit: number;
  balance: number;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getDateKey(value: unknown): string {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [d, m, y] = text.split("/");

    return `${y}-${String(Number(m)).padStart(2, "0")}-${String(
      Number(d)
    ).padStart(2, "0")}`;
  }

  return "";
}

function formatDateDDMMYYYY(value: unknown): string {
  const key = getDateKey(value);

  if (!key) return "-";

  const [year, month, day] = key.split("-");

  return `${day}/${month}/${year}`;
}

export default function CustomerLedger() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [reconciliationWarning, setReconciliationWarning] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | LedgerEntry["type"]>("All");

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customers, customerId]
  );

  useEffect(() => {
    void loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoadingCustomers(true);

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_name, opening_balance")
        .order("customer_name", { ascending: true });

      if (error) throw error;

      setCustomers(
        (data || []).map((row: any) => ({
          id: String(row.id),
          customer_name: row.customer_name || "",
          opening_balance: toNumber(row.opening_balance),
        }))
      );
    } catch (error: any) {
      console.error("CUSTOMER LOAD ERROR:", error);

      alert(
        "Unable to load customers:\n" +
          (error?.message || "Failed to load customers.")
      );
    } finally {
      setLoadingCustomers(false);
    }
  }

  async function loadLedger() {
    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    setLoading(true);
    setReconciliationWarning("");

    try {
      if (!selectedCustomer) {
        throw new Error("Customer not found.");
      }

      const [
        {
          data: salesData,
          error: salesError,
        },
        {
          data: collectionsData,
          error: collectionsError,
        },
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, sale_no, sale_date, total_amount, paid_amount, balance_amount"
          )
          .eq("customer_id", customerId)
          .order("sale_date", { ascending: true })
          .order("created_at", { ascending: true }),

        supabase
          .from("collections")
          .select(
            "id, collection_date, amount, payment_method, remarks"
          )
          .eq("customer_id", customerId)
          .order("collection_date", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

      if (salesError) throw salesError;
      if (collectionsError) throw collectionsError;

      const saleRows = (salesData || []) as SaleRow[];
      const collectionRows = (collectionsData || []) as CollectionRow[];

      const totalSales = saleRows.reduce(
        (sum, sale) => sum + toNumber(sale.total_amount),
        0
      );

      const paidAtSale = saleRows.reduce(
        (sum, sale) => sum + toNumber(sale.paid_amount),
        0
      );

      const totalCollections = collectionRows.reduce(
        (sum, collection) => sum + toNumber(collection.amount),
        0
      );

      const currentOpeningBalance = toNumber(
        selectedCustomer.opening_balance
      );

      /*
       * IMPORTANT:
       *
       * The customers.opening_balance field is a LIVE balance field.
       * When a collection is applied against an old opening balance,
       * the application reduces that field.
       *
       * Therefore we must reconstruct the ORIGINAL opening balance
       * from the authoritative live outstanding balance and the complete
       * transaction history.
       *
       * Formula:
       *
       * Original Opening
       *   = Live Outstanding
       *     - Total Sales
       *     + Paid at Sale
       *     + Total Collections
       *
       * Live Outstanding
       *   = Current Opening Balance + Current Sales Outstanding
       *
       * This avoids depending on collection_allocations visibility/RLS
       * and keeps the ledger ending balance exactly equal to the live
       * customer outstanding balance.
       */
      const currentSalesOutstanding = saleRows.reduce(
        (sum, sale) => sum + toNumber(sale.balance_amount),
        0
      );

      const expectedOutstanding =
        currentOpeningBalance + currentSalesOutstanding;

      const originalOpeningBalance =
        expectedOutstanding -
        totalSales +
        paidAtSale +
        totalCollections;

      /*
       * The transaction-derived calculation must now reconcile exactly
       * with the authoritative live outstanding balance.
       */
      const calculatedOutstanding =
        originalOpeningBalance +
        totalSales -
        paidAtSale -
        totalCollections;

      if (
        Math.abs(calculatedOutstanding - expectedOutstanding) >
        0.01
      ) {
        setReconciliationWarning(
          `Balance reconciliation difference: ₹${Math.abs(
            calculatedOutstanding - expectedOutstanding
          ).toFixed(2)}. Please review the customer's sales, collections, and live outstanding balance.`
        );
      }

      const entries: LedgerEntry[] = [];

      /*
       * Opening balance always starts the ledger.
       */
      if (Math.abs(originalOpeningBalance) > 0.000001) {
        entries.push({
          id: `opening-${customerId}`,
          date: "0000-01-01",
          type: "Opening Balance",
          reference: "Opening balance",
          debit: originalOpeningBalance,
          credit: 0,
          balance: 0,
        });
      }

      /*
       * Sales
       */
      saleRows.forEach((sale) => {
        entries.push({
          id: `sale-${sale.id}`,
          date: getDateKey(sale.sale_date) || "9999-12-31",
          type: "Sale",
          reference:
            sale.sale_no !== null && sale.sale_no !== undefined
              ? `Sale No. ${sale.sale_no}`
              : "Sale",
          debit: toNumber(sale.total_amount),
          credit: toNumber(sale.paid_amount),
          balance: 0,
        });
      });

      /*
       * Collections
       */
      collectionRows.forEach((collection) => {
        entries.push({
          id: `collection-${collection.id}`,
          date:
            getDateKey(collection.collection_date) || "9999-12-31",
          type: "Collection",
          reference: collection.payment_method
            ? `${collection.payment_method} collection`
            : "Collection",
          debit: 0,
          credit: toNumber(collection.amount),
          balance: 0,
        });
      });

      /*
       * IMPORTANT:
       *
       * Sort by:
       * 1. Opening Balance first
       * 2. Date
       * 3. Same-date transaction type
       *
       * Same-date order:
       * Opening Balance -> Sale -> Collection
       *
       * This prevents a collection from appearing before the day's
       * sale just because the database IDs happen to sort that way.
       */
      const typeOrder: Record<LedgerEntry["type"], number> = {
        "Opening Balance": 0,
        Sale: 1,
        Collection: 2,
      };

      entries.sort((a, b) => {
        if (
          a.type === "Opening Balance" &&
          b.type !== "Opening Balance"
        ) {
          return -1;
        }

        if (
          b.type === "Opening Balance" &&
          a.type !== "Opening Balance"
        ) {
          return 1;
        }

        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }

        /*
         * FIX:
         * On the same date, Sale comes before Collection.
         */
        const typeDifference =
          typeOrder[a.type] - typeOrder[b.type];

        if (typeDifference !== 0) {
          return typeDifference;
        }

        /*
         * If both transactions have the same type and same date,
         * keep a stable deterministic order.
         */
        return a.id.localeCompare(b.id);
      });

      /*
       * Calculate running balance after sorting.
       */
      let runningBalance = 0;

      const finalLedger = entries.map((entry) => {
        runningBalance += entry.debit - entry.credit;

        return {
          ...entry,
          balance: runningBalance,
        };
      });

      /*
       * Compare the transaction-derived ending balance with the
       * authoritative live outstanding balance.
       *
       * We do NOT change any database data automatically.
       */
      if (
        Math.abs(runningBalance - expectedOutstanding) >
        0.01
      ) {
        setReconciliationWarning(
          `Ledger ending balance ₹${runningBalance.toFixed(
            2
          )} differs from live outstanding ₹${expectedOutstanding.toFixed(
            2
          )}. This usually means an older collection/opening adjustment needs review.`
        );
      }

      setLedger(finalLedger);
    } catch (error: any) {
      console.error("LEDGER ERROR:", error);

      setLedger([]);

      alert(
        "Failed to load customer ledger:\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  const openingBalance = useMemo(
    () =>
      ledger
        .filter((entry) => entry.type === "Opening Balance")
        .reduce((sum, entry) => sum + entry.debit, 0),
    [ledger]
  );

  const totalSales = useMemo(
    () =>
      ledger
        .filter((entry) => entry.type === "Sale")
        .reduce((sum, entry) => sum + entry.debit, 0),
    [ledger]
  );

  const paidAtSale = useMemo(
    () =>
      ledger
        .filter((entry) => entry.type === "Sale")
        .reduce((sum, entry) => sum + entry.credit, 0),
    [ledger]
  );

  const totalCollections = useMemo(
    () =>
      ledger
        .filter((entry) => entry.type === "Collection")
        .reduce((sum, entry) => sum + entry.credit, 0),
    [ledger]
  );

  const closingBalance = useMemo(
    () =>
      ledger.length > 0
        ? ledger[ledger.length - 1].balance
        : 0,
    [ledger]
  );

  // View-only filters. The original ledger calculation and running balances
  // are completed before filtering, so displayed balances remain authoritative.
  const filteredLedger = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return ledger.filter((entry) => {
      const matchesType = typeFilter === "All" || entry.type === typeFilter;
      const matchesSearch =
        !query ||
        entry.reference.toLowerCase().includes(query) ||
        entry.type.toLowerCase().includes(query) ||
        formatDateDDMMYYYY(entry.date).toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [ledger, searchTerm, typeFilter]);

  function exportLedgerCsv() {
    if (!selectedCustomer || filteredLedger.length === 0) return;

    const rows = [
      ["Customer", selectedCustomer.customer_name],
      ["Date", "Type", "Reference", "Debit", "Credit", "Running Balance"],
      ...filteredLedger.map((entry) => [
        entry.type === "Opening Balance" ? "-" : formatDateDDMMYYYY(entry.date),
        entry.type,
        entry.reference,
        entry.debit.toFixed(2),
        entry.credit.toFixed(2),
        entry.balance.toFixed(2),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Customer-Ledger-${selectedCustomer.customer_name.replace(/[^a-z0-9-_]+/gi, "-")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const handleCustomerChange = (value: string) => {
    setCustomerId(value);
    setLedger([]);
    setReconciliationWarning("");
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 p-3 sm:p-5 lg:p-7">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            MANVI ERP / Accounts
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Customer Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete sales, collections and running outstanding history.
          </p>
        </div>
        {ledger.length > 0 && (
          <button
            type="button"
            onClick={exportLedgerCsv}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            <span aria-hidden="true">↓</span> Export CSV
          </button>
        )}
      </div>

      {/* CUSTOMER SELECTOR */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Select customer</h2>
            <p className="mt-0.5 text-xs text-slate-500">Choose a customer to view the complete ledger.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {customers.length} customers
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={customerId}
            onChange={(e) => handleCustomerChange(e.target.value)}
            disabled={loadingCustomers}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
          >
            <option value="">
              {loadingCustomers ? "Loading customers..." : "Select Customer"}
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customer_name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadLedger}
            disabled={loading || !customerId}
            className="min-h-12 rounded-xl bg-blue-700 px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading ledger..." : "Load Ledger"}
          </button>
        </div>

        {selectedCustomer && (
          <div className="mt-4 flex flex-col gap-1 rounded-xl border border-blue-100 bg-blue-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Selected customer</p>
              <p className="mt-0.5 text-lg font-extrabold text-slate-900">{selectedCustomer.customer_name}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-slate-500">Current opening balance field</p>
              <p className="text-base font-bold text-slate-800">₹ {toNumber(selectedCustomer.opening_balance).toFixed(2)}</p>
            </div>
          </div>
        )}
      </section>

      {/* RECONCILIATION WARNING */}
      {reconciliationWarning && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <strong className="font-extrabold">Reconciliation warning:</strong> {reconciliationWarning}
        </div>
      )}

      {/* SUMMARY CARDS */}
      {customerId && (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Opening balance</p>
            <p className="mt-2 text-xl font-extrabold text-orange-800 sm:text-2xl">₹ {openingBalance.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Total sales</p>
            <p className="mt-2 text-xl font-extrabold text-blue-800 sm:text-2xl">₹ {totalSales.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Paid at sale</p>
            <p className="mt-2 text-xl font-extrabold text-cyan-800 sm:text-2xl">₹ {paidAtSale.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-green-700">Collections</p>
            <p className="mt-2 text-xl font-extrabold text-green-800 sm:text-2xl">₹ {totalCollections.toFixed(2)}</p>
          </div>
          <div className={`col-span-2 rounded-2xl border p-4 shadow-sm xl:col-span-1 ${closingBalance < -0.01 ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-rose-100 bg-gradient-to-br from-rose-50 to-white"}`}>
            <p className={`text-xs font-bold uppercase tracking-wide ${closingBalance < -0.01 ? "text-amber-700" : "text-rose-700"}`}>
              {closingBalance < -0.01 ? "Advance / excess collection" : "Closing outstanding"}
            </p>
            <p className={`mt-2 text-xl font-extrabold sm:text-2xl ${closingBalance < -0.01 ? "text-amber-800" : closingBalance > 0 ? "text-rose-700" : "text-green-700"}`}>
              ₹ {Math.abs(closingBalance).toFixed(2)}
            </p>
            {closingBalance < -0.01 && <p className="mt-1 text-xs font-medium text-amber-700">Customer has an advance balance.</p>}
          </div>
        </section>
      )}

      {/* LEDGER TRANSACTIONS */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Transaction history</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Running balance is calculated in date order. Sales appear before collections on the same date.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reference or date..."
              aria-label="Search ledger transactions"
              className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-64"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "All" | LedgerEntry["type"])}
              aria-label="Filter ledger transaction type"
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="All">All transactions</option>
              <option value="Opening Balance">Opening balance</option>
              <option value="Sale">Sales only</option>
              <option value="Collection">Collections only</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:px-5">
          <span><strong className="text-slate-900">{filteredLedger.length}</strong> displayed of <strong className="text-slate-900">{ledger.length}</strong> transactions</span>
          {ledger.length > 0 && (
            <span className="font-semibold">
              Ending balance: <span className={closingBalance > 0 ? "text-rose-700" : closingBalance < -0.01 ? "text-amber-700" : "text-green-700"}>₹ {Math.abs(closingBalance).toFixed(2)} {closingBalance < -0.01 ? "Advance" : closingBalance > 0 ? "Due" : "Settled"}</span>
            </span>
          )}
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-[#123b70] text-white">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Date</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Reference</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">Debit</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">Credit</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">Running balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mb-2 text-3xl" aria-hidden="true">▤</div>
                      <p className="font-bold text-slate-700">
                        {ledger.length === 0
                          ? customerId ? "No ledger records loaded" : "Select a customer to begin"
                          : "No matching transactions"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {ledger.length === 0
                          ? customerId ? "Click Load Ledger to fetch this customer's transactions." : "Choose a customer above and load their ledger."
                          : "Change the search text or transaction filter."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLedger.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {entry.type === "Opening Balance" ? "—" : formatDateDDMMYYYY(entry.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${entry.type === "Sale" ? "bg-blue-100 text-blue-800" : entry.type === "Collection" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{entry.reference}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{entry.debit > 0 ? `₹ ${entry.debit.toFixed(2)}` : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-green-700">{entry.credit > 0 ? `₹ ${entry.credit.toFixed(2)}` : "—"}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-extrabold tabular-nums ${entry.balance > 0 ? "text-rose-700" : entry.balance < -0.01 ? "text-amber-700" : "text-green-700"}`}>
                      ₹ {Math.abs(entry.balance).toFixed(2)} {entry.balance < -0.01 ? "Cr" : entry.balance > 0 ? "Dr" : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500 sm:px-5">
          Debit increases customer outstanding. Credit reduces outstanding. A negative running balance represents customer advance.
        </div>
      </section>
    </div>
  );
}
