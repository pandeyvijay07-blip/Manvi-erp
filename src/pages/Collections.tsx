import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function getLocalDateISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDateDDMMYYYY(value: string | null | undefined) {
  if (!value) return "-";
  const text = String(value).slice(0, 10);
  const parts = text.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return text;
}

type Customer = {
  id: string;
  customer_name: string;
  opening_balance: number;
  route?: string | null;
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
  remarks: string;
};

type Allocation = {
  sale_id: string;
  amount: number;
};

export default function Collections() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Route-wise collection entry
  const [selectedRoute, setSelectedRoute] = useState("");
  const [routeAmounts, setRouteAmounts] = useState<Record<string, { cash: string; upi: string }>>({});
  const [routeBalances, setRouteBalances] = useState<Record<string, number>>({});
  const [routeSaving, setRouteSaving] = useState(false);

  const [customerId, setCustomerId] = useState("");

  const [balance, setBalance] = useState(0);

  const [amount, setAmount] = useState("");

  const [cashAmount, setCashAmount] = useState("");

  const [upiAmount, setUpiAmount] = useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("Cash");

  const [remarks, setRemarks] = useState("");

  const [collectionDate, setCollectionDate] =
    useState(
      getLocalDateISO()
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
            customer.route || "",
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
      const { data, error } = await supabase
        .from("collections")
        .select(
          `
          id,
          collection_date,
          customer_id,
          amount,
          payment_method,
          remarks
          `
        )
        .order("collection_date", {
          ascending: false,
        })
        .limit(30);

      if (error) {
        throw error;
      }

      const customerMap = new Map<
        string,
        string
      >();

      (customers || []).forEach((customer) => {
        customerMap.set(
          customer.id,
          customer.customer_name
        );
      });

      setRecentCollections(
        (data || []).map((row: any) => ({
          id: row.id,
          collection_date:
            row.collection_date,
          customer_id:
            row.customer_id,
          customer_name:
            customerMap.get(
              row.customer_id
            ) || "Unknown",
          amount:
            Number(row.amount) || 0,
          payment_method:
            row.payment_method || "Cash",
          remarks:
            row.remarks || "",
        }))
      );
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
      return 0;
    }

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id, opening_balance")
        .eq("id", id)
        .single();

      if (customerError) throw customerError;

      const openingBalance = Number(customer?.opening_balance) || 0;

      const { data, error } = await supabase
        .from("sales")
        .select("balance_amount")
        .eq("customer_id", id)
        .gt("balance_amount", 0);

      if (error) throw error;

      const salesOutstanding = (data || []).reduce(
        (total: number, sale: any) =>
          total + (Number(sale?.balance_amount) || 0),
        0
      );

      const totalBalance = openingBalance + salesOutstanding;
      setBalance(totalBalance);
      return totalBalance;
    } catch (error: any) {
      console.error(error);
      setBalance(0);
      alert(
        "Unable to calculate balance:\n" +
          (error?.message || "Unknown error")
      );
      return 0;
    }
  }

  /* =====================================================
     ROUTE-WISE COLLECTIONS
     Mobile-first: one route, vertical customer list,
     Cash + UPI per customer, one Save All button.
  ===================================================== */

  const routes = useMemo(() => {
    return Array.from(
      new Set<string>(
        (customers || [])
          .map((customer) => String(customer.route || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const routeCustomers = useMemo(() => {
    if (!selectedRoute) return [];
    return (customers || [])
      .filter(
        (customer) =>
          String(customer.route || "").trim() === selectedRoute
      )
      .sort((a, b) => a.customer_name.localeCompare(b.customer_name));
  }, [customers, selectedRoute]);

  useEffect(() => {
    let cancelled = false;

    async function loadRouteBalances() {
      if (!selectedRoute || routeCustomers.length === 0) {
        setRouteBalances({});
        return;
      }

      try {
        const rows = await Promise.all(
          routeCustomers.map(async (customer) => ({
            id: customer.id,
            balance: await getCustomerBalanceForRoute(customer.id),
          }))
        );

        if (!cancelled) {
          setRouteBalances(
            Object.fromEntries(rows.map((row) => [row.id, row.balance]))
          );
        }
      } catch (error) {
        console.error("Route balance load error:", error);
      }
    }

    loadRouteBalances();

    return () => {
      cancelled = true;
    };
  }, [selectedRoute, routeCustomers]);

  function getRouteAmount(customerIdValue: string) {
    return routeAmounts[customerIdValue] || { cash: "", upi: "" };
  }

  function setRouteAmount(
    customerIdValue: string,
    field: "cash" | "upi",
    value: string
  ) {
    setRouteAmounts((previous) => ({
      ...previous,
      [customerIdValue]: {
        ...(previous[customerIdValue] || { cash: "", upi: "" }),
        [field]: value,
      },
    }));
  }

  const routeTotals = useMemo(() => {
    let cash = 0;
    let upi = 0;

    routeCustomers.forEach((customer) => {
      const entry = getRouteAmount(customer.id);
      cash += Math.max(0, Number(entry.cash) || 0);
      upi += Math.max(0, Number(entry.upi) || 0);
    });

    return {
      cash,
      upi,
      total: cash + upi,
    };
  }, [routeCustomers, routeAmounts]);

  async function getCustomerBalanceForRoute(id: string) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, opening_balance")
      .eq("id", id)
      .single();

    if (customerError) throw customerError;

    const openingBalance = Number(customer?.opening_balance) || 0;

    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("balance_amount")
      .eq("customer_id", id)
      .gt("balance_amount", 0);

    if (salesError) throw salesError;

    const salesOutstanding = (salesData || []).reduce(
      (sum: number, row: any) => sum + (Number(row.balance_amount) || 0),
      0
    );

    return openingBalance + salesOutstanding;
  }

  async function saveRouteCollections() {
    if (!selectedRoute) {
      alert("Please select a route.");
      return;
    }

    const entries = routeCustomers
      .map((customer) => {
        const entry = getRouteAmount(customer.id);
        const cash = Math.max(0, Number(entry.cash) || 0);
        const upi = Math.max(0, Number(entry.upi) || 0);
        return {
          customer,
          cash,
          upi,
          total: cash + upi,
        };
      })
      .filter((item) => item.total > 0);

    if (entries.length === 0) {
      alert("Please enter Cash or UPI for at least one customer.");
      return;
    }

    try {
      setRouteSaving(true);

      for (const entry of entries) {
        const currentBalance = await getCustomerBalanceForRoute(entry.customer.id);

        if (entry.total > currentBalance + 0.000001) {
          throw new Error(
            `${entry.customer.customer_name}: collection ₹${entry.total.toFixed(2)} exceeds outstanding ₹${currentBalance.toFixed(2)}.`
          );
        }

        const outstandingSales = await getOutstandingSales(entry.customer.id);

        // Save Cash and UPI in one button press. Internally they remain separate
        // collection rows so Daily Closing can distinguish Cash and UPI.
        const rows: Array<{
          customer_id: string;
          collection_date: string;
          amount: number;
          payment_method: string;
          remarks: string | null;
        }> = [];

        if (entry.cash > 0) {
          rows.push({
            customer_id: entry.customer.id,
            collection_date: collectionDate,
            amount: Number(entry.cash.toFixed(2)),
            payment_method: "Cash",
            remarks: `Route: ${selectedRoute}`,
          });
        }

        if (entry.upi > 0) {
          rows.push({
            customer_id: entry.customer.id,
            collection_date: collectionDate,
            amount: Number(entry.upi.toFixed(2)),
            payment_method: "UPI",
            remarks: `Route: ${selectedRoute}`,
          });
        }

        const { data: createdCollections, error: insertError } = await supabase
          .from("collections")
          .insert(rows)
          .select("id, payment_method, amount");

        if (insertError) throw insertError;
        if (!createdCollections || createdCollections.length === 0) {
          throw new Error(`Unable to save collection for ${entry.customer.customer_name}.`);
        }

        // Allocate each payment row separately to keep deletion/editing correct.
        let saleIndex = 0;
        let allocationRemaining = entry.total;
        const allocationRows: Array<{ collection_id: string; sale_id: string; amount: number }> = [];

        for (const createdCollection of createdCollections) {
          let methodRemaining = Number(createdCollection.amount) || 0;

          while (methodRemaining > 0.000001 && saleIndex < outstandingSales.length) {
            const sale = outstandingSales[saleIndex];
            const saleBalance = Number(sale.balance_amount) || 0;
            const applied = Math.min(methodRemaining, saleBalance);

            if (applied <= 0) {
              saleIndex += 1;
              continue;
            }

            allocationRows.push({
              collection_id: createdCollection.id,
              sale_id: sale.id,
              amount: Number(applied.toFixed(2)),
            });

            sale.balance_amount = Math.max(0, saleBalance - applied);
            methodRemaining -= applied;
            allocationRemaining -= applied;

            if (sale.balance_amount <= 0.000001) {
              saleIndex += 1;
            }
          }
        }

        for (const sale of outstandingSales) {
          const originalBalance = Number(
            (await supabase.from("sales").select("balance_amount").eq("id", sale.id).single()).data?.balance_amount
          ) || 0;

          if (Math.abs(originalBalance - sale.balance_amount) > 0.000001) {
            const { error: saleUpdateError } = await supabase
              .from("sales")
              .update({ balance_amount: sale.balance_amount })
              .eq("id", sale.id);

            if (saleUpdateError) throw saleUpdateError;
          }
        }

        if (allocationRows.length > 0) {
          const { error: allocationError } = await supabase
            .from("collection_allocations")
            .insert(allocationRows);

          if (allocationError) throw allocationError;
        }

        const remaining = Math.max(0, allocationRemaining);

        if (remaining > 0) {
          const { data: freshCustomer, error: freshCustomerError } = await supabase
            .from("customers")
            .select("opening_balance")
            .eq("id", entry.customer.id)
            .single();

          if (freshCustomerError) throw freshCustomerError;

          const opening = Number(freshCustomer?.opening_balance) || 0;
          const openingPayment = Math.min(remaining, opening);

          if (openingPayment > 0) {
            const { error: openingError } = await supabase
              .from("customers")
              .update({ opening_balance: opening - openingPayment })
              .eq("id", entry.customer.id);

            if (openingError) throw openingError;
          }
        }
      }

      alert(
        `Route collection saved successfully.\n\nRoute: ${selectedRoute}\nCash: ₹${routeTotals.cash.toFixed(2)}\nUPI: ₹${routeTotals.upi.toFixed(2)}\nTotal: ₹${routeTotals.total.toFixed(2)}`
      );

      setRouteAmounts({});
      await loadCustomers();
      await loadRecentCollections();
    } catch (error: any) {
      console.error("Route collection error:", error);
      alert(
        "Route Collection Error:\n" +
          (error?.message || "Unable to save route collections.")
      );
    } finally {
      setRouteSaving(false);
    }
  }

  function clearRouteEntries() {
    setRouteAmounts({});
  }

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

  const cashValue = Number(cashAmount) || 0;
  const upiValue = Number(upiAmount) || 0;
  const combinedCollectionAmount = cashValue + upiValue;

  /* =====================================================
     SAVE NEW COLLECTION
  ===================================================== */

  async function saveNewCollection() {
    const collectionAmount = combinedCollectionAmount;

    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    if (!Number.isFinite(collectionAmount) || collectionAmount <= 0) {
      alert("Please enter a Cash or UPI amount.");
      return;
    }

    if (cashValue < 0 || upiValue < 0) {
      alert("Cash and UPI amounts cannot be negative.");
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

      const collectionRows: Array<{
        customer_id: string;
        collection_date: string;
        amount: number;
        payment_method: string;
        remarks: string | null;
      }> = [];

      if (cashValue > 0) {
        collectionRows.push({
          customer_id: customerId,
          collection_date: collectionDate,
          amount: Number(cashValue.toFixed(2)),
          payment_method: "Cash",
          remarks: remarks.trim() || null,
        });
      }

      if (upiValue > 0) {
        collectionRows.push({
          customer_id: customerId,
          collection_date: collectionDate,
          amount: Number(upiValue.toFixed(2)),
          payment_method: "UPI",
          remarks: remarks.trim() || null,
        });
      }

      const { data: collectionsCreated, error } = await supabase
        .from("collections")
        .insert(collectionRows)
        .select();

      if (error) {
        throw error;
      }

      if (!collectionsCreated || collectionsCreated.length === 0) {
        throw new Error("Collection was not created.");
      }

      /* ---------------------------------------------
         UPDATE SALE BALANCES
      --------------------------------------------- */

      // Apply the total collection to sales FIFO, while recording each
      // payment method separately. This keeps Cash/UPI correct for Daily Closing.
      let allocationRemaining = collectionAmount;
      let saleIndex = 0;
      const allocationRowsByCollection: Array<{ collection_id: string; sale_id: string; amount: number }> = [];

      for (const createdCollection of collectionsCreated) {
        let methodRemaining = Number(createdCollection.amount) || 0;

        while (methodRemaining > 0.000001 && saleIndex < outstandingSales.length) {
          const sale = outstandingSales[saleIndex];
          const saleBalance = Number(sale.balance_amount) || 0;
          const applied = Math.min(methodRemaining, saleBalance);

          if (applied <= 0) {
            saleIndex += 1;
            continue;
          }

          allocationRowsByCollection.push({
            collection_id: createdCollection.id,
            sale_id: sale.id,
            amount: Number(applied.toFixed(2)),
          });

          methodRemaining -= applied;
          allocationRemaining -= applied;

          // Update the in-memory sale balance so Cash and UPI together
          // cannot apply more than the customer's outstanding amount.
          sale.balance_amount = Math.max(0, saleBalance - applied);
          if (sale.balance_amount <= 0.000001) {
            saleIndex += 1;
          }
        }
      }

      // Update affected sales once using the final in-memory balances.
      for (const sale of outstandingSales) {
        const original = Number(
          (await supabase.from("sales").select("balance_amount").eq("id", sale.id).single()).data?.balance_amount
        ) || 0;
        if (Math.abs(original - sale.balance_amount) > 0.000001) {
          const { error: updateError } = await supabase
            .from("sales")
            .update({ balance_amount: sale.balance_amount })
            .eq("id", sale.id);
          if (updateError) throw updateError;
        }
      }

      if (allocationRowsByCollection.length > 0) {
        const { error: allocationError } = await supabase
          .from("collection_allocations")
          .insert(allocationRowsByCollection);
        if (allocationError) throw allocationError;
      }

      /* ---------------------------------------------
         OPENING BALANCE
      --------------------------------------------- */

      if (allocationRemaining > 0) {
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
            allocationRemaining,
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

  async function editCollection(collectionId: string) {
    if (!collectionId) {
      alert("Invalid collection selected.");
      return;
    }

    // Do not block the Edit button with the page save/loading state.
    // Only the actual update/delete operation should use loading.
    try {
      const { data: collection, error } = await supabase
        .from("collections")
        .select("id, customer_id, collection_date, amount, payment_method, remarks")
        .eq("id", collectionId)
        .maybeSingle();

      if (error) throw error;
      if (!collection) {
        throw new Error("Collection not found. Please refresh the list and try again.");
      }

      // Load customers if the list is not ready, then select the customer.
      let currentCustomers = customers;
      if (!currentCustomers || currentCustomers.length === 0) {
        const { data: customerRows, error: customerError } = await supabase
          .from("customers")
          .select("id, customer_name, opening_balance")
          .order("customer_name");

        if (customerError) throw customerError;

        currentCustomers = (customerRows || []).map((row: any) => ({
          id: row.id,
          customer_name: row.customer_name || "",
          opening_balance: Number(row.opening_balance) || 0,
        }));

        setCustomers(currentCustomers);
      }

      const customerExists = currentCustomers.some(
        (customer) => customer.id === collection.customer_id
      );

      if (!customerExists) {
        throw new Error("The customer for this collection could not be found.");
      }

      // Populate the form FIRST. No balance/allocation is changed here.
      setEditingCollectionId(String(collection.id));
      setCustomerId(String(collection.customer_id));
      setCollectionDate(
        collection.collection_date
          ? String(collection.collection_date).slice(0, 10)
          : getLocalDateISO()
      );
      setAmount(String(Number(collection.amount) || 0));
      setPaymentMethod(String(collection.payment_method || "Cash"));
      setRemarks(String(collection.remarks || ""));

      // Balance is informational while editing. The old collection is
      // reversed only after the user presses Update Collection.
      await loadBalance(String(collection.customer_id));

      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    } catch (error: any) {
      console.error("Edit collection error:", error);
      alert(
        "Unable to edit collection:\n" +
          (error?.message || "Unknown error")
      );
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
    if (!editingCollectionId) return;

    const collectionAmount = Number(amount);

    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    if (!Number.isFinite(collectionAmount) || collectionAmount <= 0) {
      alert("Please enter a valid collection amount.");
      return;
    }

    let originalCollection: any = null;
    let originalAllocations: any[] = [];
    let oldEffectsReversed = false;
    let newEffectsApplied = false;

    try {
      setLoading(true);

      // -----------------------------------------------------
      // 1. LOAD ORIGINAL COLLECTION + ALLOCATIONS
      // -----------------------------------------------------
      const { data: collection, error: collectionError } = await supabase
        .from("collections")
        .select("id, customer_id, collection_date, amount, payment_method, remarks")
        .eq("id", editingCollectionId)
        .single();

      if (collectionError) throw collectionError;
      if (!collection) throw new Error("Collection not found.");

      originalCollection = collection;
      originalAllocations = await getCollectionAllocations(editingCollectionId);

      // -----------------------------------------------------
      // 2. REVERSE THE OLD COLLECTION FIRST
      // -----------------------------------------------------
      await reverseCollectionEffects(originalCollection, originalAllocations);
      oldEffectsReversed = true;

      // Remove old allocation rows. They will be recreated below.
      const { error: oldAllocationDeleteError } = await supabase
        .from("collection_allocations")
        .delete()
        .eq("collection_id", editingCollectionId);

      if (oldAllocationDeleteError) throw oldAllocationDeleteError;

      // -----------------------------------------------------
      // 3. READ FRESH BALANCE AFTER REVERSAL
      //    This is important when customer/date/amount is edited.
      // -----------------------------------------------------
      const { data: newCustomer, error: newCustomerError } = await supabase
        .from("customers")
        .select("id, opening_balance")
        .eq("id", customerId)
        .single();

      if (newCustomerError) throw newCustomerError;

      const openingBalance = Number(newCustomer?.opening_balance) || 0;
      const outstandingSales = await getOutstandingSales(customerId);
      const salesOutstanding = (outstandingSales || []).reduce(
        (total: number, sale: OutstandingSale) =>
          total + (Number(sale?.balance_amount) || 0),
        0
      );
      const availableBalance = openingBalance + salesOutstanding;

      if (collectionAmount > availableBalance + 0.000001) {
        throw new Error(
          `Collection cannot exceed outstanding balance of ₹${availableBalance.toFixed(2)}.`
        );
      }

      // -----------------------------------------------------
      // 4. CALCULATE NEW FIFO ALLOCATION
      // -----------------------------------------------------
      const { allocations, remaining } = calculateAllocations(
        outstandingSales || [],
        collectionAmount
      );

      // -----------------------------------------------------
      // 5. APPLY NEW SALE ALLOCATIONS
      // -----------------------------------------------------
      for (const allocation of allocations || []) {
        const sale = (outstandingSales || []).find(
          (item) => item?.id === allocation?.sale_id
        );

        if (!sale) {
          throw new Error("Unable to find a sale for collection allocation.");
        }

        const newBalance = Math.max(
          0,
          (Number(sale.balance_amount) || 0) - (Number(allocation.amount) || 0)
        );

        const { error: saleUpdateError } = await supabase
          .from("sales")
          .update({ balance_amount: newBalance })
          .eq("id", allocation.sale_id);

        if (saleUpdateError) throw saleUpdateError;

        const { error: allocationError } = await supabase
          .from("collection_allocations")
          .insert({
            collection_id: editingCollectionId,
            sale_id: allocation.sale_id,
            amount: allocation.amount,
          });

        if (allocationError) throw allocationError;
      }

      // -----------------------------------------------------
      // 6. APPLY REMAINING AMOUNT TO OPENING BALANCE
      // -----------------------------------------------------
      const openingPayment = Math.min(
        Math.max(0, Number(remaining) || 0),
        openingBalance
      );

      if (openingPayment > 0) {
        const { error: openingError } = await supabase
          .from("customers")
          .update({
            opening_balance: openingBalance - openingPayment,
          })
          .eq("id", customerId);

        if (openingError) throw openingError;
      }

      newEffectsApplied = true;

      // -----------------------------------------------------
      // 7. UPDATE COLLECTION HEADER LAST
      // -----------------------------------------------------
      const { error: updateError } = await supabase
        .from("collections")
        .update({
          customer_id: customerId,
          collection_date: collectionDate,
          amount: collectionAmount,
          payment_method: paymentMethod,
          remarks: remarks.trim() || null,
        })
        .eq("id", editingCollectionId);

      if (updateError) throw updateError;

      alert("Collection updated successfully.");

      const refreshedCustomerId = customerId;
      clearForm();
      await loadCustomers();
      await loadRecentCollections();
      await loadBalance(refreshedCustomerId);
    } catch (error: any) {
      console.error("Update collection error:", error);

      // Best-effort rollback so a failed update does not leave the old
      // collection permanently reversed.
      try {
        if (newEffectsApplied) {
          // Reverse the newly applied effects.
          const newAllocations = await getCollectionAllocations(editingCollectionId);
          const tempCollection = {
            ...originalCollection,
            customer_id: customerId,
            amount: collectionAmount,
          };
          await reverseCollectionEffects(tempCollection, newAllocations);
          await supabase
            .from("collection_allocations")
            .delete()
            .eq("collection_id", editingCollectionId);
        }

        if (oldEffectsReversed && originalCollection) {
          // Restore original allocation rows and balances.
          for (const allocation of originalAllocations || []) {
            const { data: sale, error: saleError } = await supabase
              .from("sales")
              .select("id, balance_amount")
              .eq("id", allocation.sale_id)
              .single();

            if (saleError) throw saleError;
            if (!sale) continue;

            const restoredOldBalance =
              (Number(sale.balance_amount) || 0) - (Number(allocation.amount) || 0);

            const { error: restoreSaleError } = await supabase
              .from("sales")
              .update({ balance_amount: Math.max(0, restoredOldBalance) })
              .eq("id", allocation.sale_id);

            if (restoreSaleError) throw restoreSaleError;
          }

          const allocatedOld = (originalAllocations || []).reduce(
            (total: number, item: any) =>
              total + (Number(item?.amount) || 0),
            0
          );
          const oldOpeningUsed = Math.max(
            0,
            (Number(originalCollection.amount) || 0) - allocatedOld
          );

          if (oldOpeningUsed > 0 && originalCollection.customer_id) {
            const { data: oldCustomer, error: oldCustomerError } = await supabase
              .from("customers")
              .select("id, opening_balance")
              .eq("id", originalCollection.customer_id)
              .single();

            if (oldCustomerError) throw oldCustomerError;

            if (oldCustomer) {
              const { error: restoreOpeningError } = await supabase
                .from("customers")
                .update({
                  opening_balance:
                    (Number(oldCustomer.opening_balance) || 0) - oldOpeningUsed,
                })
                .eq("id", originalCollection.customer_id);

              if (restoreOpeningError) throw restoreOpeningError;
            }
          }

          for (const allocation of originalAllocations || []) {
            const { error: insertOldAllocationError } = await supabase
              .from("collection_allocations")
              .insert({
                collection_id: editingCollectionId,
                sale_id: allocation.sale_id,
                amount: allocation.amount,
              });

            if (insertOldAllocationError) throw insertOldAllocationError;
          }

          await supabase
            .from("collections")
            .update({
              customer_id: originalCollection.customer_id,
              collection_date: originalCollection.collection_date,
              amount: originalCollection.amount,
              payment_method: originalCollection.payment_method,
              remarks: originalCollection.remarks,
            })
            .eq("id", editingCollectionId);
        }
      } catch (rollbackError) {
        console.error("Collection update rollback error:", rollbackError);
      }

      alert(
        "Update Collection Error:\n" +
          (error?.message || "Unable to update collection.")
      );

      await loadCustomers();
      await loadRecentCollections();
      await loadBalance(customerId);
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

    setCashAmount("");

    setUpiAmount("");

    setPaymentMethod("Cash");

    setRemarks("");

    setCollectionDate(
      getLocalDateISO()
    );

    setEditingCollectionId(null);
  }

  /* =====================================================
     SELECTED CUSTOMER
     ===================================================== */

  const selectedCustomer =
    useMemo(() => {
      return (customers || []).find(
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
          ROUTE-WISE COLLECTIONS
      ================================================= */}

      <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
        <div className="flex flex-col gap-2 mb-4">
          <h2 className="text-2xl font-bold text-blue-700">
            Route-wise Collections
          </h2>
          <p className="text-gray-500 text-sm">
            Select one route, enter Cash and/or UPI for each customer, then save everyone together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block font-semibold mb-2">Collection Date</label>
            <input
              type="date"
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
              className="w-full border rounded-xl px-4 py-3"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">Select Route</label>
            <select
              value={selectedRoute}
              onChange={(e) => {
                setSelectedRoute(e.target.value);
                setRouteAmounts({});
                setRouteBalances({});
              }}
              className="w-full border rounded-xl px-4 py-3"
            >
              <option value="">Select Route</option>
              {routes.map((route) => (
                <option key={route} value={route}>{route}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Customers</div>
              <div className="text-xl font-bold text-blue-700">{routeCustomers.length}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Route Total</div>
              <div className="text-xl font-bold text-green-700">₹{routeTotals.total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {selectedRoute && routeCustomers.length === 0 && (
          <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-yellow-800">
            No customers found in this route.
          </div>
        )}

        {selectedRoute && routeCustomers.length > 0 && (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            {routeCustomers.map((customer, index) => {
              const entry = getRouteAmount(customer.id);
              const cash = Number(entry.cash) || 0;
              const upi = Number(entry.upi) || 0;
              const total = cash + upi;

              return (
                <div
                  key={customer.id}
                  className="border rounded-2xl p-4 bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="font-bold text-blue-700 text-lg">
                        {index + 1}. {customer.customer_name}
                      </div>
                      <div className="text-red-600 font-semibold text-sm">
                        Outstanding: ₹{(routeBalances[customer.id] ?? 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right bg-green-50 rounded-lg px-3 py-2 min-w-[100px]">
                      <div className="text-xs text-gray-500">Entry Total</div>
                      <div className="font-bold text-green-700">₹{total.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Cash</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={entry.cash}
                        onChange={(e) => setRouteAmount(customer.id, "cash", e.target.value)}
                        className="w-full border rounded-xl px-3 py-3 bg-white text-base"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">UPI</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={entry.upi}
                        onChange={(e) => setRouteAmount(customer.id, "upi", e.target.value)}
                        className="w-full border rounded-xl px-3 py-3 bg-white text-base"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedRoute && routeCustomers.length > 0 && (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 sticky bottom-2 shadow-lg">
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div>
                <div className="text-xs text-gray-500">Total Cash</div>
                <div className="font-bold text-green-700">₹{routeTotals.cash.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total UPI</div>
                <div className="font-bold text-blue-700">₹{routeTotals.upi.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Grand Total</div>
                <div className="font-bold text-xl text-green-800">₹{routeTotals.total.toFixed(2)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={routeSaving || routeTotals.total <= 0}
                onClick={saveRouteCollections}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-4 rounded-xl font-bold text-lg"
              >
                {routeSaving ? "Saving Route..." : "Save All Collections"}
              </button>
              <button
                type="button"
                disabled={routeSaving}
                onClick={clearRouteEntries}
                className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-6 py-4 rounded-xl font-bold"
              >
                Clear Route Entries
              </button>
            </div>
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
              type="date"
              value={collectionDate}
              onChange={(e) =>
                setCollectionDate(
                  e.target.value
                )
              }
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

              {(customers || []).map(
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

          {/* CASH */}

          <div>
            <label className="block font-semibold mb-2">
              Cash Collection
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={editingCollectionId ? (paymentMethod === "Cash" ? amount : "") : cashAmount}
              onChange={(e) => {
                if (editingCollectionId) {
                  if (paymentMethod === "Cash") setAmount(e.target.value);
                } else {
                  setCashAmount(e.target.value);
                }
              }}
              className="w-full border rounded-xl px-4 py-3"
              placeholder="Cash amount"
            />
          </div>

          {/* UPI */}

          <div>
            <label className="block font-semibold mb-2">
              UPI Collection
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={editingCollectionId ? (paymentMethod === "UPI" ? amount : "") : upiAmount}
              onChange={(e) => {
                if (editingCollectionId) {
                  if (paymentMethod === "UPI") setAmount(e.target.value);
                } else {
                  setUpiAmount(e.target.value);
                }
              }}
              className="w-full border rounded-xl px-4 py-3"
              placeholder="UPI amount"
            />
          </div>

          {/* TOTAL */}

          <div>
            <label className="block font-semibold mb-2">
              Total Collection
            </label>

            <div className="w-full border rounded-xl px-4 py-3 bg-green-50 text-xl font-bold text-green-700">
              ₹{(editingCollectionId ? Number(amount) || 0 : combinedCollectionAmount).toFixed(2)}
            </div>
          </div>

          {editingCollectionId && (
            <div>
              <label className="block font-semibold mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank">Bank</option>
              </select>
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
              (!editingCollectionId && balance <= 0)
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
                        {formatDateDDMMYYYY(collection.collection_date)}
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
                        {
                          collection.payment_method
                        }
                      </td>

                      <td className="p-3">
                        {
                          collection.remarks ||
                          "-"
                        }
                      </td>

                      <td className="p-3">

                        <div className="flex justify-center gap-2">

                          <button
                            type="button"
                            disabled={
                              loading
                            }
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
                            disabled={
                              loading
                            }
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