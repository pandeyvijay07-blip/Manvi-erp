import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  customer_name: string;
  route: string;
  opening_balance: number;
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
  round_off?: number;
  payment_method: string;
  cash_amount: number;
  upi_amount: number;
  remarks: string;
  source: "Collection" | "Sale";
  sale_id?: string | null;
};

type Allocation = {
  sale_id: string;
  amount: number;
};

type RouteCollectionRow = {
  id: string;
  customer_name: string;
  route: string;
  outstanding: number;
  cash: string;
  upi: string;
};

type RouteDailyStatus = "Paid" | "Partial" | "Not collected" | "No entry";

type RouteDailyStatusRow = {
  id: string;
  customer_name: string;
  route: string;
  saleEntered: boolean;
  saleTotal: number;
  salePaid: number;
  previousOutstanding: number;
  todayOutstanding: number;
  collectionToday: number;
  cashToday: number;
  upiToday: number;
  status: RouteDailyStatus;
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

  const [routeFilter, setRouteFilter] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  const [balance, setBalance] = useState(0);

  const [advanceBalance, setAdvanceBalance] = useState(0);

  const [outstandingSales, setOutstandingSales] = useState<OutstandingSale[]>([]);

  const [amount, setAmount] = useState("");

  const [roundOff, setRoundOff] = useState("0");

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
     ROUTE-WISE COLLECTION
     ===================================================== */

  const [routeCollectionRoute, setRouteCollectionRoute] =
    useState("");

  const [routeCollectionRows, setRouteCollectionRows] =
    useState<RouteCollectionRow[]>([]);

  const [routeCollectionLoading, setRouteCollectionLoading] =
    useState(false);

  const [routeCollectionSaving, setRouteCollectionSaving] =
    useState(false);


  /* =====================================================
     DAILY ROUTE ENTRY STATUS
     ===================================================== */

  const [dailyStatusRoute, setDailyStatusRoute] = useState("");
  const [dailyStatusDate, setDailyStatusDate] =
    useState(getTodayLocalDate());
  const [dailyStatusRows, setDailyStatusRows] =
    useState<RouteDailyStatusRow[]>([]);
  const [dailyStatusLoading, setDailyStatusLoading] =
    useState(false);
  const [dailyStatusFilter, setDailyStatusFilter] =
    useState("All");

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
          route,
          opening_balance
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
          route: customer.route || "",
          opening_balance:
            Number(
              customer.opening_balance
            ) || 0,
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
            round_off,
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
          round_off: Number(row.round_off) || 0,
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
            sale_id: row.id,
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
     VIEW BILL / COLLECTION RECEIPT FROM RECENT COLLECTIONS
     - Sale-payment rows open the original sale bill.
     - Manual collection rows show the receipt and every
       sale bill allocated to that collection.
     - This is read-only and does not modify ledger values.
  ===================================================== */
  async function viewRecentCollectionBilling(
    collection: RecentCollection
  ) {
    const billWindow = window.open("", "_blank");
    if (!billWindow) {
      alert("Please allow pop-ups for MANVI ERP to view the bill.");
      return;
    }

    billWindow.document.open();
    billWindow.document.write(
      "<!doctype html><html><body style='font-family:Arial;padding:24px'>Loading bill details...</body></html>"
    );
    billWindow.document.close();

    const safe = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const money = (value: unknown) =>
      `₹ ${Number(value || 0).toFixed(2)}`;

    try {
      setLoading(true);

      let saleIds: string[] = [];
      let allocations: { sale_id: string; amount: number }[] = [];

      if (collection.source === "Sale") {
        const linkedSaleId =
          collection.sale_id || collection.id.replace(/^sale-/, "");
        if (linkedSaleId) saleIds = [linkedSaleId];
      } else {
        const { data: allocationRows, error: allocationError } = await supabase
          .from("collection_allocations")
          .select("sale_id, amount")
          .eq("collection_id", collection.id);

        if (allocationError) throw allocationError;

        allocations = (allocationRows || [])
          .filter((row: any) => row.sale_id)
          .map((row: any) => ({
            sale_id: String(row.sale_id),
            amount: Number(row.amount) || 0,
          }));

        saleIds = Array.from(new Set(allocations.map((row) => row.sale_id)));
      }

      let linkedSales: any[] = [];
      let saleItems: any[] = [];
      let productNames = new Map<string, string>();

      if (saleIds.length > 0) {
        const [salesResponse, itemsResponse] = await Promise.all([
          supabase
            .from("sales")
            .select("id, sale_date, customer_id, payment_method, total_amount, round_off, paid_amount, balance_amount, cash_amount, upi_amount")
            .in("id", saleIds),
          supabase
            .from("sale_items")
            .select("sale_id, product_id, quantity, rate, amount")
            .in("sale_id", saleIds)
            .order("id", { ascending: true }),
        ]);

        if (salesResponse.error) throw salesResponse.error;
        if (itemsResponse.error) throw itemsResponse.error;

        linkedSales = salesResponse.data || [];
        saleItems = itemsResponse.data || [];

        const productIds = Array.from(
          new Set(saleItems.map((item: any) => String(item.product_id)).filter(Boolean))
        );

        if (productIds.length > 0) {
          const { data: productRows, error: productError } = await supabase
            .from("products")
            .select("id, product_name")
            .in("id", productIds);

          if (productError) throw productError;

          productNames = new Map(
            (productRows || []).map((product: any) => [
              String(product.id),
              String(product.product_name || "Product"),
            ])
          );
        }
      }

      const billSections = linkedSales
        .sort((a, b) => String(a.sale_date).localeCompare(String(b.sale_date)))
        .map((sale: any, index: number) => {
          const saleRows = saleItems
            .filter((item: any) => String(item.sale_id) === String(sale.id))
            .map((item: any, itemIndex: number) => `
              <tr>
                <td>${itemIndex + 1}</td>
                <td>${safe(productNames.get(String(item.product_id)) || "Product")}</td>
                <td>${Number(item.quantity || 0)}</td>
                <td>${money(item.rate)}</td>
                <td>${money(item.amount)}</td>
              </tr>`)
            .join("");

          const allocated = collection.source === "Sale"
            ? Number(sale.paid_amount || 0)
            : allocations
                .filter((item) => item.sale_id === String(sale.id))
                .reduce((sum, item) => sum + item.amount, 0);

          const method = String(sale.payment_method || "Cash");
          const split = method.trim().toLowerCase() === "split"
            ? `<div>Cash: ${money(sale.cash_amount)} &nbsp; | &nbsp; UPI: ${money(sale.upi_amount)}</div>`
            : "";

          return `
            <section class="bill-section">
              <h2>${collection.source === "Sale" ? "SALE BILL" : `BILL ${index + 1}`}</h2>
              <div class="meta"><strong>Bill Date:</strong> ${safe(formatDateDDMMYYYY(sale.sale_date))}<br>
                <strong>Payment Method:</strong> ${safe(method)} ${split}</div>
              <table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>${saleRows || '<tr><td colspan="5">No item details available.</td></tr>'}</tbody></table>
              <div class="totals">
                <div>Bill Total: ${money(sale.total_amount)}</div>
                <div>Paid on Bill: ${money(sale.paid_amount)}</div>
                <div>Balance Now: ${money(sale.balance_amount)}</div>
                ${collection.source === "Collection" ? `<div class="allocated">Applied from this collection: ${money(allocated)}</div>` : ""}
              </div>
            </section>`;
        })
        .join("");

      const isSalePayment = collection.source === "Sale";
      const noBillsMessage = !isSalePayment && linkedSales.length === 0
        ? `<div class="notice">No specific sale bill was allocated to this collection. This payment may have adjusted an opening balance or remained as customer advance.</div>`
        : "";

      const heading = isSalePayment ? "MANVI MILK AGENCIES — BILL" : "MANVI MILK AGENCIES — COLLECTION RECEIPT";
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safe(heading)}</title>
        <style>
          body{font-family:Arial,sans-serif;color:#111;margin:0 auto;padding:22px;max-width:920px}
          .toolbar{display:flex;justify-content:center;gap:10px;margin:0 0 22px}
          .toolbar button{border:0;border-radius:8px;padding:10px 18px;background:#174b91;color:white;font-weight:bold;cursor:pointer}
          .toolbar button.secondary{background:#64748b}
          h1{text-align:center;font-size:22px;margin:0 0 5px}h2{text-align:center;font-size:16px;margin:10px 0 14px}
          .meta{line-height:1.7;margin:12px 0 16px}.receipt{border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:18px 0}
          .receipt-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.receipt strong{color:#334155}
          table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}
          th{background:#eff4fb}td:nth-child(1),td:nth-child(3){text-align:center}td:nth-child(4),td:nth-child(5){text-align:right}
          .bill-section{border-top:2px solid #334155;margin-top:24px;padding-top:12px;page-break-inside:avoid}
          .totals{width:300px;margin:12px 0 0 auto;line-height:1.8;text-align:right}.allocated{font-weight:bold;color:#075985;border-top:1px solid #cbd5e1;padding-top:5px}
          .notice{border:1px solid #f59e0b;background:#fffbeb;padding:14px;border-radius:8px;margin-top:18px;color:#92400e}
          .footer{text-align:center;color:#64748b;margin-top:26px;font-size:12px}
          @media print{body{padding:6px}.toolbar{display:none}.bill-section{break-inside:avoid}}
          @media(max-width:600px){body{padding:12px}.receipt-grid{grid-template-columns:1fr}.totals{width:100%}}
        </style></head><body>
        <div class="toolbar"><button onclick="window.print()">Print</button><button class="secondary" onclick="window.close()">Close</button></div>
        <h1>MANVI MILK AGENCIES</h1><h2>${isSalePayment ? "SALE BILL" : "COLLECTION RECEIPT"}</h2>
        <div class="receipt"><div class="receipt-grid">
          <div><strong>Customer:</strong> ${safe(collection.customer_name)}</div>
          <div><strong>Date:</strong> ${safe(formatDateDDMMYYYY(collection.collection_date))}</div>
          <div><strong>Amount Received:</strong> ${money(collection.amount)}</div>
          <div><strong>Payment:</strong> ${safe(collection.payment_method)}</div>
          <div><strong>Cash:</strong> ${money(collection.cash_amount)}</div>
          <div><strong>UPI:</strong> ${money(collection.upi_amount)}</div>
          <div><strong>Remarks:</strong> ${safe(collection.remarks || "-")}</div>
        </div></div>
        ${billSections || noBillsMessage}
        <div class="footer">MANVI MILK AGENCIES · Thank you.</div>
        </body></html>`;

      billWindow.document.open();
      billWindow.document.write(html);
      billWindow.document.close();
      billWindow.focus();
    } catch (error: any) {
      console.error("View recent collection bill error:", error);
      billWindow.document.open();
      billWindow.document.write(
        `<!doctype html><html><body style="font-family:Arial;padding:24px"><h2>Unable to load billing details</h2><p>${safe(error?.message || "Unknown error")}</p></body></html>`
      );
      billWindow.document.close();
      alert("Unable to open billing details:\n" + (error?.message || "Unknown error"));
    } finally {
      setLoading(false);
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
      setAdvanceBalance(0);
      setOutstandingSales([]);
      return;
    }

    try {
      const customer = customers.find(
        (item) => item.id === id
      );

      const openingBalance = Number(
        customer?.opening_balance || 0
      );

      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_date, balance_amount")
        .eq("customer_id", id)
        .gt("balance_amount", 0)
        .order("sale_date", { ascending: true });

      if (error) throw error;

      const outstandingRows = (data || []).map(
        (sale: any) => ({
          id: sale.id,
          sale_date: sale.sale_date,
          balance_amount: Number(sale.balance_amount) || 0,
        })
      ) as OutstandingSale[];

      setOutstandingSales(outstandingRows);

      const salesOutstanding = outstandingRows.reduce(
        (total, sale) => total + sale.balance_amount,
        0
      );

      const { data: advanceData, error: advanceError } =
        await supabase.rpc("get_customer_advance_balance", {
          p_customer_id: id,
        });

      if (advanceError) throw advanceError;

      const availableAdvance = Number(advanceData) || 0;
      setAdvanceBalance(availableAdvance);

      setBalance(openingBalance + salesOutstanding);
    } catch (error: any) {
      console.error(error);
      setAdvanceBalance(0);
      alert(
        "Unable to calculate balance:\n" +
          (error?.message || "Unknown error")
      );
    }
  }

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

  const baseCollectionAmount =
    isSplitPayment
      ? cashPaid + upiPaid
      : Number(amount) || 0;

  const roundOffAmount = Number(roundOff) || 0;

  const effectiveCollectionAmount = Math.max(
    0,
    baseCollectionAmount + roundOffAmount
  );

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

  async function rebuildCustomerPaymentState(customerValue: string) {
    if (!customerValue) return;

    const { data, error } = await supabase.rpc(
      "rebuild_customer_payment_state",
      { p_customer_id: customerValue }
    );

    if (error) throw error;

    console.log("MANVI CUSTOMER PAYMENT STATE", data);
  }

  async function saveNewCollection() {
    const collectionAmount = effectiveCollectionAmount;

    const normalizedDate = parseCollectionDate(
      collectionDateDisplay
    );

    if (!normalizedDate) {
      alert(
        "Please enter a valid collection date in DD/MM/YYYY format.\nExample: 09/09/2026"
      );
      return;
    }

    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    if (
      isSplitPayment &&
      (cashPaid < 0 || upiPaid < 0 || cashPaid + upiPaid <= 0)
    ) {
      alert(
        "For Split (Cash + UPI), enter a valid Cash and/or UPI amount."
      );
      return;
    }

    if (!Number.isFinite(collectionAmount) || collectionAmount <= 0) {
      alert("Please enter a valid collection amount.");
      return;
    }

    try {
      setLoading(true);

      const { data: collection, error } = await supabase
        .from("collections")
        .insert({
          customer_id: customerId,
          collection_date: normalizedDate,
          amount: collectionAmount,
          round_off: roundOffAmount,
          payment_method: paymentMethod,
          cash_amount: cashPaid,
          upi_amount: upiPaid,
          remarks: remarks.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      if (!collection) throw new Error("Collection was not created.");

      await rebuildCustomerPaymentState(customerId);

      const advanceCreated = Math.max(
        collectionAmount - balance,
        0
      );

      alert(
        advanceCreated > 0
          ? `Collection saved successfully.

₹${advanceCreated.toFixed(2)} has been carried forward as customer advance and will automatically adjust against a future bill.`
          : "Collection saved successfully. Oldest outstanding bills were adjusted automatically."
      );

      clearForm();
      await loadCustomers();
      await loadRecentCollections();
      await loadBalance(customerId);
    } catch (error: any) {
      console.error(error);
      alert(
        "Collection Error:\n" +
          (error?.message || "Unable to save collection.")
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
      "Delete this collection?\n\nAny bill allocations and customer advance created by this payment will be recalculated automatically."
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      const { data: collection, error: collectionError } = await supabase
        .from("collections")
        .select("id, customer_id")
        .eq("id", collectionId)
        .single();

      if (collectionError) throw collectionError;
      if (!collection) throw new Error("Collection not found.");

      const customerValue = collection.customer_id;

      const { error: allocationDeleteError } = await supabase
        .from("collection_allocations")
        .delete()
        .eq("collection_id", collectionId);

      if (allocationDeleteError) throw allocationDeleteError;

      const { error: deleteError } = await supabase
        .from("collections")
        .delete()
        .eq("id", collectionId);

      if (deleteError) throw deleteError;

      if (customerValue) {
        await rebuildCustomerPaymentState(customerValue);
      }

      alert(
        "Collection deleted successfully. Customer bills and advances were recalculated."
      );

      await loadCustomers();
      await loadRecentCollections();

      if (customerValue) {
        await loadBalance(customerValue);
      } else {
        setBalance(0);
        setAdvanceBalance(0);
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
          round_off,
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

      const savedCollectionAmount =
        Number(collection.amount) || 0;
      const savedRoundOff =
        Number((collection as any).round_off) || 0;

      // Stored amount is the effective ledger collection.
      // Show the original cash/UPI amount while editing.
      setAmount(
        String(
          savedCollectionAmount - savedRoundOff
        )
      );

      setRoundOff(
        String(Number((collection as any).round_off) || 0)
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
    if (!editingCollectionId) return;

    const collectionAmount = effectiveCollectionAmount;
    const normalizedDate = parseCollectionDate(
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
      (cashPaid < 0 || upiPaid < 0 || cashPaid + upiPaid <= 0)
    ) {
      alert(
        "For Split (Cash + UPI), enter a valid Cash and/or UPI amount."
      );
      return;
    }

    if (!Number.isFinite(collectionAmount) || collectionAmount <= 0) {
      alert("Please enter a valid collection amount.");
      return;
    }

    try {
      setLoading(true);

      const { data: oldCollection, error: oldCollectionError } = await supabase
        .from("collections")
        .select("id, customer_id")
        .eq("id", editingCollectionId)
        .single();

      if (oldCollectionError) throw oldCollectionError;
      if (!oldCollection) throw new Error("Original collection not found.");

      const oldCustomerId = oldCollection.customer_id;

      const { error: updateError } = await supabase
        .from("collections")
        .update({
          customer_id: customerId,
          collection_date: normalizedDate,
          amount: collectionAmount,
          round_off: roundOffAmount,
          payment_method: paymentMethod,
          cash_amount: cashPaid,
          upi_amount: upiPaid,
          remarks: remarks.trim() || null,
        })
        .eq("id", editingCollectionId);

      if (updateError) throw updateError;

      if (oldCustomerId && oldCustomerId !== customerId) {
        await rebuildCustomerPaymentState(oldCustomerId);
      }

      await rebuildCustomerPaymentState(customerId);

      if (oldCustomerId && oldCustomerId !== customerId) {
        await loadBalance(oldCustomerId);
      }

      await loadBalance(customerId);

      alert(
        "Collection updated successfully. All affected bills and customer advances were recalculated."
      );

      clearForm();
      await loadCustomers();
      await loadRecentCollections();
    } catch (error: any) {
      console.error("UPDATE COLLECTION ERROR:", error);
      alert(
        "Update Collection Error:\n\n" +
          (error?.message || "Unable to update collection.")
      );
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
    setRouteFilter("");
    setCustomerSearch("");

    setBalance(0);

    setAdvanceBalance(0);

    setAmount("");
    setRoundOff("0");

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
     ROUTE + CUSTOMER SEARCH
     ===================================================== */

  const routeOptions = useMemo(() => {
    const uniqueRoutes = new Set<string>();

    customers.forEach((customer) => {
      const route = String(customer.route || "").trim();

      if (route) {
        uniqueRoutes.add(route);
      }
    });

    return Array.from(uniqueRoutes).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [customers]);

  useEffect(() => {
    if (!routeCollectionRoute && routeOptions.length > 0) {
      setRouteCollectionRoute(routeOptions[0]);
    }
  }, [routeOptions, routeCollectionRoute]);

  useEffect(() => {
    if (!dailyStatusRoute && routeOptions.length > 0) {
      setDailyStatusRoute(routeOptions[0]);
    }
  }, [routeOptions, dailyStatusRoute]);

  useEffect(() => {
    if (dailyStatusRoute && customers.length > 0) {
      void loadDailyRouteStatus(dailyStatusRoute, dailyStatusDate);
    } else {
      setDailyStatusRows([]);
    }
  }, [dailyStatusRoute, dailyStatusDate, customers]);

  useEffect(() => {
    if (routeCollectionRoute && customers.length > 0) {
      void loadRouteCollectionRows(routeCollectionRoute);
    }
  }, [routeCollectionRoute, customers]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesRoute =
        !routeFilter ||
        String(customer.route || "").trim().toLowerCase() ===
          routeFilter.trim().toLowerCase();

      const matchesCustomer =
        !query ||
        customer.customer_name.toLowerCase().includes(query);

      return matchesRoute && matchesCustomer;
    });

  }, [customers, routeFilter, customerSearch]);

  /* =====================================================
     DAILY ROUTE ENTRY STATUS
     ===================================================== */

  async function loadDailyRouteStatus(
    selectedRoute: string = dailyStatusRoute,
    selectedDate: string = dailyStatusDate
  ) {
    const normalizedRoute = String(selectedRoute || "").trim();

    if (!normalizedRoute || !selectedDate) {
      setDailyStatusRows([]);
      return;
    }

    const routeCustomers = customers.filter(
      (customer) =>
        String(customer.route || "").trim().toLowerCase() ===
        normalizedRoute.toLowerCase()
    );

    if (routeCustomers.length === 0) {
      setDailyStatusRows([]);
      return;
    }

    try {
      setDailyStatusLoading(true);

      const customerIds = routeCustomers.map((customer) => customer.id);

      // Read all sales for this route so old outstanding and the selected
      // day's outstanding can be displayed separately without changing data.
      const [salesResult, collectionsResult] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "customer_id, sale_date, total_amount, paid_amount, balance_amount, cash_amount, upi_amount, payment_method"
          )
          .in("customer_id", customerIds),
        supabase
          .from("collections")
          .select("customer_id, amount, cash_amount, upi_amount, payment_method")
          .in("customer_id", customerIds)
          .eq("collection_date", selectedDate),
      ]);

      if (salesResult.error) throw salesResult.error;
      if (collectionsResult.error) throw collectionsResult.error;

      const salesByCustomer = new Map<string, any[]>();
      (salesResult.data || []).forEach((sale: any) => {
        const id = String(sale.customer_id || "");
        if (!id) return;
        const rows = salesByCustomer.get(id) || [];
        rows.push(sale);
        salesByCustomer.set(id, rows);
      });

      const collectionsByCustomer = new Map<string, { amount: number; cash: number; upi: number }>();
      (collectionsResult.data || []).forEach((collection: any) => {
        const id = String(collection.customer_id || "");
        if (!id) return;

        const amountValue = Number(collection.amount) || 0;
        const method = String(collection.payment_method || "Cash").toLowerCase();
        const cashValue = collection.cash_amount !== null && collection.cash_amount !== undefined
          ? Number(collection.cash_amount) || 0
          : method === "cash" ? amountValue : 0;
        const upiValue = collection.upi_amount !== null && collection.upi_amount !== undefined
          ? Number(collection.upi_amount) || 0
          : method === "upi" ? amountValue : 0;

        const current = collectionsByCustomer.get(id) || { amount: 0, cash: 0, upi: 0 };
        current.amount += amountValue;
        current.cash += cashValue;
        current.upi += upiValue;
        collectionsByCustomer.set(id, current);
      });

      const rows: RouteDailyStatusRow[] = routeCustomers.map((customer) => {
        const customerSales = salesByCustomer.get(customer.id) || [];
        const selectedDaySales = customerSales.filter(
          (sale) => String(sale.sale_date || "").slice(0, 10) === selectedDate
        );
        const previousSalesOutstanding = customerSales.reduce((total, sale) => {
          const saleDate = String(sale.sale_date || "").slice(0, 10);
          return saleDate !== selectedDate
            ? total + Math.max(0, Number(sale.balance_amount) || 0)
            : total;
        }, 0);
        const todayOutstanding = selectedDaySales.reduce(
          (total, sale) => total + Math.max(0, Number(sale.balance_amount) || 0),
          0
        );
        const saleTotal = selectedDaySales.reduce(
          (total, sale) => total + (Number(sale.total_amount) || 0),
          0
        );
        const salePaid = selectedDaySales.reduce(
          (total, sale) => total + (Number(sale.paid_amount) || 0),
          0
        );
        const todayCollections = collectionsByCustomer.get(customer.id) || {
          amount: 0,
          cash: 0,
          upi: 0,
        };
        const paymentReceivedToday = salePaid + todayCollections.amount;
        const saleEntered = selectedDaySales.length > 0;
        const previousOutstanding =
          (Number(customer.opening_balance) || 0) + previousSalesOutstanding;

        let status: RouteDailyStatus;
        if (!saleEntered && paymentReceivedToday <= 0) {
          status = "No entry";
        } else if (todayOutstanding > 0 && paymentReceivedToday <= 0) {
          status = "Not collected";
        } else if (todayOutstanding > 0 && paymentReceivedToday > 0) {
          status = "Partial";
        } else {
          status = "Paid";
        }

        return {
          id: customer.id,
          customer_name: customer.customer_name,
          route: customer.route || "",
          saleEntered,
          saleTotal,
          salePaid,
          previousOutstanding,
          todayOutstanding,
          collectionToday: todayCollections.amount,
          cashToday: todayCollections.cash,
          upiToday: todayCollections.upi,
          status,
        };
      });

      setDailyStatusRows(rows);
    } catch (error: any) {
      console.error("Daily route status load error:", error);
      setDailyStatusRows([]);
      alert(
        "Unable to load daily route status:\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setDailyStatusLoading(false);
    }
  }

  const filteredDailyStatusRows = useMemo(() => {
    if (dailyStatusFilter === "All") return dailyStatusRows;
    return dailyStatusRows.filter((row) => row.status === dailyStatusFilter);
  }, [dailyStatusRows, dailyStatusFilter]);

  const dailyStatusTotals = useMemo(() => ({
    customers: dailyStatusRows.length,
    saleEntered: dailyStatusRows.filter((row) => row.saleEntered).length,
    missingSales: dailyStatusRows.filter((row) => !row.saleEntered).length,
    paid: dailyStatusRows.filter((row) => row.status === "Paid").length,
    partial: dailyStatusRows.filter((row) => row.status === "Partial").length,
    notCollected: dailyStatusRows.filter((row) => row.status === "Not collected").length,
    noEntry: dailyStatusRows.filter((row) => row.status === "No entry").length,
    saleTotal: dailyStatusRows.reduce((sum, row) => sum + row.saleTotal, 0),
    collectionTotal: dailyStatusRows.reduce((sum, row) => sum + row.collectionToday, 0),
    previousOutstanding: dailyStatusRows.reduce((sum, row) => sum + row.previousOutstanding, 0),
    todayOutstanding: dailyStatusRows.reduce((sum, row) => sum + row.todayOutstanding, 0),
  }), [dailyStatusRows]);

  /* =====================================================
     ROUTE-WISE COLLECTION
     ===================================================== */

  async function loadRouteCollectionRows(
    selectedRoute: string = routeCollectionRoute
  ) {
    const normalizedRoute = String(selectedRoute || "").trim();

    if (!normalizedRoute) {
      setRouteCollectionRows([]);
      return;
    }

    const routeCustomers = customers.filter(
      (customer) =>
        String(customer.route || "").trim().toLowerCase() ===
        normalizedRoute.toLowerCase()
    );

    if (routeCustomers.length === 0) {
      setRouteCollectionRows([]);
      return;
    }

    try {
      setRouteCollectionLoading(true);

      const customerIds = routeCustomers.map(
        (customer) => customer.id
      );

      const { data: sales, error } = await supabase
        .from("sales")
        .select("customer_id, balance_amount")
        .in("customer_id", customerIds)
        .gt("balance_amount", 0);

      if (error) throw error;

      const salesOutstanding = new Map<string, number>();

      (sales || []).forEach((sale: any) => {
        const customerValue = String(
          sale.customer_id || ""
        );

        salesOutstanding.set(
          customerValue,
          (salesOutstanding.get(customerValue) || 0) +
            (Number(sale.balance_amount) || 0)
        );
      });

      setRouteCollectionRows(
        routeCustomers.map((customer) => ({
          id: customer.id,
          customer_name: customer.customer_name,
          route: customer.route || "",
          outstanding:
            (Number(customer.opening_balance) || 0) +
            (salesOutstanding.get(customer.id) || 0),
          cash: "",
          upi: "",
        }))
      );
    } catch (error: any) {
      console.error(
        "Route-wise collection load error:",
        error
      );

      setRouteCollectionRows([]);

      alert(
        "Unable to load route-wise collection:\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setRouteCollectionLoading(false);
    }
  }

  function updateRouteCollectionAmount(
    customerIdValue: string,
    field: "cash" | "upi",
    value: string
  ) {
    setRouteCollectionRows((rows) =>
      rows.map((row) =>
        row.id === customerIdValue
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  const routeCollectionTotals = useMemo(() => {
    const cash = routeCollectionRows.reduce(
      (total, row) => total + (Number(row.cash) || 0),
      0
    );

    const upi = routeCollectionRows.reduce(
      (total, row) => total + (Number(row.upi) || 0),
      0
    );

    const total = cash + upi;

    return {
      cash,
      upi,
      total,
    };
  }, [routeCollectionRows]);

  async function saveRouteCollections() {
    if (!routeCollectionRoute) {
      alert("Please select a route.");
      return;
    }

    const entries = routeCollectionRows
      .map((row) => ({
        ...row,
        cashValue: Math.max(0, Number(row.cash) || 0),
        upiValue: Math.max(0, Number(row.upi) || 0),
      }))
      .filter(
        (row) => row.cashValue > 0 || row.upiValue > 0
      );

    if (entries.length === 0) {
      alert(
        "Enter Cash and/or UPI collection for at least one customer."
      );
      return;
    }

    try {
      setRouteCollectionSaving(true);

      let savedCount = 0;

      for (const row of entries) {
        const total = row.cashValue + row.upiValue;

        const paymentMethod =
          row.cashValue > 0 && row.upiValue > 0
            ? "Split"
            : row.upiValue > 0
            ? "UPI"
            : "Cash";

        const { error } = await supabase
          .from("collections")
          .insert({
            customer_id: row.id,
            collection_date: getTodayLocalDate(),
            amount: total,
            round_off: 0,
            payment_method: paymentMethod,
            cash_amount: row.cashValue,
            upi_amount: row.upiValue,
            remarks: `Route-wise Collection - ${routeCollectionRoute}`,
          });

        if (error) throw error;

        await rebuildCustomerPaymentState(row.id);
        savedCount += 1;
      }

      alert(
        `${savedCount} route-wise collection${
          savedCount === 1 ? "" : "s"
        } saved successfully.\n\n` +
          `Cash: ₹${routeCollectionTotals.cash.toFixed(2)}\n` +
          `UPI: ₹${routeCollectionTotals.upi.toFixed(2)}\n` +
          `Total: ₹${routeCollectionTotals.total.toFixed(2)}`
      );

      await loadCustomers();
      await loadRecentCollections();
      await loadRouteCollectionRows(routeCollectionRoute);
    } catch (error: any) {
      console.error(
        "Route-wise collection save error:",
        error
      );

      alert(
        "Route-wise Collection Error:\n" +
          (error?.message || "Unable to save route-wise collections.")
      );
    } finally {
      setRouteCollectionSaving(false);
    }
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
    <div className="w-full min-w-0 space-y-6">

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
          DAILY ROUTE STATUS / MISSING ENTRIES
      ================================================= */}

      <div className="bg-white rounded-2xl shadow p-5 md:p-6 border border-blue-100">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-blue-800">
              Daily Route Status
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Track missing sales entries, payments received and outstanding balances for every customer on the route.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Route</label>
              <select
                value={dailyStatusRoute}
                onChange={(event) => setDailyStatusRoute(event.target.value)}
                className="border rounded-xl px-3 py-3 min-w-[180px] bg-white"
              >
                <option value="">Select Route</option>
                {routeOptions.map((route) => (
                  <option key={route} value={route}>{route}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Date</label>
              <input
                type="date"
                value={dailyStatusDate}
                onChange={(event) => setDailyStatusDate(event.target.value)}
                className="border rounded-xl px-3 py-3 bg-white"
              />
            </div>
            <button
              type="button"
              disabled={!dailyStatusRoute || dailyStatusLoading}
              onClick={() => void loadDailyRouteStatus(dailyStatusRoute, dailyStatusDate)}
              className="bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white px-5 py-3 rounded-xl font-bold"
            >
              {dailyStatusLoading ? "Refreshing..." : "Refresh Status"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          <div className="rounded-xl bg-slate-50 border p-3">
            <div className="text-xs text-gray-500">Route Customers</div>
            <div className="text-2xl font-bold text-slate-800">{dailyStatusTotals.customers}</div>
          </div>
          <div className="rounded-xl bg-green-50 border border-green-100 p-3">
            <div className="text-xs text-green-700">Sales Entered</div>
            <div className="text-2xl font-bold text-green-800">{dailyStatusTotals.saleEntered}</div>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-100 p-3">
            <div className="text-xs text-red-700">Sales Missing</div>
            <div className="text-2xl font-bold text-red-800">{dailyStatusTotals.missingSales}</div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <div className="text-xs text-amber-700">Not Collected</div>
            <div className="text-2xl font-bold text-amber-800">{dailyStatusTotals.notCollected}</div>
          </div>
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
            <div className="text-xs text-indigo-700">Partial</div>
            <div className="text-2xl font-bold text-indigo-800">{dailyStatusTotals.partial}</div>
          </div>
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
            <div className="text-xs text-rose-700">No Entry</div>
            <div className="text-2xl font-bold text-rose-800">{dailyStatusTotals.noEntry}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-blue-50 text-blue-800 px-3 py-1.5 font-semibold">
              Sales: ₹{dailyStatusTotals.saleTotal.toFixed(2)}
            </span>
            <span className="rounded-full bg-green-50 text-green-800 px-3 py-1.5 font-semibold">
              Collections: ₹{dailyStatusTotals.collectionTotal.toFixed(2)}
            </span>
            <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1.5 font-semibold">
              Previous due: ₹{dailyStatusTotals.previousOutstanding.toFixed(2)}
            </span>
            <span className="rounded-full bg-orange-50 text-orange-800 px-3 py-1.5 font-semibold">
              Today's due: ₹{dailyStatusTotals.todayOutstanding.toFixed(2)}
            </span>
          </div>
          <select
            value={dailyStatusFilter}
            onChange={(event) => setDailyStatusFilter(event.target.value)}
            className="border rounded-lg px-3 py-2 bg-white text-sm"
            aria-label="Filter daily route status"
          >
            <option value="All">All Customers</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial Payment</option>
            <option value="Not collected">Not Collected</option>
            <option value="No entry">No Entry</option>
          </select>
        </div>

        {!dailyStatusRoute ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-gray-500">
            Select a route to view its daily status.
          </div>
        ) : dailyStatusLoading ? (
          <div className="rounded-xl border p-6 text-center text-gray-500">
            Loading daily route entries...
          </div>
        ) : dailyStatusRows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-gray-500">
            No customers found for this route.
          </div>
        ) : filteredDailyStatusRows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-gray-500">
            No customers match this status filter.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full min-w-[1050px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-center">Sales Entry</th>
                  <th className="p-3 text-right">Today's Sale</th>
                  <th className="p-3 text-right">Previous Outstanding</th>
                  <th className="p-3 text-right">Today's Outstanding</th>
                  <th className="p-3 text-right">Collection Today</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDailyStatusRows.map((row, index) => {
                  const badgeClass = row.status === "Paid"
                    ? "bg-green-100 text-green-800"
                    : row.status === "Partial"
                    ? "bg-indigo-100 text-indigo-800"
                    : row.status === "Not collected"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800";

                  return (
                    <tr key={row.id} className="border-b odd:bg-white even:bg-slate-50 hover:bg-blue-50">
                      <td className="p-3">{index + 1}</td>
                      <td className="p-3 font-semibold text-slate-800">{row.customer_name}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.saleEntered ? "bg-green-100 text-green-800" : "bg-rose-100 text-rose-800"}`}>
                          {row.saleEntered ? "Entered" : "Missing"}
                        </span>
                      </td>
                      <td className="p-3 text-right">₹{row.saleTotal.toFixed(2)}</td>
                      <td className="p-3 text-right text-slate-600">₹{row.previousOutstanding.toFixed(2)}</td>
                      <td className="p-3 text-right font-semibold text-orange-700">₹{row.todayOutstanding.toFixed(2)}</td>
                      <td className="p-3 text-right font-semibold text-green-700">₹{(row.salePaid + row.collectionToday).toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${badgeClass}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-500 mt-3">
          “No Entry” means no sale and no payment record exists for the selected date. Previous outstanding is shown separately from the selected date's outstanding. This report is read-only and does not create or change transactions.
        </p>
      </div>

      {/* =================================================
          ROUTE-WISE COLLECTION
      ================================================= */}

      <div className="bg-white rounded-2xl shadow p-6 border-2 border-blue-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-blue-700">
              Route-wise Collection
            </h2>
            <p className="text-gray-500 mt-1">
              Select a route, enter Cash and UPI for customers, then save all collections together.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block font-semibold mb-2">
                Collection Route
              </label>
              <select
                value={routeCollectionRoute}
                onChange={(e) => {
                  setRouteCollectionRoute(e.target.value);
                  setRouteCollectionRows([]);
                }}
                className="border rounded-xl px-4 py-3 min-w-[220px] bg-white"
              >
                <option value="">Select Route</option>
                {routeOptions.map((route) => (
                  <option key={route} value={route}>
                    {route}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={
                routeCollectionLoading ||
                !routeCollectionRoute
              }
              onClick={() =>
                void loadRouteCollectionRows(
                  routeCollectionRoute
                )
              }
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 py-3 rounded-xl font-bold"
            >
              {routeCollectionLoading
                ? "Loading..."
                : "Load Route"}
            </button>
          </div>
        </div>

        {!routeCollectionRoute ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
            Select a route to start route-wise collection.
          </div>
        ) : routeCollectionRows.length === 0 && !routeCollectionLoading ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
            No customers found on this route.
          </div>
        ) : (
          <>
            {/* MOBILE: customer-first cards keep names visible without horizontal scrolling */}
            <div className="md:hidden space-y-3">
              {routeCollectionRows.map((row, index) => {
                const cash = Number(row.cash) || 0;
                const upi = Number(row.upi) || 0;
                const total = cash + upi;

                return (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500">CUSTOMER {index + 1}</p>
                        <p className="mt-1 break-words text-base font-bold text-slate-900">
                          {row.customer_name || "Unnamed customer"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-500">Outstanding</p>
                        <p className="font-bold text-red-600">₹{row.outstanding.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-green-700">Cash (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={row.cash}
                          onChange={(e) => updateRouteCollectionAmount(row.id, "cash", e.target.value)}
                          className="w-full min-w-0 rounded-lg border-2 border-green-200 bg-white px-3 py-3 text-base text-right"
                          placeholder="0"
                          aria-label={`Cash received from ${row.customer_name}`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-blue-700">UPI (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={row.upi}
                          onChange={(e) => updateRouteCollectionAmount(row.id, "upi", e.target.value)}
                          className="w-full min-w-0 rounded-lg border-2 border-blue-200 bg-white px-3 py-3 text-base text-right"
                          placeholder="0"
                          aria-label={`UPI received from ${row.customer_name}`}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-sm font-semibold text-slate-600">Customer Total</span>
                      <span className="text-base font-bold text-green-700">₹{total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP: full-width table */}
            <div className="hidden md:block overflow-x-auto border rounded-xl">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Customer</th>
                    <th className="p-3 text-right">Outstanding</th>
                    <th className="p-3 text-right">Cash</th>
                    <th className="p-3 text-right">UPI</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {routeCollectionRows.map((row, index) => {
                    const cash = Number(row.cash) || 0;
                    const upi = Number(row.upi) || 0;
                    const total = cash + upi;

                    return (
                      <tr key={row.id} className="border-b hover:bg-blue-50">
                        <td className="p-3">{index + 1}</td>
                        <td className="p-3 font-semibold">{row.customer_name}</td>
                        <td className="p-3 text-right font-bold text-red-600">₹{row.outstanding.toFixed(2)}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.cash}
                            onChange={(e) => updateRouteCollectionAmount(row.id, "cash", e.target.value)}
                            className="w-full min-w-[130px] border-2 border-green-200 rounded-lg px-3 py-2 text-right"
                            placeholder="0"
                            aria-label={`Cash received from ${row.customer_name}`}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.upi}
                            onChange={(e) => updateRouteCollectionAmount(row.id, "upi", e.target.value)}
                            className="w-full min-w-[130px] border-2 border-blue-200 rounded-lg px-3 py-2 text-right"
                            placeholder="0"
                            aria-label={`UPI received from ${row.customer_name}`}
                          />
                        </td>
                        <td className="p-3 text-right font-bold text-green-700">₹{total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={3} className="p-3 text-right">Route Total</td>
                    <td className="p-3 text-right text-green-700">₹{routeCollectionTotals.cash.toFixed(2)}</td>
                    <td className="p-3 text-right text-blue-700">₹{routeCollectionTotals.upi.toFixed(2)}</td>
                    <td className="p-3 text-right text-indigo-700">₹{routeCollectionTotals.total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile route totals */}
            <div className="md:hidden mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-3 text-center">
              <div>
                <p className="text-xs text-slate-500">Cash Total</p>
                <p className="font-bold text-green-700">₹{routeCollectionTotals.cash.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">UPI Total</p>
                <p className="font-bold text-blue-700">₹{routeCollectionTotals.upi.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Route Total</p>
                <p className="font-bold text-indigo-700">₹{routeCollectionTotals.total.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-5">
              <div className="text-sm text-gray-600">
                Customers:{" "}
                <span className="font-bold">
                  {routeCollectionRows.length}
                </span>
                {" • "}
                Enter only the customers who actually paid today.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={
                    routeCollectionSaving ||
                    routeCollectionLoading
                  }
                  onClick={() =>
                    void loadRouteCollectionRows(
                      routeCollectionRoute
                    )
                  }
                  className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl font-bold"
                >
                  Clear / Reload
                </button>

                <button
                  type="button"
                  disabled={
                    routeCollectionSaving ||
                    routeCollectionLoading ||
                    routeCollectionTotals.total <= 0
                  }
                  onClick={() =>
                    void saveRouteCollections()
                  }
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-xl font-bold"
                >
                  {routeCollectionSaving
                    ? "Saving All..."
                    : "Save All Collections"}
                </button>
              </div>
            </div>
          </>
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

          {/* ROUTE */}

          <div>
            <label className="block font-semibold mb-2">
              Route
            </label>

            <select
              value={routeFilter}
              onChange={(e) => {
                setRouteFilter(e.target.value);

                // Clear selected customer if it no longer
                // belongs to the selected route.
                if (
                  e.target.value &&
                  customerId
                ) {
                  const selected = customers.find(
                    (customer) =>
                      customer.id === customerId
                  );

                  if (
                    selected &&
                    String(selected.route || "").trim().toLowerCase() !==
                      e.target.value.trim().toLowerCase()
                  ) {
                    setCustomerId("");
                    setBalance(0);
                    setOutstandingSales([]);
                  }
                }
              }}
              className="w-full border rounded-xl px-4 py-3 bg-white"
            >
              <option value="">
                All Routes
              </option>

              {routeOptions.map((route) => (
                <option
                  key={route}
                  value={route}
                >
                  {route}
                </option>
              ))}
            </select>

            <p className="mt-1 text-xs text-gray-500">
              Select a route to show only its customers.
            </p>
          </div>

          {/* CUSTOMER SEARCH */}

          <div>
            <label className="block font-semibold mb-2">
              Search Customer
            </label>

            <input
              type="text"
              value={customerSearch}
              onChange={(e) =>
                setCustomerSearch(e.target.value)
              }
              placeholder="Search customer name..."
              className="w-full border rounded-xl px-4 py-3"
            />

            <p className="mt-1 text-xs text-gray-500">
              {filteredCustomers.length} customer
              {filteredCustomers.length === 1 ? "" : "s"} found
            </p>
          </div>

          {/* CUSTOMER */}

          <div>
            <label className="block font-semibold mb-2">
              Customer
            </label>

            <select
              value={customerId}
              onChange={(e) =>
                void handleCustomerChange(
                  e.target.value
                )
              }
              className="w-full border rounded-xl px-4 py-3"
            >
              <option value="">
                Select Customer
              </option>

              {filteredCustomers.map(
                (customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.customer_name}
                    {customer.route
                      ? ` — ${customer.route}`
                      : ""}
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

            <div className="mt-2 w-full border rounded-xl px-4 py-2 bg-green-50 text-sm font-bold text-green-700">
              Customer Advance: ₹{advanceBalance.toFixed(2)}
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

          {/* ROUND OFF */}

          <div className="md:col-span-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block font-semibold mb-2">
                  Round-off (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={roundOff}
                  onChange={(e) => setRoundOff(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Accounting adjustment only; it is not an extra cash/UPI receipt.
                </p>
              </div>

              <button
                type="button"
                disabled={loading || baseCollectionAmount <= 0}
                onClick={() =>
                  setRoundOff((Math.round(baseCollectionAmount) - baseCollectionAmount).toFixed(2))
                }
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white px-5 py-3 rounded-xl font-bold"
              >
                Auto Round ₹1
              </button>

              <div className="rounded-xl bg-white border px-4 py-3">
                <p className="text-xs text-gray-500">Effective Collection</p>
                <p className="text-xl font-bold text-green-700">
                  ₹{effectiveCollectionAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

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
              {selectedCustomer.customer_name}
            </p>

            <p className="mt-1 text-sm text-slate-600">
              Route:{" "}
              <span className="font-semibold">
                {selectedCustomer.route || "-"}
              </span>
            </p>
          </div>
        )}

        {/* BUTTONS */}

        <div className="flex flex-wrap gap-3 mt-6">

          <button
            type="button"
            disabled={
              loading ||
              !customerId
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
                        {Math.abs(Number(collection.round_off) || 0) >= 0.001 && (
                          <span className="block text-xs text-amber-700 font-semibold">
                            Round-off: {(Number(collection.round_off) || 0) >= 0 ? "+" : ""}{(Number(collection.round_off) || 0).toFixed(2)}
                          </span>
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
                        <div className="flex justify-center items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => void viewRecentCollectionBilling(collection)}
                            className="bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold"
                          >
                            👁 View Bill
                          </button>

                          {collection.source === "Sale" ? (
                            <span className="inline-block bg-blue-100 text-blue-700 px-3 py-2 rounded-lg font-semibold">
                              Sale Payment
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => editCollection(collection.id)}
                                className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => deleteCollection(collection.id)}
                                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold"
                              >
                                Delete
                              </button>
                            </>
                          )}
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