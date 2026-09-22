import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type ClosingRow = {
  id: string;
  closing_date: string;

  opening_cash: number | string | null;
  opening_upi: number | string | null;

  cash_sales: number | string | null;
  upi_sales: number | string | null;

  cash_collections: number | string | null;
  upi_collections: number | string | null;

  expenses: number | string | null;

  closing_cash: number | string | null;
  closing_upi: number | string | null;
};

type SaleRow = {
  id: string;
  payment_method: string | null;
  paid_amount: number | string | null;
  cash_amount: number | string | null;
  upi_amount: number | string | null;
  sale_date: string | null;
};

type CollectionRow = {
  id: string;
  amount: number | string | null;
  payment_method: string | null;
  cash_amount: number | string | null;
  upi_amount: number | string | null;
  collection_date: string | null;
};

type ExpenseRow = {
  id: string;
  amount: number | string | null;
  expense_date: string | null;
};

function todayDate() {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateKey(value: unknown) {
  if (!value) return "";

  const text = String(value);

  const match = text.match(
    /^(\d{4}-\d{2}-\d{2})/
  );

  if (match) return match[1];

  const d = new Date(text);

  if (Number.isNaN(d.getTime())) return "";

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function displayDate(value: string) {
  if (!value) return "-";

  const p = value.substring(0, 10).split("-");

  if (p.length !== 3) return value;

  return `${p[2]}/${p[1]}/${p[0]}`;
}

export default function DailyClosing() {
  const [selectedDate, setSelectedDate] =
    useState(todayDate());

  const [openingCash, setOpeningCash] =
    useState("0");

  const [openingUpi, setOpeningUpi] =
    useState("0");

  const [cashSales, setCashSales] =
    useState(0);

  const [upiSales, setUpiSales] =
    useState(0);

  const [cashCollections, setCashCollections] =
    useState(0);

  const [upiCollections, setUpiCollections] =
    useState(0);

  const [expenses, setExpenses] =
    useState(0);

  const [history, setHistory] =
    useState<ClosingRow[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [manualOpeningCash, setManualOpeningCash] =
    useState(false);

  const [manualOpeningUpi, setManualOpeningUpi] =
    useState(false);

  const closingCash = useMemo(
    () =>
      num(openingCash) +
      cashSales +
      cashCollections -
      expenses,
    [
      openingCash,
      cashSales,
      cashCollections,
      expenses,
    ]
  );

  const closingUpi = useMemo(
    () =>
      num(openingUpi) +
      upiSales +
      upiCollections,
    [
      openingUpi,
      upiSales,
      upiCollections,
    ]
  );

  async function loadClosing(
    date = selectedDate
  ) {
    if (!date) return;

    setLoading(true);

    try {
      /*
       * =====================================================
       * SAVED CLOSING
       * =====================================================
       */

      const {
        data: saved,
        error: savedError,
      } = await supabase
        .from("daily_closings")
        .select("*")
        .eq("closing_date", date)
        .maybeSingle();

      if (savedError) {
        throw savedError;
      }

      /*
       * =====================================================
       * SALES
       * =====================================================
       */

      const {
        data: sales,
        error: salesError,
      } = await supabase
        .from("sales")
        .select(
          `
          id,
          payment_method,
          paid_amount,
          cash_amount,
          upi_amount,
          sale_date
          `
        );

      if (salesError) {
        throw salesError;
      }

      /*
       * =====================================================
       * COLLECTIONS
       * =====================================================
       */

      const {
        data: collections,
        error: collectionsError,
      } = await supabase
        .from("collections")
        .select(
          `
          id,
          amount,
          payment_method,
          cash_amount,
          upi_amount,
          collection_date
          `
        );

      if (collectionsError) {
        throw collectionsError;
      }

      /*
       * =====================================================
       * EXPENSES
       * =====================================================
       */

      const {
        data: expenseRows,
        error: expenseError,
      } = await supabase
        .from("expenses")
        .select(
          `
          id,
          amount,
          expense_date
          `
        );

      if (expenseError) {
        throw expenseError;
      }

      /*
       * =====================================================
       * FILTER DATE
       * =====================================================
       */

      const todaysSales =
        (sales || []).filter(
          (row: SaleRow) =>
            dateKey(row.sale_date) === date
        );

      const todaysCollections =
        (collections || []).filter(
          (row: CollectionRow) =>
            dateKey(
              row.collection_date
            ) === date
        );

      const todaysExpenses =
        (expenseRows || []).filter(
          (row: ExpenseRow) =>
            dateKey(row.expense_date) === date
        );

      /*
       * =====================================================
       * SALES CASH / UPI
       * =====================================================
       */

      let cashSaleTotal = 0;
      let upiSaleTotal = 0;

      todaysSales.forEach(
        (sale: SaleRow) => {
          const method = String(
            sale.payment_method || ""
          )
            .trim()
            .toLowerCase();

          const paid =
            num(sale.paid_amount);

          const cash =
            num(sale.cash_amount);

          const upi =
            num(sale.upi_amount);

          /*
           * Split payment / explicit amounts
           */
          if (cash > 0 || upi > 0) {
            cashSaleTotal += cash;
            upiSaleTotal += upi;
            return;
          }

          if (method === "cash") {
            cashSaleTotal += paid;
          }

          if (method === "upi") {
            upiSaleTotal += paid;
          }
        }
      );

      /*
       * =====================================================
       * COLLECTIONS CASH / UPI
       * =====================================================
       */

      let cashCollectionTotal = 0;
      let upiCollectionTotal = 0;

      todaysCollections.forEach(
        (collection: CollectionRow) => {
          const method = String(
            collection.payment_method || ""
          )
            .trim()
            .toLowerCase();

          const amount =
            num(collection.amount);

          const cash =
            num(collection.cash_amount);

          const upi =
            num(collection.upi_amount);

          /*
           * Split collection
           */
          if (cash > 0 || upi > 0) {
            cashCollectionTotal += cash;
            upiCollectionTotal += upi;
            return;
          }

          if (method === "cash") {
            cashCollectionTotal += amount;
          }

          if (method === "upi") {
            upiCollectionTotal += amount;
          }
        }
      );

      /*
       * =====================================================
       * EXPENSES
       * =====================================================
       */

      const expenseTotal =
        todaysExpenses.reduce(
          (
            total: number,
            row: ExpenseRow
          ) =>
            total + num(row.amount),
          0
        );

      setCashSales(cashSaleTotal);
      setUpiSales(upiSaleTotal);

      setCashCollections(
        cashCollectionTotal
      );

      setUpiCollections(
        upiCollectionTotal
      );

      setExpenses(expenseTotal);

      /*
       * =====================================================
       * OPENING BALANCES
       * =====================================================
       */

      if (saved) {
        /*
         * Existing saved day.
         */
        setOpeningCash(
          String(num(saved.opening_cash))
        );

        setOpeningUpi(
          String(num(saved.opening_upi))
        );

        setManualOpeningCash(true);
        setManualOpeningUpi(true);
      } else {
        /*
         * Find previous closing.
         */

        const {
          data: previous,
          error: previousError,
        } = await supabase
          .from("daily_closings")
          .select(
            `
            closing_date,
            closing_cash,
            closing_upi
            `
          )
          .lt("closing_date", date)
          .order("closing_date", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (previousError) {
          throw previousError;
        }

        if (previous) {
          /*
           * NEXT DAY AUTOMATIC CARRY FORWARD
           */
          setOpeningCash(
            String(
              num(previous.closing_cash)
            )
          );

          setOpeningUpi(
            String(
              num(previous.closing_upi)
            )
          );

          setManualOpeningCash(false);
          setManualOpeningUpi(false);
        } else {
          /*
           * FIRST DAY / NEW START
           */
          setOpeningCash("0");
          setOpeningUpi("0");

          setManualOpeningCash(true);
          setManualOpeningUpi(true);
        }
      }
    } catch (error: any) {
      console.error(
        "DAILY CLOSING LOAD ERROR:",
        error
      );

      alert(
        "Unable to load Daily Closing.\n\n" +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("daily_closings")
        .select("*")
        .order("closing_date", {
          ascending: false,
        })
        .limit(30);

      if (error) throw error;

      setHistory(
        (data || []) as ClosingRow[]
      );
    } catch (error: any) {
      console.error(
        "HISTORY ERROR:",
        error
      );
    }
  }

  async function saveClosing() {
    if (!selectedDate) {
      alert("Select a date first.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        closing_date: selectedDate,

        opening_cash: num(
          openingCash
        ),

        opening_upi: num(
          openingUpi
        ),

        cash_sales: cashSales,

        upi_sales: upiSales,

        cash_collections:
          cashCollections,

        upi_collections:
          upiCollections,

        expenses,

        closing_cash:
          closingCash,

        closing_upi:
          closingUpi,

        updated_at:
          new Date().toISOString(),
      };

      const {
        error,
      } = await supabase
        .from("daily_closings")
        .upsert(payload, {
          onConflict:
            "closing_date",
        });

      if (error) {
        throw error;
      }

      alert(
        `Daily Closing saved.\n\n` +
          `Closing Cash: ${money(
            closingCash
          )}\n` +
          `Closing UPI: ${money(
            closingUpi
          )}`
      );

      await loadHistory();
    } catch (error: any) {
      console.error(
        "SAVE CLOSING ERROR:",
        error
      );

      alert(
        "Unable to save Daily Closing.\n\n" +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadClosing(todayDate());
    void loadHistory();
  }, []);

  function changeDate(
    value: string
  ) {
    setSelectedDate(value);

    if (value) {
      void loadClosing(value);
    }
  }

  function today() {
    const value = todayDate();

    setSelectedDate(value);

    void loadClosing(value);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-5">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Daily Closing
              </h1>

              <p className="text-sm text-slate-500">
                Opening and closing Cash + UPI
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              <input
                type="date"
                value={selectedDate}
                onChange={(e) =>
                  changeDate(
                    e.target.value
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-3 font-semibold"
              />

              <button
                type="button"
                onClick={today}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white"
              >
                Today
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  void loadClosing(
                    selectedDate
                  )
                }
                className="rounded-xl bg-slate-800 px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : "Refresh"}
              </button>

            </div>

          </div>

        </div>

        {/* FIRST DAY */}

        {(manualOpeningCash ||
          manualOpeningUpi) && (
          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">

            <h2 className="font-bold text-blue-800">
              Opening Balance / New Start
            </h2>

            <p className="mt-1 text-sm text-blue-700">
              Enter the Cash and UPI already available
              before starting business. After saving the
              first closing, the next day will automatically
              use these closing balances as opening balances.
            </p>

          </div>
        )}

        {/* OPENING */}

        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">

          <div className="rounded-2xl border border-green-200 bg-green-50 p-5">

            <p className="font-semibold text-green-700">
              Opening Cash
            </p>

            <input
              type="number"
              step="0.01"
              min="0"
              value={openingCash}
              disabled={!manualOpeningCash}
              onChange={(e) =>
                setOpeningCash(
                  e.target.value
                )
              }
              className="mt-2 w-full rounded-xl border border-green-300 bg-white px-4 py-4 text-2xl font-bold text-green-800 disabled:bg-green-100"
            />

            <p className="mt-2 text-xs text-green-700">
              {manualOpeningCash
                ? "Manual entry"
                : "Carried from previous Closing Cash"}
            </p>

          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">

            <p className="font-semibold text-purple-700">
              Opening UPI
            </p>

            <input
              type="number"
              step="0.01"
              min="0"
              value={openingUpi}
              disabled={!manualOpeningUpi}
              onChange={(e) =>
                setOpeningUpi(
                  e.target.value
                )
              }
              className="mt-2 w-full rounded-xl border border-purple-300 bg-white px-4 py-4 text-2xl font-bold text-purple-800 disabled:bg-purple-100"
            />

            <p className="mt-2 text-xs text-purple-700">
              {manualOpeningUpi
                ? "Manual entry"
                : "Carried from previous Closing UPI"}
            </p>

          </div>

        </div>

        {/* MOVEMENT */}

        <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">

          <h2 className="mb-4 text-xl font-bold">
            Today's Movement
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-sm text-green-700">
                Cash Sales
              </p>
              <p className="text-2xl font-bold text-green-800">
                {money(cashSales)}
              </p>
            </div>

            <div className="rounded-xl bg-purple-50 p-4">
              <p className="text-sm text-purple-700">
                UPI Sales
              </p>
              <p className="text-2xl font-bold text-purple-800">
                {money(upiSales)}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-sm text-green-700">
                Cash Collections
              </p>
              <p className="text-2xl font-bold text-green-800">
                {money(
                  cashCollections
                )}
              </p>
            </div>

            <div className="rounded-xl bg-purple-50 p-4">
              <p className="text-sm text-purple-700">
                UPI Collections
              </p>
              <p className="text-2xl font-bold text-purple-800">
                {money(
                  upiCollections
                )}
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-sm text-red-700">
                Expenses
              </p>
              <p className="text-2xl font-bold text-red-800">
                {money(expenses)}
              </p>
            </div>

          </div>

        </div>

        {/* CLOSING */}

        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">

          {/* CASH */}

          <div className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm">

            <div className="mb-4 flex items-center justify-between">

              <h2 className="text-xl font-bold">
                Closing Cash
              </h2>

              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                CASH
              </span>

            </div>

            <div className="space-y-3">

              <div className="flex justify-between">
                <span>Opening Cash</span>
                <b>
                  {money(
                    num(openingCash)
                  )}
                </b>
              </div>

              <div className="flex justify-between text-green-700">
                <span>+ Cash Sales</span>
                <b>
                  {money(cashSales)}
                </b>
              </div>

              <div className="flex justify-between text-green-700">
                <span>+ Cash Collections</span>
                <b>
                  {money(
                    cashCollections
                  )}
                </b>
              </div>

              <div className="flex justify-between text-red-700">
                <span>- Expenses</span>
                <b>
                  {money(expenses)}
                </b>
              </div>

              <div className="border-t pt-4">

                <div className="flex justify-between">

                  <span className="text-lg font-bold">
                    Closing Cash
                  </span>

                  <span className="text-2xl font-bold text-green-700">
                    {money(closingCash)}
                  </span>

                </div>

              </div>

            </div>

          </div>

          {/* UPI */}

          <div className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm">

            <div className="mb-4 flex items-center justify-between">

              <h2 className="text-xl font-bold">
                Closing UPI
              </h2>

              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
                UPI
              </span>

            </div>

            <div className="space-y-3">

              <div className="flex justify-between">
                <span>Opening UPI</span>
                <b>
                  {money(
                    num(openingUpi)
                  )}
                </b>
              </div>

              <div className="flex justify-between text-purple-700">
                <span>+ UPI Sales</span>
                <b>
                  {money(upiSales)}
                </b>
              </div>

              <div className="flex justify-between text-purple-700">
                <span>+ UPI Collections</span>
                <b>
                  {money(
                    upiCollections
                  )}
                </b>
              </div>

              <div className="border-t pt-4">

                <div className="flex justify-between">

                  <span className="text-lg font-bold">
                    Closing UPI
                  </span>

                  <span className="text-2xl font-bold text-purple-700">
                    {money(closingUpi)}
                  </span>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* SAVE */}

        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">

          <button
            type="button"
            disabled={saving || loading}
            onClick={() =>
              void saveClosing()
            }
            className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : "Save Daily Closing"}
          </button>

        </div>

        {/* HISTORY */}

        <div className="rounded-2xl bg-white p-5 shadow-sm">

          <div className="mb-4 flex items-center justify-between">

            <h2 className="text-xl font-bold">
              Closing History
            </h2>

            <button
              type="button"
              onClick={() =>
                void loadHistory()
              }
              className="rounded-lg bg-slate-100 px-4 py-2 font-semibold"
            >
              Refresh
            </button>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1000px] text-sm">

              <thead className="bg-slate-800 text-white">

                <tr>

                  <th className="p-3 text-left">
                    Date
                  </th>

                  <th className="p-3 text-right">
                    Opening Cash
                  </th>

                  <th className="p-3 text-right">
                    Cash Sales
                  </th>

                  <th className="p-3 text-right">
                    Cash Collection
                  </th>

                  <th className="p-3 text-right">
                    Expenses
                  </th>

                  <th className="p-3 text-right">
                    Closing Cash
                  </th>

                  <th className="p-3 text-right">
                    Opening UPI
                  </th>

                  <th className="p-3 text-right">
                    UPI Sales
                  </th>

                  <th className="p-3 text-right">
                    UPI Collection
                  </th>

                  <th className="p-3 text-right">
                    Closing UPI
                  </th>

                </tr>

              </thead>

              <tbody>

                {history.length === 0 ? (

                  <tr>
                    <td
                      colSpan={10}
                      className="p-8 text-center text-slate-500"
                    >
                      No closing history.
                    </td>
                  </tr>

                ) : (

                  history.map((row) => (

                    <tr
                      key={row.id}
                      className="border-b hover:bg-slate-50"
                    >

                      <td className="p-3 font-semibold">
                        {displayDate(
                          row.closing_date
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {money(
                          num(
                            row.opening_cash
                          )
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {money(
                          num(
                            row.cash_sales
                          )
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {money(
                          num(
                            row.cash_collections
                          )
                        )}
                      </td>

                      <td className="p-3 text-right text-red-600">
                        {money(
                          num(
                            row.expenses
                          )
                        )}
                      </td>

                      <td className="p-3 text-right font-bold text-green-700">
                        {money(
                          num(
                            row.closing_cash
                          )
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {money(
                          num(
                            row.opening_upi
                          )
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {money(
                          num(
                            row.upi_sales
                          )
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {money(
                          num(
                            row.upi_collections
                          )
                        )}
                      </td>

                      <td className="p-3 text-right font-bold text-purple-700">
                        {money(
                          num(
                            row.closing_upi
                          )
                        )}
                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>
    </div>
  );
}