import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  customer_name: string;
};

type Advance = {
  id: string;
  customer_id: string;
  advance_date: string;
  amount: number | string;
  adjusted_amount: number | string;
  payment_method: string | null;
  notes: string | null;
};

export default function CustomerAdvances() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // =========================================================
  // LOAD PAGE
  // =========================================================

  async function loadPage() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [customersResult, advancesResult] =
        await Promise.all([
          supabase
            .from("customers")
            .select("id, customer_name")
            .order("customer_name"),

          supabase
            .from("customer_advances")
            .select(`
              id,
              customer_id,
              advance_date,
              amount,
              adjusted_amount,
              payment_method,
              notes
            `)
            .order("advance_date", {
              ascending: false,
            }),
        ]);

      if (customersResult.error) {
        throw customersResult.error;
      }

      if (advancesResult.error) {
        throw advancesResult.error;
      }

      setCustomers(
        (customersResult.data || []) as Customer[]
      );

      setAdvances(
        (advancesResult.data || []) as Advance[]
      );
    } catch (error: any) {
      console.error(
        "CUSTOMER ADVANCES LOAD ERROR:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to load customer advances."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadPage();
  }, []);

  // =========================================================
  // SAVE ADVANCE
  // =========================================================

  async function saveAdvance() {
    setErrorMessage("");

    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    const advanceAmount = Number(amount);

    if (
      !Number.isFinite(advanceAmount) ||
      advanceAmount <= 0
    ) {
      alert("Please enter a valid advance amount.");
      return;
    }

    setSaving(true);

    try {
      // Check authentication
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.log(
        "MANVI ADVANCE AUTH USER:",
        session?.user?.id
      );

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        throw new Error(
          "MANVI ERP login session is missing. Please log in again."
        );
      }

      // Today's date in India
      const today = new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      ).format(new Date());

      const { data, error } = await supabase
        .from("customer_advances")
        .insert({
          customer_id: customerId,
          advance_date: today,
          amount: advanceAmount,
          adjusted_amount: 0,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      console.log(
        "MANVI ADVANCE INSERT RESULT:",
        data,
        error
      );

      if (error) {
        throw error;
      }

      alert(
        `Customer advance ₹${advanceAmount.toFixed(
          2
        )} saved successfully.`
      );

      setAmount("");
      setNotes("");
      setPaymentMethod("Cash");

      await loadPage();
    } catch (error: any) {
      console.error(
        "CUSTOMER ADVANCE SAVE ERROR:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to save customer advance."
      );

      alert(
        "Save Error: " +
          (
            error?.message ||
            "Unable to save customer advance."
          )
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // CUSTOMER NAME
  // =========================================================

  function getCustomerName(
    customerIdValue: string
  ) {
    const customer = customers.find(
      (item) =>
        String(item.id) ===
        String(customerIdValue)
    );

    return (
      customer?.customer_name ||
      "Customer"
    );
  }

  // =========================================================
  // AVAILABLE ADVANCE
  // =========================================================

  function getAvailableAdvance(
    advance: Advance
  ) {
    const received = Number(
      advance.amount || 0
    );

    const adjusted = Number(
      advance.adjusted_amount || 0
    );

    return Math.max(
      0,
      received - adjusted
    );
  }

  // =========================================================
  // TOTAL AVAILABLE ADVANCE
  // =========================================================

  const totalAvailableAdvance =
    advances.reduce(
      (sum, advance) =>
        sum +
        getAvailableAdvance(advance),
      0
    );

  // =========================================================
  // DATE
  // =========================================================

  function formatDate(
    value: string
  ) {
    if (!value) {
      return "—";
    }

    const date = new Date(
      `${value}T00:00:00`
    );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
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

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="space-y-6 pb-8">

      {/* HEADER */}

      <section className="rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <p className="text-sm font-semibold text-blue-100">
              MANVI MILK AGENCIES
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Customer Advances
            </h1>

            <p className="mt-2 text-sm text-blue-100">
              Manage customer advance payments
              for future bills.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPage}
            disabled={loading}
            className="rounded-xl bg-white px-5 py-3 font-bold text-blue-700 shadow hover:bg-blue-50 disabled:opacity-60"
          >
            {loading
              ? "Loading..."
              : "↻ Refresh"}
          </button>

        </div>

      </section>

      {/* ERROR */}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <div>
            {errorMessage}
          </div>

          <div className="mt-2 text-xs font-normal">
            If this says "row-level security policy",
            the page is working but the Supabase
            RLS policy needs to allow the logged-in
            user to insert/read customer advances.
          </div>
        </div>
      )}

      {/* SUMMARY */}

      <section className="grid gap-4 md:grid-cols-3">

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">

          <p className="text-sm text-slate-500">
            Advance Records
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-800">
            {loading
              ? "—"
              : advances.length}
          </p>

        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">

          <p className="text-sm text-slate-500">
            Customers
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-800">
            {loading
              ? "—"
              : customers.length}
          </p>

        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">

          <p className="text-sm text-slate-500">
            Total Available Advance
          </p>

          <p className="mt-2 text-3xl font-bold text-green-600">
            ₹
            {totalAvailableAdvance.toFixed(
              2
            )}
          </p>

        </div>

      </section>

      {/* ADD ADVANCE */}

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

        <h2 className="text-xl font-bold text-slate-800">
          Add Customer Advance
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Record money received from a customer
          before it is used against a future bill.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">

          {/* CUSTOMER */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Customer
            </label>

            <select
              value={customerId}
              onChange={(e) =>
                setCustomerId(
                  e.target.value
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500"
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
          </div>

          {/* AMOUNT */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Advance Amount
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
              placeholder="Enter amount"
              className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

          {/* PAYMENT */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Payment Method
            </label>

            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500"
            >

              <option value="Cash">
                Cash
              </option>

              <option value="UPI">
                UPI
              </option>

              <option value="Bank">
                Bank
              </option>

            </select>
          </div>

          {/* NOTES */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Notes
            </label>

            <input
              type="text"
              value={notes}
              onChange={(e) =>
                setNotes(
                  e.target.value
                )
              }
              placeholder="Optional notes"
              className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

        </div>

        {/* SAVE */}

        <button
          type="button"
          onClick={saveAdvance}
          disabled={
            saving ||
            loading ||
            customers.length === 0
          }
          className="mt-6 rounded-lg bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : "Save Customer Advance"}
        </button>

      </section>

      {/* HISTORY */}

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

        <div className="border-b border-slate-200 p-6">

          <h2 className="text-xl font-bold text-slate-800">
            Advance History
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            All customer advance payments.
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-[900px] w-full">

            <thead className="bg-blue-600 text-white">

              <tr>

                <th className="p-3 text-left">
                  Date
                </th>

                <th className="p-3 text-left">
                  Customer
                </th>

                <th className="p-3 text-right">
                  Received
                </th>

                <th className="p-3 text-right">
                  Adjusted
                </th>

                <th className="p-3 text-right">
                  Available
                </th>

                <th className="p-3 text-center">
                  Payment
                </th>

                <th className="p-3 text-left">
                  Notes
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-slate-500"
                  >
                    Loading customer advances...
                  </td>
                </tr>

              ) : advances.length === 0 ? (

                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-slate-500"
                  >
                    No customer advances found.
                  </td>
                </tr>

              ) : (

                advances.map(
                  (advance) => {

                    const available =
                      getAvailableAdvance(
                        advance
                      );

                    return (
                      <tr
                        key={advance.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >

                        <td className="p-3">
                          {formatDate(
                            advance.advance_date
                          )}
                        </td>

                        <td className="p-3 font-semibold text-slate-700">
                          {getCustomerName(
                            advance.customer_id
                          )}
                        </td>

                        <td className="p-3 text-right font-semibold">
                          ₹
                          {Number(
                            advance.amount || 0
                          ).toFixed(2)}
                        </td>

                        <td className="p-3 text-right text-blue-600">
                          ₹
                          {Number(
                            advance.adjusted_amount ||
                              0
                          ).toFixed(2)}
                        </td>

                        <td className="p-3 text-right font-bold text-green-600">
                          ₹
                          {available.toFixed(
                            2
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                            {advance.payment_method ||
                              "—"}
                          </span>
                        </td>

                        <td className="p-3 text-slate-500">
                          {advance.notes ||
                            "—"}
                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}