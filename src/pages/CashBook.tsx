import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type EntryType = "Receipt" | "Payment";
type FilterType = "ALL" | EntryType;

type CashEntry = {
  id: string;
  date: string;
  entry_type: EntryType;
  category: string;
  party_name: string | null;
  amount: number;
  payment_method: string;
  reference: string | null;
  remarks: string | null;
  source: "Sales" | "Collections" | "Purchases" | "Expenses" | "Manual";
};

type SaleRow = {
  id: string;
  sale_no: number | string | null;
  sale_date: string | null;
  customer_id: string | null;
  payment_method: string | null;
  paid_amount: number | string | null;
  total_amount: number | string | null;
  cash_amount: number | string | null;
  upi_amount: number | string | null;
};

type CollectionRow = {
  id: string;
  collection_date: string | null;
  customer_id: string | null;
  amount: number | string | null;
  payment_method: string | null;
  cash_amount: number | string | null;
  upi_amount: number | string | null;
  remarks: string | null;
};

type PurchaseRow = {
  id: string;
  purchase_date: string | null;
  invoice_no: string | null;
  supplier_name: string | null;
  payment_method: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
};

type ExpenseRow = {
  id: string;
  expense_date: string | null;
  category: string | null;
  amount: number | string | null;
  remarks: string | null;
};

type CustomerRow = {
  id: string;
  customer_name: string | null;
};

type AllocationRow = {
  collection_id: string;
  sale_id: string;
  amount: number | string | null;
};

type SaleReferenceRow = {
  id: string;
  sale_no: number | string | null;
};

function getTodayLocalDate() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const part = String(value).slice(0, 10);
  const [year, month, day] =
    part.split("-");

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

