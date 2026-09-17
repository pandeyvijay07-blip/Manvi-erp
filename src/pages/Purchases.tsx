import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

// ======================================================
// TYPES
// ======================================================

type Brand = {
  id: string;
  brand_name: string;
};

type Product = {
  id: string;
  brand_id: string | null;
  product_name: string;
  size: number | string | null;
  unit: string | null;
  purchase_rate: number | string | null;
  selling_rate: number | string | null;
  stock_qty: number | string | null;
};

type PurchaseRow = {
  product_id: string;
  product_name: string;
  size: number;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  brand_id: string | null;
};

type SavedPurchase = {
  id: string;
  purchase_date: string | null;
  invoice_no: string | null;
  supplier_name: string | null;
  total_amount: number | string | null;
  payment_method: string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
  cash_amount: number | string | null;
  upi_amount: number | string | null;
};

// ======================================================
// HELPERS
// ======================================================

function todayInput() {
  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  const text =
    String(value).slice(0, 10);

  const parts =
    text.split("-");

  if (
    parts.length !== 3
  ) {
    return String(value);
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function parseDateDDMMYYYY(
  value: string
) {
  const cleaned = value
    .replace(/[^0-9]/g, "")
    .slice(0, 8);

  if (cleaned.length !== 8) {
    return null;
  }

  const day = cleaned.slice(0, 2);
  const month = cleaned.slice(2, 4);
  const year = cleaned.slice(4, 8);

  const numericDay = Number(day);
  const numericMonth = Number(month);
  const numericYear = Number(year);

  if (
    !Number.isInteger(numericDay) ||
    !Number.isInteger(numericMonth) ||
    !Number.isInteger(numericYear) ||
    numericYear < 2000 ||
    numericYear > 2100 ||
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericDay < 1
  ) {
    return null;
  }

  const checkDate = new Date(
    numericYear,
    numericMonth - 1,
    numericDay
  );

  if (
    checkDate.getFullYear() !== numericYear ||
    checkDate.getMonth() !== numericMonth - 1 ||
    checkDate.getDate() !== numericDay
  ) {
    return null;
  }

  return `${numericYear}-${String(
    numericMonth
  ).padStart(2, "0")}-${String(
    numericDay
  ).padStart(2, "0")}`;
}

function formatDateDDMMYYYYInput(
  value: string
) {
  const digits = value
    .replace(/[^0-9]/g, "")
    .slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}


function money(
  value: number | string | null | undefined
) {
  return `₹ ${Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

// ======================================================
// COMPONENT
// ======================================================

export default function Purchases() {

  // ====================================================
  // DATA
  // ====================================================

  const [
    brands,
    setBrands,
  ] =
    useState<Brand[]>([]);

  const [
    products,
    setProducts,
  ] =
    useState<Product[]>([]);

  const [
    purchaseHistory,
    setPurchaseHistory,
  ] =
    useState<SavedPurchase[]>([]);

  // ====================================================
  // PURCHASE FORM
  // ====================================================

  const [
    purchaseDate,
    setPurchaseDate,
  ] =
    useState(
      todayInput()
    );

  const [
    purchaseDateDisplay,
    setPurchaseDateDisplay,
  ] =
    useState(
      formatDate(todayInput())
    );

  const [
    invoiceNo,
    setInvoiceNo,
  ] =
    useState("");

  const [
    supplierName,
    setSupplierName,
  ] =
    useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] =
    useState("Credit");

  const [
    paidAmount,
    setPaidAmount,
  ] =
    useState("0");

  const [
    cashAmount,
    setCashAmount,
  ] =
    useState("0");

  const [
    upiAmount,
    setUpiAmount,
  ] =
    useState("0");

  // ====================================================
  // PRODUCT ENTRY
  // ====================================================

  const [
    selectedBrandId,
    setSelectedBrandId,
  ] =
    useState("");

  const [
    selectedProductId,
    setSelectedProductId,
  ] =
    useState("");

  const [
    quantity,
    setQuantity,
  ] =
    useState("");

  const [
    rate,
    setRate,
  ] =
    useState("");

  // ====================================================
  // PURCHASE CART
  // ====================================================

  const [
    purchaseRows,
    setPurchaseRows,
  ] =
    useState<PurchaseRow[]>(
      []
    );

  // ====================================================
  // UI
  // ====================================================

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);

  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {

    loadBrands();

    loadProducts();

    loadPurchaseHistory();

  }, []);

  // ====================================================
  // LOAD BRANDS
  // ====================================================

  async function loadBrands() {

    try {

      const {
        data,
        error,
      } =
        await supabase
          .from("brands")
          .select(
            `
              id,
              brand_name
            `
          )
          .order(
            "brand_name"
          );

      if (error) {
        throw error;
      }

      setBrands(
        (data || []) as Brand[]
      );

    } catch (
      error: any
    ) {

      console.error(
        "LOAD BRANDS ERROR:",
        error
      );

      alert(
        "Unable to load brands:\n\n" +
        (
          error?.message ||
          "Unknown error"
        )
      );

    }
  }

  // ====================================================
  // LOAD PRODUCTS
  // ====================================================

  async function loadProducts() {

    setLoading(true);

    try {

      const {
        data,
        error,
      } =
        await supabase
          .from("products")
          .select(
            `
              id,
              brand_id,
              product_name,
              size,
              unit,
              purchase_rate,
              selling_rate,
              stock_qty
            `
          )
          .order(
            "product_name"
          );

      if (error) {
        throw error;
      }

      setProducts(
        (data || []) as Product[]
      );

    } catch (
      error: any
    ) {

      console.error(
        "LOAD PRODUCTS ERROR:",
        error
      );

      alert(
        "Unable to load products:\n\n" +
        (
          error?.message ||
          "Unknown error"
        )
      );

    } finally {

      setLoading(false);

    }
  }

  // ====================================================
  // LOAD PURCHASE HISTORY
  // ====================================================

  async function loadPurchaseHistory() {

    setHistoryLoading(true);

    try {

      const {
        data,
        error,
      } =
        await supabase
          .from("purchases")
          .select(
            `
              id,
              purchase_date,
              invoice_no,
              supplier_name,
              total_amount,
              payment_method,
              paid_amount,
              balance_amount,
              cash_amount,
              upi_amount
            `
          )
          .order(
            "purchase_date",
            {
              ascending:
                false,
            }
          )
          .limit(20);

      if (error) {
        throw error;
      }

      setPurchaseHistory(
        (data || []) as SavedPurchase[]
      );

    } catch (
      error: any
    ) {

      console.error(
        "LOAD PURCHASE HISTORY ERROR:",
        error
      );

      alert(
        "Unable to load purchase history:\n\n" +
        (
          error?.message ||
          "Unknown error"
        )
      );

    } finally {

      setHistoryLoading(
        false
      );

    }
  }

  // ====================================================
  // PRODUCTS OF SELECTED BRAND
  // ====================================================

  const brandProducts =
    useMemo(() => {

      if (!selectedBrandId) {
        return [];
      }

      return products.filter(
        (product) =>
          String(
            product.brand_id
          ) ===
          String(
            selectedBrandId
          )
      );

    }, [
      products,
      selectedBrandId,
    ]);

  // ====================================================
  // SELECTED BRAND PRODUCT COUNT
  // ====================================================

  const selectedBrandProductCount =
    brandProducts.length;

  // ====================================================
  // SELECTED PRODUCT
  // ====================================================

  const selectedProduct =
    useMemo(() => {

      return products.find(
        (product) =>
          String(
            product.id
          ) ===
          String(
            selectedProductId
          )
      );

    }, [
      products,
      selectedProductId,
    ]);

  // ====================================================
  // BRAND NAME
  // ====================================================

  function getBrandName(
    brandId: string | null
  ) {

    return (
      brands.find(
        (brand) =>
          String(
            brand.id
          ) ===
          String(
            brandId
          )
      )?.brand_name ||
      "Unknown Brand"
    );

  }

  // ====================================================
  // BRAND CHANGE
  // ====================================================

  function handleBrandChange(
    value: string
  ) {

    setSelectedBrandId(
      value
    );

    setSelectedProductId(
      ""
    );

    setQuantity(
      ""
    );

    setRate(
      ""
    );

  }

  // ====================================================
  // PRODUCT CHANGE
  // ====================================================

  function handleProductChange(
    value: string
  ) {

    setSelectedProductId(
      value
    );

    const product =
      products.find(
        (item) =>
          String(
            item.id
          ) ===
          String(
            value
          )
      );

    if (!product) {

      setRate("");

      return;

    }

    setRate(
      String(
        product.purchase_rate ||
        0
      )
    );

  }

  // ====================================================
  // ADD PURCHASE ITEM
  // ====================================================

  function addPurchaseItem() {

    if (!selectedBrandId) {

      alert(
        "Please select a brand."
      );

      return;
    }

    if (!selectedProductId) {

      alert(
        "Please select a product."
      );

      return;
    }

    const numericQuantity =
      Number(
        quantity
      );

    const numericRate =
      Number(
        rate
      );

    if (
      !Number.isFinite(
        numericQuantity
      ) ||
      numericQuantity <= 0
    ) {

      alert(
        "Please enter a valid quantity."
      );

      return;
    }

    if (
      !Number.isFinite(
        numericRate
      ) ||
      numericRate < 0
    ) {

      alert(
        "Please enter a valid purchase rate."
      );

      return;
    }

    if (!selectedProduct) {

      alert(
        "Selected product was not found."
      );

      return;
    }

    const amount =
      numericQuantity *
      numericRate;

    setPurchaseRows(
      (
        previous
      ) => {

        const existingIndex =
          previous.findIndex(
            (row) =>
              String(
                row.product_id
              ) ===
              String(
                selectedProduct.id
              )
          );

        // ----------------------------------------------
        // UPDATE EXISTING PRODUCT
        // ----------------------------------------------

        if (
          existingIndex >=
          0
        ) {

          const updated = [
            ...previous,
          ];

          updated[
            existingIndex
          ] = {

            ...updated[
              existingIndex
            ],

            quantity:
              numericQuantity,

            rate:
              numericRate,

            amount,

          };

          return updated;
        }

        // ----------------------------------------------
        // ADD NEW PRODUCT
        // ----------------------------------------------

        return [

          ...previous,

          {

            product_id:
              selectedProduct.id,

            product_name:
              selectedProduct.product_name,

            size:
              Number(
                selectedProduct.size ||
                  1
              ),

            unit:
              selectedProduct.unit ||
              "Litre",

            quantity:
              numericQuantity,

            rate:
              numericRate,

            amount,

            brand_id:
              selectedProduct.brand_id,

          },

        ];

      }
    );

    // Reset only product entry

    setSelectedProductId(
      ""
    );

    setQuantity(
      ""
    );

    setRate(
      ""
    );

  }

  // ====================================================
  // REMOVE PURCHASE ITEM
  // ====================================================

  function removePurchaseItem(
    productId: string
  ) {

    setPurchaseRows(
      (previous) =>
        previous.filter(
          (row) =>
            String(
              row.product_id
            ) !==
            String(
              productId
            )
        )
    );

  }

  // ====================================================
  // CLEAR PURCHASE
  // ====================================================

  function clearPurchase() {

    const today = todayInput();

    setPurchaseDate(
      today
    );

    setPurchaseDateDisplay(
      formatDate(today)
    );

    setInvoiceNo(
      ""
    );

    setSupplierName(
      ""
    );

    setPaymentMethod(
      "Credit"
    );

    setPaidAmount(
      "0"
    );

    setCashAmount("0");
    setUpiAmount("0");

    setSelectedBrandId(
      ""
    );

    setSelectedProductId(
      ""
    );

    setQuantity(
      ""
    );

    setRate(
      ""
    );

    setPurchaseRows(
      []
    );

  }

  // ====================================================
  // TOTAL PURCHASE AMOUNT
  // ====================================================

  const totalPurchaseAmount =
    useMemo(() => {

      return purchaseRows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          Number(
            row.amount ||
              0
          ),
        0
      );

    }, [
      purchaseRows,
    ]);

  // ====================================================
  // TOTAL QUANTITY
  // ====================================================

  const totalPurchaseQuantity =
    useMemo(() => {

      return purchaseRows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          Number(
            row.quantity ||
              0
          ),
        0
      );

    }, [
      purchaseRows,
    ]);

  // ====================================================
  // NUMERIC PAID AMOUNT
  // ====================================================

  const numericPaidAmount =
    Number(
      paidAmount
    );

  const numericCashAmount =
    Math.max(
      0,
      Number(cashAmount) || 0
    );

  const numericUpiAmount =
    Math.max(
      0,
      Number(upiAmount) || 0
    );

  const effectivePaidAmount =
    paymentMethod === "Split"
      ? numericCashAmount + numericUpiAmount
      : Number.isFinite(numericPaidAmount)
      ? Math.max(0, numericPaidAmount)
      : 0;

  // ====================================================
  // PURCHASE BALANCE
  // ====================================================

  const purchaseBalance =
    Math.max(
      0,
      totalPurchaseAmount -
        effectivePaidAmount
    );

  // ====================================================
  // PAYMENT METHOD CHANGE
  // ====================================================

  function handlePaymentMethodChange(
    value: string
  ) {

    setPaymentMethod(
      value
    );

    // Credit defaults to zero paid.
    if (
      value ===
      "Credit"
    ) {
      setPaidAmount("0");
      setCashAmount("0");
      setUpiAmount("0");
      return;
    }

    if (value === "Split") {
      setPaidAmount("0");
      setCashAmount("0");
      setUpiAmount("0");
      return;
    }

    // If switching to a normal paid method,
    // automatically suggest full payment.
    if (
      totalPurchaseAmount > 0
    ) {
      setPaidAmount(
        totalPurchaseAmount.toFixed(2)
      );
    }

    setCashAmount("0");
    setUpiAmount("0");

  }

  // ====================================================
  // PAID AMOUNT CHANGE
  // ====================================================

  function handlePaidAmountChange(
    value: string
  ) {

    const cleaned =
      value.replace(
        /[^0-9.]/g,
        ""
      );

    setPaidAmount(
      cleaned
    );

  }

  // ====================================================
  // SAVE PURCHASE
  // ====================================================

  async function savePurchase() {

    // -----------------------------------------------
    // DATE
    // -----------------------------------------------

    const normalizedPurchaseDate =
      parseDateDDMMYYYY(
        purchaseDateDisplay
      );

    if (!normalizedPurchaseDate) {

      alert(
        "Please enter a valid purchase date in DD/MM/YYYY format.\nExample: 09/09/2026"
      );

      return;

    }

    setPurchaseDate(
      normalizedPurchaseDate
    );

    // -----------------------------------------------
    // INVOICE
    // -----------------------------------------------

    const cleanInvoice =
      invoiceNo.trim();

    if (!cleanInvoice) {

      alert(
        "Please enter Purchase Bill / Invoice No."
      );

      return;

    }

    // -----------------------------------------------
    // SUPPLIER
    // -----------------------------------------------

    if (
      !supplierName.trim()
    ) {

      alert(
        "Please enter company / supplier name."
      );

      return;

    }

    // -----------------------------------------------
    // PRODUCTS
    // -----------------------------------------------

    if (
      purchaseRows.length === 0
    ) {

      alert(
        "Please add at least one product to the purchase."
      );

      return;

    }

    // -----------------------------------------------
    // PAID
    // -----------------------------------------------

    const finalPaid =
      paymentMethod === "Split"
        ? numericCashAmount + numericUpiAmount
        : Number(paidAmount);

    if (
      !Number.isFinite(finalPaid) ||
      finalPaid < 0
    ) {
      alert(
        "Please enter a valid paid amount."
      );
      return;
    }

    if (
      finalPaid >
      totalPurchaseAmount
    ) {
      alert(
        `Paid amount cannot exceed purchase total of ${money(
          totalPurchaseAmount
        )}.`
      );
      return;
    }

    if (
      paymentMethod === "Split" &&
      numericCashAmount < 0
    ) {
      alert("Please enter a valid Cash amount.");
      return;
    }

    if (
      paymentMethod === "Split" &&
      numericUpiAmount < 0
    ) {
      alert("Please enter a valid UPI amount.");
      return;
    }

    // -----------------------------------------------
    // CREDIT
    // -----------------------------------------------

    if (
      paymentMethod === "Credit" &&
      finalPaid !== 0
    ) {
      alert(
        "For Credit purchase, Paid Amount should be 0."
      );
      return;
    }

    setSaving(
      true
    );

    try {

      // =================================================
      // STEP 1 — CREATE PURCHASE HEADER
      // =================================================

      const {
        data:
          purchase,
        error:
          purchaseError,
      } =
        await supabase
          .from(
            "purchases"
          )
          .insert({

            purchase_date:
              normalizedPurchaseDate,

            invoice_no:
              cleanInvoice,

            supplier_name:
              supplierName.trim(),

            total_amount:
              totalPurchaseAmount,

            payment_method:
              paymentMethod,

            paid_amount:
              finalPaid,

            balance_amount:
              Math.max(
                0,
                totalPurchaseAmount -
                  finalPaid
              ),

            cash_amount:
              paymentMethod === "Split"
                ? numericCashAmount
                : paymentMethod === "Cash"
                ? finalPaid
                : 0,

            upi_amount:
              paymentMethod === "Split"
                ? numericUpiAmount
                : paymentMethod === "UPI"
                ? finalPaid
                : 0,

          })
          .select(
            `
              id,
              invoice_no,
              supplier_name,
              purchase_date,
              total_amount,
              payment_method,
              paid_amount,
              balance_amount,
              cash_amount,
              upi_amount
            `
          )
          .single();

      if (
        purchaseError
      ) {

        throw purchaseError;

      }

      if (
        !purchase?.id
      ) {

        throw new Error(
          "Purchase was created but Purchase ID was not returned."
        );

      }

      // =================================================
      // STEP 2 — CREATE PURCHASE ITEMS
      // =================================================

      const purchaseItems =
        purchaseRows.map(
          (
            row
          ) => ({

            purchase_id:
              purchase.id,

            product_id:
              row.product_id,

            quantity:
              row.quantity,

            rate:
              row.rate,

            amount:
              row.amount,

          })
        );

      const {
        error:
          itemsError,
      } =
        await supabase
          .from(
            "purchase_items"
          )
          .insert(
            purchaseItems
          );

      if (
        itemsError
      ) {

        // Try rollback purchase header
        await supabase
          .from(
            "purchases"
          )
          .delete()
          .eq(
            "id",
            purchase.id
          );

        throw itemsError;

      }

      // =================================================
      // STEP 3 — UPDATE PRODUCT STOCK
      // =================================================

      for (
        const row of
          purchaseRows
      ) {

        const product =
          products.find(
            (
              item
            ) =>
              String(
                item.id
              ) ===
              String(
                row.product_id
              )
          );

        if (
          !product
        ) {

          throw new Error(
            `Product not found: ${row.product_name}`
          );

        }

        const currentStock =
          Number(
            product.stock_qty ||
              0
          );

        const newStock =
          currentStock +
          Number(
            row.quantity ||
              0
          );

        const {
          error:
            stockError,
        } =
          await supabase
            .from(
              "products"
            )
            .update({

              stock_qty:
                newStock,

              purchase_rate:
                row.rate,

            })
            .eq(
              "id",
              row.product_id
            );

        if (
          stockError
        ) {

          throw stockError;

        }

      }

      // =================================================
      // SUCCESS
      // =================================================

      alert(
        "Purchase saved successfully.\n\n" +
        `Bill No: ${cleanInvoice}\n` +
        `Supplier: ${supplierName.trim()}\n` +
        `Total: ${money(
          totalPurchaseAmount
        )}\n` +
        `Paid: ${money(
          finalPaid
        )}\n` +
        `Balance: ${money(
          Math.max(
            0,
            totalPurchaseAmount -
              finalPaid
          )
        )}`
      );

      clearPurchase();

      await loadProducts();

      await loadPurchaseHistory();

    } catch (
      error: any
    ) {

      console.error(
        "SAVE PURCHASE ERROR:",
        error
      );

      alert(
        "Purchase Error:\n\n" +
        (
          error?.message ||
          "Unable to save purchase."
        )
      );

    } finally {

      setSaving(
        false
      );

    }

  }

  // ====================================================
  // UI
  // ====================================================

  return (

    <div
      className="
        max-w-7xl
        mx-auto
        pb-10
      "
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <div
        className="
          mb-6
          rounded-2xl
          bg-gradient-to-r
          from-blue-700
          via-blue-600
          to-cyan-600
          p-6
          text-white
          shadow-lg
        "
      >

        <div
          className="
            flex
            flex-col
            gap-4
            md:flex-row
            md:items-center
            md:justify-between
          "
        >

          <div>

            <p
              className="
                text-sm
                font-semibold
                text-blue-100
              "
            >
              MANVI MILK AGENCIES
            </p>

            <h1
              className="
                mt-1
                text-3xl
                font-bold
              "
            >
              Purchase Entry
            </h1>

            <p
              className="
                mt-2
                text-sm
                text-blue-100
              "
            >
              Enter purchase bill,
              products, payment
              and stock.
            </p>

          </div>

          <div
            className="
              rounded-xl
              bg-white/15
              px-5
              py-4
            "
          >

            <p
              className="
                text-sm
                text-blue-100
              "
            >
              Products in Current Brand
            </p>

            <p
              className="
                text-3xl
                font-bold
              "
            >
              {selectedBrandId
                ? selectedBrandProductCount
                : "—"}
            </p>

          </div>

        </div>

      </div>

      {/* ==================================================
          PURCHASE DETAILS
      ================================================== */}

      <div
        className="
          mb-6
          rounded-2xl
          bg-white
          p-6
          shadow-lg
        "
      >

        <div
          className="
            mb-5
            flex
            items-center
            justify-between
            gap-3
          "
        >

          <div>

            <h2
              className="
                text-xl
                font-bold
                text-slate-800
              "
            >
              Purchase Details
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-slate-500
              "
            >
              Bill and payment
              information.
            </p>

          </div>

          <div
            className="
              rounded-xl
              bg-blue-50
              px-4
              py-3
              text-right
            "
          >

            <p
              className="
                text-xs
                font-semibold
                text-slate-500
              "
            >
              Current Total
            </p>

            <p
              className="
                text-xl
                font-bold
                text-blue-700
              "
            >
              {money(
                totalPurchaseAmount
              )}
            </p>

          </div>

        </div>

        <div
          className="
            grid
            gap-4
            md:grid-cols-2
          "
        >

          {/* DATE */}

          <div>

            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Purchase Date
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={
                purchaseDateDisplay
              }
              onChange={(e) => {
                const formatted =
                  formatDateDDMMYYYYInput(
                    e.target.value
                  );

                setPurchaseDateDisplay(
                  formatted
                );

                const normalized =
                  parseDateDDMMYYYY(
                    formatted
                  );

                if (normalized) {
                  setPurchaseDate(
                    normalized
                  );
                }
              }}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="
                w-full
                rounded-lg
                border
                border-slate-300
                p-3
              "
            />

            <p
              className="
                mt-1
                text-xs
                text-slate-500
              "
            >
              Date format: DD/MM/YYYY
            </p>

          </div>

          {/* INVOICE */}

          <div>

            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Purchase Bill /
              Invoice No.
            </label>

            <input
              type="text"
              value={
                invoiceNo
              }
              onChange={(e) =>
                setInvoiceNo(
                  e.target.value
                )
              }
              placeholder="Example: PUR-00125"
              className="
                w-full
                rounded-lg
                border-2
                border-blue-200
                p-3
                font-semibold
                focus:border-blue-500
                focus:outline-none
              "
            />

          </div>

          {/* SUPPLIER */}

          <div>

            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Company / Supplier
            </label>

            <input
              type="text"
              value={
                supplierName
              }
              onChange={(e) =>
                setSupplierName(
                  e.target.value
                )
              }
              placeholder="Example: Amul"
              className="
                w-full
                rounded-lg
                border
                border-slate-300
                p-3
              "
            />

          </div>

          {/* PAYMENT METHOD */}

          <div>

            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
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
              className="
                w-full
                rounded-lg
                border-2
                border-blue-200
                bg-white
                p-3
                font-semibold
                focus:border-blue-500
                focus:outline-none
              "
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

              <option value="Credit">
                Credit
              </option>

              <option value="Split">
                Split (Cash + UPI)
              </option>

            </select>

          </div>

          {/* PAID / SPLIT */}

          {paymentMethod === "Split" ? (
            <>
              <div>
                <label
                  className="
                    mb-2
                    block
                    text-sm
                    font-semibold
                    text-slate-700
                  "
                >
                  Cash Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) =>
                    setCashAmount(e.target.value)
                  }
                  className="
                    w-full
                    rounded-lg
                    border-2
                    border-green-200
                    bg-white
                    p-3
                    font-bold
                  "
                />
              </div>

              <div>
                <label
                  className="
                    mb-2
                    block
                    text-sm
                    font-semibold
                    text-slate-700
                  "
                >
                  UPI Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={upiAmount}
                  onChange={(e) =>
                    setUpiAmount(e.target.value)
                  }
                  className="
                    w-full
                    rounded-lg
                    border-2
                    border-purple-200
                    bg-white
                    p-3
                    font-bold
                  "
                />

                <p className="mt-1 text-xs text-slate-500">
                  Split Paid: {money(effectivePaidAmount)}
                </p>
              </div>
            </>
          ) : (
            <div>

              <label
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Paid Amount
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(e) =>
                  handlePaidAmountChange(
                    e.target.value
                  )
                }
                disabled={
                  paymentMethod === "Credit"
                }
                className={`
                  w-full
                  rounded-lg
                  border-2
                  p-3
                  font-bold
                  ${
                    paymentMethod === "Credit"
                      ? "bg-slate-100 border-slate-200 text-slate-500"
                      : "bg-white border-green-200"
                  }
                `}
              />

              {paymentMethod === "Credit" && (
                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >
                  Credit purchase:
                  paid amount is automatically ₹0.
                </p>
              )}

            </div>
          )}

          {/* BALANCE */}

          <div>

            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Balance Amount
            </label>

            <div
              className="
                w-full
                rounded-lg
                border-2
                border-orange-200
                bg-orange-50
                p-3
                font-bold
                text-orange-700
              "
            >
              {money(
                purchaseBalance
              )}
            </div>

          </div>

        </div>

      </div>

      {/* ==================================================
          BRAND SELECTOR
      ================================================== */}

      <div
        className="
          mb-6
          rounded-2xl
          bg-white
          p-6
          shadow-lg
        "
      >

        <div
          className="
            mb-4
            flex
            flex-col
            gap-3
            md:flex-row
            md:items-center
            md:justify-between
          "
        >

          <div>

            <h2
              className="
                text-xl
                font-bold
                text-slate-800
              "
            >
              1. Select Brand
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-slate-500
              "
            >
              Select a brand to
              open its products.
            </p>

          </div>

          {selectedBrandId && (

            <div
              className="
                rounded-lg
                bg-blue-50
                px-4
                py-2
                font-bold
                text-blue-700
              "
            >

              {getBrandName(
                selectedBrandId
              )}

              {" — "}

              {
                selectedBrandProductCount
              }{" "}
              Products

            </div>

          )}

        </div>

        <select
          value={
            selectedBrandId
          }
          onChange={(e) =>
            handleBrandChange(
              e.target.value
            )
          }
          className="
            w-full
            rounded-xl
            border-2
            border-blue-200
            bg-white
            p-4
            text-lg
            font-semibold
            focus:border-blue-500
            focus:outline-none
          "
        >

          <option value="">
            Select Brand
          </option>

          {brands.map(
            (brand) => {

              const count =
                products.filter(
                  (
                    product
                  ) =>
                    String(
                      product.brand_id
                    ) ===
                    String(
                      brand.id
                    )
                ).length;

              return (

                <option
                  key={
                    brand.id
                  }
                  value={
                    brand.id
                  }
                >
                  {
                    brand.brand_name
                  }
                  {" — "}
                  {count}
                  {" Products"}
                </option>

              );

            }
          )}

        </select>

      </div>

      {/* ==================================================
          PRODUCT SELECTION
      ================================================== */}

      {selectedBrandId && (

        <div
          className="
            mb-6
            rounded-2xl
            bg-white
            p-6
            shadow-lg
          "
        >

          <div className="mb-5">

            <h2
              className="
                text-xl
                font-bold
                text-slate-800
              "
            >
              2. Select Product
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-slate-500
              "
            >

              {
                getBrandName(
                  selectedBrandId
                )
              }

              {" — "}

              {
                selectedBrandProductCount
              }{" "}
              products available.

            </p>

          </div>

          {brandProducts.length ===
          0 ? (

            <div
              className="
                rounded-xl
                bg-yellow-50
                p-6
                text-center
                text-yellow-800
              "
            >

              No products found
              for this brand.

              <br />

              Please add products
              in Products section
              first.

            </div>

          ) : (

            <div
              className="
                grid
                gap-3
                sm:grid-cols-2
                lg:grid-cols-3
                xl:grid-cols-4
              "
            >

              {brandProducts.map(
                (
                  product
                ) => {

                  const isSelected =
                    String(
                      selectedProductId
                    ) ===
                    String(
                      product.id
                    );

                  const alreadyAdded =
                    purchaseRows.some(
                      (
                        row
                      ) =>
                        String(
                          row.product_id
                        ) ===
                        String(
                          product.id
                        )
                    );

                  return (

                    <button
                      key={
                        product.id
                      }
                      type="button"
                      onClick={() =>
                        handleProductChange(
                          product.id
                        )
                      }
                      className={`
                        rounded-xl
                        border-2
                        p-4
                        text-left
                        transition
                        ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 shadow-md"
                            : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"
                        }
                      `}
                    >

                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-2
                        "
                      >

                        <div>

                          <p
                            className="
                              font-bold
                              text-slate-800
                            "
                          >
                            {
                              product.product_name
                            }
                          </p>

                          <p
                            className="
                              mt-1
                              text-sm
                              text-slate-500
                            "
                          >

                            {Number(
                              product.size ||
                                1
                            )}

                            {" "}

                            {
                              product.unit ||
                              "Litre"
                            }

                          </p>

                        </div>

                        {alreadyAdded && (

                          <span
                            className="
                              rounded-full
                              bg-green-100
                              px-2
                              py-1
                              text-xs
                              font-bold
                              text-green-700
                            "
                          >
                            Added
                          </span>

                        )}

                      </div>

                      <div
                        className="
                          mt-3
                          flex
                          justify-between
                          text-sm
                        "
                      >

                        <span
                          className="
                            text-slate-500
                          "
                        >
                          Purchase
                        </span>

                        <span
                          className="
                            font-bold
                            text-blue-700
                          "
                        >
                          ₹
                          {Number(
                            product.purchase_rate ||
                              0
                          ).toFixed(
                            2
                          )}
                        </span>

                      </div>

                      <div
                        className="
                          mt-1
                          flex
                          justify-between
                          text-sm
                        "
                      >

                        <span
                          className="
                            text-slate-500
                          "
                        >
                          Stock
                        </span>

                        <span
                          className="
                            font-semibold
                            text-green-700
                          "
                        >
                          {Number(
                            product.stock_qty ||
                              0
                          )}
                        </span>

                      </div>

                    </button>

                  );

                }
              )}

            </div>

          )}

        </div>

      )}

      {/* ==================================================
          QUANTITY + RATE
      ================================================== */}

      {selectedProduct && (

        <div
          className="
            mb-6
            rounded-2xl
            border-2
            border-blue-200
            bg-blue-50
            p-6
            shadow-lg
          "
        >

          <div className="mb-5">

            <p
              className="
                text-sm
                font-semibold
                text-blue-600
              "
            >
              Selected Product
            </p>

            <h2
              className="
                mt-1
                text-2xl
                font-bold
                text-slate-800
              "
            >
              {
                selectedProduct.product_name
              }
            </h2>

            <p
              className="
                mt-1
                text-slate-600
              "
            >

              {
                getBrandName(
                  selectedProduct.brand_id
                )
              }

              {" • "}

              {Number(
                selectedProduct.size ||
                  1
              )}

              {" "}

              {
                selectedProduct.unit ||
                  "Litre"
              }

            </p>

          </div>

          <div
            className="
              grid
              gap-4
              md:grid-cols-3
            "
          >

            {/* QUANTITY */}

            <div>

              <label
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Quantity
              </label>

              <input
                type="number"
                min="0.001"
                step="0.001"
                value={
                  quantity
                }
                onChange={(e) =>
                  setQuantity(
                    e.target.value
                  )
                }
                autoFocus
                placeholder="Enter quantity"
                className="
                  w-full
                  rounded-lg
                  border-2
                  border-blue-300
                  bg-white
                  p-4
                  text-lg
                  font-bold
                "
              />

            </div>

            {/* RATE */}

            <div>

              <label
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Purchase Rate
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  rate
                }
                onChange={(e) =>
                  setRate(
                    e.target.value
                  )
                }
                className="
                  w-full
                  rounded-lg
                  border-2
                  border-blue-300
                  bg-white
                  p-4
                  text-lg
                  font-bold
                "
              />

              <p
                className="
                  mt-1
                  text-xs
                  text-slate-500
                "
              >
                Loaded automatically
                from Product Master.
              </p>

            </div>

            {/* ADD */}

            <div
              className="
                flex
                items-end
              "
            >

              <button
                type="button"
                onClick={
                  addPurchaseItem
                }
                className="
                  w-full
                  rounded-lg
                  bg-blue-600
                  px-5
                  py-4
                  text-lg
                  font-bold
                  text-white
                  hover:bg-blue-700
                "
              >
                + Add Product
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ==================================================
          PURCHASE CART
      ================================================== */}

      <div
        className="
          mb-6
          rounded-2xl
          bg-white
          p-6
          shadow-lg
        "
      >

        <div
          className="
            mb-5
            flex
            flex-col
            gap-3
            md:flex-row
            md:items-center
            md:justify-between
          "
        >

          <div>

            <h2
              className="
                text-xl
                font-bold
                text-slate-800
              "
            >
              3. Purchase Products
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-slate-500
              "
            >
              Multiple products
              can be added to the
              same purchase.
            </p>

          </div>

          <div
            className="
              rounded-xl
              bg-blue-50
              px-5
              py-3
            "
          >

            <p
              className="
                text-xs
                font-semibold
                text-slate-500
              "
            >
              Purchase Total
            </p>

            <p
              className="
                text-2xl
                font-bold
                text-blue-700
              "
            >
              {money(
                totalPurchaseAmount
              )}
            </p>

          </div>

        </div>

        {purchaseRows.length ===
        0 ? (

          <div
            className="
              rounded-xl
              border-2
              border-dashed
              border-slate-300
              p-10
              text-center
            "
          >

            <p
              className="
                text-lg
                font-semibold
                text-slate-500
              "
            >
              No products added yet
            </p>

            <p
              className="
                mt-2
                text-sm
                text-slate-400
              "
            >
              Select a brand and
              product above to
              start punching the
              purchase.
            </p>

          </div>

        ) : (

          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className="
                w-full
                min-w-[900px]
                border-collapse
              "
            >

              <thead
                className="
                  bg-slate-800
                  text-white
                "
              >

                <tr>

                  <th className="p-3 text-left">
                    #
                  </th>

                  <th className="p-3 text-left">
                    Product
                  </th>

                  <th className="p-3 text-left">
                    Brand
                  </th>

                  <th className="p-3 text-center">
                    Size
                  </th>

                  <th className="p-3 text-right">
                    Quantity
                  </th>

                  <th className="p-3 text-right">
                    Rate
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

                {purchaseRows.map(
                  (
                    row,
                    index
                  ) => (

                    <tr
                      key={
                        row.product_id
                      }
                      className="
                        border-b
                        hover:bg-slate-50
                      "
                    >

                      <td
                        className="
                          p-3
                          font-semibold
                        "
                      >
                        {index + 1}
                      </td>

                      <td
                        className="
                          p-3
                        "
                      >

                        <p
                          className="
                            font-bold
                            text-blue-700
                          "
                        >
                          {
                            row.product_name
                          }
                        </p>

                      </td>

                      <td
                        className="
                          p-3
                          font-semibold
                          text-slate-600
                        "
                      >
                        {
                          getBrandName(
                            row.brand_id
                          )
                        }
                      </td>

                      <td
                        className="
                          p-3
                          text-center
                        "
                      >

                        {
                          row.size
                        }

                        {" "}

                        {
                          row.unit
                        }

                      </td>

                      <td
                        className="
                          p-3
                          text-right
                          font-semibold
                        "
                      >
                        {
                          row.quantity
                        }
                      </td>

                      <td
                        className="
                          p-3
                          text-right
                        "
                      >
                        ₹
                        {
                          row.rate.toFixed(
                            2
                          )
                        }
                      </td>

                      <td
                        className="
                          p-3
                          text-right
                          font-bold
                        "
                      >
                        ₹
                        {
                          row.amount.toFixed(
                            2
                          )
                        }
                      </td>

                      <td
                        className="
                          p-3
                          text-center
                        "
                      >

                        <button
                          type="button"
                          onClick={() =>
                            removePurchaseItem(
                              row.product_id
                            )
                          }
                          className="
                            rounded-lg
                            bg-red-600
                            px-3
                            py-2
                            font-semibold
                            text-white
                            hover:bg-red-700
                          "
                        >
                          Remove
                        </button>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

              <tfoot>

                <tr
                  className="
                    bg-blue-50
                    font-bold
                  "
                >

                  <td
                    colSpan={
                      4
                    }
                    className="
                      p-4
                      text-right
                    "
                  >
                    TOTAL
                  </td>

                  <td
                    className="
                      p-4
                      text-right
                      text-blue-700
                    "
                  >
                    {
                      totalPurchaseQuantity
                    }
                  </td>

                  <td
                    className="
                      p-4
                      text-right
                    "
                  >
                    -
                  </td>

                  <td
                    className="
                      p-4
                      text-right
                      text-xl
                      text-blue-700
                    "
                  >
                    {money(
                      totalPurchaseAmount
                    )}
                  </td>

                  <td />

                </tr>

              </tfoot>

            </table>

          </div>

        )}

      </div>

      {/* ==================================================
          PAYMENT SUMMARY
      ================================================== */}

      <div
        className="
          mb-6
          rounded-2xl
          bg-white
          p-6
          shadow-lg
        "
      >

        <h2
          className="
            mb-5
            text-xl
            font-bold
            text-slate-800
          "
        >
          4. Payment Summary
        </h2>

        <div
          className="
            grid
            grid-cols-1
            gap-4
            md:grid-cols-3
          "
        >

          <div
            className="
              rounded-xl
              bg-blue-50
              p-5
            "
          >

            <p
              className="
                text-sm
                text-slate-500
              "
            >
              Total Purchase
            </p>

            <p
              className="
                mt-1
                text-2xl
                font-bold
                text-blue-700
              "
            >
              {money(
                totalPurchaseAmount
              )}
            </p>

          </div>

          <div
            className="
              rounded-xl
              bg-green-50
              p-5
            "
          >

            <p
              className="
                text-sm
                text-slate-500
              "
            >
              Paid Amount
            </p>

            <p
              className="
                mt-1
                text-2xl
                font-bold
                text-green-700
              "
            >
              {money(
                effectivePaidAmount
              )}
            </p>

          </div>

          <div
            className="
              rounded-xl
              bg-orange-50
              p-5
            "
          >

            <p
              className="
                text-sm
                text-slate-500
              "
            >
              Supplier Balance
            </p>

            <p
              className="
                mt-1
                text-2xl
                font-bold
                text-orange-700
              "
            >
              {money(
                purchaseBalance
              )}
            </p>

          </div>

        </div>

      </div>

      {/* ==================================================
          SAVE PURCHASE
      ================================================== */}

      <div
        className="
          mb-10
          rounded-2xl
          bg-white
          p-6
          shadow-lg
        "
      >

        <div
          className="
            flex
            flex-col
            gap-3
            md:flex-row
            md:items-center
            md:justify-between
          "
        >

          <div>

            <p
              className="
                text-sm
                text-slate-500
              "
            >
              Products in this
              purchase
            </p>

            <p
              className="
                text-2xl
                font-bold
                text-slate-800
              "
            >
              {
                purchaseRows.length
              }
            </p>

          </div>

          <div
            className="
              flex
              flex-col
              gap-3
              sm:flex-row
            "
          >

            <button
              type="button"
              onClick={
                clearPurchase
              }
              disabled={
                saving
              }
              className="
                rounded-lg
                bg-slate-500
                px-6
                py-3
                font-bold
                text-white
                hover:bg-slate-600
                disabled:opacity-50
              "
            >
              Clear Purchase
            </button>

            <button
              type="button"
              onClick={
                savePurchase
              }
              disabled={
                saving ||
                purchaseRows.length ===
                  0
              }
              className="
                rounded-lg
                bg-green-600
                px-8
                py-3
                font-bold
                text-white
                shadow-lg
                hover:bg-green-700
                disabled:opacity-50
              "
            >
              {saving
                ? "Saving Purchase..."
                : "✓ Punch / Save Purchase"}
            </button>

          </div>

        </div>

      </div>

      {/* ==================================================
          RECENT PURCHASES
      ================================================== */}

      <div
        className="
          rounded-2xl
          bg-white
          p-6
          shadow-lg
        "
      >

        <div
          className="
            mb-5
          "
        >

          <h2
            className="
              text-xl
              font-bold
              text-slate-800
            "
          >
            Recent Purchases
          </h2>

          <p
            className="
              mt-1
              text-sm
              text-slate-500
            "
          >
            Latest 20 purchase
            entries.
          </p>

        </div>

        {historyLoading ? (

          <div
            className="
              p-8
              text-center
              text-slate-500
            "
          >
            Loading purchase
            history...
          </div>

        ) : purchaseHistory.length ===
          0 ? (

          <div
            className="
              rounded-xl
              bg-slate-50
              p-8
              text-center
              text-slate-500
            "
          >
            No purchase entries
            found.
          </div>

        ) : (

          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className="
                w-full
                min-w-[1100px]
              "
            >

              <thead
                className="
                  bg-red-600
                  text-white
                "
              >

                <tr>

                  <th
                    className="
                      p-3
                      text-left
                    "
                  >
                    Date
                  </th>

                  <th
                    className="
                      p-3
                      text-left
                    "
                  >
                    Invoice No.
                  </th>

                  <th
                    className="
                      p-3
                      text-left
                    "
                  >
                    Company / Supplier
                  </th>

                  <th
                    className="
                      p-3
                      text-left
                    "
                  >
                    Payment
                  </th>

                  <th
                    className="
                      p-3
                      text-right
                    "
                  >
                    Total
                  </th>

                  <th
                    className="
                      p-3
                      text-right
                    "
                  >
                    Paid
                  </th>

                  <th
                    className="
                      p-3
                      text-right
                    "
                  >
                    Balance
                  </th>

                </tr>

              </thead>

              <tbody>

                {purchaseHistory.map(
                  (
                    purchase
                  ) => (

                    <tr
                      key={
                        purchase.id
                      }
                      className="
                        border-b
                        hover:bg-slate-50
                      "
                    >

                      <td
                        className="
                          p-3
                        "
                      >
                        {formatDate(
                          purchase.purchase_date
                        )}
                      </td>

                      <td
                        className="
                          p-3
                          font-bold
                          text-blue-700
                        "
                      >
                        {
                          purchase.invoice_no ||
                          "-"
                        }
                      </td>

                      <td
                        className="
                          p-3
                          font-semibold
                          text-slate-700
                        "
                      >
                        {
                          purchase.supplier_name ||
                          "-"
                        }
                      </td>

                      <td
                        className="
                          p-3
                        "
                      >

                        <span
                          className={`
                            inline-flex
                            rounded-full
                            px-3
                            py-1
                            text-xs
                            font-bold
                            ${
                              purchase.payment_method ===
                              "Cash"
                                ? "bg-green-100 text-green-700"
                                : purchase.payment_method ===
                                  "UPI"
                                ? "bg-purple-100 text-purple-700"
                                : purchase.payment_method ===
                                  "Bank"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-orange-100 text-orange-700"
                            }
                          `}
                        >
                          {
                            purchase.payment_method ||
                            "Credit"
                          }
                        </span>

                        {purchase.payment_method === "Split" && (
                          <div className="mt-1 text-xs text-slate-500">
                            Cash {money(purchase.cash_amount)} + UPI {money(purchase.upi_amount)}
                          </div>
                        )}

                      </td>

                      <td
                        className="
                          p-3
                          text-right
                          font-bold
                          text-red-600
                        "
                      >
                        {money(
                          purchase.total_amount
                        )}
                      </td>

                      <td
                        className="
                          p-3
                          text-right
                          font-bold
                          text-green-600
                        "
                      >
                        {money(
                          purchase.paid_amount
                        )}
                      </td>

                      <td
                        className="
                          p-3
                          text-right
                          font-bold
                          text-orange-600
                        "
                      >
                        {money(
                          purchase.balance_amount
                        )}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

      {/* ==================================================
          LOADING
      ================================================== */}

      {loading && (

        <div
          className="
            mt-4
            rounded-lg
            bg-blue-50
            p-3
            text-center
            text-sm
            font-semibold
            text-blue-700
          "
        >
          Loading products...
        </div>

      )}

    </div>

  );
}