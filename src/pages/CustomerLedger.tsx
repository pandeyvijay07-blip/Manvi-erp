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

type AllocationRow = {
  id: string;
  collection_id: string;
  sale_id: string;
  amount: number | string | null;
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
        {
          data: allocationsData,
          error: allocationsError,
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

        supabase
          .from("collection_allocations")
          .select("id, collection_id, sale_id, amount"),
      ]);

      if (salesError) throw salesError;
      if (collectionsError) throw collectionsError;

      const saleRows = (salesData || []) as SaleRow[];
      const collectionRows = (collectionsData || []) as CollectionRow[];
      const allocationRows = (allocationsData || []) as AllocationRow[];

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

      let originalOpeningBalance = currentOpeningBalance;
      let openingAppliedTotal = 0;

      /*
       * Collections are allocated first to outstanding sales.
       *
       * Any remaining collection amount is applied to the customer's
       * opening balance.
       *
       * Since the current customer.opening_balance is reduced when
       * that happens, add those historical opening allocations back
       * to reconstruct the original opening balance for the ledger.
       */
      if (!allocationsError) {
        const allocatedByCollection = new Map<string, number>();

        allocationRows.forEach((allocation) => {
          const previous =
            allocatedByCollection.get(String(allocation.collection_id)) || 0;

          allocatedByCollection.set(
            String(allocation.collection_id),
            previous + toNumber(allocation.amount)
          );
        });

        collectionRows.forEach((collection) => {
          const collectionAmount = toNumber(collection.amount);

          const allocatedToSales =
            allocatedByCollection.get(String(collection.id)) || 0;

          const openingApplied = Math.max(
            0,
            collectionAmount - allocatedToSales
          );

          openingAppliedTotal += openingApplied;
        });

        originalOpeningBalance =
          currentOpeningBalance + openingAppliedTotal;
      } else {
        setReconciliationWarning(
          "Collection allocations could not be read. The ledger is showing transaction history, but the reconstructed original opening balance may be incomplete."
        );
      }

      /*
       * Current sales outstanding is the authoritative current balance
       * of the sales rows after collection allocation.
       */
      const currentSalesOutstanding = saleRows.reduce(
        (sum, sale) => sum + toNumber(sale.balance_amount),
        0
      );

      const calculatedOutstanding =
        originalOpeningBalance +
        totalSales -
        paidAtSale -
        totalCollections;

      const expectedOutstanding =
        currentOpeningBalance + currentSalesOutstanding;

      if (
        Math.abs(calculatedOutstanding - expectedOutstanding) >
        0.01
      ) {
        setReconciliationWarning(
          `Balance reconciliation difference: ₹${Math.abs(
            calculatedOutstanding - expectedOutstanding
          ).toFixed(2)}. Review older collection allocations.`
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

  const handleCustomerChange = (value: string) => {
    setCustomerId(value);
    setLedger([]);
    setReconciliationWarning("");
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* PAGE HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-700">
          Customer Ledger
        </h1>

        <p className="text-gray-600 mt-1">
          Sales, payments, collections and outstanding balance
        </p>
      </div>

      {/* CUSTOMER SELECTOR */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={customerId}
            onChange={(e) =>
              handleCustomerChange(e.target.value)
            }
            disabled={loadingCustomers}
            className="border rounded-lg p-3 flex-1"
          >
            <option value="">
              {loadingCustomers
                ? "Loading customers..."
                : "Select Customer"}
            </option>

            {customers.map((customer) => (
              <option
                key={customer.id}
                value={customer.id}
              >
                {customer.customer_name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadLedger}
            disabled={loading || !customerId}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-semibold"
          >
            {loading ? "Loading..." : "Load Ledger"}
          </button>
        </div>

        {/* CUSTOMER INFORMATION */}
        {selectedCustomer && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-700">
              Customer: {selectedCustomer.customer_name}
            </p>

            <p className="text-gray-600 mt-1">
              Current Opening Balance Field: ₹
              {toNumber(
                selectedCustomer.opening_balance
              ).toFixed(2)}
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Ledger opening balance is reconstructed from
              historical opening-balance collections.
            </p>
          </div>
        )}
      </div>

      {/* RECONCILIATION WARNING */}
      {reconciliationWarning && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl p-4 mb-6">
          <strong>Reconciliation Warning:</strong>{" "}
          {reconciliationWarning}
        </div>
      )}

      {/* SUMMARY CARDS */}
      {customerId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* OPENING BALANCE */}
          <div className="bg-orange-100 rounded-xl p-5 shadow">
            <p className="text-gray-600">
              Opening Balance
            </p>

            <h2 className="text-2xl font-bold text-orange-700 mt-2">
              ₹ {openingBalance.toFixed(2)}
            </h2>
          </div>

          {/* TOTAL SALES */}
          <div className="bg-blue-100 rounded-xl p-5 shadow">
            <p className="text-gray-600">
              Total Sales
            </p>

            <h2 className="text-2xl font-bold text-blue-700 mt-2">
              ₹ {totalSales.toFixed(2)}
            </h2>
          </div>

          {/* PAID AT SALE */}
          <div className="bg-cyan-100 rounded-xl p-5 shadow">
            <p className="text-gray-600">
              Paid at Sale
            </p>

            <h2 className="text-2xl font-bold text-cyan-700 mt-2">
              ₹ {paidAtSale.toFixed(2)}
            </h2>
          </div>

          {/* COLLECTIONS */}
          <div className="bg-green-100 rounded-xl p-5 shadow">
            <p className="text-gray-600">
              Collections
            </p>

            <h2 className="text-2xl font-bold text-green-700 mt-2">
              ₹ {totalCollections.toFixed(2)}
            </h2>
          </div>

          {/* OUTSTANDING / ADVANCE */}
          <div
            className={`rounded-xl p-5 shadow ${
              closingBalance < -0.01
                ? "bg-amber-100"
                : "bg-red-100"
            }`}
          >
            <p className="text-gray-600">
              {closingBalance < -0.01
                ? "Advance / Excess Collection"
                : "Outstanding"}
            </p>

            <h2
              className={`text-2xl font-bold mt-2 ${
                closingBalance < -0.01
                  ? "text-amber-700"
                  : closingBalance > 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              ₹ {Math.abs(closingBalance).toFixed(2)}
            </h2>

            {closingBalance < -0.01 && (
              <p className="mt-1 text-sm font-medium text-amber-700">
                Customer has paid more than the recorded
                outstanding amount.
              </p>
            )}
          </div>
        </div>
      )}

      {/* LEDGER TABLE */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="p-3 text-left">
                Date
              </th>

              <th className="p-3 text-left">
                Type
              </th>

              <th className="p-3 text-left">
                Reference
              </th>

              <th className="p-3 text-right">
                Debit
              </th>

              <th className="p-3 text-right">
                Credit
              </th>

              <th className="p-3 text-right">
                Balance
              </th>
            </tr>
          </thead>

          <tbody>
            {ledger.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-gray-500"
                >
                  {customerId
                    ? "No ledger records found. Click Load Ledger."
                    : "Select a customer and load the ledger."}
                </td>
              </tr>
            ) : (
              ledger.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b hover:bg-gray-50"
                >
                  {/* DATE */}
                  <td className="p-3">
                    {entry.type === "Opening Balance"
                      ? "-"
                      : formatDateDDMMYYYY(entry.date)}
                  </td>

                  {/* TYPE */}
                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        entry.type === "Sale"
                          ? "bg-blue-100 text-blue-700"
                          : entry.type === "Collection"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {entry.type}
                    </span>
                  </td>

                  {/* REFERENCE */}
                  <td className="p-3 font-medium">
                    {entry.reference}
                  </td>

                  {/* DEBIT */}
                  <td className="p-3 text-right">
                    {entry.debit > 0
                      ? `₹ ${entry.debit.toFixed(2)}`
                      : "-"}
                  </td>

                  {/* CREDIT */}
                  <td className="p-3 text-right">
                    {entry.credit > 0
                      ? `₹ ${entry.credit.toFixed(2)}`
                      : "-"}
                  </td>

                  {/* RUNNING BALANCE */}
                  <td
                    className={`p-3 text-right font-bold ${
                      entry.balance > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    ₹ {entry.balance.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}