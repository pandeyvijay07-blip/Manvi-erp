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

type Supplier = {
  id: string;
  supplier_name: string;
  opening_balance?: number | string | null;
};

type SupplierProductLink = {
  supplier_id: string;
  product_id: string;
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
  const roundedValue = Math.round(Number(value || 0));

  return `₹ ${roundedValue.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 0,
    }
  )}`;
}

function generatePurchaseInvoiceNo() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `MANVI-PUR-${datePart}-${timePart}-${randomPart}`;
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
    suppliers,
    setSuppliers,
  ] =
    useState<Supplier[]>([]);

  // Supplier balance is calculated using the same ledger formula as
  // Suppliers.tsx: opening balance + unpaid purchases - supplier payments.
  const [supplierOutstandingById, setSupplierOutstandingById] =
    useState<Record<string, number>>({});
  const [supplierBalancesLoading, setSupplierBalancesLoading] =
    useState(false);
  const [supplierBalancesError, setSupplierBalancesError] =
    useState("");

  // When editing, remove the old purchase balance from the preview so the
  // screen shows the balance BEFORE the edited bill is applied.
  const [editingOriginalSupplierName, setEditingOriginalSupplierName] =
    useState("");
  const [editingOriginalPurchaseBalance, setEditingOriginalPurchaseBalance] =
    useState(0);

  const [
    products,
    setProducts,
  ] =
    useState<Product[]>([]);

  const [
    supplierProductLinks,
    setSupplierProductLinks,
  ] =
    useState<SupplierProductLink[]>([]);

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

  const [copyPurchaseDate, setCopyPurchaseDate] = useState(() => {
    const date = new Date(`${todayInput()}T00:00:00`);
    date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });

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
    editingPurchaseId,
    setEditingPurchaseId,
  ] =
    useState<string | null>(null);

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

  // Fast-entry rate overrides used by the supplier product table.
  // Product Master purchase_rate remains unchanged until a purchase is saved.
  const [
    purchaseRateOverrides,
    setPurchaseRateOverrides,
  ] =
    useState<Record<string, string>>({});

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

    loadSuppliers();

    loadProducts();

    loadSupplierProductLinks();

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
  // LOAD SUPPLIERS
  // ====================================================

  async function loadSuppliers() {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, supplier_name, opening_balance")
        .order("supplier_name");

      if (error) throw error;

      const supplierRows = (data || []) as Supplier[];
      setSuppliers(supplierRows);
      await loadSupplierOutstanding(supplierRows);
    } catch (error: any) {
      console.error("LOAD SUPPLIERS ERROR:", error);
      alert(
        "Unable to load suppliers:\n\n" +
          (error?.message || "Unknown error")
      );
    }
  }

  // ====================================================
  // LOAD SUPPLIER OUTSTANDING (SAME FORMULA AS SUPPLIERS PAGE)
  // ====================================================

  async function loadSupplierOutstanding(supplierRows: Supplier[] = suppliers) {
    setSupplierBalancesLoading(true);
    setSupplierBalancesError("");

    try {
      const [purchaseResult, paymentResult] = await Promise.all([
        supabase
          .from("purchases")
          .select("supplier_name, total_amount, paid_amount"),
        supabase
          .from("supplier_payments")
          .select("supplier_id, amount"),
      ]);

      if (purchaseResult.error) throw purchaseResult.error;
      if (paymentResult.error) throw paymentResult.error;

      const purchaseOutstandingByName = new Map<string, number>();
      (purchaseResult.data || []).forEach((purchase: any) => {
        const key = String(purchase.supplier_name || "")
          .trim()
          .toLowerCase();
        if (!key) return;

        const total = Number(purchase.total_amount || 0);
        const paid = Number(purchase.paid_amount || 0);
        const unpaid = Math.max(total - paid, 0);
        purchaseOutstandingByName.set(
          key,
          (purchaseOutstandingByName.get(key) || 0) + unpaid
        );
      });

      const supplierPaymentsById = new Map<string, number>();
      (paymentResult.data || []).forEach((payment: any) => {
        const key = String(payment.supplier_id || "");
        if (!key) return;
        supplierPaymentsById.set(
          key,
          (supplierPaymentsById.get(key) || 0) + Number(payment.amount || 0)
        );
      });

      const nextBalances: Record<string, number> = {};
      supplierRows.forEach((supplier) => {
        const supplierId = String(supplier.id);
        const supplierNameKey = String(supplier.supplier_name || "")
          .trim()
          .toLowerCase();
        const opening = Number(supplier.opening_balance || 0);
        const unpaidPurchases = purchaseOutstandingByName.get(supplierNameKey) || 0;
        const supplierPayments = supplierPaymentsById.get(supplierId) || 0;

        // Positive = payable; negative = supplier credit/advance.
        nextBalances[supplierId] = opening + unpaidPurchases - supplierPayments;
      });

      setSupplierOutstandingById(nextBalances);
    } catch (error: any) {
      console.error("LOAD SUPPLIER OUTSTANDING ERROR:", error);
      setSupplierBalancesError(
        error?.message || "Unable to calculate supplier outstanding."
      );
    } finally {
      setSupplierBalancesLoading(false);
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
  // LOAD SUPPLIER -> PRODUCT CONNECTIONS
  // ====================================================

  async function loadSupplierProductLinks() {
    try {
      const { data, error } = await supabase
        .from("supplier_products")
        .select("supplier_id, product_id");

      if (error) throw error;

      setSupplierProductLinks(
        (data || []) as SupplierProductLink[]
      );
    } catch (error: any) {
      console.error("LOAD SUPPLIER PRODUCT LINKS ERROR:", error);
      alert(
        "Unable to load supplier-product connections:\n\n" +
          (error?.message || "Unknown error")
      );
    }
  }

  // ====================================================
  // SELECTED SUPPLIER / ALLOWED PRODUCTS
  // ====================================================

  const selectedSupplierId = useMemo(() => {
    const supplier = suppliers.find(
      (item) =>
        String(item.supplier_name).trim().toLowerCase() ===
        String(supplierName).trim().toLowerCase()
    );

    return supplier?.id || "";
  }, [suppliers, supplierName]);

  const allowedProductIds = useMemo(() => {
    if (!selectedSupplierId) return new Set<string>();

    return new Set(
      supplierProductLinks
        .filter(
          (link) => String(link.supplier_id) === String(selectedSupplierId)
        )
        .map((link) => String(link.product_id))
    );
  }, [supplierProductLinks, selectedSupplierId]);

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
              balance_amount
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

      // Once the supplier's linked brand is opened, show ALL products
      // belonging to that brand. The supplier_products mapping decides
      // which brand opens for the supplier; it does not hide products
      // belonging to that already-selected brand.
      return products.filter(
        (product) =>
          String(product.brand_id) === String(selectedBrandId)
      );

    }, [
      products,
      selectedBrandId,
    ]);

  // ====================================================
  // BRANDS AVAILABLE FOR SELECTED SUPPLIER
  // ====================================================

  const supplierBrands = useMemo(() => {
    if (!selectedSupplierId) return [];

    const linkedProductIds = new Set(
      supplierProductLinks
        .filter(
          (link) => String(link.supplier_id) === String(selectedSupplierId)
        )
        .map((link) => String(link.product_id))
    );

    const brandIds = new Set(
      products
        .filter((product) => linkedProductIds.has(String(product.id)))
        .map((product) => String(product.brand_id || ""))
        .filter(Boolean)
    );

    return brands.filter((brand) => brandIds.has(String(brand.id)));
  }, [brands, products, supplierProductLinks, selectedSupplierId]);

  // ====================================================
  // AUTO OPEN SUPPLIER'S LINKED BRAND
  // ====================================================

  useEffect(() => {
    if (!selectedSupplierId) {
      setSelectedBrandId("");
      setSelectedProductId("");
      setQuantity("");
      setRate("");
      return;
    }

    // Automatically open the first brand linked to this supplier.
    // For the normal dairy setup, a supplier is linked to one brand.
    const firstBrand = supplierBrands[0];

    if (!firstBrand) {
      setSelectedBrandId("");
      setSelectedProductId("");
      setQuantity("");
      setRate("");
      return;
    }

    setSelectedBrandId(String(firstBrand.id));
    setSelectedProductId("");
    setQuantity("");
    setRate("");
  }, [selectedSupplierId, supplierBrands]);

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
  // ENSURE SUPPLIER -> PRODUCT CONNECTION
  // ====================================================

  async function ensureSupplierProductLink(productId: string) {
    if (!selectedSupplierId || !productId) {
      return;
    }

    const alreadyLinked = supplierProductLinks.some(
      (link) =>
        String(link.supplier_id) === String(selectedSupplierId) &&
        String(link.product_id) === String(productId)
    );

    if (alreadyLinked) {
      return;
    }

    const { error } = await supabase
      .from("supplier_products")
      .upsert(
        {
          supplier_id: selectedSupplierId,
          product_id: productId,
        },
        {
          onConflict: "supplier_id,product_id",
        }
      );

    if (error) {
      throw error;
    }

    setSupplierProductLinks((previous) => [
      ...previous,
      {
        supplier_id: selectedSupplierId,
        product_id: productId,
      },
    ]);
  }

  // ====================================================
  // ADD PURCHASE ITEM
  // ====================================================

  async function addPurchaseItem() {

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

    if (!selectedSupplierId) {
      alert("Please select a supplier first.");
      return;
    }

    try {
      // If a product under the automatically opened brand is purchased
      // for this supplier, keep the supplier -> product connection.
      await ensureSupplierProductLink(selectedProduct.id);
    } catch (error: any) {
      console.error("AUTO LINK SUPPLIER PRODUCT ERROR:", error);
      alert(
        "Product could not be linked to this supplier.\\n\\n" +
          (error?.message || "Unable to create supplier-product connection.")
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
  // FAST PURCHASE TABLE HELPERS
  // ====================================================

  function getFastPurchaseRow(productId: string) {
    return purchaseRows.find(
      (row) => String(row.product_id) === String(productId)
    );
  }

  function getFastPurchaseRate(product: Product) {
    const override = purchaseRateOverrides[String(product.id)];

    if (override !== undefined && override !== "") {
      return Number(override) || 0;
    }

    const existingRow = getFastPurchaseRow(product.id);

    if (existingRow) {
      return Number(existingRow.rate || 0);
    }

    return Number(product.purchase_rate || 0);
  }

  async function handleFastQuantityChange(
    product: Product,
    value: string
  ) {
    const cleaned = value.replace(/[^0-9.]/g, "");

    if (cleaned === "") {
      setPurchaseRows((previous) =>
        previous.filter(
          (row) => String(row.product_id) !== String(product.id)
        )
      );
      return;
    }

    const numericQuantity = Number(cleaned);

    if (!Number.isFinite(numericQuantity) || numericQuantity < 0) {
      return;
    }

    if (numericQuantity === 0) {
      setPurchaseRows((previous) =>
        previous.filter(
          (row) => String(row.product_id) !== String(product.id)
        )
      );
      return;
    }

    const numericRate = getFastPurchaseRate(product);
    const amount = numericQuantity * numericRate;

    setPurchaseRows((previous) => {
      const existingIndex = previous.findIndex(
        (row) => String(row.product_id) === String(product.id)
      );

      if (existingIndex >= 0) {
        const updated = [...previous];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: numericQuantity,
          rate: numericRate,
          amount,
        };
        return updated;
      }

      return [
        ...previous,
        {
          product_id: product.id,
          product_name: product.product_name,
          size: Number(product.size || 1),
          unit: product.unit || "Litre",
          quantity: numericQuantity,
          rate: numericRate,
          amount,
          brand_id: product.brand_id,
        },
      ];
    });

    // Keep the existing supplier -> product mapping behavior.
    if (selectedSupplierId) {
      try {
        await ensureSupplierProductLink(product.id);
      } catch (error: any) {
        console.error("FAST PURCHASE SUPPLIER LINK ERROR:", error);
        alert(
          "Product could not be linked to this supplier.\n\n" +
            (error?.message || "Unable to create supplier-product connection.")
        );
      }
    }
  }

  function handleFastRateChange(
    product: Product,
    value: string
  ) {
    const cleaned = value.replace(/[^0-9.]/g, "");

    setPurchaseRateOverrides((previous) => ({
      ...previous,
      [String(product.id)]: cleaned,
    }));

    const numericRate = Number(cleaned || 0);

    setPurchaseRows((previous) => {
      const existingIndex = previous.findIndex(
        (row) => String(row.product_id) === String(product.id)
      );

      if (existingIndex < 0) {
        return previous;
      }

      const updated = [...previous];
      const existing = updated[existingIndex];
      updated[existingIndex] = {
        ...existing,
        rate: numericRate,
        amount: Number(existing.quantity || 0) * numericRate,
      };
      return updated;
    });
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
  // COPY YESTERDAY'S PURCHASE
  // ====================================================

  async function copyYesterdayPurchase() {
    setLoading(true);
    setPurchaseRateOverrides({});

    try {
      const selectedCopyDate = copyPurchaseDate;
      if (!selectedCopyDate) {
        alert("Please select a purchase date to repeat.");
        return;
      }

      // If a product is already selected, repeat ONLY that selected product
      // from the selected date. This prevents a different product from appearing.
      const selectedProductForCopy = selectedProductId
        ? products.find(
            (productItem) =>
              String(productItem.id) === String(selectedProductId)
          )
        : null;

      if (selectedProductId && !selectedProductForCopy) {
        alert("Selected product was not found.");
        return;
      }

      const { data: yesterdayPurchases, error: purchaseError } =
        await supabase
          .from("purchases")
          .select(`
            id,
            purchase_date,
            invoice_no,
            supplier_name,
            total_amount,
            payment_method,
            paid_amount,
            balance_amount
          `)
          .eq("purchase_date", selectedCopyDate)
          .order("id", { ascending: true });

      if (purchaseError) {
        throw purchaseError;
      }

      if (!yesterdayPurchases || yesterdayPurchases.length === 0) {
        alert(
          `No purchase was found on ${formatDate(selectedCopyDate)}.`
        );
        return;
      }

      // If a supplier is selected, copy only that supplier's purchase.
      // This prevents products from another supplier/brand from appearing.
      const purchasesForCopy = supplierName.trim()
        ? (yesterdayPurchases as any[]).filter(
            (purchase) =>
              String(purchase.supplier_name || "").trim().toLowerCase() ===
              supplierName.trim().toLowerCase()
          )
        : (yesterdayPurchases as any[]);

      if (purchasesForCopy.length === 0) {
        alert(
          `No purchase for supplier "${supplierName.trim()}" was found on ${formatDate(selectedCopyDate)}.`
        );
        return;
      }

      const purchaseIds = purchasesForCopy
        .map((purchase: any) => purchase.id)
        .filter(Boolean);

      const { data: yesterdayItems, error: itemsError } =
        await supabase
          .from("purchase_items")
          .select(`
            purchase_id,
            product_id,
            quantity,
            rate,
            amount
          `)
          .in("purchase_id", purchaseIds);

      if (itemsError) {
        throw itemsError;
      }

      if (!yesterdayItems || yesterdayItems.length === 0) {
        alert(
          `Selected-date purchases (${formatDate(selectedCopyDate)}) have no product items.`
        );
        return;
      }

      // When a product is selected, only use selected-date rows for that
      // exact product_id. Otherwise, copy all products from the selected date.
      const sourceItems = selectedProductForCopy
        ? (yesterdayItems as any[]).filter(
            (item) =>
              String(item.product_id) ===
              String(selectedProductForCopy.id)
          )
        : (yesterdayItems as any[]);

      if (sourceItems.length === 0) {
        alert(
          `${selectedProductForCopy?.product_name || "Selected product"} was not purchased on ${formatDate(selectedCopyDate)}.`
        );
        return;
      }

      // Merge repeated occurrences of the same product.
      const merged = new Map<string, PurchaseRow>();

      for (const item of sourceItems) {
        const product = products.find(
          (productItem) =>
            String(productItem.id) === String(item.product_id)
        );

        if (!product) {
          continue;
        }

        const productId = String(product.id);
        const copiedQuantity = Number(item.quantity || 0);
        const copiedRate = Number(item.rate || 0);

        if (copiedQuantity <= 0) {
          continue;
        }

        const existing = merged.get(productId);

        if (existing) {
          existing.quantity += copiedQuantity;
          if (copiedRate > 0) {
            existing.rate = copiedRate;
          }
          existing.amount = existing.quantity * existing.rate;
        } else {
          const finalRate =
            copiedRate || Number(product.purchase_rate || 0);

          merged.set(productId, {
            product_id: product.id,
            product_name: product.product_name,
            size: Number(product.size || 1),
            unit: product.unit || "Litre",
            quantity: copiedQuantity,
            rate: finalRate,
            amount: copiedQuantity * finalRate,
            brand_id: product.brand_id,
          });
        }
      }

      const copiedRows = Array.from(merged.values());

      if (copiedRows.length === 0) {
        alert(
          `${selectedProductForCopy?.product_name || "Selected-date products"} could not be found in the product master.`
        );
        return;
      }

      // If a product was selected, add/replace only that product in the
      // current purchase cart. If no product was selected, replace with
      // the complete previous-day product list.
      if (selectedProductForCopy) {
        setPurchaseRows((previous) => {
          const copiedRow = copiedRows[0];

          const existingIndex = previous.findIndex(
            (row) =>
              String(row.product_id) === String(copiedRow.product_id)
          );

          if (existingIndex >= 0) {
            const updated = [...previous];
            updated[existingIndex] = copiedRow;
            return updated;
          }

          return [...previous, copiedRow];
        });

        // Keep the selected Chitale Jeevan (or selected product) visible
        // after copying. Load its selected-date quantity and rate into the
        // entry fields as well.
        setSelectedBrandId(String(selectedProductForCopy.brand_id || ""));
        setSelectedProductId(String(selectedProductForCopy.id));
        setQuantity(String(copiedRows[0].quantity));
        setRate(String(copiedRows[0].rate));
      } else {
        setPurchaseRows(copiedRows);

        setSelectedBrandId("");
        setSelectedProductId("");
        setQuantity("");
        setRate("");
      }

      const latestPurchase =
        purchasesForCopy[purchasesForCopy.length - 1] as any;

      if (latestPurchase?.supplier_name && !supplierName) {
        setSupplierName(String(latestPurchase.supplier_name));
      }

      setEditingPurchaseId(null);

      alert(
        selectedProductForCopy
          ? `${selectedProductForCopy.product_name} repeated from ${formatDate(selectedCopyDate)}.`
          : `${copiedRows.length} product(s) repeated from ${formatDate(selectedCopyDate)}.`
      );
    } catch (error: any) {
      console.error("COPY PURCHASE ERROR:", error);
      alert(
        "Unable to repeat purchase:\n\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  // ====================================================
  // CLEAR PURCHASE
  // ====================================================

  function clearPurchase() {

    setEditingPurchaseId(null);
    setEditingOriginalSupplierName("");
    setEditingOriginalPurchaseBalance(0);

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

    setPurchaseRateOverrides({});

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

  // ====================================================
  // PURCHASE BALANCE
  // ====================================================

  const purchaseBalance =
    Math.max(
      0,
      totalPurchaseAmount -
        (
          Number.isFinite(
            numericPaidAmount
          )
            ? numericPaidAmount
            : 0
        )
    );

  // Previous supplier position excludes the old balance of the bill being
  // edited. The projected position then adds the new unpaid bill amount.
  const selectedSupplierOutstanding = selectedSupplierId
    ? Number(supplierOutstandingById[selectedSupplierId] || 0)
    : 0;

  const previousSupplierOutstanding =
    editingPurchaseId &&
    editingOriginalSupplierName.trim().toLowerCase() ===
      supplierName.trim().toLowerCase()
      ? selectedSupplierOutstanding - editingOriginalPurchaseBalance
      : selectedSupplierOutstanding;

  const projectedSupplierOutstanding =
    previousSupplierOutstanding + purchaseBalance;

  function formatSupplierPosition(value: number) {
    if (value < -0.005) return `Credit ${money(Math.abs(value))}`;
    return money(Math.max(value, 0));
  }

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

      setPaidAmount(
        "0"
      );

      return;
    }

    // If switching from Credit,
    // automatically suggest full payment.
    if (
      totalPurchaseAmount > 0
    ) {

      setPaidAmount(
        totalPurchaseAmount.toFixed(
          2
        )
      );

    }

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
  // EDIT PURCHASE
  // ====================================================

  async function editPurchase(purchaseId: string) {
    setLoading(true);

    try {
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .select(`
          id,
          purchase_date,
          invoice_no,
          supplier_name,
          total_amount,
          payment_method,
          paid_amount,
          balance_amount
        `)
        .eq("id", purchaseId)
        .single();

      if (purchaseError) throw purchaseError;

      const { data: items, error: itemsError } = await supabase
        .from("purchase_items")
        .select("product_id, quantity, rate, amount")
        .eq("purchase_id", purchaseId);

      if (itemsError) throw itemsError;

      const rows: PurchaseRow[] = (items || [])
        .map((item: any) => {
          const product = products.find(
            (p) => String(p.id) === String(item.product_id)
          );

          if (!product) return null;

          return {
            product_id: product.id,
            product_name: product.product_name,
            size: Number(product.size || 1),
            unit: product.unit || "Litre",
            quantity: Number(item.quantity || 0),
            rate: Number(item.rate || 0),
            amount: Number(item.amount || 0),
            brand_id: product.brand_id,
          };
        })
        .filter((row): row is PurchaseRow => !!row);

      setEditingPurchaseId(purchase.id);
      setEditingOriginalSupplierName(String(purchase.supplier_name || ""));
      setEditingOriginalPurchaseBalance(
        Math.max(
          Number(purchase.total_amount || 0) - Number(purchase.paid_amount || 0),
          0
        )
      );
      const date = String(purchase.purchase_date || "").slice(0, 10);
      setPurchaseDate(date || todayInput());
      setPurchaseDateDisplay(formatDate(date || todayInput()));
      setInvoiceNo(purchase.invoice_no || "");
      setSupplierName(purchase.supplier_name || "");
      setPaymentMethod(purchase.payment_method || "Credit");
      setPaidAmount(
        purchase.paid_amount == null
          ? "0"
          : String(Number(purchase.paid_amount))
      );
      setPurchaseRows(rows);
      setPurchaseRateOverrides({});
      setSelectedBrandId("");
      setSelectedProductId("");
      setQuantity("");
      setRate("");

      window.scrollTo({ top: 0, behavior: "smooth" });
      alert("Purchase loaded for editing. Make changes and press Update Purchase.");
    } catch (error: any) {
      console.error("EDIT PURCHASE ERROR:", error);
      alert(
        "Unable to edit purchase:\n\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  // ====================================================
  // VIEW / PRINT PURCHASE BILL
  // ====================================================

  async function viewPurchaseBill(purchaseId: string) {
    const billWindow = window.open("", "_blank");
    if (!billWindow) {
      alert("Please allow pop-ups to view or print the purchase bill.");
      return;
    }

    billWindow.document.write("<p style='font-family:Arial;padding:24px'>Loading purchase bill...</p>");

    try {
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .select("id, purchase_date, invoice_no, supplier_name, total_amount, payment_method, paid_amount, balance_amount")
        .eq("id", purchaseId)
        .single();
      if (purchaseError) throw purchaseError;

      const { data: items, error: itemsError } = await supabase
        .from("purchase_items")
        .select("product_id, quantity, rate, amount")
        .eq("purchase_id", purchaseId);
      if (itemsError) throw itemsError;

      const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
      const rows = (items || []).map((item: any, index: number) => {
        const product = products.find((entry) => String(entry.id) === String(item.product_id));
        return `<tr><td>${index + 1}</td><td>${escapeHtml(product?.product_name || "Product")}</td><td>${Number(item.quantity || 0).toLocaleString("en-IN")}</td><td>₹${Number(item.rate || 0).toFixed(2)}</td><td>₹${Number(item.amount || 0).toFixed(2)}</td></tr>`;
      }).join("");

      billWindow.document.open();
      billWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(purchase.invoice_no || "Purchase Bill")}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#172033;margin:24px} .wrap{max-width:800px;margin:auto}.top{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #1d4ed8;padding-bottom:14px}h1{margin:0;color:#1d4ed8;font-size:24px}h2{margin:0 0 8px;font-size:18px}p{margin:6px 0}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #cbd5e1;padding:10px;text-align:right}th:nth-child(1),td:nth-child(1),th:nth-child(2),td:nth-child(2){text-align:left}th{background:#eff6ff}.summary{margin:22px 0 0 auto;max-width:320px}.summary p{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0}.actions{margin-top:24px;text-align:right}button{background:#1d4ed8;color:white;border:0;border-radius:6px;padding:10px 18px;font-weight:bold}@media print{.actions{display:none}body{margin:10mm}}</style></head><body><div class="wrap"><div class="top"><div><h1>MANVI MILK AGENCIES</h1><p>Purchase Bill</p></div><div><h2>${escapeHtml(purchase.invoice_no || "-")}</h2><p>Date: ${escapeHtml(formatDate(purchase.purchase_date))}</p></div></div><p><strong>Supplier:</strong> ${escapeHtml(purchase.supplier_name || "-")}</p><table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows || "<tr><td colspan='5'>No items found</td></tr>"}</tbody></table><div class="summary"><p><strong>Total</strong><strong>${escapeHtml(money(purchase.total_amount))}</strong></p><p><span>Payment</span><strong>${escapeHtml(purchase.payment_method || "Credit")}</strong></p><p><span>Paid</span><strong>${escapeHtml(money(purchase.paid_amount))}</strong></p><p><span>Balance</span><strong>${escapeHtml(money(purchase.balance_amount))}</strong></p></div><div class="actions"><button onclick="window.print()">Print Bill</button></div></div></body></html>`);
      billWindow.document.close();
      billWindow.focus();
    } catch (error: any) {
      billWindow.close();
      console.error("VIEW PURCHASE BILL ERROR:", error);
      alert("Unable to open purchase bill:\n\n" + (error?.message || "Unknown error"));
    }
  }

  // ====================================================
  // DELETE PURCHASE
  // ====================================================

  async function deletePurchase(purchaseId: string) {
    const confirmed = window.confirm(
      "Delete this purchase?\n\nThe purchase items will be removed and the stock added by this purchase will be restored."
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { data: items, error: itemsError } = await supabase
        .from("purchase_items")
        .select("product_id, quantity")
        .eq("purchase_id", purchaseId);

      if (itemsError) throw itemsError;

      const restoreMap = new Map<string, number>();
      (items || []).forEach((item: any) => {
        const current = restoreMap.get(String(item.product_id)) || 0;
        restoreMap.set(
          String(item.product_id),
          current + Number(item.quantity || 0)
        );
      });

      for (const [productId, quantityToRestore] of restoreMap) {
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("id, stock_qty")
          .eq("id", productId)
          .single();

        if (productError) throw productError;

        const currentStock = Number(product?.stock_qty || 0);
        const newStock = Math.max(0, currentStock - quantityToRestore);

        const { error: stockError } = await supabase
          .from("products")
          .update({ stock_qty: newStock })
          .eq("id", productId);

        if (stockError) throw stockError;
      }

      const { error: deleteItemsError } = await supabase
        .from("purchase_items")
        .delete()
        .eq("purchase_id", purchaseId);

      if (deleteItemsError) throw deleteItemsError;

      const { error: deletePurchaseError } = await supabase
        .from("purchases")
        .delete()
        .eq("id", purchaseId);

      if (deletePurchaseError) throw deletePurchaseError;

      if (editingPurchaseId === purchaseId) {
        clearPurchase();
      }

      await loadProducts();
      await loadPurchaseHistory();
      await loadSupplierOutstanding(suppliers);

      alert("Purchase deleted successfully.");
    } catch (error: any) {
      console.error("DELETE PURCHASE ERROR:", error);
      alert(
        "Unable to delete purchase:\n\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  // ====================================================
  // UPDATE PURCHASE
  // ====================================================

  async function updatePurchase() {
    if (!editingPurchaseId) {
      return;
    }

    const normalizedPurchaseDate = parseDateDDMMYYYY(purchaseDateDisplay);
    if (!normalizedPurchaseDate) {
      alert("Please enter a valid purchase date in DD/MM/YYYY format.");
      return;
    }

    const cleanInvoice = invoiceNo.trim() || generatePurchaseInvoiceNo();

    if (!supplierName.trim()) {
      alert("Please select a supplier.");
      return;
    }

    if (purchaseRows.length === 0) {
      alert("Please add at least one product.");
      return;
    }

    // Paid amount can contain formatting commas. Treat a blank field as 0.
    const paidText = String(paidAmount ?? "").trim().replace(/,/g, "");
    const finalPaid = paidText === "" ? 0 : Number(paidText);

    if (
      !Number.isFinite(finalPaid) ||
      finalPaid < 0 ||
      finalPaid > totalPurchaseAmount
    ) {
      alert("Please enter a valid paid amount.");
      return;
    }

    if (paymentMethod === "Credit" && finalPaid !== 0) {
      alert("For Credit purchase, Paid Amount should be 0.");
      return;
    }

    setSaving(true);

    try {
      // --------------------------------------------------
      // LOAD OLD PURCHASE QUANTITIES
      // --------------------------------------------------
      const { data: oldItems, error: oldItemsError } = await supabase
        .from("purchase_items")
        .select("product_id, quantity")
        .eq("purchase_id", editingPurchaseId);

      if (oldItemsError) throw oldItemsError;

      const oldMap = new Map<string, number>();
      (oldItems || []).forEach((item: any) => {
        const productId = String(item.product_id);
        const quantity = Number(item.quantity || 0);
        oldMap.set(productId, (oldMap.get(productId) || 0) + quantity);
      });

      // --------------------------------------------------
      // BUILD NEW QUANTITY MAP
      // --------------------------------------------------
      const newMap = new Map<string, number>();
      purchaseRows.forEach((row) => {
        const productId = String(row.product_id);
        const quantity = Number(row.quantity || 0);
        newMap.set(productId, (newMap.get(productId) || 0) + quantity);
      });

      // --------------------------------------------------
      // IMPORTANT STOCK RULE
      // Current stock already includes the old purchase.
      // Therefore:
      //     New Stock = Current Stock - Old Qty + New Qty
      // Do NOT subtract the complete old quantity first and reject
      // just because Current Stock < Old Qty.
      // --------------------------------------------------
      const productIds = new Set<string>([
        ...Array.from(oldMap.keys()),
        ...Array.from(newMap.keys()),
      ]);

      const stockChanges: Array<{
        productId: string;
        currentStock: number;
        oldQty: number;
        newQty: number;
        finalStock: number;
        newRate: number | null;
      }> = [];

      // Validate every affected product BEFORE changing any database row.
      for (const productId of productIds) {
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("id, product_name, stock_qty, purchase_rate")
          .eq("id", productId)
          .single();

        if (productError) throw productError;

        const currentStock = Number(product?.stock_qty || 0);
        const oldQty = Number(oldMap.get(productId) || 0);
        const newQty = Number(newMap.get(productId) || 0);
        const finalStock = currentStock - oldQty + newQty;

        if (!Number.isFinite(finalStock) || finalStock < 0) {
          throw new Error(
            `Cannot update purchase for ${
              product?.product_name || productId
            }.\n\nCurrent Stock: ${currentStock}\nOld Purchase: ${oldQty}\nNew Purchase: ${newQty}\nResulting Stock: ${finalStock}`
          );
        }

        const newRow = purchaseRows.find(
          (row) => String(row.product_id) === productId
        );

        stockChanges.push({
          productId,
          currentStock,
          oldQty,
          newQty,
          finalStock,
          newRate: newRow ? Number(newRow.rate || 0) : null,
        });
      }

      // --------------------------------------------------
      // UPDATE PURCHASE HEADER
      // --------------------------------------------------
      const { error: headerError } = await supabase
        .from("purchases")
        .update({
          purchase_date: normalizedPurchaseDate,
          invoice_no: cleanInvoice,
          supplier_name: supplierName.trim(),
          total_amount: totalPurchaseAmount,
          payment_method: paymentMethod,
          paid_amount: finalPaid,
          balance_amount: Math.max(0, totalPurchaseAmount - finalPaid),
        })
        .eq("id", editingPurchaseId);

      if (headerError) throw headerError;

      // --------------------------------------------------
      // REPLACE PURCHASE ITEMS
      // --------------------------------------------------
      const { error: deleteItemsError } = await supabase
        .from("purchase_items")
        .delete()
        .eq("purchase_id", editingPurchaseId);

      if (deleteItemsError) throw deleteItemsError;

      const { error: insertItemsError } = await supabase
        .from("purchase_items")
        .insert(
          purchaseRows.map((row) => ({
            purchase_id: editingPurchaseId,
            product_id: row.product_id,
            quantity: row.quantity,
            rate: row.rate,
            amount: row.amount,
          }))
        );

      if (insertItemsError) throw insertItemsError;

      // --------------------------------------------------
      // APPLY NET STOCK CHANGE ONCE PER PRODUCT
      // --------------------------------------------------
      for (const change of stockChanges) {
        const stockPayload: Record<string, number> = {
          stock_qty: change.finalStock,
        };

        if (change.newRate !== null) {
          stockPayload.purchase_rate = change.newRate;
        }

        const { error: stockError } = await supabase
          .from("products")
          .update(stockPayload)
          .eq("id", change.productId);

        if (stockError) throw stockError;
      }

      clearPurchase();
      await loadProducts();
      await loadPurchaseHistory();
      await loadSupplierOutstanding(suppliers);
      alert("Purchase updated successfully.");
    } catch (error: any) {
      console.error("UPDATE PURCHASE ERROR:", error);
      alert(
        "Unable to update purchase:\n\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // SAVE PURCHASE
  // ====================================================

  async function savePurchase() {

    if (editingPurchaseId) {
      await updatePurchase();
      return;
    }

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

    const cleanInvoice = invoiceNo.trim() || generatePurchaseInvoiceNo();
    setInvoiceNo(cleanInvoice);

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
      Number(
        paidAmount
      );

    if (
      !Number.isFinite(
        finalPaid
      ) ||
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

    // -----------------------------------------------
    // CREDIT
    // -----------------------------------------------

    if (
      paymentMethod ===
        "Credit" &&
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

      // Ensure every fast-entry product is linked to the selected supplier
      // before the purchase is saved. This keeps supplier_products as the
      // source of truth for future purchase screens.
      for (const row of purchaseRows) {
        await ensureSupplierProductLink(row.product_id);
      }

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
              balance_amount
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
      await loadSupplierOutstanding(suppliers);

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
        px-3
        pb-28
        md:px-0
        md:pb-10
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

          {editingPurchaseId && (
            <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-semibold text-yellow-800">
              Editing an existing purchase. Change the supplier, products, payment or date, then press <span className="font-bold">Update Purchase</span>.
              <button
                type="button"
                onClick={clearPurchase}
                className="ml-3 rounded-lg bg-slate-600 px-3 py-1.5 text-white hover:bg-slate-700"
              >
                Cancel Edit
              </button>
            </div>
          )}

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

          {/* AUTO GENERATED INVOICE */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Purchase Bill Number</label>
            <div className="w-full rounded-lg border-2 border-blue-200 bg-blue-50 p-3 font-bold text-blue-800">
              {invoiceNo || "Auto-generated when you save"}
            </div>
            <p className="mt-1 text-xs text-slate-500">No manual bill number entry required.</p>
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

            <select
              value={supplierName}
              onChange={(e) => {
                setSupplierName(e.target.value);
                setSelectedBrandId("");
                setSelectedProductId("");
                setQuantity("");
                setRate("");
                setPurchaseRateOverrides({});
                setPurchaseRows([]);
              }}
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
              <option value="">
                Select Supplier
              </option>
              {suppliers.map((supplier) => (
                <option
                  key={supplier.id}
                  value={supplier.supplier_name}
                >
                  {supplier.supplier_name}
                </option>
              ))}
            </select>

            <p className="mt-1 text-xs text-slate-500">
              Select the supplier from Supplier Master.
            </p>

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

            </select>

          </div>

          {/* PAID */}

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
              value={
                paidAmount
              }
              onChange={(e) =>
                handlePaidAmountChange(
                  e.target.value
                )
              }
              disabled={
                paymentMethod ===
                "Credit"
              }
              className={`
                w-full
                rounded-lg
                border-2
                p-3
                font-bold
                ${
                  paymentMethod ===
                  "Credit"
                    ? "bg-slate-100 border-slate-200 text-slate-500"
                    : "bg-white border-green-200"
                }
              `}
            />

            {paymentMethod ===
              "Credit" && (

              <p
                className="
                  mt-1
                  text-xs
                  text-slate-500
                "
              >
                Credit purchase:
                paid amount is
                automatically ₹0.
              </p>

            )}

          </div>

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

        {/* SUPPLIER ACCOUNT POSITION — LIVE PREVIEW, NO LEDGER WRITE */}
        <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-slate-50 p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
                Supplier Account Summary
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Preview only. The supplier ledger updates after the purchase is saved.
              </p>
            </div>
            {editingPurchaseId && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                Editing purchase
              </span>
            )}
          </div>

          {!selectedSupplierId ? (
            <div className="rounded-xl border border-dashed border-blue-200 bg-white/80 p-4 text-sm font-medium text-slate-500">
              Select a supplier to view its previous outstanding and projected balance.
            </div>
          ) : supplierBalancesLoading ? (
            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
              Loading supplier account balance...
            </div>
          ) : supplierBalancesError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Supplier balance could not be loaded: {supplierBalancesError}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">Previous Supplier Balance</p>
                <p className={`mt-2 text-xl font-extrabold ${previousSupplierOutstanding < 0 ? "text-emerald-700" : "text-slate-800"}`}>
                  {formatSupplierPosition(previousSupplierOutstanding)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Before this purchase
                </p>
              </div>

              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs font-semibold text-orange-700">This Purchase Due</p>
                <p className="mt-2 text-xl font-extrabold text-orange-800">
                  {money(purchaseBalance)}
                </p>
                <p className="mt-1 text-[11px] text-orange-600">
                  Total {money(totalPurchaseAmount)} − Paid {money(Number.isFinite(numericPaidAmount) ? numericPaidAmount : 0)}
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-700 p-4 text-white">
                <p className="text-xs font-semibold text-blue-100">Estimated Supplier Balance</p>
                <p className="mt-2 text-xl font-extrabold">
                  {formatSupplierPosition(projectedSupplierOutstanding)}
                </p>
                <p className="mt-1 text-[11px] text-blue-100">
                  After saving this purchase
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ==================================================
          SUPPLIER BRAND + FAST PRODUCT ENTRY
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
            <h2 className="text-xl font-bold text-slate-800">
              Supplier Products
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select the supplier once. Its linked brand opens automatically. Enter only today's quantities.
            </p>
          </div>

          {selectedBrandId && (
            <div className="rounded-xl bg-blue-50 px-5 py-3 text-right">
              <p className="text-xs font-semibold text-slate-500">
                Brand
              </p>
              <p className="text-xl font-bold text-blue-700">
                {getBrandName(selectedBrandId)}
              </p>
            </div>
          )}
        </div>

        {!selectedSupplierId ? (
          <div className="rounded-xl border-2 border-dashed border-orange-200 bg-orange-50 p-8 text-center text-orange-800">
            Select a supplier above to automatically open its linked brand and products.
          </div>
        ) : !selectedBrandId ? (
          <div className="rounded-xl border-2 border-dashed border-yellow-200 bg-yellow-50 p-8 text-center text-yellow-800">
            No linked brand/products found for this supplier.
          </div>
        ) : brandProducts.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-yellow-200 bg-yellow-50 p-8 text-center text-yellow-800">
            No products found under {getBrandName(selectedBrandId)}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-center">Stock</th>
                  <th className="p-3 text-right">Purchase Rate</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {brandProducts.map((product) => {
                  const row = getFastPurchaseRow(product.id);
                  const currentQuantity = row?.quantity ?? 0;
                  const currentRate = getFastPurchaseRate(product);
                  const amount = currentQuantity * currentRate;

                  return (
                    <tr
                      key={product.id}
                      className="border-b border-slate-200 hover:bg-blue-50/40"
                    >
                      <td
                        className="p-3"
                        onClick={() => {
                          setSelectedProductId(String(product.id));
                          setQuantity(currentQuantity ? String(currentQuantity) : "");
                          setRate(String(currentRate));
                        }}
                      >
                        <p className="font-bold text-slate-800">
                          {product.product_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {Number(product.size || 1)} {product.unit || "Litre"}
                        </p>
                      </td>


                      <td className="p-3 text-center">
                        <span
                          className={`font-bold ${
                            Number(product.stock_qty || 0) > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {Number(product.stock_qty || 0)
                            .toFixed(2)
                            .replace(/\.00$/, "")}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            purchaseRateOverrides[String(product.id)] ??
                            String(currentRate)
                          }
                          onChange={(e) =>
                            handleFastRateChange(product, e.target.value)
                          }
                          className="w-28 rounded-lg border border-blue-200 bg-white px-3 py-2 text-right font-bold text-blue-700 focus:border-blue-500 focus:outline-none"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={currentQuantity || ""}
                          placeholder="0"
                          onChange={(e) =>
                            void handleFastQuantityChange(product, e.target.value)
                          }
                          className="w-24 rounded-lg border-2 border-slate-200 bg-white p-2 text-center font-bold focus:border-blue-500 focus:outline-none"
                        />
                      </td>

                      <td className="p-3 text-right font-bold text-slate-800">
                        ₹{amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 font-bold">
                  <td colSpan={3} className="p-4 text-right">
                    SELECTED TOTAL
                  </td>
                  <td className="p-4 text-center text-blue-700">
                    {totalPurchaseQuantity}
                  </td>
                  <td className="p-4 text-right text-xl text-blue-700">
                    {money(totalPurchaseAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

      </div>

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
              Select a supplier above. Its linked brand and products will open automatically.
            </p>

          </div>

        ) : (

          <>
          <div className="space-y-3 md:hidden">
            {purchaseRows.map((row, index) => (
              <div key={row.product_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-400">#{index + 1} · {getBrandName(row.brand_id)}</p>
                    <p className="break-words font-bold text-blue-700">{row.product_name}</p>
                    <p className="text-xs text-slate-500">{row.size} {row.unit}</p>
                  </div>
                  <button type="button" onClick={() => removePurchaseItem(row.product_id)} className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Remove</button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-slate-500">Quantity</p><p className="font-bold">{row.quantity}</p></div>
                  <div><p className="text-xs text-slate-500">Rate</p><p className="font-semibold">₹{row.rate.toFixed(2)}</p></div>
                  <div><p className="text-xs text-slate-500">Amount</p><p className="font-bold text-green-700">₹{row.amount.toFixed(2)}</p></div>
                </div>
              </div>
            ))}
            <div className="rounded-xl bg-blue-50 p-4 text-right font-bold text-blue-800">Total: {money(totalPurchaseAmount)}</div>
          </div>

          <div className="hidden overflow-x-auto md:block">
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
          </>

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
                numericPaidAmount
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
              sm:flex-wrap
            "
          >

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Repeat purchase date</label>
              <input
                type="date"
                value={copyPurchaseDate}
                onChange={(event) => setCopyPurchaseDate(event.target.value)}
                max={todayInput()}
                className="rounded-lg border border-blue-200 px-3 py-3 font-semibold text-slate-700"
              />
            </div>

            <button
              type="button"
              onClick={
                copyYesterdayPurchase
              }
              disabled={
                saving || loading
              }
              className="
                rounded-lg
                bg-blue-600
                px-6
                py-3
                font-bold
                text-white
                shadow
                hover:bg-blue-700
                disabled:opacity-50
              "
            >
              ↩ Repeat Selected Date Purchase
            </button>

            <button
              type="button"
              onClick={
                clearPurchase
              }
              disabled={
                saving || loading
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
                ? editingPurchaseId
                  ? "Updating Purchase..."
                  : "Saving Purchase..."
                : editingPurchaseId
                  ? "✓ Update Purchase"
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

          <>
          <div className="space-y-3 md:hidden">
            {purchaseHistory.map((purchase) => (
              <div key={purchase.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{formatDate(purchase.purchase_date)}</p>
                    <p className="break-all font-bold text-blue-700">{purchase.invoice_no || "-"}</p>
                    <p className="break-words font-semibold text-slate-800">{purchase.supplier_name || "-"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{purchase.payment_method || "Credit"}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-slate-500">Total</p><p className="font-bold text-slate-800">{money(purchase.total_amount)}</p></div>
                  <div><p className="text-xs text-slate-500">Paid</p><p className="font-bold text-green-700">{money(purchase.paid_amount)}</p></div>
                  <div><p className="text-xs text-slate-500">Balance</p><p className="font-bold text-orange-700">{money(purchase.balance_amount)}</p></div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => void viewPurchaseBill(purchase.id)} disabled={loading || saving} className="rounded-lg bg-blue-600 px-2 py-2 text-xs font-bold text-white disabled:opacity-50">View Bill</button>
                  <button type="button" onClick={() => void editPurchase(purchase.id)} disabled={loading || saving} className="rounded-lg bg-yellow-500 px-2 py-2 text-xs font-bold text-white disabled:opacity-50">Edit</button>
                  <button type="button" onClick={() => void deletePurchase(purchase.id)} disabled={loading || saving} className="rounded-lg bg-red-600 px-2 py-2 text-xs font-bold text-white disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
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

                  <th
                    className="
                      p-3
                      text-center
                    "
                  >
                    Actions
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

                      <td
                        className="
                          p-3
                          text-center
                        "
                      >
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => void viewPurchaseBill(purchase.id)}
                            disabled={loading || saving}
                            className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            View Bill
                          </button>
                          <button
                            type="button"
                            onClick={() => void editPurchase(purchase.id)}
                            disabled={loading || saving}
                            className="rounded-lg bg-yellow-500 px-3 py-2 font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => void deletePurchase(purchase.id)}
                            disabled={loading || saving}
                            className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>
          </>

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