import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type SupplierRow = {
  id: string;
  name: string;
  mobile: string;
  address: string;
  opening_balance: number;
  total_purchases: number;
  purchase_paid: number;
  purchase_outstanding: number;
  supplier_payments: number;
  outstanding: number;
};

type PurchaseRow = {
  supplier_name: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
};

type SupplierPayment = {
  id: string;
  supplier_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  cash_amount?: number;
  upi_amount?: number;
  bank_amount?: number;
  reference: string;
  remarks: string;
  supplier_name: string;
};

function money(value: number | string | null | undefined) {
  return `₹ ${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function todayInput() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(value: string) {
  const parts = String(value || "").slice(0, 10).split("-");
  if (parts.length !== 3) return value || "-";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const item = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const message = text(item.message);
    const details = text(item.details);
    const hint = text(item.hint);
    return [message, details, hint].filter(Boolean).join(" • ") || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [loadWarning, setLoadWarning] = useState("");

  // Supplier master
  const [supplierName, setSupplierName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Supplier payment
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(todayInput());
  const [paymentSupplierId, setPaymentSupplierId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentCashAmount, setPaymentCashAmount] = useState("");
  const [paymentUpiAmount, setPaymentUpiAmount] = useState("");
  const [paymentBankAmount, setPaymentBankAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadSuppliers(), loadPayments()]);
  }

  async function loadSuppliers() {
    setLoading(true);
    setLoadWarning("");
    try {
      const { data: supplierData, error: supplierError } = await supabase
        .from("suppliers")
        .select(`id, supplier_name, mobile, address, opening_balance`)
        .order("supplier_name", { ascending: true });

      if (supplierError) throw supplierError;

      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .select(`supplier_name, total_amount, paid_amount, balance_amount`);

      if (purchaseError) {
        setLoadWarning(
          `Supplier master loaded, but purchase totals could not be loaded: ${getErrorMessage(
            purchaseError,
            "Unknown purchase query error."
          )}`
        );
      }

      const purchaseMap = new Map<
        string,
        { total: number; paid: number; balance: number }
      >();

      (purchaseData || []).forEach((purchase: PurchaseRow) => {
        const name = text(purchase.supplier_name);
        if (!name) return;
        const key = name.toLowerCase();
        const current = purchaseMap.get(key) || { total: 0, paid: 0, balance: 0 };
        const total = Number(purchase.total_amount || 0);
        const paid = Number(purchase.paid_amount || 0);
        const savedBalance = Number(purchase.balance_amount);
        const balance = Number.isFinite(savedBalance)
          ? Math.max(savedBalance, 0)
          : Math.max(total - paid, 0);
        if (Number.isFinite(total)) current.total += total;
        if (Number.isFinite(paid)) current.paid += paid;
        if (Number.isFinite(balance)) current.balance += balance;
        purchaseMap.set(key, current);
      });

      const paymentMap = new Map<string, number>();
      payments.forEach((payment) => {
        const key = String(payment.supplier_id);
        paymentMap.set(key, (paymentMap.get(key) || 0) + Number(payment.amount || 0));
      });

      const rows: SupplierRow[] = (supplierData || []).map((supplier: any) => {
        const name = text(supplier.supplier_name);
        const purchaseSummary = purchaseMap.get(name.toLowerCase()) || {
          total: 0,
          paid: 0,
          balance: 0,
        };
        const opening = Math.max(Number(supplier.opening_balance || 0), 0);
        const supplierPayments = paymentMap.get(String(supplier.id)) || 0;
        return {
          id: String(supplier.id),
          name,
          mobile: text(supplier.mobile),
          address: text(supplier.address),
          opening_balance: opening,
          total_purchases: purchaseSummary.total,
          purchase_paid: purchaseSummary.paid,
          purchase_outstanding: purchaseSummary.balance,
          supplier_payments: supplierPayments,
          outstanding: Math.max(0, opening + purchaseSummary.balance - supplierPayments),
        };
      });

      setSuppliers(rows);
    } catch (error) {
      console.error("SUPPLIER LOADING ERROR:", error);
      setSuppliers([]);
      alert(`Unable to load suppliers.\n\n${getErrorMessage(error, "Unknown error.")}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments() {
    try {
      const { data, error } = await supabase
        .from("supplier_payments")
        .select(`
          id,
          supplier_id,
          payment_date,
          amount,
          payment_method,
          cash_amount,
          upi_amount,
          bank_amount,
          reference,
          remarks,
          suppliers ( supplier_name )
        `)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows: SupplierPayment[] = (data || []).map((row: any) => ({
        id: String(row.id),
        supplier_id: String(row.supplier_id),
        payment_date: String(row.payment_date || "").slice(0, 10),
        amount: Number(row.amount || 0),
        payment_method: text(row.payment_method) || "Cash",
        cash_amount: Number(row.cash_amount || 0),
        upi_amount: Number(row.upi_amount || 0),
        bank_amount: Number(row.bank_amount || 0),
        reference: text(row.reference),
        remarks: text(row.remarks),
        supplier_name: text(row.suppliers?.supplier_name) || "Unknown Supplier",
      }));

      setPayments(rows);
    } catch (error: any) {
      console.error("SUPPLIER PAYMENT LOAD ERROR:", error);
      setPayments([]);
      setLoadWarning(
        `Supplier payments could not be loaded: ${getErrorMessage(
          error,
          "Unknown payment query error."
        )}`
      );
    }
  }

  async function refreshData() {
    await loadPayments();
    await loadSuppliers();
  }

  async function saveSupplier() {
    const cleanName = supplierName.trim();
    const cleanMobile = mobile.trim();
    const cleanAddress = address.trim();
    const opening = Number(openingBalance);

    if (!cleanName) {
      alert("Enter supplier name.");
      return;
    }
    if (!Number.isFinite(opening) || opening < 0) {
      alert("Opening balance must be a valid amount.");
      return;
    }
    const duplicate = suppliers.some(
      (supplier) =>
        supplier.id !== editingId && supplier.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      alert("A supplier with this name already exists.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("suppliers")
          .update({
            supplier_name: cleanName,
            mobile: cleanMobile || null,
            address: cleanAddress || null,
            opening_balance: opening,
          })
          .eq("id", editingId);
        if (error) throw error;
        alert("Supplier updated successfully.");
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert({
            supplier_name: cleanName,
            mobile: cleanMobile || null,
            address: cleanAddress || null,
            opening_balance: opening,
          });
        if (error) throw error;
        alert("Supplier added successfully.");
      }
      clearSupplierForm();
      await loadSuppliers();
    } catch (error) {
      console.error("SAVE SUPPLIER ERROR:", error);
      alert(`Unable to save supplier.\n\n${getErrorMessage(error, "Unknown error.")}`);
    } finally {
      setSaving(false);
    }
  }

  function editSupplier(supplier: SupplierRow) {
    setEditingId(supplier.id);
    setSupplierName(supplier.name);
    setMobile(supplier.mobile);
    setAddress(supplier.address);
    setOpeningBalance(String(supplier.opening_balance));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteSupplier(id: string) {
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) return;
    if (supplier.total_purchases > 0 || supplier.supplier_payments > 0) {
      alert("This supplier has purchase or payment transactions. Resolve those records before deleting the supplier.");
      return;
    }
    const confirmed = window.confirm(`Delete supplier "${supplier.name}"?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      if (editingId === id) clearSupplierForm();
      alert("Supplier deleted successfully.");
      await loadSuppliers();
    } catch (error) {
      console.error("DELETE SUPPLIER ERROR:", error);
      alert(`Unable to delete supplier.\n\n${getErrorMessage(error, "Unknown error.")}`);
    } finally {
      setLoading(false);
    }
  }

  function clearSupplierForm() {
    setEditingId(null);
    setSupplierName("");
    setMobile("");
    setAddress("");
    setOpeningBalance("0");
  }

  function clearPaymentForm() {
    setPaymentId(null);
    setPaymentDate(todayInput());
    setPaymentSupplierId("");
    setPaymentAmount("");
    setPaymentMethod("Cash");
    setPaymentCashAmount("");
    setPaymentUpiAmount("");
    setPaymentBankAmount("");
    setPaymentReference("");
    setPaymentRemarks("");
  }

  function editPayment(payment: SupplierPayment) {
    setPaymentId(payment.id);
    setPaymentDate(payment.payment_date || todayInput());
    setPaymentSupplierId(payment.supplier_id);
    setPaymentAmount(String(payment.amount));
    setPaymentMethod(payment.payment_method || "Cash");
    setPaymentCashAmount(String(Number(payment.cash_amount || 0)));
    setPaymentUpiAmount(String(Number(payment.upi_amount || 0)));
    setPaymentBankAmount(String(Number(payment.bank_amount || 0)));
    setPaymentReference(payment.reference);
    setPaymentRemarks(payment.remarks);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function savePayment() {
    if (!paymentSupplierId) {
      alert("Please select a supplier.");
      return;
    }
    if (!paymentDate) {
      alert("Please select payment date.");
      return;
    }

    const cashPart = Math.round(Number(paymentCashAmount || 0));
    const upiPart = Math.round(Number(paymentUpiAmount || 0));
    const bankPart = Math.round(Number(paymentBankAmount || 0));

    const amount =
      paymentMethod === "Split"
        ? cashPart + upiPart + bankPart
        : Math.round(Number(paymentAmount || 0));

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    if (paymentMethod === "Split" && (cashPart < 0 || upiPart < 0 || bankPart < 0)) {
      alert("Split payment amounts cannot be negative.");
      return;
    }

    const supplier = suppliers.find((item) => item.id === paymentSupplierId);
    if (!supplier) {
      alert("Selected supplier was not found.");
      return;
    }

    // Allow an edited payment to be reused against its own existing outstanding.
    const existingPayment = paymentId
      ? payments.find((item) => item.id === paymentId)
      : null;
    const availableOutstanding =
      supplier.outstanding +
      (existingPayment?.supplier_id === supplier.id ? Number(existingPayment.amount || 0) : 0);

    if (amount > availableOutstanding + 0.0001) {
      alert(
        `Payment cannot exceed supplier outstanding.\n\nAvailable outstanding: ${money(
          availableOutstanding
        )}`
      );
      return;
    }

    setPaymentSaving(true);
    try {
      const payload = {
        supplier_id: paymentSupplierId,
        payment_date: paymentDate,
        amount: Math.round(amount),
        payment_method: paymentMethod,
        cash_amount:
          paymentMethod === "Split"
            ? cashPart
            : paymentMethod === "Cash"
            ? Math.round(amount)
            : 0,
        upi_amount:
          paymentMethod === "Split"
            ? upiPart
            : paymentMethod === "UPI"
            ? Math.round(amount)
            : 0,
        bank_amount:
          paymentMethod === "Split"
            ? bankPart
            : paymentMethod === "Bank"
            ? Math.round(amount)
            : 0,
        reference: paymentReference.trim() || null,
        remarks: paymentRemarks.trim() || null,
      };

      if (paymentId) {
        const { error } = await supabase
          .from("supplier_payments")
          .update(payload)
          .eq("id", paymentId);
        if (error) throw error;
        alert("Supplier payment updated successfully.");
      } else {
        const { error } = await supabase.from("supplier_payments").insert(payload);
        if (error) throw error;
        alert("Supplier payment saved successfully.");
      }

      clearPaymentForm();
      await refreshData();
    } catch (error: any) {
      console.error("SAVE SUPPLIER PAYMENT ERROR:", error);
      alert(
        `Unable to save supplier payment.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setPaymentSaving(false);
    }
  }

  async function deletePayment(payment: SupplierPayment) {
    const confirmed = window.confirm(
      `Delete supplier payment of ${money(payment.amount)} made on ${formatDate(payment.payment_date)} to ${payment.supplier_name}?\n\nThis will increase the supplier outstanding again.`
    );
    if (!confirmed) return;

    setPaymentSaving(true);
    try {
      const { error } = await supabase
        .from("supplier_payments")
        .delete()
        .eq("id", payment.id);
      if (error) throw error;
      if (paymentId === payment.id) clearPaymentForm();
      alert("Supplier payment deleted successfully.");
      await refreshData();
    } catch (error: any) {
      console.error("DELETE SUPPLIER PAYMENT ERROR:", error);
      alert(
        `Unable to delete supplier payment.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setPaymentSaving(false);
    }
  }

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(query) ||
        supplier.mobile.toLowerCase().includes(query) ||
        supplier.address.toLowerCase().includes(query)
    );
  }, [suppliers, search]);

  const totalOutstanding = useMemo(
    () => suppliers.reduce((sum, supplier) => sum + supplier.outstanding, 0),
    [suppliers]
  );

  const totalPayments = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );

  return (
    <div className="mx-auto max-w-7xl pb-10">
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">Suppliers</h1>
        <p className="mt-1 text-blue-100">
          Supplier master, daily supplier payments and outstanding ledger
        </p>
      </div>

      {loadWarning && (
        <div className="mb-5 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          {loadWarning}
        </div>
      )}

      {/* SUPPLIER MASTER */}
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {editingId ? "Edit Supplier" : "Add Supplier"}
            </h2>
            <p className="text-sm text-slate-500">Supplier master details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <input className="rounded-lg border p-3" placeholder="Supplier name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          <input className="rounded-lg border p-3" placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          <input className="rounded-lg border p-3" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <input className="rounded-lg border p-3" type="number" min="0" placeholder="Opening balance" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void saveSupplier()} disabled={saving} className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : editingId ? "Update Supplier" : "Add Supplier"}
          </button>
          {editingId && (
            <button type="button" onClick={clearSupplierForm} className="rounded-lg bg-slate-500 px-6 py-3 font-bold text-white hover:bg-slate-600">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* SUPPLIER PAYMENT */}
      <div className="mb-6 rounded-2xl border-2 border-green-100 bg-white p-6 shadow-lg">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-800">
            {paymentId ? "Edit Supplier Payment" : "Supplier Payment Entry"}
          </h2>
          <p className="text-sm text-slate-500">
            Record the payment actually made to a supplier. Date can be changed later.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600">Payment Date</label>
            <input type="date" className="w-full rounded-lg border p-3" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-600">Supplier</label>
            <select className="w-full rounded-lg border p-3" value={paymentSupplierId} onChange={(e) => setPaymentSupplierId(e.target.value)}>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} — Outstanding {money(supplier.outstanding)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600">Amount</label>
            <input type="number" min="1" step="1" className="w-full rounded-lg border p-3" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600">Payment Mode</label>
            <select
              className="w-full rounded-lg border p-3"
              value={paymentMethod}
              onChange={(e) => {
                const value = e.target.value;
                setPaymentMethod(value);
                if (value !== "Split") {
                  setPaymentCashAmount("");
                  setPaymentUpiAmount("");
                  setPaymentBankAmount("");
                }
              }}
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank">Bank</option>
              <option value="Split">Split Payment</option>
            </select>
          </div>

          {paymentMethod === "Split" && (
            <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="mb-3 font-bold text-blue-900">Split Payment</div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Cash</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full rounded-lg border p-3"
                    value={paymentCashAmount}
                    onChange={(e) => setPaymentCashAmount(e.target.value)}
                    placeholder="Cash amount"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">UPI</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full rounded-lg border p-3"
                    value={paymentUpiAmount}
                    onChange={(e) => setPaymentUpiAmount(e.target.value)}
                    placeholder="UPI amount"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Bank</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full rounded-lg border p-3"
                    value={paymentBankAmount}
                    onChange={(e) => setPaymentBankAmount(e.target.value)}
                    placeholder="Bank amount"
                  />
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-white p-3 font-bold text-slate-800">
                Split Total: ₹{" "}
                {(
                  Number(paymentCashAmount || 0) +
                  Number(paymentUpiAmount || 0) +
                  Number(paymentBankAmount || 0)
                ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600">Reference</label>
            <input className="w-full rounded-lg border p-3" placeholder="UTR / reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <input className="w-full rounded-lg border p-3" placeholder="Remarks (optional)" value={paymentRemarks} onChange={(e) => setPaymentRemarks(e.target.value)} />
        </div>

        {paymentSupplierId && (
          <div className="mt-4 rounded-xl bg-blue-50 p-4">
            <span className="text-sm text-slate-600">Current outstanding: </span>
            <span className="font-bold text-red-700">
              {money(suppliers.find((item) => item.id === paymentSupplierId)?.outstanding || 0)}
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void savePayment()} disabled={paymentSaving} className="rounded-lg bg-green-600 px-7 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50">
            {paymentSaving ? "Saving..." : paymentId ? "Update Payment" : "Save Supplier Payment"}
          </button>
          {paymentId && (
            <button type="button" onClick={clearPaymentForm} className="rounded-lg bg-slate-500 px-6 py-3 font-bold text-white hover:bg-slate-600">
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Suppliers</p>
          <p className="mt-1 text-2xl font-bold">{suppliers.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Total Supplier Payments</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{money(totalPayments)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Total Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{money(totalOutstanding)}</p>
        </div>
      </div>

      {/* SUPPLIER TABLE */}
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Supplier Outstanding</h2>
            <p className="text-sm text-slate-500">Opening + unpaid purchases − supplier payments</p>
          </div>
          <input className="rounded-lg border p-3 md:w-80" placeholder="Search supplier..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[1150px]">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="p-3 text-left">Supplier</th>
                <th className="p-3 text-left">Mobile</th>
                <th className="p-3 text-right">Opening</th>
                <th className="p-3 text-right">Purchases</th>
                <th className="p-3 text-right">Paid in Purchase</th>
                <th className="p-3 text-right">Supplier Payments</th>
                <th className="p-3 text-right">Outstanding</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading suppliers...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">No suppliers found.</td></tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-semibold">{supplier.name}</td>
                    <td className="p-3">{supplier.mobile || "-"}</td>
                    <td className="p-3 text-right">{money(supplier.opening_balance)}</td>
                    <td className="p-3 text-right font-semibold text-purple-700">{money(supplier.total_purchases)}</td>
                    <td className="p-3 text-right text-green-700">{money(supplier.purchase_paid)}</td>
                    <td className="p-3 text-right font-semibold text-blue-700">{money(supplier.supplier_payments)}</td>
                    <td className={`p-3 text-right font-bold ${supplier.outstanding > 0 ? "text-red-600" : "text-green-600"}`}>{money(supplier.outstanding)}</td>
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => editSupplier(supplier)} className="rounded bg-yellow-500 px-3 py-1 text-sm font-semibold text-white">Edit</button>
                        <button type="button" onClick={() => void deleteSupplier(supplier.id)} className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAYMENT HISTORY */}
      <div className="rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-800">Supplier Payment History</h2>
          <p className="text-sm text-slate-500">Payments can be edited, deleted, or moved to another date.</p>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[900px]">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Supplier</th>
                <th className="p-3 text-left">Mode</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Reference</th>
                <th className="p-3 text-left">Remarks</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No supplier payments found.</td></tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">{formatDate(payment.payment_date)}</td>
                    <td className="p-3 font-semibold">{payment.supplier_name}</td>
                    <td className="p-3">{payment.payment_method}</td>
                    <td className="p-3 text-right font-bold text-green-700">{money(payment.amount)}</td>
                    <td className="p-3">{payment.reference || "-"}</td>
                    <td className="p-3">{payment.remarks || "-"}</td>
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => editPayment(payment)} className="rounded bg-yellow-500 px-3 py-1 text-sm font-semibold text-white">Edit</button>
                        <button type="button" onClick={() => void deletePayment(payment)} disabled={paymentSaving} className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">Delete</button>
                      </div>
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
