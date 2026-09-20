import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  customer_name: string;
  opening_balance: number;
  route: string;
};

type QuickCollectionRow = {
  amount: string;
  cashAmount: string;
  upiAmount: string;
  paymentMethod: "Cash" | "UPI" | "Split";
  saving: boolean;
};

type OutstandingSale = {
  id: string;
  sale_date: string;
  balance_amount: number;
};

type RecentCollection = {
  id: string;
  collection_date: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  payment_method: string;
  cash_amount: number;
  upi_amount: number;
  remarks: string;
  source: "Collection" | "Sale";
};

type Allocation = {
  sale_id: string;
  amount: number;
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
  if (!value) return "-";

  const part = String(value).slice(0, 10);
  const parts = part.split("-");

  if (
    parts.length === 3 &&
    /^\d{4}$/.test(parts[0])
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return String(value);
}

function formatDateDDMMYYYYInput(
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

function parseCollectionDate(
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

  return `${year}-${String(
    month
  ).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}

export default function Collections() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [customerId, setCustomerId] = useState("");

  // Route-wise quick collection entry
  const [selectedRoute, setSelectedRoute] = useState("");
  const [quickCollectionRows, setQuickCollectionRows] =
    useState<Record<string, QuickCollectionRow>>({});
  const [quickBalances, setQuickBalances] =
    useState<Record<string, number>>({});
  const [quickBalanceLoading, setQuickBalanceLoading] =
    useState(false);

  const [balance, setBalance] = useState(0);

  const [outstandingSales, setOutstandingSales] = useState<OutstandingSale[]>([]);

  const [amount, setAmount] = useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("Cash");

  const [cashAmount, setCashAmount] =
    useState("");

  const [upiAmount, setUpiAmount] =
    useState("");

  const [remarks, setRemarks] = useState("");

  const [collectionDate, setCollectionDate] =
    useState(getTodayLocalDate());

  const [collectionDateDisplay, setCollectionDateDisplay] =
    useState(
      formatDateDDMMYYYY(
        getTodayLocalDate()
      )
    );

  const [recentCollections, setRecentCollections] =
    useState<RecentCollection[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [loadingData, setLoadingData] =
    useState(true);

  const [editingCollectionId, setEditingCollectionId] =
    useState<string | null>(null);

  /* =====================================================
     LOAD CUSTOMERS
  ===================================================== */

  async function loadCustomers() {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select(
          `
          id,
          customer_name,
          opening_balance,
          route
          `
        )
        .order("customer_name");

      if (error) {
        throw error;
      }

      setCustomers(
        (data || []).map((customer: any) => ({
          id: customer.id,
          customer_name:
            customer.customer_name || "",
          opening_balance:
            Number(
              customer.opening_balance
            ) || 0,
          route:
            String(
              customer.route || ""
            ).trim(),
        }))
      );
    } catch (error: any) {
      console.error(error);

      alert(
        "Unable to load customers:\n" +
          (error?.message || "Unknown error")
      );
    }
  }

  /* =====================================================
     LOAD RECENT COLLECTIONS
  ===================================================== */

  async function loadRecentCollections() {
    try {
      /*
       * Recent Collections shows:
       * 1. Payments entered in Collections
       * 2. Payments received directly during Sales Punch
       *
       * Sale payments are DISPLAYED here only.
       * They are not inserted into collections, so balances
       * are never reduced twice.
       */

      const [
        { data: collectionRows, error: collectionError },
        { data: saleRows, error: saleError },
      ] = await Promise.all([
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
          .order("collection_date", {
            ascending: false,
          })
          .limit(30),

        supabase
          .from("sales")
          .select(
            `
            id,
            sale_date,
            customer_id,
            paid_amount,
            payment_method,
            cash_amount,
            upi_amount
            `
          )
          .gt("paid_amount", 0)
          .order("sale_date", {
            ascending: false,
          })
          .limit(30),
      ]);

      if (collectionError) {
        throw collectionError;
      }

      if (saleError) {
        throw saleError;
      }

      const customerMap = new Map<string, string>();

      customers.forEach((customer) => {
        customerMap.set(
          customer.id,
          customer.customer_name
        );
      });

      const collectionItems: RecentCollection[] =
        (collectionRows || []).map((row: any) => ({
          id: row.id,
          collection_date: row.collection_date,
          customer_id: row.customer_id,
          customer_name:
            customerMap.get(row.customer_id) || "Unknown",
          amount: Number(row.amount) || 0,
          payment_method: row.payment_method || "Cash",
          cash_amount: Number(row.cash_amount) || 0,
          upi_amount: Number(row.upi_amount) || 0,
          remarks: row.remarks || "",
          source: "Collection",
        }));

      const saleItems: RecentCollection[] =
        (saleRows || []).map((row: any) => {
          const method = String(
            row.payment_method || "Cash"
          ).trim();

          const paid = Number(row.paid_amount) || 0;

          const cash =
            Number(row.cash_amount) ||
            (method.toLowerCase() === "cash" ? paid : 0);

          const upi =
            Number(row.upi_amount) ||
            (method.toLowerCase() === "upi" ? paid : 0);

          return {
            id: `sale-${row.id}`,
            collection_date: row.sale_date,
            customer_id: row.customer_id,
            customer_name:
              customerMap.get(row.customer_id) || "Unknown",
            amount: paid,
            payment_method: method || "Cash",
            cash_amount: cash,
            upi_amount: upi,
            remarks: "Sale Payment",
            source: "Sale",
          };
        });

      const combined = [
        ...collectionItems,
        ...saleItems,
      ]
        .sort((a, b) => {
          const dateCompare =
            String(b.collection_date).localeCompare(
              String(a.collection_date)
            );

          if (dateCompare !== 0) {
            return dateCompare;
          }

          if (a.source !== b.source) {
            return a.source === "Collection" ? -1 : 1;
          }

          return 0;
        })
        .slice(0, 50);

      setRecentCollections(combined);
    } catch (error: any) {
      console.error(
        "Recent collection error:",
        error
      );
    }
  }

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    async function initialLoad() {
      setLoadingData(true);

      await loadCustomers();

      setLoadingData(false);
    }

    initialLoad();
  }, []);

  useEffect(() => {
    if (!loadingData) {
      loadRecentCollections();
    }
  }, [customers, loadingData]);

  /* =====================================================
     LOAD CUSTOMER BALANCE
  ===================================================== */

  async function loadBalance(id: string) {
    if (!id) {
      setBalance(0);
      setOutstandingSales([]);
      return;
    }

    try {
      const customer =
        customers.find(
          (item) => item.id === id
        );

      const openingBalance =
        Number(
          customer?.opening_balance || 0
        );

      const { data, error } =
        await supabase
          .from("sales")
          .select("balance_amount")
          .eq("customer_id", id)
          .gt("balance_amount", 0);

      if (error) {
        throw error;
      }

      const outstandingRows = (data || []).map(
        (sale: any) => ({
          id: sale.id,
          sale_date: sale.sale_date,
          balance_amount:
            Number(sale.balance_amount) || 0,
        })
      ) as OutstandingSale[];

      setOutstandingSales(outstandingRows);

      const salesOutstanding =
        outstandingRows.reduce(
          (total: number, sale: OutstandingSale) =>
            total + sale.balance_amount,
          0
        );

      setBalance(
        openingBalance +
          salesOutstanding
      );
    } catch (error: any) {
      console.error(error);

      alert(
        "Unable to calculate balance:\n" +
          (error?.message || "Unknown error")
      );
    }
  }

  /* =====================================================
     ROUTE-WISE QUICK COLLECTION
     ===================================================== */

  const routeNames = useMemo(() => {
    return Array.from(
      new Set(
        customers
          .map((customer) =>
            String(customer.route || "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [customers]);

  const routeCustomers = useMemo(() => {
    if (!selectedRoute) {
      return [];
    }

    return customers
      .filter(
        (customer) =>
          String(customer.route || "").trim() ===
          selectedRoute
      )
      .sort((a, b) =>
        a.customer_name.localeCompare(
          b.customer_name
        )
      );
  }, [customers, selectedRoute]);

  async function initializeQuickRoute(route: string) {
    setSelectedRoute(route);

    if (!route) {
      setQuickCollectionRows({});
      setQuickBalances({});
      return;
    }

    const routeCustomersForBalance =
      customers.filter(
        (customer) =>
          String(customer.route || "").trim() === route
      );

    const rows: Record<string, QuickCollectionRow> = {};

    routeCustomersForBalance.forEach(
      (customer) => {
        rows[customer.id] = {
          amount: "",
          cashAmount: "",
          upiAmount: "",
          paymentMethod: "Cash",
          saving: false,
        };
      }
    );

    setQuickCollectionRows(rows);
    setQuickBalanceLoading(true);

    try {
      const balances: Record<string, number> = {};

      await Promise.all(
        routeCustomersForBalance.map(
          async (customer) => {
            const { data, error } =
              await supabase
                .from("sales")
                .select("balance_amount")
                .eq(
                  "customer_id",
                  customer.id
                )
                .gt(
                  "balance_amount",
                  0
                );

            if (error) {
              throw error;
            }

            const salesOutstanding =
              (data || []).reduce(
                (
                  total: number,
                  sale: any
                ) =>
                  total +
                  (Number(
                    sale.balance_amount
                  ) || 0),
                0
              );

            balances[customer.id] =
              (Number(
                customer.opening_balance
              ) || 0) +
              salesOutstanding;
          }
        )
      );

      setQuickBalances(balances);
    } catch (error: any) {
      console.error(
        "LOAD ROUTE BALANCES ERROR:",
        error
      );

      alert(
        "Unable to load route outstanding balances.\n\n" +
          (error?.message ||
            "Unknown error")
      );

      setQuickBalances({});
    } finally {
      setQuickBalanceLoading(false);
    }
  }

  function updateQuickCollectionRow(
    customerIdValue: string,
    changes: Partial<QuickCollectionRow>
  ) {
    setQuickCollectionRows((previous) => ({
      ...previous,
      [customerIdValue]: {
        amount:
          previous[customerIdValue]?.amount || "",
        cashAmount:
          previous[customerIdValue]?.cashAmount || "",
        upiAmount:
          previous[customerIdValue]?.upiAmount || "",
        paymentMethod:
          previous[customerIdValue]?.paymentMethod ||
          "Cash",
        saving:
          previous[customerIdValue]?.saving || false,
        ...changes,
      },
    }));
  }

  async function saveQuickRouteCollection(
    customer: Customer
  ) {
    const row =
      quickCollectionRows[customer.id];

    const quickCash =
      row?.paymentMethod === "Cash"
        ? Number(row.amount || 0)
        : row?.paymentMethod === "Split"
        ? Number(row.cashAmount || 0)
        : 0;

    const quickUpi =
      row?.paymentMethod === "UPI"
        ? Number(row.amount || 0)
        : row?.paymentMethod === "Split"
        ? Number(row.upiAmount || 0)
        : 0;

    const quickAmount =
      quickCash + quickUpi;

    if (
      !Number.isFinite(quickCash) ||
      !Number.isFinite(quickUpi) ||
      quickCash < 0 ||
      quickUpi < 0 ||
      quickAmount <= 0
    ) {
      alert(
        `Enter collection amount for ${customer.customer_name}.`
      );
      return;
    }

    try {
      updateQuickCollectionRow(
        customer.id,
        { saving: true }
      );

      // Load the latest balance so quick entry cannot
      // accidentally collect more than the current outstanding.
      const openingBalance =
        Number(customer.opening_balance || 0);

      const { data: sales, error: salesError } =
        await supabase
          .from("sales")
          .select(
            "id, sale_date, balance_amount"
          )
          .eq(
            "customer_id",
            customer.id
          )
          .gt(
            "balance_amount",
            0
          )
          .order(
            "sale_date",
            { ascending: true }
          )
          .order(
            "created_at",
            { ascending: true }
          );

      if (salesError) {
        throw salesError;
      }

      const outstanding =
        (sales || []).map((sale: any) => ({
          id: sale.id,
          sale_date: sale.sale_date,
          balance_amount:
            Number(sale.balance_amount) || 0,
        })) as OutstandingSale[];

      const salesOutstanding =
        outstanding.reduce(
          (sum, sale) =>
            sum + sale.balance_amount,
          0
        );

      const currentBalance =
        openingBalance +
        salesOutstanding;

      if (
        quickAmount >
        currentBalance
      ) {
        throw new Error(
          `Collection cannot exceed outstanding balance of ₹${currentBalance.toFixed(
            2
          )}.`
        );
      }

      const {
        allocations,
        remaining,
      } =
        calculateAllocations(
          outstanding,
          quickAmount
        );

      const { data: collection, error } =
        await supabase
          .from("collections")
          .insert({
            customer_id:
              customer.id,
            collection_date:
              getTodayLocalDate(),
            amount:
              quickAmount,
            payment_method:
              row.paymentMethod,
            cash_amount:
              quickCash,
            upi_amount:
              quickUpi,
            remarks:
              `Route: ${selectedRoute}`,
          })
          .select()
          .single();

      if (error) {
        throw error;
      }

      if (!collection) {
        throw new Error(
          "Collection was not created."
        );
      }

      for (const allocation of allocations) {
        const sale =
          outstanding.find(
            (item) =>
              item.id ===
              allocation.sale_id
          );

        if (!sale) {
          continue;
        }

        const newBalance =
          Math.max(
            0,
            sale.balance_amount -
              allocation.amount
          );

        const { error: updateError } =
          await supabase
            .from("sales")
            .update({
              balance_amount:
                newBalance,
            })
            .eq(
              "id",
              allocation.sale_id
            );

        if (updateError) {
          throw updateError;
        }

        const {
          error: allocationError,
        } = await supabase
          .from(
            "collection_allocations"
          )
          .insert({
            collection_id:
              collection.id,
            sale_id:
              allocation.sale_id,
            amount:
              allocation.amount,
          });

        if (allocationError) {
          throw allocationError;
        }
      }

      if (remaining > 0) {
        const openingPayment =
          Math.min(
            remaining,
            openingBalance
          );

        if (openingPayment > 0) {
          const {
            error: openingError,
          } = await supabase
            .from("customers")
            .update({
              opening_balance:
                openingBalance -
                openingPayment,
            })
            .eq(
              "id",
              customer.id
            );

          if (openingError) {
            throw openingError;
          }
        }
      }

      updateQuickCollectionRow(
        customer.id,
        {
          amount: "",
          cashAmount: "",
          upiAmount: "",
          saving: false,
        }
      );

      await loadCustomers();
      await loadRecentCollections();

      // Refresh the route outstanding values while keeping
      // the route and all customers open.
      await initializeQuickRoute(
        selectedRoute
      );

      // Keep route open after saving so the next customer
      // can be entered immediately.
      alert(
        `${customer.customer_name}: ₹${quickAmount.toFixed(
          2
        )} ${row.paymentMethod} saved.`
      );
    } catch (error: any) {
      console.error(
        "QUICK ROUTE COLLECTION ERROR:",
        error
      );

      updateQuickCollectionRow(
        customer.id,
        { saving: false }
      );

      alert(
        `Unable to save collection for ${customer.customer_name}.\\n\\n${
          error?.message ||
          "Unknown error"
        }`
      );
    }
  }

  /* =====================================================
     ROUTE QUICK TOTALS
  ===================================================== */

  const routeQuickTotals = useMemo(() => {
    if (!selectedRoute) {
      return {
        total: 0,
        cash: 0,
        upi: 0,
        customersEntered: 0,
      };
    }

    let total = 0;
    let cash = 0;
    let upi = 0;
    let customersEntered = 0;

    routeCustomers.forEach((customer) => {
      const row = quickCollectionRows[customer.id];
      const enteredAmount = Number(row?.amount || 0);

      if (Number.isFinite(enteredAmount) && enteredAmount > 0) {
        total += enteredAmount;
        customersEntered += 1;

        if (row?.paymentMethod === "UPI") {
          upi += enteredAmount;
        } else if (row?.paymentMethod === "Split") {
          cash += Number(row.cashAmount || 0);
          upi += Number(row.upiAmount || 0);
        } else {
          cash += enteredAmount;
        }
      }
    });

    return {
      total,
      cash,
      upi,
      customersEntered,
    };
  }, [
    selectedRoute,
    routeCustomers,
    quickCollectionRows,
  ]);

  /* =====================================================
     PAYMENT METHOD CHANGE
  ===================================================== */


  function handlePaymentMethodChange(
    value: string
  ) {
    setPaymentMethod(value);

    const normalized =
      value.trim().toLowerCase();

    if (normalized !== "split") {
      setCashAmount("");
      setUpiAmount("");
    } else {
      setCashAmount("");
      setUpiAmount("");
      setAmount("");
    }
  }

  /* =====================================================
     COLLECTION PAYMENT TOTALS
  ===================================================== */

  const isSplitPayment =
    paymentMethod.trim().toLowerCase() ===
    "split";

  const cashPaid =
    isSplitPayment
      ? Number(cashAmount) || 0
      : paymentMethod.trim().toLowerCase() ===
        "cash"
      ? Number(amount) || 0
      : 0;

  const upiPaid =
    isSplitPayment
      ? Number(upiAmount) || 0
      : paymentMethod.trim().toLowerCase() ===
        "upi"
      ? Number(amount) || 0
      : 0;

  const effectiveCollectionAmount =
    isSplitPayment
      ? cashPaid + upiPaid
      : Number(amount) || 0;

  /* =====================================================
     CUSTOMER CHANGE
  ===================================================== */

  async function handleCustomerChange(
    id: string
  ) {
    setCustomerId(id);

    setAmount("");

    setRemarks("");

    setEditingCollectionId(null);

    await loadBalance(id);
  }

  /* =====================================================
     GET OUTSTANDING SALES
  ===================================================== */

  async function getOutstandingSales(
    id: string
  ) {
    const { data, error } =
      await supabase
        .from("sales")
        .select(
          `
          id,
          sale_date,
          balance_amount
          `
        )
        .eq("customer_id", id)
        .gt("balance_amount", 0)
        .order("sale_date", {
          ascending: true,
        })
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      throw error;
    }

    return (data || []).map(
      (sale: any) => ({
        id: sale.id,
        sale_date: sale.sale_date,
        balance_amount:
          Number(
            sale.balance_amount
          ) || 0,
      })
    ) as OutstandingSale[];
  }

  /* =====================================================
     CREATE ALLOCATIONS
  ===================================================== */

  function calculateAllocations(
    sales: OutstandingSale[],
    collectionAmount: number
  ) {
    let remaining =
      collectionAmount;

    const allocations: Allocation[] =
      [];

    for (const sale of sales) {
      if (remaining <= 0) {
        break;
      }

      const saleBalance =
        Number(
          sale.balance_amount
        ) || 0;

      if (saleBalance <= 0) {
        continue;
      }

      const applied = Math.min(
        remaining,
        saleBalance
      );

      allocations.push({
        sale_id: sale.id,
        amount: applied,
      });

      remaining -= applied;
    }

    return {
      allocations,
      remaining,
    };
  }

  /* =====================================================
     SAVE NEW COLLECTION
  ===================================================== */

  async function saveNewCollection() {
    const collectionAmount =
      effectiveCollectionAmount;

    const normalizedDate =
      parseCollectionDate(
        collectionDateDisplay
      );

    if (!normalizedDate) {
      alert(
        "Please enter a valid collection date in DD/MM/YYYY format.\nExample: 09/09/2026"
      );
      return;
    }

    setCollectionDate(
      normalizedDate
    );

    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    if (
      isSplitPayment &&
      (cashPaid < 0 ||
        upiPaid < 0 ||
        cashPaid + upiPaid <= 0)
    ) {
      alert(
        "For Split (Cash + UPI), enter a valid Cash and/or UPI amount."
      );
      return;
    }

    if (
      !Number.isFinite(
        collectionAmount
      ) ||
      collectionAmount <= 0
    ) {
      alert(
        "Please enter a valid collection amount."
      );
      return;
    }

    if (
      collectionAmount >
      balance
    ) {
      alert(
        `Collection cannot exceed outstanding balance of ₹${balance.toFixed(
          2
        )}.`
      );
      return;
    }

    try {
      setLoading(true);

      /* ---------------------------------------------
         LOAD CURRENT OUTSTANDING SALES
      --------------------------------------------- */

      const outstandingSales =
        await getOutstandingSales(
          customerId
        );

      /* ---------------------------------------------
         CALCULATE ALLOCATION
      --------------------------------------------- */

      const {
        allocations,
        remaining,
      } =
        calculateAllocations(
          outstandingSales,
          collectionAmount
        );

      /* ---------------------------------------------
         INSERT COLLECTION
      --------------------------------------------- */

      const { data: collection, error } =
        await supabase
          .from("collections")
          .insert({
            customer_id:
              customerId,

            collection_date:
              normalizedDate,

            amount:
              collectionAmount,

            payment_method:
              paymentMethod,

            cash_amount:
              cashPaid,

            upi_amount:
              upiPaid,

            remarks:
              remarks.trim() || null,
          })
          .select()
          .single();

      if (error) {
        throw error;
      }

      if (!collection) {
        throw new Error(
          "Collection was not created."
        );
      }

      /* ---------------------------------------------
         UPDATE SALE BALANCES
      --------------------------------------------- */

      for (const allocation of allocations) {
        const sale =
          outstandingSales.find(
            (item) =>
              item.id ===
              allocation.sale_id
          );

        if (!sale) {
          continue;
        }

        const newBalance =
          Math.max(
            0,
            sale.balance_amount -
              allocation.amount
          );

        const { error: updateError } =
          await supabase
            .from("sales")
            .update({
              balance_amount:
                newBalance,
            })
            .eq(
              "id",
              allocation.sale_id
            );

        if (updateError) {
          throw updateError;
        }

        /* -------------------------------------------
           SAVE ALLOCATION
        ------------------------------------------- */

        const {
          error: allocationError,
        } = await supabase
          .from(
            "collection_allocations"
          )
          .insert({
            collection_id:
              collection.id,

            sale_id:
              allocation.sale_id,

            amount:
              allocation.amount,
          });

        if (allocationError) {
          throw allocationError;
        }
      }

      /* ---------------------------------------------
         OPENING BALANCE
      --------------------------------------------- */

      if (remaining > 0) {
        const customer =
          customers.find(
            (item) =>
              item.id ===
              customerId
          );

        const opening =
          Number(
            customer?.opening_balance ||
              0
          );

        const openingPayment =
          Math.min(
            remaining,
            opening
          );

        if (
          openingPayment > 0
        ) {
          const {
            error: openingError,
          } = await supabase
            .from("customers")
            .update({
              opening_balance:
                opening -
                openingPayment,
            })
            .eq(
              "id",
              customerId
            );

          if (openingError) {
            throw openingError;
          }
        }
      }

      alert(
        "Collection saved successfully."
      );

      clearForm();

      await loadCustomers();

      await loadRecentCollections();

      await loadBalance(
        customerId
      );
    } catch (error: any) {
      console.error(error);

      alert(
        "Collection Error:\n" +
          (error?.message ||
            "Unable to save collection.")
      );
    } finally {
      setLoading(false);
    }
  }

  /* =====================================================
     GET COLLECTION ALLOCATIONS
  ===================================================== */

  async function getCollectionAllocations(
    collectionId: string
  ) {
    const { data, error } =
      await supabase
        .from(
          "collection_allocations"
        )
        .select(
          `
          id,
          sale_id,
          amount
          `
        )
        .eq(
          "collection_id",
          collectionId
        );

    if (error) {
      throw error;
    }

    return data || [];
  }

  /* =====================================================
     DELETE COLLECTION
  ===================================================== */

  async function deleteCollection(
    collectionId: string
  ) {
    const confirmed = window.confirm(
      "Delete this collection?\n\nThe collection, allocations, and related customer balance effects will be reversed."
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      // -----------------------------------------------------
      // LOAD COLLECTION
      // -----------------------------------------------------
      const { data: collection, error: collectionError } =
        await supabase
          .from("collections")
          .select("id, customer_id, amount")
          .eq("id", collectionId)
          .single();

      if (collectionError) throw collectionError;
      if (!collection) throw new Error("Collection not found.");

      // -----------------------------------------------------
      // LOAD ALLOCATIONS
      // -----------------------------------------------------
      const allocations = await getCollectionAllocations(
        collectionId
      );

      // -----------------------------------------------------
      // RESTORE EACH SALE BALANCE
      // -----------------------------------------------------
      for (const allocation of allocations) {
        const { data: sale, error: saleError } =
          await supabase
            .from("sales")
            .select("id, balance_amount")
            .eq("id", allocation.sale_id)
            .single();

        if (saleError) throw saleError;
        if (!sale) continue;

        const restoredBalance =
          (Number(sale.balance_amount) || 0) +
          (Number(allocation.amount) || 0);

        const { error: restoreError } = await supabase
          .from("sales")
          .update({ balance_amount: restoredBalance })
          .eq("id", allocation.sale_id);

        if (restoreError) throw restoreError;
      }

      // -----------------------------------------------------
      // RESTORE OPENING BALANCE PORTION
      // Collection amount not allocated to sales was applied
      // against opening_balance when the collection was saved.
      // -----------------------------------------------------
      const allocatedAmount = allocations.reduce(
        (total: number, item: any) =>
          total + (Number(item.amount) || 0),
        0
      );

      const openingRestore = Math.max(
        0,
        (Number(collection.amount) || 0) - allocatedAmount
      );

      if (openingRestore > 0 && collection.customer_id) {
        const { data: customer, error: customerError } =
          await supabase
            .from("customers")
            .select("id, opening_balance")
            .eq("id", collection.customer_id)
            .single();

        if (customerError) throw customerError;

        if (customer) {
          const { error: openingError } = await supabase
            .from("customers")
            .update({
              opening_balance:
                (Number(customer.opening_balance) || 0) +
                openingRestore,
            })
            .eq("id", collection.customer_id);

          if (openingError) throw openingError;
        }
      }

      // -----------------------------------------------------
      // DELETE ALLOCATIONS FIRST
      // -----------------------------------------------------
      const { error: allocationDeleteError } =
        await supabase
          .from("collection_allocations")
          .delete()
          .eq("collection_id", collectionId);

      if (allocationDeleteError) {
        throw allocationDeleteError;
      }

      // -----------------------------------------------------
      // DELETE COLLECTION HEADER
      // -----------------------------------------------------
      const { error: deleteError } = await supabase
        .from("collections")
        .delete()
        .eq("id", collectionId);

      if (deleteError) throw deleteError;

      // -----------------------------------------------------
      // REFRESH DATA
      // -----------------------------------------------------
      alert("Collection deleted successfully.");

      await loadCustomers();
      await loadRecentCollections();

      if (collection.customer_id) {
        await loadBalance(collection.customer_id);
      } else {
        setBalance(0);
      }
    } catch (error: any) {
      console.error("Delete collection error:", error);

      alert(
        "Delete Collection Error:\n" +
          (error?.message || "Unable to delete collection.")
      );
    } finally {
      setLoading(false);
    }
  }

  /* =====================================================
     EDIT COLLECTION
  ===================================================== */

  async function editCollection(
    collectionId: string
  ) {
    try {
      setLoading(true);

      const {
        data: collection,
        error: collectionError,
      } = await supabase
        .from("collections")
        .select(
          `
          id,
          customer_id,
          collection_date,
          amount,
          payment_method,
          remarks
          `
        )
        .eq(
          "id",
          collectionId
        )
        .single();

      if (collectionError) {
        throw collectionError;
      }

      setEditingCollectionId(
        collection.id
      );

      setCustomerId(
        collection.customer_id
      );

      const editDate =
        collection.collection_date
          ? String(
              collection.collection_date
            ).slice(0, 10)
          : getTodayLocalDate();

      setCollectionDate(
        editDate
      );

      setCollectionDateDisplay(
        formatDateDDMMYYYY(
          editDate
        )
      );

      setAmount(
        String(
          Number(
            collection.amount
          ) || 0
        )
      );

      const editMethod =
        String(
          collection.payment_method ||
            "Cash"
        )
          .trim()
          .toLowerCase();

      setPaymentMethod(
        collection.payment_method ||
          "Cash"
      );

      setCashAmount(
        editMethod === "split"
          ? String(
              Number(
                (collection as any).cash_amount
              ) || 0
            )
          : ""
      );

      setUpiAmount(
        editMethod === "split"
          ? String(
              Number(
                (collection as any).upi_amount
              ) || 0
            )
          : ""
      );

      setRemarks(
        collection.remarks || ""
      );

      // Do not change balances while opening the edit form.
      // The old collection is reversed only when Update is clicked.

      await loadCustomers();

      await loadBalance(
        collection.customer_id
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error: any) {
      console.error(error);

      alert(
        "Unable to edit collection:\n" +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  /* =====================================================
     REVERSE OLD COLLECTION EFFECTS
  ===================================================== */

  async function reverseCollectionEffects(
    collection: any,
    allocations: any[]
  ) {
    for (const allocation of allocations || []) {
      if (!allocation.sale_id) continue;

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("id, balance_amount")
        .eq("id", allocation.sale_id)
        .single();

      if (saleError) throw saleError;
      if (!sale) continue;

      const restoredBalance =
        (Number(sale.balance_amount) || 0) +
        (Number(allocation.amount) || 0);

      const { error } = await supabase
        .from("sales")
        .update({ balance_amount: restoredBalance })
        .eq("id", allocation.sale_id);

      if (error) throw error;
    }

    const allocatedAmount = (allocations || []).reduce(
      (total: number, item: any) =>
        total + (Number(item.amount) || 0),
      0
    );

    const openingRestore = Math.max(
      0,
      (Number(collection.amount) || 0) - allocatedAmount
    );

    if (openingRestore > 0 && collection.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id, opening_balance")
        .eq("id", collection.customer_id)
        .single();

      if (customerError) throw customerError;

      if (customer) {
        const { error } = await supabase
          .from("customers")
          .update({
            opening_balance:
              (Number(customer.opening_balance) || 0) +
              openingRestore,
          })
          .eq("id", collection.customer_id);

        if (error) throw error;
      }
    }
  }

  /* =====================================================
     UPDATE EDITED COLLECTION
  ===================================================== */

  async function updateCollection() {
    if (!editingCollectionId) {
      return;
    }

    const collectionAmount =
      effectiveCollectionAmount;

    const normalizedDate =
      parseCollectionDate(
        collectionDateDisplay
      );

    if (!normalizedDate) {
      alert(
        "Please enter a valid collection date in DD/MM/YYYY format.\nExample: 09/09/2026"
      );
      return;
    }

    if (
      isSplitPayment &&
      (cashPaid < 0 ||
        upiPaid < 0 ||
        cashPaid + upiPaid <= 0)
    ) {
      alert(
        "For Split (Cash + UPI), enter a valid Cash and/or UPI amount."
      );
      return;
    }

    if (
      !Number.isFinite(
        collectionAmount
      ) ||
      collectionAmount <= 0
    ) {
      alert(
        "Please enter a valid collection amount."
      );
      return;
    }

    try {
      setLoading(true);

      /*
       * 1. Load original collection and allocations.
       * 2. Reverse original sale/opening effects.
       * 3. Delete original allocations.
       * 4. Re-read outstanding.
       * 5. Apply the edited collection.
       */
      const {
        data: oldCollection,
        error: oldCollectionError,
      } = await supabase
        .from("collections")
        .select(
          `
            id,
            customer_id,
            amount
          `
        )
        .eq(
          "id",
          editingCollectionId
        )
        .single();

      if (oldCollectionError) {
        throw oldCollectionError;
      }

      if (!oldCollection) {
        throw new Error(
          "Original collection not found."
        );
      }

      const oldAllocations =
        await getCollectionAllocations(
          editingCollectionId
        );

      await reverseCollectionEffects(
        oldCollection,
        oldAllocations
      );

      const {
        error: deleteAllocationError,
      } = await supabase
        .from(
          "collection_allocations"
        )
        .delete()
        .eq(
          "collection_id",
          editingCollectionId
        );

      if (deleteAllocationError) {
        throw deleteAllocationError;
      }

      /*
       * Get fresh customer master values after
       * reversing the old opening-balance portion.
       */
      const {
        data: refreshedCustomer,
        error: refreshedCustomerError,
      } = await supabase
        .from("customers")
        .select(
          "id, opening_balance"
        )
        .eq(
          "id",
          customerId
        )
        .single();

      if (refreshedCustomerError) {
        throw refreshedCustomerError;
      }

      const outstandingSales =
        await getOutstandingSales(
          customerId
        );

      const openingBalance =
        Number(
          refreshedCustomer
            ?.opening_balance || 0
        );

      const salesOutstanding =
        outstandingSales.reduce(
          (sum, sale) =>
            sum +
            Number(
              sale.balance_amount || 0
            ),
          0
        );

      const currentBalance =
        openingBalance +
        salesOutstanding;

      if (
        collectionAmount >
        currentBalance
      ) {
        throw new Error(
          `Collection cannot exceed outstanding balance of ₹${currentBalance.toFixed(
            2
          )}.`
        );
      }

      const {
        allocations,
        remaining,
      } =
        calculateAllocations(
          outstandingSales,
          collectionAmount
        );

      const {
        error: updateError,
      } = await supabase
        .from("collections")
        .update({
          customer_id:
            customerId,
          collection_date:
            normalizedDate,
          amount:
            collectionAmount,
          payment_method:
            paymentMethod,
          cash_amount:
            cashPaid,
          upi_amount:
            upiPaid,
          remarks:
            remarks.trim() ||
            null,
        })
        .eq(
          "id",
          editingCollectionId
        );

      if (updateError) {
        throw updateError;
      }

      for (
        const allocation of allocations
      ) {
        const sale =
          outstandingSales.find(
            (item) =>
              item.id ===
              allocation.sale_id
          );

        if (!sale) {
          continue;
        }

        const newBalance =
          Math.max(
            0,
            Number(
              sale.balance_amount
            ) -
              Number(
                allocation.amount
              )
          );

        const {
          error: saleUpdateError,
        } = await supabase
          .from("sales")
          .update({
            balance_amount:
              newBalance,
          })
          .eq(
            "id",
            allocation.sale_id
          );

        if (saleUpdateError) {
          throw saleUpdateError;
        }

        const {
          error: allocationError,
        } = await supabase
          .from(
            "collection_allocations"
          )
          .insert({
            collection_id:
              editingCollectionId,
            sale_id:
              allocation.sale_id,
            amount:
              allocation.amount,
          });

        if (allocationError) {
          throw allocationError;
        }
      }

      /*
       * Any amount left after clearing sale balances
       * is applied to the customer's opening balance.
       */
      if (remaining > 0) {
        const {
          data: customer,
          error: customerError,
        } = await supabase
          .from("customers")
          .select(
            "id, opening_balance"
          )
          .eq(
            "id",
            customerId
          )
          .single();

        if (customerError) {
          throw customerError;
        }

        const opening =
          Number(
            customer?.opening_balance ||
              0
          );

        const openingPayment =
          Math.min(
            remaining,
            opening
          );

        if (
          openingPayment > 0
        ) {
          const {
            error: openingError,
          } = await supabase
            .from("customers")
            .update({
              opening_balance:
                opening -
                openingPayment,
            })
            .eq(
              "id",
              customerId
            );

          if (openingError) {
            throw openingError;
          }
        }
      }

      alert(
        "Collection updated successfully."
      );

      clearForm();

      await loadCustomers();

      await loadRecentCollections();
    } catch (error: any) {
      console.error(
        "UPDATE COLLECTION ERROR:",
        error
      );

      alert(
        "Update Collection Error:\n\n" +
          (
            error?.message ||
            "Unable to update collection."
          )
      );

      await loadCustomers();

      if (customerId) {
        await loadBalance(
          customerId
        );
      }
    } finally {
      setLoading(false);
    }
  }

  /* =====================================================
     SAVE BUTTON
     ===================================================== */

  async function handleSave() {
    if (editingCollectionId) {
      await updateCollection();
    } else {
      await saveNewCollection();
    }
  }

  /* =====================================================
     CLEAR FORM
     ===================================================== */

  function clearForm() {
    setCustomerId("");

    setBalance(0);

    setAmount("");

    setPaymentMethod("Cash");

    setCashAmount("");
    setUpiAmount("");

    setRemarks("");

    const todayDate =
      getTodayLocalDate();

    setCollectionDate(
      todayDate
    );

    setCollectionDateDisplay(
      formatDateDDMMYYYY(
        todayDate
      )
    );

    setEditingCollectionId(null);
  }

  /* =====================================================
     SELECTED CUSTOMER
     ===================================================== */

  const selectedCustomer =
    useMemo(() => {
      return customers.find(
        (customer) =>
          customer.id ===
          customerId
      );
    }, [
      customers,
      customerId,
    ]);

  /* =====================================================
     LOADING
     ===================================================== */

  if (loadingData) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-blue-700">
          Collections
        </h1>

        <p className="mt-3 text-gray-600">
          Loading collections...
        </p>
      </div>
    );
  }

  /* =====================================================
     UI
     ===================================================== */

  return (
    <div className="space-y-6">

      {/* =================================================
          HEADER
      ================================================= */}

      <div>
        <h1 className="text-3xl font-bold text-blue-700">
          Customer Collections
        </h1>

        <p className="text-gray-600 mt-1">
          {editingCollectionId
            ? "Edit existing collection"
            : "Record customer payment"}
        </p>
      </div>

      {/* =================================================
          ROUTE-WISE ONE-CLICK COLLECTION
      ================================================= */}

      <div className="bg-white rounded-2xl shadow p-4 md:p-6">

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">

          <div>
            <h2 className="text-xl md:text-2xl font-bold text-blue-700">
              Route-wise Quick Collection
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Select a route once. All customers in that route open together.
              Enter amount and choose Cash or UPI without opening each customer.
            </p>
          </div>

          <div className="w-full md:w-80">
            <label className="block font-semibold mb-2">
              Select Route
            </label>

            <select
              value={selectedRoute}
              onChange={(e) =>
                initializeQuickRoute(
                  e.target.value
                )
              }
              className="w-full border-2 border-blue-200 rounded-xl px-4 py-3 text-lg font-semibold bg-white"
            >
              <option value="">
                Select Route
              </option>

              {routeNames.map((route) => (
                <option
                  key={route}
                  value={route}
                >
                  {route}
                </option>
              ))}
            </select>
          </div>

        </div>

        {selectedRoute && (
          <div className="mt-5">

            <div className="mb-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">
                  Selected Route
                </p>
                <p className="font-bold text-blue-800 text-lg">
                  {selectedRoute}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">
                  Customers
                </p>
                <p className="font-bold text-blue-700 text-lg">
                  {routeCustomers.length}
                </p>
              </div>
            </div>

            {routeCustomers.length === 0 ? (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-center text-yellow-800">
                No customers are assigned to this route.
              </div>
            ) : (
              <>
                {/* LIVE ROUTE COLLECTION TOTAL */}
                <div className="mb-4 rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 md:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

                    <div className="rounded-xl bg-white border border-blue-100 p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Route Collection Total
                      </p>
                      <p className="mt-1 text-2xl md:text-3xl font-extrabold text-blue-700">
                        ₹{routeQuickTotals.total.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white border border-green-100 p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Cash
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-green-700">
                        ₹{routeQuickTotals.cash.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white border border-indigo-100 p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        UPI
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-indigo-700">
                        ₹{routeQuickTotals.upi.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white border border-slate-100 p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Customers Entered
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-slate-700">
                        {routeQuickTotals.customersEntered}
                        {" / "}
                        {routeCustomers.length}
                      </p>
                    </div>

                  </div>

                  <div className="mt-3 text-sm font-semibold text-blue-700">
                    Total updates automatically as you enter each customer's collection amount.
                  </div>
                </div>

                <div className="space-y-2">

                {routeCustomers.map((customer) => {
                  const row =
                    quickCollectionRows[
                      customer.id
                    ] || {
                      amount: "",
                      cashAmount: "",
                      upiAmount: "",
                      paymentMethod: "Cash" as const,
                      saving: false,
                    };

                  return (
                    <div
                      key={customer.id}
                      className="rounded-xl border bg-white p-3 shadow-sm"
                    >

                      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_150px_150px_auto] gap-3 items-center">

                        <div>
                          <p className="font-bold text-slate-800">
                            {customer.customer_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {customer.route || "No Route"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">
                            Outstanding
                          </p>
                          <p className="font-bold text-red-600">
                            ₹
                            {quickBalanceLoading
                              ? "..."
                              : (
                                  Number(
                                    quickBalances[
                                      customer.id
                                    ] ?? 0
                                  )
                                ).toFixed(2)}
                          </p>
                        </div>

                        <div>
                          {row.paymentMethod === "Split" ? (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={row.cashAmount}
                                onChange={(e) =>
                                  updateQuickCollectionRow(
                                    customer.id,
                                    { cashAmount: e.target.value }
                                  )
                                }
                                placeholder="Cash"
                                className="w-full border-2 border-green-200 rounded-xl px-3 py-3 font-bold"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={row.upiAmount}
                                onChange={(e) =>
                                  updateQuickCollectionRow(
                                    customer.id,
                                    { upiAmount: e.target.value }
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void saveQuickRouteCollection(customer);
                                  }
                                }}
                                placeholder="UPI"
                                className="w-full border-2 border-indigo-200 rounded-xl px-3 py-3 font-bold"
                              />
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={row.amount}
                              onChange={(e) =>
                                updateQuickCollectionRow(
                                  customer.id,
                                  { amount: e.target.value }
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void saveQuickRouteCollection(customer);
                                }
                              }}
                              placeholder={
                                row.paymentMethod === "UPI"
                                  ? "UPI Amount"
                                  : "Cash Amount"
                              }
                              className="w-full border-2 border-green-200 rounded-xl px-3 py-3 font-bold text-lg"
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1">

                          <button
                            type="button"
                            onClick={() =>
                              updateQuickCollectionRow(
                                customer.id,
                                {
                                  paymentMethod:
                                    "Cash",
                                }
                              )
                            }
                            className={`rounded-lg px-2 py-3 text-sm font-bold ${
                              row.paymentMethod ===
                              "Cash"
                                ? "bg-green-600 text-white"
                                : "bg-green-50 text-green-700 border border-green-200"
                            }`}
                          >
                            CASH
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuickCollectionRow(
                                customer.id,
                                {
                                  paymentMethod:
                                    "UPI",
                                }
                              )
                            }
                            className={`rounded-lg px-2 py-3 text-xs font-bold ${
                              row.paymentMethod ===
                              "UPI"
                                ? "bg-indigo-600 text-white"
                                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            }`}
                          >
                            UPI
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuickCollectionRow(
                                customer.id,
                                {
                                  paymentMethod:
                                    "Split",
                                }
                              )
                            }
                            className={`rounded-lg px-2 py-3 text-xs font-bold ${
                              row.paymentMethod ===
                              "Split"
                                ? "bg-purple-600 text-white"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            SPLIT
                          </button>

                        </div>

                        <button
                          type="button"
                          disabled={
                            row.saving ||
                            (
                              row.paymentMethod === "Split"
                                ? (
                                    Number(row.cashAmount || 0) +
                                    Number(row.upiAmount || 0) <= 0
                                  )
                                : !Number(row.amount || 0)
                            )
                          }
                          onClick={() =>
                            void saveQuickRouteCollection(
                              customer
                            )
                          }
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-5 py-3 rounded-xl font-bold whitespace-nowrap"
                        >
                          {row.saving
                            ? "Saving..."
                            : "Save"}
                        </button>

                      </div>

                    </div>
                  );
                })}

                </div>
              </>
            )}

          </div>
        )}

      </div>

      {/* =================================================
          FORM
      ================================================= */}

      <div className="bg-white rounded-2xl shadow p-6">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

          {/* DATE */}

          <div>
            <label className="block font-semibold mb-2">
              Collection Date
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={collectionDateDisplay}
              onChange={(e) => {
                const display =
                  formatDateDDMMYYYYInput(
                    e.target.value
                  );

                setCollectionDateDisplay(
                  display
                );

                const parsed =
                  parseCollectionDate(
                    display
                  );

                if (parsed) {
                  setCollectionDate(
                    parsed
                  );
                }
              }}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-full border rounded-xl px-4 py-3"
            />
          </div>

          {/* CUSTOMER */}

          <div>
            <label className="block font-semibold mb-2">
              Customer
            </label>

            <select
              value={customerId}
              onChange={(e) =>
                handleCustomerChange(
                  e.target.value
                )
              }
              className="w-full border rounded-xl px-4 py-3"
            >
              <option value="">
                Select Customer
              </option>

              {customers.map(
                (customer) => (
                  <option
                    key={
                      customer.id
                    }
                    value={
                      customer.id
                    }
                  >
                    {
                      customer.customer_name
                    }
                  </option>
                )
              )}
            </select>
          </div>

          {/* BALANCE */}

          <div>
            <label className="block font-semibold mb-2">
              Outstanding Balance
            </label>

            <div className="w-full border rounded-xl px-4 py-3 bg-yellow-50 text-xl font-bold text-red-600">
              ₹{balance.toFixed(2)}
            </div>
          </div>

          {/* OUTSTANDING SALES */}

          {customerId && outstandingSales.length > 0 && (
            <div className="md:col-span-3 mt-1 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-red-700">
                    Outstanding Sales
                  </h3>
                  <p className="text-sm text-red-600">
                    Unpaid sale balances for this customer
                  </p>
                </div>
                <div className="font-bold text-red-700">
                  {outstandingSales.length} sale
                  {outstandingSales.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="overflow-x-auto bg-white rounded-lg border border-red-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-100 text-red-800">
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-right px-3 py-2">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingSales.map((sale) => (
                      <tr key={sale.id} className="border-t border-red-100">
                        <td className="px-3 py-2">
                          {formatDateDDMMYYYY(sale.sale_date)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-red-700">
                          ₹{sale.balance_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAYMENT */}

          <div>
            <label className="block font-semibold mb-2">
              Payment Method
            </label>

            <select
              value={
                paymentMethod
              }
              onChange={(e) =>
                handlePaymentMethodChange(
                  e.target.value
                )
              }
              className="w-full border rounded-xl px-4 py-3"
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

              <option value="Split">
                Split (Cash + UPI)
              </option>
            </select>
          </div>

          {isSplitPayment ? (
            <>
              <div>
                <label className="block font-semibold mb-2">
                  Cash Received
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) =>
                    setCashAmount(
                      e.target.value
                    )
                  }
                  className="w-full border-2 border-green-200 rounded-xl px-4 py-3"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">
                  UPI Received
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={upiAmount}
                  onChange={(e) =>
                    setUpiAmount(
                      e.target.value
                    )
                  }
                  className="w-full border-2 border-blue-200 rounded-xl px-4 py-3"
                  placeholder="0"
                />
              </div>

              <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                <p className="text-sm text-slate-600">
                  Total Collection
                </p>
                <p className="text-xl font-bold text-indigo-700">
                  ₹{effectiveCollectionAmount.toFixed(2)}
                </p>
              </div>
            </>
          ) : (
            <div>
              <label className="block font-semibold mb-2">
                Collection Amount
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
                className="w-full border rounded-xl px-4 py-3"
                placeholder="Enter amount"
              />
            </div>
          )}

          {/* REMARKS */}

          <div className="md:col-span-3">
            <label className="block font-semibold mb-2">
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
              className="w-full border rounded-xl px-4 py-3"
              placeholder="Optional remarks"
            />
          </div>

        </div>

        {/* CUSTOMER INFO */}

        {selectedCustomer && (
          <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-gray-500">
              Selected Customer
            </p>

            <p className="font-bold text-blue-700 text-lg">
              {
                selectedCustomer.customer_name
              }
            </p>
          </div>
        )}

        {/* BUTTONS */}

        <div className="flex flex-wrap gap-3 mt-6">

          <button
            type="button"
            disabled={
              loading ||
              !customerId ||
              balance <= 0
            }
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-xl font-bold"
          >
            {loading
              ? "Saving..."
              : editingCollectionId
              ? "Update Collection"
              : "Save Collection"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={clearForm}
            className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-8 py-3 rounded-xl font-bold"
          >
            Clear
          </button>

        </div>

      </div>

      {/* =================================================
          RECENT COLLECTIONS
      ================================================= */}

      <div className="bg-white rounded-2xl shadow p-6">

        <div className="flex items-center justify-between mb-5">

          <div>
            <h2 className="text-2xl font-bold text-blue-700">
              Recent Collections
            </h2>

            <p className="text-gray-500">
              Verify, edit or delete customer collections.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadRecentCollections
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold"
          >
            Refresh
          </button>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead>

              <tr className="bg-blue-600 text-white">

                <th className="p-3 text-left">
                  Date
                </th>

                <th className="p-3 text-left">
                  Customer
                </th>

                <th className="p-3 text-right">
                  Amount
                </th>

                <th className="p-3 text-left">
                  Payment
                </th>

                <th className="p-3 text-left">
                  Remarks
                </th>

                <th className="p-3 text-center">
                  Action
                </th>

              </tr>

            </thead>

            <tbody>

              {recentCollections.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-gray-500"
                  >
                    No collections found.
                  </td>
                </tr>
              ) : (
                recentCollections.map(
                  (collection) => (
                    <tr
                      key={
                        collection.id
                      }
                      className="border-b hover:bg-gray-50"
                    >

                      <td className="p-3">
                        {formatDateDDMMYYYY(
                          collection.collection_date
                        )}
                      </td>

                      <td className="p-3 font-semibold">
                        {
                          collection.customer_name
                        }
                      </td>

                      <td className="p-3 text-right font-bold text-green-600">
                        ₹
                        {collection.amount.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3">
                        {collection.payment_method}
                        {collection.payment_method
                          .trim()
                          .toLowerCase() ===
                          "split" && (
                          <span className="ml-2 text-xs font-semibold text-slate-500">
                            (Cash ₹
                            {collection.cash_amount.toFixed(2)}
                            + UPI ₹
                            {collection.upi_amount.toFixed(2)})
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {
                          collection.remarks ||
                          "-"
                        }
                      </td>

                      <td className="p-3">
                        {collection.source === "Sale" ? (
                          <span className="inline-block bg-blue-100 text-blue-700 px-3 py-2 rounded-lg font-semibold">
                            Sale Payment
                          </span>
                        ) : (
                          <div className="flex justify-center gap-2">

                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                editCollection(
                                  collection.id
                                )
                              }
                              className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                deleteCollection(
                                  collection.id
                                )
                              }
                              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold"
                            >
                              Delete
                            </button>

                          </div>
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

    </div>
  );
}