function formatDateInput(value: string) {
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

function parseDDMMYYYY(value: string) {
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

function dateKey(value: unknown) {
  if (!value) {
    return "";
  }

  const text = String(value).trim();

  if (
    /^\d{4}-\d{2}-\d{2}/.test(
      text
    )
  ) {
    return text.slice(0, 10);
  }

  const parsed = new Date(text);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(
    parsed.getMonth() + 1
  ).padStart(2, "0")}-${String(
    parsed.getDate()
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

function numeric(
  value:
    | number
    | string
    | null
    | undefined
) {
  const n = Number(
    value || 0
  );

  return Number.isFinite(n)
    ? n
    : 0;
}

export default function CashBook() {
  const today = getTodayLocalDate();

  const [fromDate, setFromDate] =
    useState(today);

  const [toDate, setToDate] =
    useState(today);

  const [fromDateDisplay, setFromDateDisplay] =
    useState(formatDateInput(
      formatDate(today)
        .split("/")
        .join("")
    ));

  const [toDateDisplay, setToDateDisplay] =
    useState(formatDateInput(
      formatDate(today)
        .split("/")
        .join("")
    ));

  const [filter, setFilter] =
    useState<FilterType>("ALL");

  const [entries, setEntries] =
    useState<CashEntry[]>([]);

  const [openingCash, setOpeningCash] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [
    showAdd,
    setShowAdd,
  ] = useState(false);

  const [entryDate, setEntryDate] =
    useState(today);

  const [
    entryDateDisplay,
    setEntryDateDisplay,
  ] = useState(formatDateInput(
    formatDate(today)
      .split("/")
      .join("")
  ));

  const [entryType, setEntryType] =
    useState<EntryType>(
      "Receipt"
    );

  const [category, setCategory] =
    useState("Other Receipt");

  const [partyName, setPartyName] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [reference, setReference] =
    useState("");

  const [remarks, setRemarks] =
    useState("");

  const [
    loadWarning,
    setLoadWarning,
  ] = useState("");

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
        String(item.message || ""),
        String(item.details || ""),
        String(item.hint || ""),
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

  async function loadCashBook() {
    if (
      !fromDate ||
      !toDate
    ) {
      return;
    }

    if (fromDate > toDate) {
      alert(
        "From Date cannot be after To Date."
      );
      return;
    }

    setLoading(true);
    setLoadWarning("");

    try {
      const [
        salesResult,
        collectionsResult,
        purchasesResult,
        expensesResult,
        customersResult,
        allocationResult,
        closingResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            `
              id,
              sale_no,
              sale_date,
              customer_id,
              payment_method,
              paid_amount,
              total_amount,
              cash_amount,
              upi_amount
            `
          )
          .order(
            "sale_date",
            {
              ascending: false,
            }
          ),

        supabase
          .from("collections")
          .select(
            `
              id,
              collection_date,
              customer_id,
              amount,
              payment_method,
              cash_amount,
              upi_amount,
              remarks
            `
          )
          .order(
            "collection_date",
            {
              ascending: false,
            }
          ),

        supabase
          .from("purchases")
          .select(
            `
              id,
              purchase_date,
              invoice_no,
              supplier_name,
              payment_method,
              total_amount,
              paid_amount,
              balance_amount
            `
          )
          .gte(
            "purchase_date",
            fromDate
          )
          .lte(
            "purchase_date",
            toDate
          )
          .order(
            "purchase_date",
            {
              ascending: false,
            }
          ),

        supabase
          .from("expenses")
          .select(
            `
              id,
              expense_date,
              category,
              amount,
              remarks
            `
          )
          .order(
            "expense_date",
            {
              ascending: false,
            }
          ),

        supabase
          .from("customers")
          .select(
            `
              id,
              customer_name
            `
          )
          .order(
            "customer_name",
            {
              ascending: true,
            }
          ),

        supabase
          .from(
            "collection_allocations"
          )
          .select(
            `
              collection_id,
              sale_id,
              amount
            `
          ),

        supabase
          .from("daily_closings")
          .select(
            `
              closing_date,
              closing_cash
            `
          )
          .lt(
            "closing_date",
            fromDate
          )
          .order(
            "closing_date",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle(),
      ]);

      /*
       * Supplier master is deliberately not required
       * for cash-book generation because the purchase row
       * already contains supplier_name.
       */

      const errors = [
        salesResult.error,
        collectionsResult.error,
        purchasesResult.error,
        expensesResult.error,
        customersResult.error,
        allocationResult.error,
        closingResult.error,
      ].filter(Boolean);

      if (
        customersResult.error
      ) {
        setLoadWarning(
          "Customer names could not be loaded. Cash entries will still be shown."
        );
      }

      if (
        allocationResult.error
      ) {
        setLoadWarning(
          (previous) =>
            previous
              ? `${previous} Collection bill references could not be loaded.`
              : "Collection bill references could not be loaded."
        );
      }

      if (
        closingResult.error
      ) {
        setLoadWarning(
          (previous) =>
            previous
              ? `${previous} Previous closing could not be loaded.`
              : "Previous closing could not be loaded."
        );
      }

      const customerMap =
        new Map<string, string>();

      (
        (customersResult.data ||
          []) as CustomerRow[]
      ).forEach((customer) => {
        customerMap.set(
          String(customer.id),
          String(
            customer.customer_name ||
              ""
          ).trim()
        );
      });

      const allocations =
        (allocationResult.data ||
          []) as AllocationRow[];

      const collectionAllocationsMap =
        new Map<
          string,
          string[]
        >();

      allocations.forEach(
        (allocation) => {
          const collectionId =
            String(
              allocation.collection_id
            );

          const saleIds =
            collectionAllocationsMap.get(
              collectionId
            ) || [];

          saleIds.push(
            String(
              allocation.sale_id
            )
          );

          collectionAllocationsMap.set(
            collectionId,
            saleIds
          );
        }
      );

      /*
       * Only fetch sale numbers needed by
       * collection allocations.
       */
      const allocatedSaleIds =
        Array.from(
          new Set(
            allocations.map(
              (item) =>
                String(
                  item.sale_id
                )
            )
          )
        );

      let saleReferenceMap =
        new Map<string, string>();

      if (
        allocatedSaleIds.length > 0 &&
        !salesResult.error
      ) {
        const salesForReference =
          (
            (salesResult.data ||
              []) as SaleRow[]
          );

        saleReferenceMap =
          new Map<string, string>(
            salesForReference
              .filter((sale) =>
                allocatedSaleIds.includes(
                  String(sale.id)
                )
              )
              .map(
                (sale): [string, string] => [
                  String(sale.id),
                  sale.sale_no !== null &&
                  sale.sale_no !== undefined
                    ? String(sale.sale_no)
                    : "",
                ]
              )
              .filter(
                (item): item is [string, string] =>
                  item[1] !== ""
              )
          );
      }

      const rows: CashEntry[] =
        [];

      /*
       * SALES
       *
       * Cash, UPI and Split (Cash + UPI) sales are visible.
       * Split produces two receipt rows with the same Sale No.
       * Only the Cash portion affects physical cash.
       */
      (
        (salesResult.data ||
          []) as SaleRow[]
      ).forEach((sale) => {
        const date =
          dateKey(
            sale.sale_date
          );

        const method =
          String(
            sale.payment_method ||
              ""
          )
            .trim()
            .toLowerCase();

        if (
          date < fromDate ||
          date > toDate
        ) {
          return;
        }

        const total =
          numeric(
            sale.total_amount
          );

        const storedPaid =
          numeric(
            sale.paid_amount
          );

        const storedCash =
          numeric(
            sale.cash_amount
          );

        const storedUpi =
          numeric(
            sale.upi_amount
          );

        const fallbackPaid =
          storedPaid > 0
            ? storedPaid
            : total;

        const cashPaid =
          storedCash > 0
            ? storedCash
            : method === "cash"
            ? fallbackPaid
            : 0;

        const upiPaid =
          storedUpi > 0
            ? storedUpi
            : method === "upi"
            ? fallbackPaid
            : 0;

        const customerName =
          sale.customer_id
            ? customerMap.get(
                String(
                  sale.customer_id
                )
              ) || "Customer"
            : "Walk-in";

        const reference =
          sale.sale_no !== null &&
          sale.sale_no !== undefined
            ? String(
                sale.sale_no
              )
            : "-";

        if (
          (method === "cash" ||
            method === "split") &&
          cashPaid > 0
        ) {
          rows.push({
            id: `sale-${sale.id}-cash`,
            date,
            entry_type:
              "Receipt",
            category:
              "Sales (Cash)",
            party_name:
              customerName,
            amount: cashPaid,
            payment_method:
              "Cash",
            reference,
            remarks:
              method === "split"
                ? "Split sale — cash portion"
                : null,
            source:
              "Sales",
          });
        }

        if (
          (method === "upi" ||
            method === "split") &&
          upiPaid > 0
        ) {
          rows.push({
            id: `sale-${sale.id}-upi`,
            date,
            entry_type:
              "Receipt",
            category:
              "Sales (UPI)",
            party_name:
              customerName,
            amount: upiPaid,
            payment_method:
              "UPI",
            reference,
            remarks:
              method === "split"
                ? "Split sale — UPI portion; not included in physical cash"
                : "Non-cash sale receipt — not included in physical cash",
            source:
              "Sales",
          });
        }
      });

      /*
       * COLLECTIONS
       *
       * Cash, UPI and Split (Cash + UPI) collections are visible.
       * Split produces two receipt rows with the same customer/date.
       * Only Cash collection receipts affect physical cash.
       */
      (
        (collectionsResult.data ||
          []) as CollectionRow[]
      ).forEach(
        (collection) => {
          const date =
            dateKey(
              collection.collection_date
            );

          const method =
            String(
              collection.payment_method ||
                "Cash"
            )
              .trim()
              .toLowerCase();

          const total =
            numeric(
              collection.amount
            );

          const storedCash =
            numeric(
              collection.cash_amount
            );

          const storedUpi =
            numeric(
              collection.upi_amount
            );

          const fallbackCash =
            method === "cash"
              ? total
              : 0;

          const fallbackUpi =
            method === "upi"
              ? total
              : 0;

          const cashPaid =
            storedCash > 0
              ? storedCash
              : fallbackCash;

          const upiPaid =
            storedUpi > 0
              ? storedUpi
              : fallbackUpi;

          if (
            date < fromDate ||
            date > toDate
          ) {
            return;
          }

          const customerName =
            collection.customer_id
              ? customerMap.get(
                  String(
                    collection.customer_id
                  )
                ) || "Customer"
              : "Customer";

          const allocatedSaleIds =
            collectionAllocationsMap.get(
              String(
                collection.id
              )
            ) || [];

          const billNumbers =
            Array.from(
              new Set(
                allocatedSaleIds
                  .map(
                    (saleId) =>
                      saleReferenceMap.get(
                        saleId
                      ) || ""
                  )
                  .filter(Boolean)
              )
            );

          const reference =
            billNumbers.length > 0
              ? billNumbers.join(", ")
              : "Opening Balance";

          if (
            (method === "cash" ||
              method === "split") &&
            cashPaid > 0
          ) {
            rows.push({
              id: `collection-${collection.id}-cash`,
              date,
              entry_type:
                "Receipt",
              category:
                "Customer Collection (Cash)",
              party_name:
                customerName,
              amount: cashPaid,
              payment_method:
                "Cash",
              reference,
              remarks:
                method === "split"
                  ? "Split collection — cash portion"
                  : collection.remarks ||
                    null,
              source:
                "Collections",
            });
          }

          if (
            (method === "upi" ||
              method === "split") &&
            upiPaid > 0
          ) {
            rows.push({
              id: `collection-${collection.id}-upi`,
              date,
              entry_type:
                "Receipt",
              category:
                "Customer Collection (UPI)",
              party_name:
                customerName,
              amount: upiPaid,
              payment_method:
                "UPI",
              reference,
              remarks:
                method === "split"
                  ? "Split collection — UPI portion; not included in physical cash"
                  : collection.remarks ||
                    "Non-cash collection",
              source:
                "Collections",
            });
          }
        }
      );

      /*
       * PURCHASE PAYMENTS
       * Only Cash purchase payments reduce physical cash.
       *
       * Use paid_amount as the primary value. For legacy Cash
       * purchases where paid_amount is zero/null but total_amount
       * is positive, use total_amount as a safe fallback.
       */
      (
        (purchasesResult.data ||
          []) as PurchaseRow[]
      ).forEach(
        (purchase) => {
          const date =
            dateKey(
              purchase.purchase_date
            );

          const method =
            String(
              purchase.payment_method ||
                ""
            )
              .trim()
              .toLowerCase();

          if (
            method !== "cash" ||
            date < fromDate ||
            date > toDate
          ) {
            return;
          }

          const storedPaid =
            numeric(
              purchase.paid_amount
            );

          const total =
            numeric(
              purchase.total_amount
            );

          const paid =
            storedPaid > 0
              ? storedPaid
              : total;

          if (
            paid <= 0
          ) {
            return;
          }

          rows.push({
            id: `purchase-${purchase.id}`,
            date,
            entry_type:
              "Payment",
            category:
              "Purchase Payment",
            party_name:
              purchase.supplier_name ||
              "Supplier",
            amount: paid,
            payment_method:
              "Cash",
            reference:
              purchase.invoice_no ||
              "-",
            remarks:
              numeric(
                purchase.balance_amount
              ) > 0
                ? `Purchase balance ₹${numeric(
                    purchase.balance_amount
                  ).toFixed(2)}`
                : null,
            source:
              "Purchases",
          });
        }
      );

      /*
       * EXPENSES
       * Current MANVI expense records represent cash
       * business expenses in the existing Cash Book logic.
       */
      (
        (expensesResult.data ||
          []) as ExpenseRow[]
      ).forEach(
        (expense) => {
          const date =
            dateKey(
              expense.expense_date
            );

          const value =
            numeric(
              expense.amount
            );

          if (
            value <= 0 ||
            date < fromDate ||
            date > toDate
          ) {
            return;
          }

          rows.push({
            id: `expense-${expense.id}`,
            date,
            entry_type:
              "Payment",
            category:
              expense.category ||
              "Expense",
            party_name:
              null,
            amount: value,
            payment_method:
              "Cash",
            reference:
              String(
                expense.id
              ),
            remarks:
              expense.remarks ||
              null,
            source:
              "Expenses",
          });
        }
      );

      /*
       * MANUAL CASH BOOK ENTRIES
       */
      (
        await supabase
          .from("cash_book_entries")
          .select(
            `
              id,
              entry_date,
              entry_type,
              category,
              party_name,
              amount,
              payment_method,
              reference,
              remarks
            `
          )
          .gte(
            "entry_date",
            fromDate
          )
          .lte(
            "entry_date",
            toDate
          )
          .order(
            "entry_date",
            {
              ascending: false,
            }
          )
      ).data?.forEach(
        (row: any) => {
          const entryMethod =
            String(
              row.payment_method ||
                "Cash"
            );

          if (
            entryMethod
              .trim()
              .toLowerCase() !==
            "cash"
          ) {
            return;
          }

          rows.push({
            id: String(
              row.id
            ),
            date: dateKey(
              row.entry_date
            ),
            entry_type:
              row.entry_type ===
              "Payment"
                ? "Payment"
                : "Receipt",
            category:
              row.category ||
              "Other",
            party_name:
              row.party_name ||
              null,
            amount: numeric(
              row.amount
            ),
            payment_method:
              "Cash",
            reference:
              row.reference ||
              null,
            remarks:
              row.remarks ||
              null,
            source: "Manual",
          });
        }
      );

      setEntries(rows);

      if (
        !closingResult.error
      ) {
        setOpeningCash(
          numeric(
            closingResult
              .data?.closing_cash
          )
        );
      } else {
        setOpeningCash(0);
      }

      if (
        errors.length > 0
      ) {
        const messages =
          errors
            .map(
              (error: any) =>
                error?.message
            )
            .filter(Boolean);

        if (
          messages.length > 0
        ) {
          setLoadWarning(
            (previous) =>
              previous
                ? `${previous} ${messages.join(
                    " • "
                  )}`
                : messages.join(
                    " • "
                  )
          );
        }
      }
    } catch (error) {
      console.error(
        "CASH BOOK LOAD ERROR:",
        error
      );

      setEntries([]);
      setOpeningCash(0);

      alert(
        `Unable to load Cash Book.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCashBook();
  }, [fromDate, toDate]);

  const filteredEntries =
    useMemo(() => {
      return entries
        .filter(
          (row) =>
            row.date >=
              fromDate &&
            row.date <=
              toDate
        )
        .filter(
          (row) =>
            filter ===
              "ALL" ||
            row.entry_type ===
              filter
        )
        .sort((a, b) => {
          const dateSort =
            b.date.localeCompare(
              a.date
            );

          if (
            dateSort !== 0
          ) {
            return dateSort;
          }

          return b.id.localeCompare(
            a.id
          );
        });
    }, [
      entries,
      fromDate,
      toDate,
      filter,
    ]);

  const purchasePaymentTotal =
    filteredEntries
      .filter(
        (row) =>
          row.source === "Purchases" &&
          row.entry_type === "Payment"
      )
      .reduce(
        (sum, row) =>
          sum + row.amount,
        0
      );

  const purchasePaymentCount =
    filteredEntries.filter(
      (row) =>
        row.source === "Purchases" &&
        row.entry_type === "Payment"
    ).length;

  /*
   * PHYSICAL CASH RECONCILIATION
   *
   * UPI receipts are visible in the transaction list, but they
   * must never increase physical cash. Therefore only entries
   * marked Cash participate in the cash balance calculation.
   */
  const receipts =
    filteredEntries
      .filter(
        (row) =>
          row.entry_type ===
            "Receipt" &&
          row.payment_method
            .trim()
            .toLowerCase() ===
            "cash"
      )
      .reduce(
        (sum, row) =>
          sum + row.amount,
        0
      );

  const payments =
    filteredEntries
      .filter(
        (row) =>
          row.entry_type ===
            "Payment" &&
          row.payment_method
            .trim()
            .toLowerCase() ===
            "cash"
      )
      .reduce(
        (sum, row) =>
          sum + row.amount,
        0
      );

  const closingBalance =
    openingCash +
    receipts -
    payments;

  function setToday() {
    const value =
      getTodayLocalDate();

    setFromDate(value);
    setToDate(value);

    const display =
      formatDateInput(
        value
          .split("-")
          .reverse()
          .join("")
      );

    setFromDateDisplay(
      display
    );

    setToDateDisplay(
      display
    );
  }

  function setDateDisplay(
    value: string,
    setter: (
      value: string
    ) => void,
    isoSetter: (
      value: string
    ) => void
  ) {
    const display =
      formatDateInput(value);

    setter(display);

    const parsed =
      parseDDMMYYYY(
        display
      );

    if (parsed) {
      isoSetter(parsed);
    }
  }

  function resetForm() {
    const value =
      getTodayLocalDate();

    setEntryDate(value);

    setEntryDateDisplay(
      formatDateInput(
        value
          .split("-")
          .reverse()
          .join("")
      )
    );

    setEntryType(
      "Receipt"
    );

    setCategory(
      "Other Receipt"
    );

    setPartyName("");
    setAmount("");
    setReference("");
    setRemarks("");
  }

  async function saveManualEntry() {
    const value =
      numeric(amount);

    const normalizedDate =
      parseDDMMYYYY(
        entryDateDisplay
      );

    if (!normalizedDate) {
      alert(
        "Please enter a valid date in DD/MM/YYYY format.\nExample: 09/09/2026"
      );
      return;
    }

    if (
      value <= 0
    ) {
      alert(
        "Enter a valid amount."
      );
      return;
    }

    if (
      !category.trim()
    ) {
      alert(
        "Enter category."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        error,
      } = await supabase
        .from(
          "cash_book_entries"
        )
        .insert({
          entry_date:
            normalizedDate,
          entry_type:
            entryType,
          category:
            category.trim(),
          party_name:
            partyName.trim() ||
            null,
          amount: value,
          payment_method:
            "Cash",
          reference:
            reference.trim() ||
            null,
          remarks:
            remarks.trim() ||
            null,
        });

      if (error) {
        throw error;
      }

      alert(
        "Cash Book entry saved successfully."
      );

      setShowAdd(false);

      resetForm();

      await loadCashBook();
    } catch (error) {
      console.error(
        "CASH BOOK SAVE ERROR:",
        error
      );

      alert(
        `Unable to save Cash Book entry.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteManualEntry(
    id: string
  ) {
    const confirmed =
      window.confirm(
        "Delete this manual Cash Book entry?"
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const {
        error,
      } = await supabase
        .from(
          "cash_book_entries"
        )
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }

      alert(
        "Manual Cash Book entry deleted."
      );

      await loadCashBook();
    } catch (error) {
      console.error(
        "DELETE CASH BOOK ERROR:",
        error
      );

      alert(
        `Unable to delete entry.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            MANVI MILK AGENCIES
          </p>

          <h1 className="mt-1 text-3xl font-bold text-blue-700">
            Cash Book
          </h1>

          <p className="mt-1 text-gray-500">
            Physical cash receipts and payments.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={setToday}
            className="rounded-lg border bg-white px-4 py-2 font-semibold hover:bg-gray-50"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() =>
              void loadCashBook()
            }
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() =>
              setShowAdd(true)
            }
            className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
          >
            + Add Cash Entry
          </button>
        </div>
      </div>

      {/* WARNING */}
      {loadWarning && (
        <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          <p className="font-bold">
            Cash Book warning
          </p>

          <p className="mt-1 break-words">
            {loadWarning}
          </p>
        </div>
      )}

      {/* DATE FILTER */}
      <div className="mb-6 rounded-2xl bg-white p-5 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold">
              From Date
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={fromDateDisplay}
              onChange={(e) =>
                setDateDisplay(
                  e.target.value,
                  setFromDateDisplay,
                  setFromDate
                )
              }
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-full rounded-lg border border-slate-300 px-3 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              To Date
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={toDateDisplay}
              onChange={(e) =>
                setDateDisplay(
                  e.target.value,
                  setToDateDisplay,
                  setToDate
                )
              }
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-full rounded-lg border border-slate-300 px-3 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              View
            </label>

            <select
              value={filter}
              onChange={(e) =>
                setFilter(
                  e.target.value as FilterType
                )
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-3"
            >
              <option value="ALL">
                All Transactions
              </option>

              <option value="Receipt">
                Receipts Only
              </option>

              <option value="Payment">
                Payments Only
              </option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white">
              <div className="text-xs opacity-80">
                Period
              </div>

              <div className="font-bold">
                {formatDate(
                  fromDate
                )}{" "}
                -{" "}
                {formatDate(
                  toDate
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Date format: DD/MM/YYYY
        </p>
      </div>

      {/* SUMMARY */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-800 p-5 text-white shadow">
          <div className="text-sm opacity-80">
            Opening Cash
          </div>

          <div className="mt-2 text-2xl font-bold">
            {money(
              openingCash
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-green-600 p-5 text-white shadow">
          <div className="text-sm opacity-80">
            Cash Receipts
          </div>

          <div className="mt-2 text-2xl font-bold">
            {money(receipts)}
          </div>
        </div>

        <div className="rounded-2xl bg-red-600 p-5 text-white shadow">
          <div className="text-sm opacity-80">
            Cash Payments
          </div>

          <div className="mt-2 text-2xl font-bold">
            {money(payments)}
          </div>
        </div>

        <div className="rounded-2xl bg-purple-600 p-5 text-white shadow">
          <div className="text-sm opacity-80">
            Purchase Payments
          </div>

          <div className="mt-2 text-2xl font-bold">
            {money(
              purchasePaymentTotal
            )}
          </div>

          <div className="mt-1 text-xs text-purple-100">
            {purchasePaymentCount} cash purchase
            {purchasePaymentCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-2xl bg-indigo-600 p-5 text-white shadow">
          <div className="text-sm opacity-80">
            Cash Balance
          </div>

          <div className="mt-2 text-2xl font-bold">
            {money(
              closingBalance
            )}
          </div>
        </div>
      </div>

      {/* UPI SUMMARY / TRANSACTIONS */}

      {(() => {
        const upiEntries = filteredEntries.filter(
          (row) =>
            row.payment_method
              .trim()
              .toLowerCase() ===
            "upi" &&
            row.entry_type ===
              "Receipt"
        );

        const upiTotal =
          upiEntries.reduce(
            (sum, row) =>
              sum + row.amount,
            0
          );

        return (
          <div className="mb-6 overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-bold text-blue-700">
                  UPI Transactions
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  All UPI sale payments and customer UPI collections.
                  UPI does not affect physical cash.
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 px-5 py-3 text-right">
                <p className="text-xs font-semibold text-slate-500">
                  Total UPI Receipts
                </p>
                <p className="text-2xl font-bold text-blue-700">
                  {money(upiTotal)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-blue-700 text-white">
                  <tr>
                    <th className="p-3 text-left">
                      Date
                    </th>
                    <th className="p-3 text-left">
                      Type
                    </th>
                    <th className="p-3 text-left">
                      Category
                    </th>
                    <th className="p-3 text-left">
                      Party
                    </th>
                    <th className="p-3 text-left">
                      Reference
                    </th>
                    <th className="p-3 text-right">
                      UPI Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {upiEntries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-slate-500"
                      >
                        No UPI transactions found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    upiEntries.map((row) => (
                      <tr
                        key={`upi-section-${row.id}`}
                        className="border-b hover:bg-slate-50"
                      >
                        <td className="p-3">
                          {formatDate(row.date)}
                        </td>
                        <td className="p-3 font-semibold text-green-600">
                          {row.entry_type}
                        </td>
                        <td className="p-3">
                          {row.category}
                        </td>
                        <td className="p-3 font-semibold">
                          {row.party_name || "-"}
                        </td>
                        <td className="p-3">
                          {row.reference || "-"}
                        </td>
                        <td className="p-3 text-right font-bold text-blue-700">
                          {money(row.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* TRANSACTIONS */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Cash Transactions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Sales, customer collections, CASH PURCHASE PAYMENTS,
              UPI receipts, expenses and manual entries.
              UPI receipts are displayed but do not affect physical cash.
              Purchases are read directly from the purchases table.
            </p>
          </div>

          <div className="text-sm font-semibold text-slate-500">
            {filteredEntries.length} entries
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead className="bg-blue-700 text-white">
              <tr>
                <th className="p-3 text-left">
                  Date
                </th>

                <th className="p-3 text-left">
                  Type
                </th>

                <th className="p-3 text-left">
                  Category
                </th>

                <th className="p-3 text-left">
                  Party
                </th>

                <th className="p-3 text-left">
                  Payment
                </th>

                <th className="p-3 text-left">
                  Source
                </th>

                <th className="p-3 text-left">
                  Reference
                </th>

                <th className="p-3 text-right">
                  Amount
                </th>

                <th className="p-3 text-center">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="p-10 text-center text-slate-500"
                  >
                    Loading Cash Book...
                  </td>
                </tr>
              ) : filteredEntries.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="p-10 text-center text-slate-500"
                  >
                    No cash transactions found.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(
                  (row) => (
                    <tr
                      key={row.id}
                      className="border-b hover:bg-slate-50"
                    >
                      <td className="p-3">
                        {formatDate(
                          row.date
                        )}
                      </td>

                      <td
                        className={`p-3 font-semibold ${
                          row.entry_type ===
                          "Receipt"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {row.entry_type}
                      </td>

                      <td className="p-3 font-medium">
                        {row.category}
                      </td>

                      <td className="p-3">
                        {row.party_name ||
                          "-"}
                      </td>

                      <td className="p-3">
                        {row.payment_method}
                      </td>

                      <td className="p-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {row.source}
                        </span>
                      </td>

                      <td className="p-3 font-semibold text-blue-700">
                        {row.reference ||
                          "-"}
                      </td>

                      <td
                        className={`p-3 text-right font-bold ${
                          row.entry_type ===
                          "Receipt"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {row.entry_type ===
                        "Receipt"
                          ? "+ "
                          : "- "}
                        {money(
                          row.amount
                        )}
                      </td>

                      <td className="p-3 text-center">
                        {row.source ===
                        "Manual" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void deleteManualEntry(
                                row.id
                              )
                            }
                            disabled={saving}
                            className="rounded-lg bg-red-50 px-3 py-1 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Automatic
                          </span>
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

      {/* ADD MANUAL ENTRY */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Add Cash Book Entry
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Manual entry for physical cash only.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAdd(
                    false
                  );
                  resetForm();
                }}
                className="text-2xl text-slate-500 hover:text-slate-800"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Date
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    entryDateDisplay
                  }
                  onChange={(e) =>
                    setDateDisplay(
                      e.target.value,
                      setEntryDateDisplay,
                      setEntryDate
                    )
                  }
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  className="w-full rounded-lg border border-slate-300 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Type
                </label>

                <select
                  value={
                    entryType
                  }
                  onChange={(e) => {
                    const value =
                      e.target.value as EntryType;

                    setEntryType(
                      value
                    );

                    setCategory(
                      value ===
                        "Receipt"
                        ? "Other Receipt"
                        : "Other Payment"
                    );
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-3"
                >
                  <option value="Receipt">
                    Receipt
                  </option>

                  <option value="Payment">
                    Payment
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Category
                </label>

                <input
                  type="text"
                  value={
                    category
                  }
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  placeholder="Example: Owner cash received"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Party / Person
                </label>

                <input
                  type="text"
                  value={
                    partyName
                  }
                  onChange={(e) =>
                    setPartyName(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    amount
                  }
                  onChange={(e) =>
                    setAmount(
                      e.target.value
                    )
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Payment Method
                </label>

                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 font-bold text-green-700">
                  Cash
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Reference
                </label>

                <input
                  type="text"
                  value={
                    reference
                  }
                  onChange={(e) =>
                    setReference(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Remarks
                </label>

                <input
                  type="text"
                  value={
                    remarks
                  }
                  onChange={(e) =>
                    setRemarks(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t p-5">
              <button
                type="button"
                onClick={() => {
                  setShowAdd(
                    false
                  );
                  resetForm();
                }}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveManualEntry()
                }
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
