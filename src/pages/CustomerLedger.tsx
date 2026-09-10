import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  customer_name: string;
  opening_balance: number;
  route: string;
};

type LedgerEntry = {
  id: string;
  date: string;
  type: "Opening Balance" | "Sale" | "Collection";
  debit: number;
  credit: number;
  balance: number;
};

type SaleRow = {
  id: string;
  sale_date: string;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
};

type CollectionRow = {
  id: string;
  collection_date: string;
  amount: number | string | null;
  payment_method: string | null;
  remarks: string | null;
};


function formatDateDDMMYYYY(
  value: string | null | undefined
) {
  if (!value) return "-";

  const part = String(value).slice(
    0,
    10
  );

  const pieces =
    part.split("-");

  if (
    pieces.length === 3 &&
    /^\d{4}$/.test(
      pieces[0]
    )
  ) {
    return `${pieces[2]}/${pieces[1]}/${pieces[0]}`;
  }

  return String(value);
}

function money(value: number) {
  return `₹ ${Number(
    value || 0
  ).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CustomerLedger() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  // =========================================
  // LOAD CUSTOMERS
  // =========================================

  async function loadCustomers() {
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("customers")
        .select(`
          id,
          customer_name,
          opening_balance,
          route
        `)
        .order("customer_name", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      const formattedCustomers: Customer[] =
        (data || []).map((customer) => ({
          id: customer.id,
          customer_name:
            customer.customer_name || "",
          opening_balance: Number(
            customer.opening_balance || 0
          ),
          route:
            String(
              customer.route || ""
            ).trim(),
        }));

      setCustomers(formattedCustomers);
    } catch (error) {
      console.error(
        "CUSTOMER LOAD ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to load customers."
      );
    }
  }

  // =========================================
  // LOAD LEDGER
  // =========================================

  async function loadLedger() {
    setErrorMessage("");

    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    setLoading(true);

    try {
      // ---------------------------------------
      // SELECTED CUSTOMER
      // ---------------------------------------

      const selectedCustomer =
        customers.find(
          (customer) =>
            customer.id === customerId
        );

      if (!selectedCustomer) {
        throw new Error(
          "Customer not found."
        );
      }

      // ---------------------------------------
      // LOAD SALES
      // IMPORTANT: balance_amount INCLUDED
      // ---------------------------------------

      const {
        data: sales,
        error: salesError,
      } = await supabase
        .from("sales")
        .select(`
          id,
          sale_date,
          total_amount,
          paid_amount,
          balance_amount
        `)
        .eq("customer_id", customerId)
        .order("sale_date", {
          ascending: true,
        });

      if (salesError) {
        throw salesError;
      }

      const saleRows: SaleRow[] =
        (sales || []) as SaleRow[];

      // ---------------------------------------
      // LOAD COLLECTIONS
      // ---------------------------------------

      const {
        data: collections,
        error: collectionError,
      } = await supabase
        .from("collections")
        .select(`
          id,
          collection_date,
          amount,
          payment_method,
          remarks
        `)
        .eq("customer_id", customerId)
        .order("collection_date", {
          ascending: true,
        });

      if (collectionError) {
        console.error(
          "COLLECTION LOAD ERROR:",
          collectionError
        );

        // Don't stop ledger if RLS prevents
        // reading collections.
      }

      const collectionRows: CollectionRow[] =
        (collections || []) as CollectionRow[];

      // =======================================
      // OPENING BALANCE
      // =======================================

      const openingBalance =
        Number(
          selectedCustomer.opening_balance || 0
        );

      // =======================================
      // SALES TOTALS
      // =======================================

      const totalSales =
        saleRows.reduce(
          (sum, sale) =>
            sum +
            Number(
              sale.total_amount || 0
            ),
          0
        );

      const paidAtSale =
        saleRows.reduce(
          (sum, sale) =>
            sum +
            Number(
              sale.paid_amount || 0
            ),
          0
        );

      // =======================================
      // CURRENT SALES OUTSTANDING
      // =======================================

      const currentSalesOutstanding =
        saleRows.reduce(
          (sum, sale) =>
            sum +
            Number(
              sale.balance_amount || 0
            ),
          0
        );

      // =======================================
      // ACTUAL COLLECTIONS
      // =======================================

      const actualCollections =
        collectionRows.reduce(
          (sum, collection) =>
            sum +
            Number(
              collection.amount || 0
            ),
          0
        );

      // =======================================
      // DETERMINE COLLECTION AMOUNT
      //
      // Normally we use actual collection
      // records.
      //
      // If RLS makes the collection records
      // invisible, calculate the amount that
      // has already reduced the balance.
      // =======================================

      const balanceBeforeCollections =
        openingBalance +
        totalSales -
        paidAtSale;

      const inferredCollections =
        Math.max(
          0,
          balanceBeforeCollections -
            currentSalesOutstanding
        );

      const totalCollections =
        actualCollections > 0
          ? actualCollections
          : inferredCollections;

      // =======================================
      // CREATE LEDGER
      // =======================================

      const entries: LedgerEntry[] = [];

      // ---------------------------------------
      // OPENING BALANCE
      // ---------------------------------------

      if (openingBalance !== 0) {
        entries.push({
          id: `opening-${customerId}`,
          date:
            "2000-01-01T00:00:00.000Z",
          type: "Opening Balance",
          debit: openingBalance,
          credit: 0,
          balance: 0,
        });
      }

      // ---------------------------------------
      // SALES
      // ---------------------------------------

      saleRows.forEach((sale) => {
        entries.push({
          id: `sale-${sale.id}`,
          date: sale.sale_date,
          type: "Sale",

          debit: Number(
            sale.total_amount || 0
          ),

          credit: Number(
            sale.paid_amount || 0
          ),

          balance: 0,
        });
      });

      // ---------------------------------------
      // ACTUAL COLLECTION RECORDS
      // ---------------------------------------

      if (collectionRows.length > 0) {
        collectionRows.forEach(
          (collection) => {
            entries.push({
              id: `collection-${collection.id}`,
              date:
                collection.collection_date,
              type: "Collection",
              debit: 0,
              credit: Number(
                collection.amount || 0
              ),
              balance: 0,
            });
          }
        );
      }

      // ---------------------------------------
      // FALLBACK COLLECTION
      //
      // Used only when Supabase doesn't return
      // collection records but sales balances
      // prove that a collection was applied.
      // ---------------------------------------

      if (
        collectionRows.length === 0 &&
        inferredCollections > 0
      ) {
        entries.push({
          id: `calculated-collection-${customerId}`,
          date:
            new Date().toISOString(),
          type: "Collection",
          debit: 0,
          credit: inferredCollections,
          balance: 0,
        });
      }

      // =======================================
      // SORT ENTRIES
      // =======================================

      entries.sort((a, b) => {
        // Opening balance always first

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

        return (
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
        );
      });

      // =======================================
      // RUNNING BALANCE
      // =======================================

      let runningBalance = 0;

      const finalLedger =
        entries.map((entry) => {
          runningBalance =
            runningBalance +
            entry.debit -
            entry.credit;

          return {
            ...entry,
            balance: runningBalance,
          };
        });

      setLedger(finalLedger);
    } catch (error) {
      console.error(
        "LEDGER ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to load ledger.";

      setErrorMessage(message);

      alert(message);
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // SUMMARY
  // =========================================

  const openingBalance =
    ledger
      .filter(
        (entry) =>
          entry.type === "Opening Balance"
      )
      .reduce(
        (sum, entry) =>
          sum + entry.debit,
        0
      );

  const totalSales =
    ledger
      .filter(
        (entry) =>
          entry.type === "Sale"
      )
      .reduce(
        (sum, entry) =>
          sum + entry.debit,
        0
      );

  const paidAtSale =
    ledger
      .filter(
        (entry) =>
          entry.type === "Sale"
      )
      .reduce(
        (sum, entry) =>
          sum + entry.credit,
        0
      );

  const totalCollections =
    ledger
      .filter(
        (entry) =>
          entry.type === "Collection"
      )
      .reduce(
        (sum, entry) =>
          sum + entry.credit,
        0
      );

  const closingBalance =
    ledger.length > 0
      ? ledger[
          ledger.length - 1
        ].balance
      : openingBalance;

  const routeOptions = Array.from(
    new Set(
      customers
        .map((customer) =>
          customer.route.trim()
        )
        .filter(Boolean)
    )
  ).sort((a, b) =>
    a.localeCompare(b)
  );

  const filteredCustomers = customers.filter(
    (customer) => {
      const query =
        customerSearch
          .trim()
          .toLowerCase();

      const matchesSearch =
        !query ||
        customer.customer_name
          .toLowerCase()
          .includes(query) ||
        customer.route
          .toLowerCase()
          .includes(query);

      const matchesRoute =
        !routeFilter ||
        customer.route === routeFilter;

      return (
        matchesSearch &&
        matchesRoute
      );
    }
  );

  // =========================================
  // SELECTED CUSTOMER
  // =========================================

  const selectedCustomer =
    customers.find(
      (customer) =>
        customer.id === customerId
    );

  // =========================================
  // UI
  // =========================================

  return (
    <div className="max-w-7xl mx-auto p-6">

      {/* HEADER */}

      <div className="mb-6">

        <h1 className="text-3xl font-bold text-blue-700">
          Customer Ledger
        </h1>

        <p className="text-gray-600 mt-1">
          Sales, payments, collections and
          outstanding balance
        </p>

      </div>

      {/* CUSTOMER SELECTION */}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">

        <div className="flex flex-col md:flex-row gap-4">

          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(
                e.target.value
              );

              setLedger([]);
            }}
            className="border rounded-lg p-3 flex-1"
          >

            <option value="">
              Select Customer
            </option>

            {customers.map(
              (customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {customer.customer_name}
                </option>
              )
            )}

          </select>

          <button
            onClick={loadLedger}
            disabled={
              loading || !customerId
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-semibold"
          >
            {loading
              ? "Loading..."
              : "Load Ledger"}
          </button>

        </div>

        {selectedCustomer && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">

            <p className="font-semibold text-blue-700">
              Customer:{" "}
              {selectedCustomer.customer_name}
            </p>

            <p className="text-gray-600 mt-1">
              Route:{" "}
              <strong>
                {selectedCustomer.route ||
                  "-"}
              </strong>
            </p>

            <p className="text-gray-600 mt-1">
              Opening Balance:{" "}
              {money(
                Number(
                  selectedCustomer.opening_balance ||
                    0
                )
              )}
            </p>

          </div>
        )}

      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-semibold">
            Ledger Error
          </p>
          <p className="mt-1 break-words text-sm">
            {errorMessage}
          </p>
        </div>
      )}

      {/* SUMMARY CARDS */}

      {customerId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

          {/* OPENING */}

          <div className="bg-orange-100 rounded-xl p-5 shadow">

            <p className="text-gray-600">
              Opening Balance
            </p>

            <h2 className="text-2xl font-bold text-orange-700 mt-2">
              ₹{" "}
              {openingBalance.toFixed(2)}
            </h2>

          </div>

          {/* SALES */}

          <div className="bg-blue-100 rounded-xl p-5 shadow">

            <p className="text-gray-600">
              Total Sales
            </p>

            <h2 className="text-2xl font-bold text-blue-700 mt-2">
              ₹{" "}
              {totalSales.toFixed(2)}
            </h2>

          </div>

          {/* PAID AT SALE */}

          <div className="bg-cyan-100 rounded-xl p-5 shadow">

            <p className="text-gray-600">
              Paid at Sale
            </p>

            <h2 className="text-2xl font-bold text-cyan-700 mt-2">
              ₹{" "}
              {paidAtSale.toFixed(2)}
            </h2>

          </div>

          {/* COLLECTIONS */}

          <div className="bg-green-100 rounded-xl p-5 shadow">

            <p className="text-gray-600">
              Collections
            </p>

            <h2 className="text-2xl font-bold text-green-700 mt-2">
              ₹{" "}
              {totalCollections.toFixed(2)}
            </h2>

          </div>

          {/* OUTSTANDING */}

          <div className="bg-red-100 rounded-xl p-5 shadow">

            <p className="text-gray-600">
              Outstanding
            </p>

            <h2
              className={`text-2xl font-bold mt-2 ${
                closingBalance > 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              ₹{" "}
              {closingBalance.toFixed(2)}
            </h2>

          </div>

        </div>
      )}

      {/* LEDGER TABLE */}

      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">

        <table className="w-full border-collapse">

          <thead className="bg-blue-600 text-white">

            <tr>

              <th className="p-3 text-left">
                Date
              </th>

              <th className="p-3 text-left">
                Type
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
                  colSpan={5}
                  className="p-8 text-center text-gray-500"
                >
                  {customerId
                    ? "No ledger records found."
                    : "Select a customer and load the ledger."}
                </td>

              </tr>

            ) : (

              ledger.map(
                (entry) => (

                  <tr
                    key={entry.id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="p-3">

                      {entry.type ===
                      "Opening Balance"
                        ? "-"
                        : formatDateDDMMYYYY(
                            entry.date
                          )}

                    </td>

                    <td className="p-3">

                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          entry.type ===
                          "Sale"
                            ? "bg-blue-100 text-blue-700"
                            : entry.type ===
                              "Collection"
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {entry.type}
                      </span>

                    </td>

                    <td className="p-3 text-right">

                      {entry.debit > 0
                        ? money(
                            entry.debit
                          )
                        : "-"}

                    </td>

                    <td className="p-3 text-right">

                      {entry.credit > 0
                        ? money(
                            entry.credit
                          )
                        : "-"}

                    </td>

                    <td
                      className={`p-3 text-right font-bold ${
                        entry.balance > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {money(
                        entry.balance
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
  );
}