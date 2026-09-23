import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  FiCheckSquare,
  FiChevronDown,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";

type EntryKind = "income" | "expense";

type IncomeRow = {
  id: string;
  entry_date: string;
  source: string;
  description: string | null;
  amount: number;
  payment_method: string;
  include_in_calculation: boolean;
};

type ExpenseRow = {
  id: string;
  entry_date: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string;
  include_in_calculation: boolean;
};

const INCOME_SOURCES = [
  "Salary / Income",
  "Business Drawings",
  "Interest",
  "Investment Income",
  "Refund",
  "Gift / Received",
  "Other Income",
];

const EXPENSE_CATEGORIES = [
  "Food",
  "Fuel / Travel",
  "Shopping",
  "Household",
  "Medical",
  "Education",
  "Bills / Utilities",
  "Entertainment",
  "EMI / Loan",
  "Insurance",
  "Investment",
  "Gift",
  "Other",
];

const PAYMENT_METHODS = ["Cash", "UPI", "Bank"];

function todayInput() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function money(value: number) {
  return `₹ ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function displayDate(value: string) {
  if (!value) return "-";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function csvSafe(value: string | number | boolean | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function PersonalExpenses() {
  const [activeTab, setActiveTab] = useState<EntryKind>("expense");
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [search, setSearch] = useState("");

  const [editingType, setEditingType] = useState<EntryKind | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState(todayInput());
  const [entryName, setEntryName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [includeInCalculation, setIncludeInCalculation] = useState(true);
  const [customName, setCustomName] = useState(false);

  const isEditing = Boolean(editingId && editingType);

  const loadData = async () => {
    try {
      setLoading(true);

      const [{ data: income, error: incomeError }, { data: expenses, error: expenseError }] =
        await Promise.all([
          supabase
            .from("personal_income")
            .select(
              "id, entry_date, source, description, amount, payment_method, include_in_calculation"
            )
            .order("entry_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("personal_expenses")
            .select(
              "id, entry_date, category, description, amount, payment_method, include_in_calculation"
            )
            .order("entry_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

      if (incomeError) throw incomeError;
      if (expenseError) throw expenseError;

      setIncomeRows(
        (income || []).map((row: any) => ({
          id: row.id,
          entry_date: String(row.entry_date || "").slice(0, 10),
          source: row.source || "Other Income",
          description: row.description || null,
          amount: Number(row.amount) || 0,
          payment_method: row.payment_method || "Cash",
          include_in_calculation: row.include_in_calculation !== false,
        }))
      );

      setExpenseRows(
        (expenses || []).map((row: any) => ({
          id: row.id,
          entry_date: String(row.entry_date || "").slice(0, 10),
          category: row.category || "Other",
          description: row.description || null,
          amount: Number(row.amount) || 0,
          payment_method: row.payment_method || "Cash",
          include_in_calculation: row.include_in_calculation !== false,
        }))
      );
    } catch (error: any) {
      console.error("PERSONAL FINANCE LOAD ERROR:", error);
      alert(`Unable to load Personal Expenses.\n\n${error?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const resetForm = () => {
    setEditingType(null);
    setEditingId(null);
    setEntryDate(todayInput());
    setEntryName("");
    setDescription("");
    setAmount("");
    setPaymentMethod("Cash");
    setIncludeInCalculation(true);
    setCustomName(false);
  };

  const startAdd = (type: EntryKind) => {
    resetForm();
    setActiveTab(type);
  };

  const startEditIncome = (row: IncomeRow) => {
    setActiveTab("income");
    setEditingType("income");
    setEditingId(row.id);
    setEntryDate(row.entry_date);
    setEntryName(row.source);
    setDescription(row.description || "");
    setAmount(String(row.amount));
    setPaymentMethod(row.payment_method);
    setIncludeInCalculation(row.include_in_calculation);
    setCustomName(!INCOME_SOURCES.includes(row.source));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEditExpense = (row: ExpenseRow) => {
    setActiveTab("expense");
    setEditingType("expense");
    setEditingId(row.id);
    setEntryDate(row.entry_date);
    setEntryName(row.category);
    setDescription(row.description || "");
    setAmount(String(row.amount));
    setPaymentMethod(row.payment_method);
    setIncludeInCalculation(row.include_in_calculation);
    setCustomName(!EXPENSE_CATEGORIES.includes(row.category));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEntry = async () => {
    const numericAmount = Number(amount);
    const finalName = entryName.trim();

    if (!entryDate) {
      alert("Please select a date.");
      return;
    }

    if (!finalName) {
      alert(activeTab === "income" ? "Please select or enter an income source." : "Please select or enter an expense category.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      alert("Please enter a valid amount greater than zero.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        entry_date: entryDate,
        amount: numericAmount,
        payment_method: paymentMethod,
        description: description.trim() || null,
        include_in_calculation: includeInCalculation,
      };

      if (activeTab === "income") {
        if (isEditing && editingType === "income" && editingId) {
          const { error } = await supabase
            .from("personal_income")
            .update({
              ...payload,
              source: finalName,
            })
            .eq("id", editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("personal_income")
            .insert({
              ...payload,
              source: finalName,
            });
          if (error) throw error;
        }
      } else {
        if (isEditing && editingType === "expense" && editingId) {
          const { error } = await supabase
            .from("personal_expenses")
            .update({
              ...payload,
              category: finalName,
            })
            .eq("id", editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("personal_expenses")
            .insert({
              ...payload,
              category: finalName,
            });
          if (error) throw error;
        }
      }

      resetForm();
      await loadData();
    } catch (error: any) {
      console.error("PERSONAL FINANCE SAVE ERROR:", error);
      alert(`Unable to save entry.\n\n${error?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteIncome = async (id: string) => {
    if (!window.confirm("Delete this personal income entry?")) return;

    try {
      setSaving(true);
      const { error } = await supabase.from("personal_income").delete().eq("id", id);
      if (error) throw error;
      if (editingId === id && editingType === "income") resetForm();
      await loadData();
    } catch (error: any) {
      alert(`Unable to delete income.\n\n${error?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!window.confirm("Delete this personal expense entry?")) return;

    try {
      setSaving(true);
      const { error } = await supabase.from("personal_expenses").delete().eq("id", id);
      if (error) throw error;
      if (editingId === id && editingType === "expense") resetForm();
      await loadData();
    } catch (error: any) {
      alert(`Unable to delete expense.\n\n${error?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const updateInclude = async (type: EntryKind, id: string, checked: boolean) => {
    try {
      if (type === "income") {
        setIncomeRows((rows) =>
          rows.map((row) => (row.id === id ? { ...row, include_in_calculation: checked } : row))
        );
        const { error } = await supabase
          .from("personal_income")
          .update({ include_in_calculation: checked })
          .eq("id", id);
        if (error) throw error;
      } else {
        setExpenseRows((rows) =>
          rows.map((row) => (row.id === id ? { ...row, include_in_calculation: checked } : row))
        );
        const { error } = await supabase
          .from("personal_expenses")
          .update({ include_in_calculation: checked })
          .eq("id", id);
        if (error) throw error;
      }
    } catch (error: any) {
      await loadData();
      alert(`Unable to update calculation selection.\n\n${error?.message || "Unknown error"}`);
    }
  };

  const filteredIncome = useMemo(() => {
    const text = search.trim().toLowerCase();
    return incomeRows.filter((row) => {
      if (fromDate && row.entry_date < fromDate) return false;
      if (toDate && row.entry_date > toDate) return false;
      if (text && !`${row.source} ${row.description || ""} ${row.payment_method}`.toLowerCase().includes(text)) return false;
      if (categoryFilter !== "All" && row.source !== categoryFilter) return false;
      return true;
    });
  }, [incomeRows, fromDate, toDate, search, categoryFilter]);

  const filteredExpenses = useMemo(() => {
    const text = search.trim().toLowerCase();
    return expenseRows.filter((row) => {
      if (fromDate && row.entry_date < fromDate) return false;
      if (toDate && row.entry_date > toDate) return false;
      if (text && !`${row.category} ${row.description || ""} ${row.payment_method}`.toLowerCase().includes(text)) return false;
      if (categoryFilter !== "All" && row.category !== categoryFilter) return false;
      return true;
    });
  }, [expenseRows, fromDate, toDate, search, categoryFilter]);

  const totals = useMemo(() => {
    const allIncome = filteredIncome.reduce((sum, row) => sum + row.amount, 0);
    const selectedIncome = filteredIncome
      .filter((row) => row.include_in_calculation)
      .reduce((sum, row) => sum + row.amount, 0);

    const allExpenses = filteredExpenses.reduce((sum, row) => sum + row.amount, 0);
    const selectedExpenses = filteredExpenses
      .filter((row) => row.include_in_calculation)
      .reduce((sum, row) => sum + row.amount, 0);

    return {
      allIncome,
      selectedIncome,
      allExpenses,
      selectedExpenses,
      selectedBalance: selectedIncome - selectedExpenses,
      allBalance: allIncome - allExpenses,
      incomeCount: filteredIncome.length,
      expenseCount: filteredExpenses.length,
    };
  }, [filteredIncome, filteredExpenses]);

  const visibleCategories = activeTab === "expense" ? EXPENSE_CATEGORIES : INCOME_SOURCES;

  const selectAllVisible = async (type: EntryKind, checked: boolean) => {
    const rows = type === "income" ? filteredIncome : filteredExpenses;
    if (!rows.length) return;

    try {
      setSaving(true);
      const ids = rows.map((row) => row.id);
      const table = type === "income" ? "personal_income" : "personal_expenses";
      const { error } = await supabase
        .from(table)
        .update({ include_in_calculation: checked })
        .in("id", ids);
      if (error) throw error;
      await loadData();
    } catch (error: any) {
      alert(`Unable to update selections.\n\n${error?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const lines: string[] = [
      ["Type", "Selected", "Date", "Category / Source", "Description", "Payment", "Amount"].map(csvSafe).join(","),
    ];

    filteredIncome.forEach((row) => {
      lines.push(
        ["Income", row.include_in_calculation ? "Yes" : "No", row.entry_date, row.source, row.description || "", row.payment_method, row.amount]
          .map(csvSafe)
          .join(",")
      );
    });

    filteredExpenses.forEach((row) => {
      lines.push(
        ["Expense", row.include_in_calculation ? "Yes" : "No", row.entry_date, row.category, row.description || "", row.payment_method, row.amount]
          .map(csvSafe)
          .join(",")
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `personal-finance-${todayInput()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setCategoryFilter("All");
    setSearch("");
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-900 p-5 text-white shadow-lg md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-100">MANVI ERP V29</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Personal Expenses</h1>
            <p className="mt-1 text-sm text-blue-100">
              Keep your personal income and every personal expense completely separate from business accounts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 font-bold text-white hover:bg-white/25 disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || saving}
              className="rounded-xl bg-white px-4 py-2.5 font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase text-slate-500">Selected Income</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{money(totals.selectedIncome)}</p>
          <p className="mt-1 text-xs text-slate-500">{totals.incomeCount} visible entries</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase text-slate-500">Selected Expenses</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{money(totals.selectedExpenses)}</p>
          <p className="mt-1 text-xs text-slate-500">{totals.expenseCount} visible entries</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase text-slate-500">Personal Balance</p>
          <p className={`mt-2 text-2xl font-bold ${totals.selectedBalance >= 0 ? "text-blue-700" : "text-red-700"}`}>
            {money(totals.selectedBalance)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Selected income − selected expenses</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase text-slate-500">All Recorded</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{money(totals.allIncome - totals.allExpenses)}</p>
          <p className="mt-1 text-xs text-slate-500">Before checkbox selection</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-lg md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Add / Edit Personal Entry</h2>
            <p className="mt-1 text-sm text-slate-500">Every entry can be included or excluded from your own calculation.</p>
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-200"
            >
              <FiX /> Cancel Edit
            </button>
          )}
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => startAdd("expense")}
            className={`rounded-lg px-4 py-3 font-bold transition ${activeTab === "expense" ? "bg-red-600 text-white shadow" : "text-slate-600 hover:bg-white"}`}
          >
            Personal Expense
          </button>
          <button
            type="button"
            onClick={() => startAdd("income")}
            className={`rounded-lg px-4 py-3 font-bold transition ${activeTab === "income" ? "bg-emerald-600 text-white shadow" : "text-slate-600 hover:bg-white"}`}
          >
            Personal Income
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <label className="mb-1 block text-sm font-bold text-slate-700">Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-3 font-semibold outline-none focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-bold text-slate-700">
              {activeTab === "income" ? "Income Source" : "Expense Category"}
            </label>
            {!customName ? (
              <div className="relative">
                <select
                  value={entryName}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomName(true);
                      setEntryName("");
                    } else {
                      setEntryName(e.target.value);
                    }
                  }}
                  className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-3 py-3 font-semibold outline-none focus:border-blue-500"
                >
                  <option value="">Select...</option>
                  {visibleCategories.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                  <option value="__custom__">+ Custom</option>
                </select>
                <FiChevronDown className="pointer-events-none absolute right-3 top-4 text-slate-400" />
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={entryName}
                  onChange={(e) => setEntryName(e.target.value)}
                  placeholder={activeTab === "income" ? "Enter income source" : "Enter expense category"}
                  className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-3 py-3 font-semibold outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomName(false);
                    setEntryName("");
                  }}
                  className="rounded-xl bg-slate-100 px-3 text-slate-600 hover:bg-slate-200"
                  title="Use list"
                >
                  List
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <label className="mb-1 block text-sm font-bold text-slate-700">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border-2 border-slate-200 px-3 py-3 text-lg font-bold outline-none focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="mb-1 block text-sm font-bold text-slate-700">Payment</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-3 font-semibold outline-none focus:border-blue-500"
            >
              {PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div className="lg:col-span-1">
            <label className="mb-1 block text-sm font-bold text-slate-700">Calculation</label>
            <label className="flex h-[50px] cursor-pointer items-center gap-3 rounded-xl border-2 border-slate-200 px-3">
              <input
                type="checkbox"
                checked={includeInCalculation}
                onChange={(e) => setIncludeInCalculation(e.target.checked)}
                className="h-5 w-5 accent-blue-600"
              />
              <span className="text-sm font-bold text-slate-700">Include</span>
            </label>
          </div>

          <div className="lg:col-span-5">
            <label className="mb-1 block text-sm font-bold text-slate-700">Description / Remarks</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
              className="w-full rounded-xl border-2 border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-1 flex items-end">
            <button
              type="button"
              onClick={() => void saveEntry()}
              disabled={saving}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold text-white shadow ${activeTab === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"} disabled:opacity-50`}
            >
              <FiPlus /> {isEditing ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-lg md:p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Your Calculation</h2>
            <p className="mt-1 text-sm text-slate-500">Use the checkbox in each row to decide what is included.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void selectAllVisible("income", true)}
              disabled={saving}
              className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              Select Income
            </button>
            <button
              type="button"
              onClick={() => void selectAllVisible("income", false)}
              disabled={saving}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Clear Income
            </button>
            <button
              type="button"
              onClick={() => void selectAllVisible("expense", true)}
              disabled={saving}
              className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Select Expenses
            </button>
            <button
              type="button"
              onClick={() => void selectAllVisible("expense", false)}
              disabled={saving}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Clear Expenses
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-700"><FiTrendingUp /> Selected Income</div>
            <p className="mt-1 text-xl font-bold text-emerald-800">{money(totals.selectedIncome)}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700"><FiTrendingDown /> Selected Expenses</div>
            <p className="mt-1 text-xl font-bold text-red-800">{money(totals.selectedExpenses)}</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-blue-700"><FiCheckSquare /> Remaining</div>
            <p className={`mt-1 text-xl font-bold ${totals.selectedBalance >= 0 ? "text-blue-800" : "text-red-800"}`}>{money(totals.selectedBalance)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-slate-600">Recorded Balance</div>
            <p className="mt-1 text-xl font-bold text-slate-800">{money(totals.allBalance)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-lg md:p-6">
        <div className="mb-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Expense & Income History</h2>
              <p className="mt-1 text-sm text-slate-500">Filter by date/category and maintain your own calculation with the checkbox.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"
              title="From date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"
              title="To date"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
            >
              <option value="All">All Categories / Sources</option>
              {Array.from(new Set([...INCOME_SOURCES, ...EXPENSE_CATEGORIES])).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description/category..."
              className="rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl bg-slate-100 px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-200"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl bg-slate-50 p-10 text-center font-semibold text-slate-500">Loading personal finance...</div>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-bold text-emerald-700">Personal Income</h3>
                <span className="font-bold text-emerald-700">Selected: {money(totals.selectedIncome)}</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-emerald-600 text-white">
                    <tr>
                      <th className="p-3 text-center">✓</th>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Source</th>
                      <th className="p-3 text-left">Description</th>
                      <th className="p-3 text-left">Payment</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIncome.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-slate-500">No personal income entries found.</td></tr>
                    ) : filteredIncome.map((row) => (
                      <tr key={row.id} className={`border-b last:border-0 ${row.include_in_calculation ? "bg-white" : "bg-slate-50 opacity-60"}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.include_in_calculation}
                            onChange={(e) => void updateInclude("income", row.id, e.target.checked)}
                            className="h-5 w-5 accent-emerald-600"
                          />
                        </td>
                        <td className="p-3 font-semibold">{displayDate(row.entry_date)}</td>
                        <td className="p-3 font-bold text-slate-800">{row.source}</td>
                        <td className="p-3 text-slate-600">{row.description || "-"}</td>
                        <td className="p-3">{row.payment_method}</td>
                        <td className="p-3 text-right font-bold text-emerald-700">{money(row.amount)}</td>
                        <td className="p-3">
                          <div className="flex justify-center gap-2">
                            <button type="button" onClick={() => startEditIncome(row)} className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100" title="Edit"><FiEdit2 /></button>
                            <button type="button" onClick={() => void deleteIncome(row.id)} className="rounded-lg bg-red-50 p-2 text-red-700 hover:bg-red-100" title="Delete"><FiTrash2 /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-bold text-red-700">Personal Expenses</h3>
                <span className="font-bold text-red-700">Selected: {money(totals.selectedExpenses)}</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="bg-red-600 text-white">
                    <tr>
                      <th className="p-3 text-center">✓</th>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Category</th>
                      <th className="p-3 text-left">Description</th>
                      <th className="p-3 text-left">Payment</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-slate-500">No personal expense entries found.</td></tr>
                    ) : filteredExpenses.map((row) => (
                      <tr key={row.id} className={`border-b last:border-0 ${row.include_in_calculation ? "bg-white" : "bg-slate-50 opacity-60"}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.include_in_calculation}
                            onChange={(e) => void updateInclude("expense", row.id, e.target.checked)}
                            className="h-5 w-5 accent-red-600"
                          />
                        </td>
                        <td className="p-3 font-semibold">{displayDate(row.entry_date)}</td>
                        <td className="p-3 font-bold text-slate-800">{row.category}</td>
                        <td className="p-3 text-slate-600">{row.description || "-"}</td>
                        <td className="p-3">{row.payment_method}</td>
                        <td className="p-3 text-right font-bold text-red-700">{money(row.amount)}</td>
                        <td className="p-3">
                          <div className="flex justify-center gap-2">
                            <button type="button" onClick={() => startEditExpense(row)} className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100" title="Edit"><FiEdit2 /></button>
                            <button type="button" onClick={() => void deleteExpense(row.id)} className="rounded-lg bg-red-50 p-2 text-red-700 hover:bg-red-100" title="Delete"><FiTrash2 /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
        <p className="font-bold text-blue-800">Personal calculation rule</p>
        <p className="mt-1">Only rows with ✓ are included in your calculation. This module uses its own tables and does not write to Sales, Collections, Purchases, Stock, Daily Closing, Business Expenses, or the Dashboard.</p>
      </div>
    </div>
  );
}
