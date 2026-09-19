import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type ExpenseRow = {
  id: string;
  expense_date: string | null;
  category: string | null;
  amount: number | string | null;
  remarks: string | null;
  employee_id?: string | null;
};

type EmployeeRow = {
  id: string;
  name: string | null;
  mobile?: string | null;
  email: string | null;
  uses_erp?: boolean | null;
  active: boolean | null;
};

type HolidayRow = {
  id: string;
  holiday_date: string | null;
  employee_id: string | null;
  holiday_type: string | null;
  reason: string | null;
};

function getTodayLocalDate() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function formatDateDDMMYYYY(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  const datePart =
    String(value).slice(0, 10);

  const [year, month, day] =
    datePart.split("-");

  if (
    year &&
    month &&
    day &&
    /^\d{4}$/.test(year)
  ) {
    return `${day}/${month}/${year}`;
  }

  return String(value);
}

function formatDateInput(
  value: string
) {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(
      0,
      2
    )}/${digits.slice(2)}`;
  }

  return `${digits.slice(
    0,
    2
  )}/${digits.slice(
    2,
    4
  )}/${digits.slice(4, 8)}`;
}

function parseDDMMYYYY(
  value: string
) {
  const digits = value.replace(
    /\D/g,
    ""
  );

  if (!/^\d{8}$/.test(digits)) {
    return null;
  }

  const day = Number(
    digits.slice(0, 2)
  );

  const month = Number(
    digits.slice(2, 4)
  );

  const year = Number(
    digits.slice(4, 8)
  );

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

  const testDate = new Date(
    year,
    month - 1,
    day
  );

  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() !==
      month - 1 ||
    testDate.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(
    month
  ).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}

function money(value: number) {
  return `₹ ${Number(
    value || 0
  ).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function numberValue(
  value:
    | number
    | string
    | null
    | undefined
) {
  const amount = Number(
    value || 0
  );

  return Number.isFinite(
    amount
  )
    ? amount
    : 0;
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error &&
    typeof error === "object"
  ) {
    const item = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    return [
      String(
        item.message || ""
      ),
      String(
        item.details || ""
      ),
      String(
        item.hint || ""
      ),
    ]
      .map((value) =>
        value.trim()
      )
      .filter(Boolean)
      .join(" • ") || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function Expenses() {
  const today =
    getTodayLocalDate();

  const [
    expenseDate,
    setExpenseDate,
  ] = useState(today);

  const [
    expenseDateDisplay,
    setExpenseDateDisplay,
  ] = useState(
    formatDateDDMMYYYY(today)
  );

  const [
    category,
    setCategory,
  ] = useState("");

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    remarks,
    setRemarks,
  ] = useState("");

  const [
    expenses,
    setExpenses,
  ] = useState<ExpenseRow[]>(
    []
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  // =========================================================
  // EMPLOYEE PAYOUT / ADVANCE / HOLIDAY
  // =========================================================
  const [isOwner, setIsOwner] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [employeeEntryType, setEmployeeEntryType] =
    useState<"salary" | "advance" | "holiday">("salary");

  const [employeeDateDisplay, setEmployeeDateDisplay] =
    useState(formatDateDDMMYYYY(today));
  const [employeeId, setEmployeeId] = useState("");
  const [employeeAmount, setEmployeeAmount] = useState("");
  const [employeeRemarks, setEmployeeRemarks] = useState("");

  const [holidayDateDisplay, setHolidayDateDisplay] =
    useState(formatDateDDMMYYYY(today));
  const [holidayEmployeeId, setHolidayEmployeeId] = useState("all");
  const [holidayType, setHolidayType] =
    useState<"Paid" | "Unpaid">("Paid");
  const [holidayReason, setHolidayReason] = useState("");
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [employeeSaving, setEmployeeSaving] = useState(false);

  const defaultCategories = [
    "Employee Salary",
    "Employee Advance",
    "Rent",
    "Electricity",
    "Fuel",
    "Transport",
    "Maintenance",
    "Tea / Food",
    "Office Expense",
    "Other Expense",
  ];

  async function loadCurrentUserRole() {
    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const authUser = sessionData.session?.user;
      if (!authUser) {
        setIsOwner(false);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("role, active")
        .eq("id", authUser.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const role = String(data?.role || "").trim().toLowerCase();
      setIsOwner(
        data?.active !== false &&
        (role === "owner" ||
          role === "admin" ||
          role === "administrator")
      );
    } catch (error) {
      console.error("LOAD EXPENSE USER ROLE ERROR:", error);
      setIsOwner(false);
    }
  }

  async function loadEmployees() {
    if (!isOwner) {
      setEmployees([]);
      return;
    }

    setEmployeeLoading(true);

    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, mobile, email, uses_erp, active")
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      setEmployees((data || []) as EmployeeRow[]);
    } catch (error) {
      console.error("LOAD EMPLOYEES ERROR:", error);
      setEmployees([]);
      alert(
        `Unable to load employees.\n\n${getErrorMessage(
          error,
          "Employee list could not be loaded."
        )}`
      );
    } finally {
      setEmployeeLoading(false);
    }
  }

  async function loadHolidays() {
    if (!isOwner) {
      setHolidays([]);
      return;
    }

    setHolidayLoading(true);

    try {
      const { data, error } = await supabase
        .from("employee_holidays")
        .select(
          `
            id,
            holiday_date,
            employee_id,
            holiday_type,
            reason
          `
        )
        .order("holiday_date", { ascending: false });

      if (error) {
        throw error;
      }

      setHolidays((data || []) as HolidayRow[]);
    } catch (error) {
      console.error("LOAD HOLIDAYS ERROR:", error);
      setHolidays([]);
      console.warn(
        "Holiday management requires the employee_holidays table."
      );
    } finally {
      setHolidayLoading(false);
    }
  }

  function getEmployeeName(employeeIdValue: string) {
    return (
      employees.find(
        (employee) => employee.id === employeeIdValue
      )?.name ||
      "Employee"
    );
  }

  function resetEmployeeForm() {
    setEmployeeDateDisplay(formatDateDDMMYYYY(today));
    setEmployeeId("");
    setEmployeeAmount("");
    setEmployeeRemarks("");
  }

  async function saveEmployeeTransaction(
    transactionType: "salary" | "advance"
  ) {
    if (!isOwner) {
      alert("Only the Owner can record employee payout or advance.");
      return;
    }

    const normalizedDate = parseDDMMYYYY(employeeDateDisplay);

    if (!normalizedDate) {
      alert(
        "Please enter a valid employee payment date in DD/MM/YYYY format."
      );
      return;
    }

    if (!employeeId) {
      alert("Please select an employee.");
      return;
    }

    const numericAmount = Number(employeeAmount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const employeeName = getEmployeeName(employeeId);
    const category =
      transactionType === "salary"
        ? "Employee Salary"
        : "Employee Advance";

    const detail = employeeRemarks.trim();

    const remarksText = detail
      ? `Employee: ${employeeName} | ${detail}`
      : `Employee: ${employeeName}`;

    setEmployeeSaving(true);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("expenses")
        .insert({
          expense_date: normalizedDate,
          category,
          amount: numericAmount,
          remarks: remarksText,
          employee_id: employeeId,
        });

      if (error) {
        throw error;
      }

      alert(
        transactionType === "salary"
          ? `Employee payout saved for ${employeeName}.`
          : `Employee advance saved for ${employeeName}.`
      );

      resetEmployeeForm();
      await loadExpenses();
    } catch (error) {
      console.error(
        "SAVE EMPLOYEE TRANSACTION ERROR:",
        error
      );

      const message = getErrorMessage(
        error,
        "Unable to save employee payment."
      );

      setErrorMessage(message);
      alert(`Unable to save employee payment.\n\n${message}`);
    } finally {
      setEmployeeSaving(false);
    }
  }

  async function saveHoliday() {
    if (!isOwner) {
      alert("Only the Owner can record holidays.");
      return;
    }

    const normalizedDate = parseDDMMYYYY(holidayDateDisplay);

    if (!normalizedDate) {
      alert(
        "Please enter a valid holiday date in DD/MM/YYYY format."
      );
      return;
    }

    if (!holidayReason.trim()) {
      alert("Please enter a holiday reason.");
      return;
    }

    setHolidayLoading(true);

    try {
      const { error } = await supabase
        .from("employee_holidays")
        .insert({
          holiday_date: normalizedDate,
          employee_id:
            holidayEmployeeId === "all"
              ? null
              : holidayEmployeeId,
          holiday_type: holidayType,
          reason: holidayReason.trim(),
        });

      if (error) {
        throw error;
      }

      alert("Holiday saved successfully.");

      setHolidayDateDisplay(formatDateDDMMYYYY(today));
      setHolidayEmployeeId("all");
      setHolidayType("Paid");
      setHolidayReason("");

      await loadHolidays();
    } catch (error) {
      console.error("SAVE HOLIDAY ERROR:", error);

      const message = getErrorMessage(
        error,
        "Unable to save holiday."
      );

      alert(
        `Unable to save holiday.\n\n${message}\n\nRun the MANVI ERP V29 holiday SQL once in Supabase if the table does not exist.`
      );
    } finally {
      setHolidayLoading(false);
    }
  }

  async function deleteHoliday(holiday: HolidayRow) {
    if (!isOwner) {
      return;
    }

    if (
      !window.confirm(
        `Delete holiday ${formatDateDDMMYYYY(
          holiday.holiday_date
        )}?`
      )
    ) {
      return;
    }

    setHolidayLoading(true);

    try {
      const { error } = await supabase
        .from("employee_holidays")
        .delete()
        .eq("id", holiday.id);

      if (error) {
        throw error;
      }

      await loadHolidays();
    } catch (error) {
      console.error("DELETE HOLIDAY ERROR:", error);
      alert(
        `Unable to delete holiday.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setHolidayLoading(false);
    }
  }

  useEffect(() => {
    void loadCurrentUserRole();
  }, []);

  useEffect(() => {
    if (!isOwner) {
      return;
    }

    void loadEmployees();
    void loadHolidays();
  }, [isOwner]);

  async function loadExpenses() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data,
        error,
      } = await supabase
        .from("expenses")
        .select(
          `
            id,
            expense_date,
            category,
            amount,
            remarks,
            employee_id
          `
        )
        .order(
          "expense_date",
          {
            ascending: false,
          }
        );

      if (error) {
        throw error;
      }

      setExpenses(
        (data || []) as ExpenseRow[]
      );
    } catch (error) {
      console.error(
        "LOAD EXPENSES ERROR:",
        error
      );

      setExpenses([]);

      const message =
        getErrorMessage(
          error,
          "Unable to load expenses."
        );

      setErrorMessage(
        message
      );

      alert(
        `Unable to load expenses.\n\n${message}`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExpenses();
  }, []);

  function resetForm() {
    const date =
      getTodayLocalDate();

    setEditingId(null);
    setExpenseDate(date);
    setExpenseDateDisplay(
      formatDateDDMMYYYY(
        date
      )
    );
    setCategory("");
    setAmount("");
    setRemarks("");
  }

  function startEdit(
    expense: ExpenseRow
  ) {
    const date =
      String(
        expense.expense_date ||
          today
      ).slice(0, 10);

    setEditingId(
      expense.id
    );
    setExpenseDate(date);
    setExpenseDateDisplay(
      formatDateDDMMYYYY(
        date
      )
    );
    setCategory(
      expense.category || ""
    );
    setAmount(
      String(
        numberValue(
          expense.amount
        )
      )
    );
    setRemarks(
      expense.remarks || ""
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveExpense() {
    const normalizedDate =
      parseDDMMYYYY(
        expenseDateDisplay
      );

    if (!normalizedDate) {
      alert(
        "Please enter a valid expense date in DD/MM/YYYY format.\nExample: 09/09/2026"
      );
      return;
    }

    const cleanCategory =
      category.trim();

    if (!cleanCategory) {
      alert(
        "Please enter expense category."
      );
      return;
    }

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      alert(
        "Please enter a valid expense amount."
      );
      return;
    }

    setExpenseDate(
      normalizedDate
    );

    setSaving(true);
    setErrorMessage("");

    try {
      const payload = {
        expense_date:
          normalizedDate,
        category:
          cleanCategory,
        amount:
          numericAmount,
        remarks:
          remarks.trim() ||
          null,
      };

      if (editingId) {
        const {
          error,
        } = await supabase
          .from("expenses")
          .update(payload)
          .eq(
            "id",
            editingId
          );

        if (error) {
          throw error;
        }

        alert(
          "Expense updated successfully."
        );
      } else {
        const {
          error,
        } = await supabase
          .from("expenses")
          .insert(
            payload
          );

        if (error) {
          throw error;
        }

        alert(
          "Expense saved successfully."
        );
      }

      resetForm();

      await loadExpenses();
    } catch (error) {
      console.error(
        "SAVE EXPENSE ERROR:",
        error
      );

      const message =
        getErrorMessage(
          error,
          "Unable to save expense."
        );

      setErrorMessage(
        message
      );

      alert(
        `Unable to save expense.\n\n${message}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(
    expense: ExpenseRow
  ) {
    const confirmed =
      window.confirm(
        `Delete expense "${expense.category || "Expense"}" for ${money(
          numberValue(
            expense.amount
          )
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase
        .from("expenses")
        .delete()
        .eq(
          "id",
          expense.id
        );

      if (error) {
        throw error;
      }

      if (
        editingId ===
        expense.id
      ) {
        resetForm();
      }

      alert(
        "Expense deleted successfully."
      );

      await loadExpenses();
    } catch (error) {
      console.error(
        "DELETE EXPENSE ERROR:",
        error
      );

      const message =
        getErrorMessage(
          error,
          "Unable to delete expense."
        );

      setErrorMessage(
        message
      );

      alert(
        `Unable to delete expense.\n\n${message}`
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredExpenses =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return expenses;
      }

      return expenses.filter(
        (expense) =>
          String(
            expense.category ||
              ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            expense.remarks ||
              ""
          )
            .toLowerCase()
            .includes(query) ||
          formatDateDDMMYYYY(
            expense.expense_date
          )
            .toLowerCase()
            .includes(query)
      );
    }, [
      expenses,
      search,
    ]);

  const totalExpenses =
    useMemo(
      () =>
        expenses.reduce(
          (sum, expense) =>
            sum +
            numberValue(
              expense.amount
            ),
          0
        ),
      [expenses]
    );

  const todayExpenses =
    useMemo(
      () =>
        expenses
          .filter(
            (expense) =>
              String(
                expense.expense_date ||
                  ""
              ).slice(0, 10) ===
              today
          )
          .reduce(
            (sum, expense) =>
              sum +
              numberValue(
                expense.amount
              ),
            0
          ),
      [expenses, today]
    );

  const monthExpenses =
    useMemo(() => {
      const monthPrefix =
        today.slice(0, 7);

      return expenses
        .filter(
          (expense) =>
            String(
              expense.expense_date ||
                ""
            ).slice(0, 7) ===
            monthPrefix
        )
        .reduce(
          (sum, expense) =>
            sum +
            numberValue(
              expense.amount
            ),
          0
        );
    }, [
      expenses,
      today,
    ]);

  const categoryTotals =
    useMemo(() => {
      const map =
        new Map<
          string,
          number
        >();

      expenses.forEach(
        (expense) => {
          const key =
            expense.category?.trim() ||
            "Other Expense";

          map.set(
            key,
            (map.get(key) ||
              0) +
              numberValue(
                expense.amount
              )
          );
        }
      );

      return Array.from(
        map.entries()
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );
    }, [expenses]);

  const employeeSalaryThisMonth = useMemo(
    () =>
      expenses
        .filter(
          (expense) =>
            expense.category === "Employee Salary" &&
            String(expense.expense_date || "").slice(0, 7) ===
              today.slice(0, 7)
        )
        .reduce(
          (sum, expense) =>
            sum + numberValue(expense.amount),
          0
        ),
    [expenses, today]
  );

  const employeeAdvanceThisMonth = useMemo(
    () =>
      expenses
        .filter(
          (expense) =>
            expense.category === "Employee Advance" &&
            String(expense.expense_date || "").slice(0, 7) ===
              today.slice(0, 7)
        )
        .reduce(
          (sum, expense) =>
            sum + numberValue(expense.amount),
          0
        ),
    [expenses, today]
  );

  function handleDateChange(
    value: string
  ) {
    const display =
      formatDateInput(value);

    setExpenseDateDisplay(
      display
    );

    const parsed =
      parseDDMMYYYY(
        display
      );

    if (parsed) {
      setExpenseDate(
        parsed
      );
    }
  }

  function handleEmployeeDateChange(value: string) {
    const display = formatDateInput(value);
    setEmployeeDateDisplay(display);
  }

  function handleHolidayDateChange(value: string) {
    const display = formatDateInput(value);
    setHolidayDateDisplay(display);
  }

  return (
    <div className="mx-auto max-w-7xl p-4 pb-10 md:p-6">
      {/* HEADER */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-100">
              MANVI MILK AGENCIES
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Expenses
            </h1>

            <p className="mt-2 text-sm text-blue-100">
              Record and control daily business expenses.
            </p>
          </div>

          <div className="rounded-xl bg-white/15 px-5 py-4">
            <p className="text-sm text-blue-100">
              Today's Expenses
            </p>

            <p className="mt-1 text-3xl font-bold">
              {money(
                todayExpenses
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">
            Expense Error
          </p>

          <p className="mt-1 break-words">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() =>
              void loadExpenses()
            }
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Today's Expenses"
          value={todayExpenses}
          className="text-red-600"
        />

        <SummaryCard
          title="This Month"
          value={monthExpenses}
          className="text-orange-600"
        />

        <SummaryCard
          title="All Recorded Expenses"
          value={totalExpenses}
          className="text-blue-700"
        />
      </div>

      {/* EMPLOYEE PAYOUT / ADVANCE / HOLIDAY */}
      {isOwner && (
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-800">
              Employee Payments & Holiday
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Employee payout and advance are recorded as cash expenses.
              Holiday records do not affect cash.
            </p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-2">
            <button
              type="button"
              onClick={() => setEmployeeEntryType("salary")}
              className={`rounded-lg px-3 py-3 text-sm font-bold ${
                employeeEntryType === "salary"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              💰 Employee Payout
            </button>

            <button
              type="button"
              onClick={() => setEmployeeEntryType("advance")}
              className={`rounded-lg px-3 py-3 text-sm font-bold ${
                employeeEntryType === "advance"
                  ? "bg-orange-500 text-white shadow"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              💵 Employee Advance
            </button>

            <button
              type="button"
              onClick={() => setEmployeeEntryType("holiday")}
              className={`rounded-lg px-3 py-3 text-sm font-bold ${
                employeeEntryType === "holiday"
                  ? "bg-green-600 text-white shadow"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              📅 Holiday
            </button>
          </div>

          {employeeEntryType !== "holiday" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Payment Date
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={employeeDateDisplay}
                  onChange={(e) =>
                    handleEmployeeDateChange(e.target.value)
                  }
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Employee
                </label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={employeeLoading || employeeSaving}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">
                    {employeeLoading
                      ? "Loading employees..."
                      : employees.length === 0
                      ? "No active employees"
                      : "Select employee"}
                  </option>

                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name || employee.email || "Employee"}{employee.uses_erp ? " (ERP)" : " (Non-ERP)"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={employeeAmount}
                  onChange={(e) => setEmployeeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Type
                </label>
                <div
                  className={`rounded-lg p-3 font-bold ${
                    employeeEntryType === "salary"
                      ? "border border-blue-200 bg-blue-50 text-blue-700"
                      : "border border-orange-200 bg-orange-50 text-orange-700"
                  }`}
                >
                  {employeeEntryType === "salary"
                    ? "Employee Salary / Payout"
                    : "Employee Advance"}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Remarks
                </label>
                <input
                  type="text"
                  value={employeeRemarks}
                  onChange={(e) => setEmployeeRemarks(e.target.value)}
                  placeholder={
                    employeeEntryType === "salary"
                      ? "Example: September salary"
                      : "Example: Advance for personal requirement"
                  }
                  className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    void saveEmployeeTransaction(employeeEntryType)
                  }
                  disabled={
                    employeeSaving ||
                    employeeLoading ||
                    employees.length === 0
                  }
                  className={`rounded-lg px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                    employeeEntryType === "salary"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {employeeSaving
                    ? "Saving..."
                    : employeeEntryType === "salary"
                    ? "Save Employee Payout"
                    : "Save Employee Advance"}
                </button>

                <button
                  type="button"
                  onClick={resetEmployeeForm}
                  disabled={employeeSaving}
                  className="rounded-lg bg-slate-500 px-6 py-3 font-bold text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Holiday Date
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={holidayDateDisplay}
                  onChange={(e) =>
                    handleHolidayDateChange(e.target.value)
                  }
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  className="w-full rounded-lg border border-slate-300 p-3 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Applies To
                </label>
                <select
                  value={holidayEmployeeId}
                  onChange={(e) =>
                    setHolidayEmployeeId(e.target.value)
                  }
                  disabled={holidayLoading}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 focus:border-green-500 focus:outline-none"
                >
                  <option value="all">All Employees</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name || employee.email || "Employee"}{employee.uses_erp ? " (ERP)" : " (Non-ERP)"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Holiday Type
                </label>
                <select
                  value={holidayType}
                  onChange={(e) =>
                    setHolidayType(
                      e.target.value as "Paid" | "Unpaid"
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 focus:border-green-500 focus:outline-none"
                >
                  <option value="Paid">Paid Holiday</option>
                  <option value="Unpaid">Unpaid Holiday</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Reason
                </label>
                <input
                  type="text"
                  value={holidayReason}
                  onChange={(e) => setHolidayReason(e.target.value)}
                  placeholder="Example: Festival Holiday"
                  className="w-full rounded-lg border border-slate-300 p-3 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => void saveHoliday()}
                  disabled={holidayLoading}
                  className="rounded-lg bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {holidayLoading ? "Saving..." : "Save Holiday"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryCard
              title="Employee Payout — This Month"
              value={employeeSalaryThisMonth}
              className="text-blue-700"
            />
            <SummaryCard
              title="Employee Advance — This Month"
              value={employeeAdvanceThisMonth}
              className="text-orange-600"
            />
          </div>

          {holidays.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl border border-green-100">
              <div className="border-b bg-green-50 p-4">
                <h3 className="font-bold text-slate-800">
                  Holiday History
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-green-700 text-white">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Employee</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Reason</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {holidays.map((holiday) => (
                      <tr
                        key={holiday.id}
                        className="border-b last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="p-3">
                          {formatDateDDMMYYYY(holiday.holiday_date)}
                        </td>
                        <td className="p-3 font-semibold">
                          {holiday.employee_id === null
                            ? "All Employees"
                            : getEmployeeName(holiday.employee_id)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              holiday.holiday_type === "Paid"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {holiday.holiday_type || "-"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">
                          {holiday.reason || "-"}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => void deleteHoliday(holiday)}
                            disabled={holidayLoading}
                            className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FORM */}
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {editingId
                ? "Edit Expense"
                : "Add Expense"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              All expenses entered here are treated as cash business expenses.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Expense Date
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={
                expenseDateDisplay
              }
              onChange={(e) =>
                handleDateChange(
                  e.target.value
                )
              }
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Category
            </label>

            <input
              list="expense-categories"
              type="text"
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value
                )
              }
              placeholder="Example: Employee Salary"
              className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
            />

            <datalist id="expense-categories">
              {defaultCategories.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  />
                )
              )}
            </datalist>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Amount
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
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Payment Type
            </label>

            <div className="rounded-lg border border-green-200 bg-green-50 p-3 font-bold text-green-700">
              Cash
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Remarks
            </label>

            <input
              type="text"
              value={remarks}
              onChange={(e) =>
                setRemarks(
                  e.target.value
                )
              }
              placeholder="Optional remarks"
              className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              void saveExpense()
            }
            disabled={saving}
            className="rounded-lg bg-red-600 px-6 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Expense"
              : "Save Expense"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            disabled={saving}
            className="rounded-lg bg-slate-500 px-6 py-3 font-bold text-white hover:bg-slate-600 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* CATEGORY SUMMARY */}
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800">
            Expense By Category
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Total recorded amount by category.
          </p>
        </div>

        {categoryTotals.length ===
        0 ? (
          <div className="rounded-xl bg-slate-50 p-6 text-center text-slate-500">
            No expense data available.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {categoryTotals.map(
              ([name, value]) => (
                <div
                  key={name}
                  className="rounded-xl border border-orange-100 bg-orange-50 p-4"
                >
                  <p className="font-semibold text-slate-800">
                    {name}
                  </p>

                  <p className="mt-1 text-xl font-bold text-orange-600">
                    {money(value)}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* SEARCH */}
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold">
              Search Expenses
            </label>

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search category, remarks or date..."
              className="w-full rounded-lg border border-slate-300 p-3"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              void loadExpenses()
            }
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : "Refresh"}
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          Showing{" "}
          <span className="font-semibold text-slate-800">
            {filteredExpenses.length}
          </span>{" "}
          expense
          {filteredExpenses.length ===
          1
            ? ""
            : "s"}
        </p>
      </div>

      {/* HISTORY */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="border-b p-5">
          <h2 className="text-xl font-bold text-slate-800">
            Expense History
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Edit or delete recorded expenses.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead className="bg-blue-700 text-white">
              <tr>
                <th className="p-3 text-left">
                  Date
                </th>

                <th className="p-3 text-left">
                  Category
                </th>

                <th className="p-3 text-left">
                  Remarks
                </th>

                <th className="p-3 text-right">
                  Amount
                </th>

                <th className="p-3 text-center">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-10 text-center text-slate-500"
                  >
                    Loading expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-10 text-center text-slate-500"
                  >
                    No expenses found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(
                  (expense) => (
                    <tr
                      key={expense.id}
                      className="border-b hover:bg-slate-50"
                    >
                      <td className="p-3">
                        {formatDateDDMMYYYY(
                          expense.expense_date
                        )}
                      </td>

                      <td className="p-3 font-semibold text-slate-800">
                        {expense.category ||
                          "-"}
                      </td>

                      <td className="p-3 text-slate-600">
                        {expense.remarks ||
                          "-"}
                      </td>

                      <td className="p-3 text-right font-bold text-red-600">
                        {money(
                          numberValue(
                            expense.amount
                          )
                        )}
                      </td>

                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              startEdit(
                                expense
                              )
                            }
                            disabled={saving}
                            className="rounded bg-yellow-500 px-3 py-1 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteExpense(
                                expense
                              )
                            }
                            disabled={saving}
                            className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>

            {filteredExpenses.length >
              0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td
                    colSpan={3}
                    className="p-3 text-right"
                  >
                    Filtered Total
                  </td>

                  <td className="p-3 text-right text-red-600">
                    {money(
                      filteredExpenses.reduce(
                        (sum, expense) =>
                          sum +
                          numberValue(
                            expense.amount
                          ),
                        0
                      )
                    )}
                  </td>

                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  className,
}: {
  title: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-500">
        {title}
      </p>

      <p
        className={`mt-2 text-3xl font-bold ${className}`}
      >
        {money(value)}
      </p>
    </div>
  );
}
