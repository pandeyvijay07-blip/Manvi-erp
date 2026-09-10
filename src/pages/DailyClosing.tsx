import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ClosingRow = {
  id: string;
  closing_date: string;
  opening_cash: number | string | null;
  cash_sales: number | string | null;
  upi_sales: number | string | null;
  credit_sales: number | string | null;
  collections: number | string | null;
  expenses: number | string | null;
  closing_cash: number | string | null;
};

type SaleRow = {
  id: string;
  payment_method: string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
  total_amount: number | string | null;
  cash_amount: number | string | null;
  upi_amount: number | string | null;
  sale_date: string;
};

type CollectionRow = {
  id: string;
  amount: number | string | null;
  collection_date: string;
  payment_method: string | null;
  cash_amount: number | string | null;
  upi_amount: number | string | null;
};

type ExpenseRow = {
  id: string;
  amount: number | string | null;
  expense_date: string;
};

type PurchaseRow = {
  id: string;
  purchase_date: string;
  invoice_no: string | null;
  supplier_name: string | null;
  payment_method: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
};

export default function DailyClosing() {
  // =========================================================
  // TODAY
  // =========================================================

  function getToday() {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }

  const [date, setDate] = useState(getToday());

  const [dateDisplay, setDateDisplay] =
    useState(() => {
      const value = getToday();
      const [year, month, day] =
        value.split("-");
      return `${day}/${month}/${year}`;
    });

  // =========================================================
  // VALUES
  // =========================================================

  const [cashSales, setCashSales] = useState(0);
  const [upiSales, setUpiSales] = useState(0);
  const [creditSales, setCreditSales] = useState(0);

  const [collections, setCollections] = useState(0);

  const [upiCollections, setUpiCollections] =
    useState(0);
  const [expenses, setExpenses] = useState(0);
  const [cashPurchasePayments, setCashPurchasePayments] =
    useState(0);

  const [cashPurchaseRows, setCashPurchaseRows] =
    useState<PurchaseRow[]>([]);

  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);

  // =========================================================
  // STATE
  // =========================================================

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<ClosingRow[]>([]);

  // =========================================================
  // DATE FORMAT
  // =========================================================

  function formatDate(value: string) {
    if (!value) return "";

    const parts = value.substring(0, 10).split("-");

    if (parts.length !== 3) {
      return value;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // =========================================================
  // IMPORTANT DATE HELPER
  //
  // Handles:
  // 2026-09-02
  // 2026-09-02T10:30:00
  // 2026-09-02T10:30:00+00:00
  // =========================================================

  function getDateKey(value: unknown): string {
    if (!value) return "";

    const text = String(value).trim();

    if (!text) return "";

    // Date-only value
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }

    // Timestamp beginning with YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
      return text.substring(0, 10);
    }

    // Fallback
    const parsed = new Date(text);

    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return `${parsed.getFullYear()}-${String(
      parsed.getMonth() + 1
    ).padStart(2, "0")}-${String(
      parsed.getDate()
    ).padStart(2, "0")}`;
  }

  function formatDateInput(value: string) {
    const digits = value
      .replace(/\D/g, "")
      .slice(0, 8);

    if (digits.length <= 2) {
      return digits;
    }

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

  function handleDateInput(value: string) {
    const display = formatDateInput(value);

    setDateDisplay(display);

    const parsed = parseDDMMYYYY(display);

    if (parsed) {
      setDate(parsed);
    }
  }

  // =========================================================
  // LOAD WHEN DATE CHANGES
  // =========================================================

  useEffect(() => {
    loadClosing();
    loadHistory();
  }, [date]);

  // =========================================================
  // LOAD DAILY CLOSING
  // =========================================================

  async function loadClosing() {
    setLoading(true);

    try {
      // =====================================================
      // SALES
      //
      // IMPORTANT:
      // Do NOT filter sale_date in Supabase.
      // Load records and compare YYYY-MM-DD locally.
      // This avoids date/timestamp mismatch.
      // =====================================================

      const {
        data: salesData,
        error: salesError,
      } = await supabase
        .from("sales")
        .select(`
          id,
          payment_method,
          paid_amount,
          balance_amount,
          total_amount,
          cash_amount,
          upi_amount,
          sale_date
        `)
        .order("sale_date", {
          ascending: false,
        });

      if (salesError) {
        throw salesError;
      }

      const sales: SaleRow[] =
        (salesData || []) as SaleRow[];

      // =====================================================
      // FILTER SALES FOR SELECTED DATE
      // =====================================================

      const selectedSales = sales.filter(
        (sale) =>
          getDateKey(sale.sale_date) === date
      );

      // =====================================================
      // PURCHASE PAYMENTS
      // =====================================================

      const {
        data: purchaseData,
        error: purchaseError,
      } = await supabase
        .from("purchases")
        .select(`
          id,
          purchase_date,
          invoice_no,
          supplier_name,
          payment_method,
          total_amount,
          paid_amount,
          balance_amount
        `)
        .order("purchase_date", {
          ascending: false,
        });

      if (purchaseError) {
        throw purchaseError;
      }

      const purchasesData: PurchaseRow[] =
        (purchaseData || []) as PurchaseRow[];

      const selectedPurchases =
        purchasesData.filter(
          (item) =>
            getDateKey(item.purchase_date) ===
            date
        );

      const cashPurchaseRows =
        selectedPurchases.filter(
          (item) => {
            const method = String(
              item.payment_method || ""
            )
              .trim()
              .toLowerCase();

            return (
              method === "cash" &&
              (
                Number(
                  item.paid_amount || 0
                ) > 0 ||
                Number(
                  item.total_amount || 0
                ) > 0
              )
            );
          }
        );

      const cashPurchases =
        cashPurchaseRows.reduce(
          (sum, item) => {
            const storedPaid =
              Number(
                item.paid_amount || 0
              );

            const total =
              Number(
                item.total_amount || 0
              );

            return (
              sum +
              (
                storedPaid > 0
                  ? storedPaid
                  : total
              )
            );
          },
          0
        );

      // =====================================================
      // COLLECTIONS
      // =====================================================

      const {
        data: collectionData,
        error: collectionError,
      } = await supabase
        .from("collections")
        .select(`
          id,
          amount,
          payment_method,
          cash_amount,
          upi_amount,
          collection_date
        `)
        .order("collection_date", {
          ascending: false,
        });

      if (collectionError) {
        throw collectionError;
      }

      const collectionsData: CollectionRow[] =
        (collectionData || []) as CollectionRow[];

      // =====================================================
      // FILTER COLLECTIONS FOR SELECTED DATE
      // =====================================================

      const selectedCollections =
        collectionsData.filter(
          (item) =>
            getDateKey(item.collection_date) ===
            date
        );

      // =====================================================
      // EXPENSES
      // =====================================================

      const {
        data: expenseData,
        error: expenseError,
      } = await supabase
        .from("expenses")
        .select(`
          id,
          amount,
          expense_date
        `)
        .order("expense_date", {
          ascending: false,
        });

      if (expenseError) {
        throw expenseError;
      }

      const expensesData: ExpenseRow[] =
        (expenseData || []) as ExpenseRow[];

      // =====================================================
      // FILTER EXPENSES FOR SELECTED DATE
      // =====================================================

      const selectedExpenses =
        expensesData.filter(
          (item) =>
            getDateKey(item.expense_date) ===
            date
        );

      // =====================================================
      // CALCULATE SALES
      // =====================================================

      let cash = 0;
      let upi = 0;
      let credit = 0;

      selectedSales.forEach((sale) => {
        const paymentMethod = String(
          sale.payment_method || ""
        )
          .trim()
          .toLowerCase();

        const paid =
          Number(
            sale.paid_amount || 0
          );

        const balance =
          Number(
            sale.balance_amount || 0
          );

        const total =
          Number(
            sale.total_amount || 0
          );

        const storedCash =
          Number(
            sale.cash_amount || 0
          );

        const storedUpi =
          Number(
            sale.upi_amount || 0
          );

        const fallbackPaid =
          paid > 0
            ? paid
            : total;

        const cashPaid =
          storedCash > 0
            ? storedCash
            : paymentMethod === "cash"
            ? fallbackPaid
            : 0;

        const upiPaid =
          storedUpi > 0
            ? storedUpi
            : paymentMethod === "upi"
            ? fallbackPaid
            : 0;

        if (
          paymentMethod === "cash" ||
          paymentMethod === "split"
        ) {
          cash += cashPaid;
        }

        if (
          paymentMethod === "upi" ||
          paymentMethod === "split"
        ) {
          upi += upiPaid;
        }

        if (
          paymentMethod === "credit"
        ) {
          credit += balance;
        }
      });

      // =====================================================
      // TOTAL COLLECTIONS
      // =====================================================

      let totalCollections = 0;
      let cashCollections = 0;
      let upiCollectionTotal = 0;

      selectedCollections.forEach(
        (collection) => {
          const total =
            Number(
              collection.amount || 0
            );

          const method =
            String(
              collection.payment_method ||
                "Cash"
            )
              .trim()
              .toLowerCase();

          const storedCash =
            Number(
              collection.cash_amount || 0
            );

          const storedUpi =
            Number(
              collection.upi_amount || 0
            );

          const cash =
            storedCash > 0
              ? storedCash
              : method === "cash"
              ? total
              : 0;

          const upi =
            storedUpi > 0
              ? storedUpi
              : method === "upi"
              ? total
              : 0;

          totalCollections +=
            cash + upi;

          cashCollections +=
            cash;

          upiCollectionTotal +=
            upi;
        }
      );

      // =====================================================
      // TOTAL EXPENSES
      // =====================================================

      const totalExpenses =
        selectedExpenses.reduce(
          (sum, item) =>
            sum + Number(item.amount || 0),
          0
        );

      // =====================================================
      // PREVIOUS CLOSING
      // =====================================================

      const {
        data: previousClosing,
        error: previousError,
      } = await supabase
        .from("daily_closings")
        .select(`
          closing_date,
          closing_cash
        `)
        .lt("closing_date", date)
        .order("closing_date", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (previousError) {
        throw previousError;
      }

      const opening = Number(
        previousClosing?.closing_cash || 0
      );

      // =====================================================
      // CLOSING CASH
      //
      // Physical cash:
      //
      // Opening Cash
      // + Cash Sales
      // + Cash Collections
      // - Cash Purchase Payments
      // - Expenses
      //
      // UPI is NOT physical cash.
      // Bank is NOT physical cash.
      // Credit is NOT physical cash.
      // =====================================================

      const closing =
        opening +
        cash +
        cashCollections -
        cashPurchases -
        totalExpenses;

      // =====================================================
      // SET STATE
      // =====================================================

      setCashSales(cash);
      setUpiSales(upi);
      setCreditSales(credit);

      setCollections(totalCollections);
      setUpiCollections(
        upiCollectionTotal
      );
      setExpenses(totalExpenses);
      setCashPurchasePayments(
        cashPurchases
      );

      setCashPurchaseRows(
        cashPurchaseRows
      );

      setOpeningCash(opening);
      setClosingCash(closing);

      // =====================================================
      // DEBUG
      // =====================================================

      console.log(
        "MANVI DAILY CLOSING",
        {
          selectedDate: date,
          totalSalesRecords: sales.length,
          selectedSalesRecords:
            selectedSales.length,
          cash,
          upi,
          credit,
          collections: totalCollections,
          expenses: totalExpenses,
          opening,
          closing,
          selectedSales,
        }
      );
    } catch (error) {
      console.error(
        "DAILY CLOSING ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to load daily closing."
      );

      // Reset visible values on error
      setCashSales(0);
      setUpiSales(0);
      setCreditSales(0);
      setCollections(0);
    setUpiCollections(0);
      setExpenses(0);
      setCashPurchasePayments(0);
      setCashPurchaseRows([]);
      setOpeningCash(0);
      setClosingCash(0);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // SAVE CLOSING
  // =========================================================

  async function saveClosing() {
    setSaving(true);

    try {
      const record = {
        closing_date: date,
        opening_cash: openingCash,
        cash_sales: cashSales,
        upi_sales: upiSales,
        credit_sales: creditSales,
        collections: collections,
        expenses: expenses,
        closing_cash: closingCash,
      };

      const {
        error,
      } = await supabase
        .from("daily_closings")
        .upsert(
          record,
          {
            onConflict: "closing_date",
          }
        );

      if (error) {
        throw error;
      }

      alert(
        `Closing saved successfully for ${formatDate(
          date
        )}`
      );

      await loadHistory();
    } catch (error) {
      console.error(
        "SAVE CLOSING ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to save closing."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // HISTORY
  // =========================================================

  async function loadHistory() {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("daily_closings")
        .select(`
          id,
          closing_date,
          opening_cash,
          cash_sales,
          upi_sales,
          credit_sales,
          collections,
          expenses,
          closing_cash
        `)
        .order("closing_date", {
          ascending: false,
        })
        .limit(30);

      if (error) {
        throw error;
      }

      setHistory(
        (data || []) as ClosingRow[]
      );
    } catch (error) {
      console.error(
        "CLOSING HISTORY ERROR:",
        error
      );
    }
  }

  // =========================================================
  // TODAY
  // =========================================================

  function goToday() {
    const todayValue = getToday();
    setDate(todayValue);

    const [
      year,
      month,
      day,
    ] = todayValue.split("-");

    setDateDisplay(
      `${day}/${month}/${year}`
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="max-w-7xl mx-auto p-6">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-700">
          Daily Closing
        </h1>

        <p className="mt-1 text-gray-600">
          Daily cash closing and previous-day carry forward
        </p>
      </div>

      {/* ===================================================
          DATE
      =================================================== */}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">

        <div className="flex flex-col md:flex-row md:items-end gap-4">

          <div className="flex-1">

            <label className="block font-semibold mb-2">
              Closing Date
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={dateDisplay}
              onChange={(e) =>
                handleDateInput(
                  e.target.value
                )
              }
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-full border rounded-lg p-3"
            />

            <p className="text-sm text-gray-500 mt-2">
              Date format: DD/MM/YYYY
            </p>

            <p className="font-semibold text-blue-700 mt-1">
              Selected: {formatDate(date)}
            </p>

          </div>

          <button
            type="button"
            onClick={goToday}
            className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Today
          </button>

          <button
            type="button"
            onClick={loadClosing}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold"
          >
            {loading
              ? "Loading..."
              : "Load Closing"}
          </button>

        </div>

      </div>

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* CASH SALES */}

        <div className="bg-green-500 text-white rounded-xl p-6 shadow">

          <h2 className="text-lg font-semibold">
            Cash Sales
          </h2>

          <p className="text-3xl font-bold mt-3">
            ₹ {cashSales.toFixed(2)}
          </p>

        </div>

        {/* UPI SALES */}

        <div className="bg-blue-600 text-white rounded-xl p-6 shadow">

          <h2 className="text-lg font-semibold">
            UPI Sales
          </h2>

          <p className="text-3xl font-bold mt-3">
            ₹ {upiSales.toFixed(2)}
          </p>

        </div>

        {/* CREDIT SALES */}

        <div className="bg-yellow-500 text-white rounded-xl p-6 shadow">

          <h2 className="text-lg font-semibold">
            Credit Sales
          </h2>

          <p className="text-3xl font-bold mt-3">
            ₹ {creditSales.toFixed(2)}
          </p>

        </div>

        {/* COLLECTIONS */}

        <div className="bg-purple-600 text-white rounded-xl p-6 shadow">

          <h2 className="text-lg font-semibold">
            Collections
          </h2>

          <p className="text-3xl font-bold mt-3">
            ₹ {collections.toFixed(2)}
          </p>

          <p className="mt-2 text-sm text-blue-100">
            UPI Collections: ₹ {upiCollections.toFixed(2)}
          </p>

        </div>

        {/* CASH PURCHASE PAYMENTS */}

        <div className="bg-purple-600 text-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold">
            Cash Purchase Payments
          </h2>

          <p className="text-3xl font-bold mt-3">
            ₹ {cashPurchasePayments.toFixed(2)}
          </p>

          <p className="text-sm mt-2 text-purple-100">
            Cash paid to suppliers
          </p>
        </div>

        {/* EXPENSES */}

        <div className="bg-red-500 text-white rounded-xl p-6 shadow">

          <h2 className="text-lg font-semibold">
            Expenses
          </h2>

          <p className="text-3xl font-bold mt-3">
            ₹ {expenses.toFixed(2)}
          </p>

        </div>

        {/* OPENING CASH */}

        <div className="bg-gray-700 text-white rounded-xl p-6 shadow">

          <h2 className="text-lg font-semibold">
            Opening Cash
          </h2>

          <p className="text-3xl font-bold mt-3">
            ₹ {openingCash.toFixed(2)}
          </p>

          <p className="text-sm mt-2 text-gray-200">
            Previous closing carried forward
          </p>

        </div>

        {/* CLOSING CASH */}

        <div className="bg-indigo-600 text-white rounded-xl p-6 shadow lg:col-span-2">

          <h2 className="text-lg font-semibold">
            Closing Cash
          </h2>

          <p className="text-4xl font-bold mt-4">
            ₹ {closingCash.toFixed(2)}
          </p>

          <p className="text-sm mt-2 text-indigo-100">
            Physical cash expected at closing
          </p>

        </div>

      </div>

      {/* ===================================================
          SAVE
      =================================================== */}

      <div className="bg-white rounded-xl shadow-lg p-6 mt-6">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>

            <h2 className="text-xl font-bold">
              Save Daily Closing
            </h2>

            <p className="text-gray-500 mt-1">
              Save or update closing for{" "}
              <strong>
                {formatDate(date)}
              </strong>
            </p>

          </div>

          <button
            type="button"
            onClick={saveClosing}
            disabled={saving || loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-bold"
          >
            {saving
              ? "Saving..."
              : "✓ Save Closing"}
          </button>

        </div>

      </div>

      {/* ===================================================
          CASH PURCHASE PAYMENTS
      =================================================== */}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Cash Purchase Payments
            </h2>

            <p className="text-sm text-gray-600 mt-1">
              Purchases paid in cash on {formatDate(date)}.
            </p>
          </div>

          <div className="text-xl font-bold text-purple-700">
            ₹ {cashPurchasePayments.toFixed(2)}
          </div>
        </div>

        {cashPurchaseRows.length === 0 ? (
          <div className="rounded-lg bg-slate-50 p-5 text-center text-gray-500">
            No cash purchase payment found for this date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-purple-700 text-white">
                <tr>
                  <th className="p-3 text-left">
                    Date
                  </th>
                  <th className="p-3 text-left">
                    Invoice No.
                  </th>
                  <th className="p-3 text-left">
                    Supplier
                  </th>
                  <th className="p-3 text-left">
                    Payment
                  </th>
                  <th className="p-3 text-right">
                    Paid
                  </th>
                </tr>
              </thead>

              <tbody>
                {cashPurchaseRows.map(
                  (purchase) => {
                    const paid =
                      Number(
                        purchase.paid_amount || 0
                      ) > 0
                        ? Number(
                            purchase.paid_amount || 0
                          )
                        : Number(
                            purchase.total_amount || 0
                          );

                    return (
                      <tr
                        key={purchase.id}
                        className="border-b hover:bg-purple-50"
                      >
                        <td className="p-3">
                          {formatDate(
                            purchase.purchase_date
                          )}
                        </td>

                        <td className="p-3 font-semibold text-blue-700">
                          {purchase.invoice_no ||
                            "-"}
                        </td>

                        <td className="p-3">
                          {purchase.supplier_name ||
                            "Supplier"}
                        </td>

                        <td className="p-3 font-semibold text-green-700">
                          Cash
                        </td>

                        <td className="p-3 text-right font-bold text-red-600">
                          ₹ {paid.toFixed(2)}
                        </td>
                      </tr>
                    );
                  }
                )}

                <tr className="bg-purple-50 font-bold">
                  <td
                    colSpan={4}
                    className="p-3 text-right"
                  >
                    Total Cash Purchase Payments
                  </td>

                  <td className="p-3 text-right text-red-700">
                    ₹ {cashPurchasePayments.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================
          CALCULATION
      =================================================== */}

      <div className="bg-white rounded-xl shadow-lg p-6 mt-6">

        <h2 className="text-2xl font-bold mb-5">
          Closing Calculation
        </h2>

        <div className="space-y-4">

          <div className="flex justify-between border-b pb-3">
            <span>
              Opening Cash
            </span>

            <strong>
              ₹ {openingCash.toFixed(2)}
            </strong>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="text-green-600">
              + Cash Sales
            </span>

            <strong className="text-green-600">
              ₹ {cashSales.toFixed(2)}
            </strong>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="text-purple-600">
              + Collections
            </span>

            <strong className="text-purple-600">
              ₹ {collections.toFixed(2)}
            </strong>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="text-purple-600">
              - Cash Purchase Payments
            </span>

            <strong className="text-purple-600">
              ₹ {cashPurchasePayments.toFixed(2)}
            </strong>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="text-red-600">
              - Expenses
            </span>

            <strong className="text-red-600">
              ₹ {expenses.toFixed(2)}
            </strong>
          </div>

          <div className="flex justify-between pt-2 text-xl">

            <span className="font-bold">
              Closing Cash
            </span>

            <strong className="text-indigo-600">
              ₹ {closingCash.toFixed(2)}
            </strong>

          </div>

        </div>

      </div>

      {/* ===================================================
          HISTORY
      =================================================== */}

      <div className="bg-white rounded-xl shadow-lg mt-8 overflow-hidden">

        <div className="p-6 border-b">

          <h2 className="text-2xl font-bold">
            Closing History
          </h2>

          <p className="text-gray-500 mt-1">
            Last 30 saved daily closings
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1000px]">

            <thead className="bg-blue-600 text-white">

              <tr>

                <th className="p-3 text-left">
                  Date
                </th>

                <th className="p-3 text-right">
                  Opening
                </th>

                <th className="p-3 text-right">
                  Cash Sales
                </th>

                <th className="p-3 text-right">
                  UPI Sales
                </th>

                <th className="p-3 text-right">
                  Credit Sales
                </th>

                <th className="p-3 text-right">
                  Collections
                </th>

                <th className="p-3 text-right">
                  Expenses
                </th>

                <th className="p-3 text-right">
                  Closing
                </th>

              </tr>

            </thead>

            <tbody>

              {history.length === 0 ? (

                <tr>

                  <td
                    colSpan={8}
                    className="p-8 text-center text-gray-500"
                  >
                    No saved closing records yet.
                  </td>

                </tr>

              ) : (

                history.map((row) => (

                  <tr
                    key={row.id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="p-3 font-semibold">
                      {formatDate(
                        row.closing_date
                      )}
                    </td>

                    <td className="p-3 text-right">
                      ₹{" "}
                      {Number(
                        row.opening_cash || 0
                      ).toFixed(2)}
                    </td>

                    <td className="p-3 text-right text-green-600">
                      ₹{" "}
                      {Number(
                        row.cash_sales || 0
                      ).toFixed(2)}
                    </td>

                    <td className="p-3 text-right text-blue-600">
                      ₹{" "}
                      {Number(
                        row.upi_sales || 0
                      ).toFixed(2)}
                    </td>

                    <td className="p-3 text-right text-yellow-600">
                      ₹{" "}
                      {Number(
                        row.credit_sales || 0
                      ).toFixed(2)}
                    </td>

                    <td className="p-3 text-right text-purple-600">
                      ₹{" "}
                      {Number(
                        row.collections || 0
                      ).toFixed(2)}
                    </td>

                    <td className="p-3 text-right text-red-600">
                      ₹{" "}
                      {Number(
                        row.expenses || 0
                      ).toFixed(2)}
                    </td>

                    <td className="p-3 text-right font-bold text-indigo-700">
                      ₹{" "}
                      {Number(
                        row.closing_cash || 0
                      ).toFixed(2)}
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}