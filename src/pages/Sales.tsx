import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import CustomerRouteSearch from "../components/CustomerRouteSearch";

// ---------------------------------------------------------
// LOCAL BUSINESS DATE
// Never use toISOString().slice(0, 10) for the sale date.
// That converts the time to UTC and can save yesterday's
// date for users in India/Asia after midnight.
// ---------------------------------------------------------
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "-";

  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split("-");

  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }

  return String(value);
}

function formatDateInput(value: string | null | undefined) {
  if (!value) return "";

  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split("-");

  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }

  return "";
}

function parseDateInput(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 8) {
    return null;
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTypingDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function normalizeSaleDate(value: string | null | undefined) {
  if (!value) return getLocalDateString();
  return String(value).slice(0, 10);
}

type Brand = {
id: string;
brand_name: string;
};

type Customer = {
id: string;
customer_name: string;
route?: string | null;
};

type Product = {
id: string;
product_name: string;
brand_id: string | null;
pack_size: string | null;
selling_rate: number | null;
purchase_rate: number | null;
stock_qty: number | null;
};

type SaleItem = {
id?: string;
product_id: string;
brand_id: string | null;
brand_name: string;
product_name: string;
pack_size: string;
unit: string;
quantity: number;
rate: number;
purchase_rate: number;
amount: number;
};

type RecentSale = {
id: string;
sale_date: string;
customer_id: string | null;
customer_name: string;
payment_method: string;
total_amount: number;
paid_amount: number;
balance_amount: number;
};

export default function Sales() {
/* =========================================================
MASTER DATA
========================================================= */

const [brands, setBrands] = useState<Brand[]>([]);
const [customers, setCustomers] = useState<Customer[]>([]);
const [products, setProducts] = useState<Product[]>([]);

/* =========================================================
SALE HEADER
========================================================= */

const initialSaleDate = getLocalDateString();

const [saleDate, setSaleDate] = useState(initialSaleDate);

const [saleDateDisplay, setSaleDateDisplay] = useState(
formatDateInput(initialSaleDate)
);

const [customerId, setCustomerId] = useState("");

const [paymentMethod, setPaymentMethod] =
useState("Cash");

const [paidAmount, setPaidAmount] =
useState("0");

/* =========================================================
PRODUCT ENTRY
========================================================= */

const [brandId, setBrandId] = useState("");

const [productId, setProductId] = useState("");

const [quantity, setQuantity] = useState("1");

const [sellingRate, setSellingRate] =
useState("");

const [productSearch, setProductSearch] =
useState("");

/* =========================================================
SALE ITEMS
========================================================= */

const [saleItems, setSaleItems] =
useState<SaleItem[]>([]);

/* =========================================================
EDIT CURRENT PRODUCT LINE
========================================================= */

const [editingItemIndex, setEditingItemIndex] =
useState<number | null>(null);

/* =========================================================
EDIT SAVED SALE
========================================================= */

const [editingSaleId, setEditingSaleId] =
useState<string | null>(null);

/* =========================================================
RECENT SALES
========================================================= */

const [recentSales, setRecentSales] =
useState<RecentSale[]>([]);

/* =========================================================
LOADING
========================================================= */

const [loading, setLoading] = useState(false);

const [loadingData, setLoadingData] =
useState(true);

/* =========================================================
HELPER
========================================================= */

function getProductUnit(product: Product | undefined) {
if (!product) {
return "Litre";
}

return "Litre";

}

function getPackDisplay(packSize: string | null) {
if (!packSize) {
return "-";
}

const value = Number(packSize);

if (!Number.isFinite(value)) {
  return packSize;
}

if (value >= 1000) {
  return `${value / 1000} L`;
}

return `${value} ml`;

}

/* =========================================================
LOAD MASTER DATA
========================================================= */

async function loadData() {
try {
setLoadingData(true);

  const [
    brandsResponse,
    customersResponse,
    productsResponse,
  ] = await Promise.all([
    supabase
      .from("brands")
      .select("id, brand_name")
      .order("brand_name"),

    supabase
      .from("customers")
      .select("id, customer_name, route")
      .order("customer_name"),

    /*
     * IMPORTANT:
     * These are the ACTUAL columns in your products table.
     */
    supabase
      .from("products")
      .select(
        `
        id,
        product_name,
        brand_id,
        pack_size,
        selling_rate,
        purchase_rate,
        stock_qty
        `
      )
      .order("product_name"),
  ]);

  if (brandsResponse.error) {
    throw brandsResponse.error;
  }

  if (customersResponse.error) {
    throw customersResponse.error;
  }

  if (productsResponse.error) {
    throw productsResponse.error;
  }

  setBrands(
    (brandsResponse.data || []) as Brand[]
  );

  setCustomers(
    (customersResponse.data || []) as Customer[]
  );

  setProducts(
    (productsResponse.data || []) as Product[]
  );
} catch (error: any) {
  console.error(
    "Sales master data error:",
    error
  );

  alert(
    "Unable to load sales data:\n" +
      (error?.message ||
        "Unknown error")
  );
} finally {
  setLoadingData(false);
}

}

/* =========================================================
LOAD RECENT SALES
========================================================= */

async function loadRecentSales() {
try {
const {
data,
error,
} = await supabase
.from("sales")
.select(`
          id,
          sale_date,
          customer_id,
          payment_method,
          total_amount,
          paid_amount,
          balance_amount
        `)
.order("sale_date", {
ascending: false,
})
.limit(20);

  if (error) {
    throw error;
  }

  const customerMap = new Map<
    string,
    string
  >();

  customers.forEach((customer) => {
    customerMap.set(
      customer.id,
      customer.customer_name
    );
  });

  const rows: RecentSale[] =
    (data || []).map(
      (sale: any) => ({
        id: sale.id,
        sale_date: sale.sale_date,
        customer_id:
          sale.customer_id,
        customer_name:
          customerMap.get(
            sale.customer_id
          ) || "Walk-in",
        payment_method:
          sale.payment_method ||
          "Cash",
        total_amount:
          Number(
            sale.total_amount
          ) || 0,
        paid_amount:
          Number(
            sale.paid_amount
          ) || 0,
        balance_amount:
          Number(
            sale.balance_amount
          ) || 0,
      })
    );

  setRecentSales(rows);
} catch (error: any) {
  console.error(
    "Recent sales error:",
    error
  );
}

}

/* =========================================================
INITIAL LOAD
========================================================= */

useEffect(() => {
loadData();
}, []);

useEffect(() => {
if (!loadingData) {
loadRecentSales();
}
}, [
customers,
loadingData,
]);

/* =========================================================
SELECTED CUSTOMER
========================================================= */

const selectedCustomer = useMemo(() => {
return customers.find(
(customer) =>
customer.id === customerId
);
}, [
customers,
customerId,
]);

/* =========================================================
YESTERDAY'S SALE
Loads the selected customer's sale from the previous
calendar day into today's draft.
It does NOT save automatically. The loaded sale remains
fully editable before Save Sale is pressed.
========================================================= */
function getPreviousSaleDate(value: string) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

async function loadYesterdaysSale() {
  if (!customerId) {
    alert("Please select a customer first.");
    return;
  }

  try {
    setLoading(true);

    const yesterdayDate = getPreviousSaleDate(saleDate);

    const {
      data: previousSale,
      error: previousSaleError,
    } = await supabase
      .from("sales")
      .select(`
        id,
        sale_date,
        customer_id,
        payment_method,
        paid_amount
      `)
      .eq("customer_id", customerId)
      .eq("sale_date", yesterdayDate)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousSaleError) {
      throw previousSaleError;
    }

    if (!previousSale) {
      alert(
        `No sale found for this customer on ${formatDisplayDate(
          yesterdayDate
        )}.`
      );
      return;
    }

    const {
      data: previousItems,
      error: previousItemsError,
    } = await supabase
      .from("sale_items")
      .select(`
        id,
        product_id,
        quantity,
        rate,
        amount,
        cost_rate
      `)
      .eq("sale_id", previousSale.id);

    if (previousItemsError) {
      throw previousItemsError;
    }

    if (!previousItems || previousItems.length === 0) {
      alert("Yesterday's sale has no products.");
      return;
    }

    const punchedItems = await Promise.all(
      previousItems.map(async (item: any) => {
        const product = products.find(
          (p) => p.id === item.product_id
        );

        if (!product) {
          return null;
        }

        const brand = brands.find(
          (b) => b.id === product.brand_id
        );

        const customerRate = await getCustomerPrice(
          customerId,
          product.id
        );

        const rate =
          customerRate !== null
            ? customerRate
            : Number(product.selling_rate || item.rate || 0);

        const qty = Number(item.quantity) || 0;

        return {
          product_id: product.id,
          brand_id: product.brand_id || null,
          brand_name: brand?.brand_name || "No Brand",
          product_name: product.product_name,
          pack_size: product.pack_size || "",
          unit: getProductUnit(product),
          quantity: qty,
          rate,
          purchase_rate: Number(
            product.purchase_rate || item.cost_rate || 0
          ),
          amount: qty * rate,
        } as SaleItem;
      })
    );

    const validItems = punchedItems.filter(
      (item): item is SaleItem => item !== null
    );

    if (validItems.length === 0) {
      alert("Yesterday's sale products could not be found in Products.");
      return;
    }

    // Load into the current draft only.
    // The user can edit quantities/products/rates/payment
    // and must press Save Sale to create today's sale.
    setSaleItems(validItems);
    setPaymentMethod(previousSale.payment_method || "Cash");
    setPaidAmount("0");
    setEditingSaleId(null);
    setEditingItemIndex(null);
    setProductId("");
    setQuantity("1");
    setSellingRate("");
    setProductSearch("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    alert(
      `Yesterday's sale (${formatDisplayDate(
        previousSale.sale_date
      )}) loaded.\n\nYou can edit the products or quantities, then press Save Sale.`
    );
  } catch (error: any) {
    console.error("Load yesterday's sale error:", error);
    alert(
      "Unable to load yesterday's sale:\n" +
        (error?.message || "Unknown error")
    );
  } finally {
    setLoading(false);
  }
}

/* =========================================================
PRODUCTS FOR BRAND / SEARCH
========================================================= */

const brandProducts = useMemo(() => {
let result = products;

if (brandId) {
  result = result.filter(
    (product) =>
      product.brand_id === brandId
  );
}

const search =
  productSearch
    .trim()
    .toLowerCase();

if (search) {
  result = result.filter(
    (product) => {
      const brand =
        brands.find(
          (b) =>
            b.id ===
            product.brand_id
        );

      const text = [
        product.product_name,
        product.pack_size,
        brand?.brand_name,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(
        search
      );
    }
  );
}

return result;

}, [
products,
brandId,
productSearch,
brands,
]);

/* =========================================================
SELECTED PRODUCT
========================================================= */

const selectedProduct = useMemo(() => {
return products.find(
(product) =>
product.id === productId
);
}, [
products,
productId,
]);

/* =========================================================
SELECTED BRAND
========================================================= */

const selectedBrand = useMemo(() => {
if (!selectedProduct) {
return undefined;
}

return brands.find(
  (brand) =>
    brand.id ===
    selectedProduct.brand_id
);

}, [
selectedProduct,
brands,
]);

/* =========================================================
CUSTOMER PRICE
========================================================= */

async function getCustomerPrice(
customer: string,
product: string
) {
if (!customer || !product) {
return null;
}

try {
  const {
    data,
    error,
  } = await supabase
    .from("customer_prices")
    .select("rate")
    .eq(
      "customer_id",
      customer
    )
    .eq(
      "product_id",
      product
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Customer price error:",
      error
    );

    return null;
  }

  if (!data) {
    return null;
  }

  const rate = Number(
    data.rate
  );

  if (
    !Number.isFinite(rate)
  ) {
    return null;
  }

  return rate;
} catch (error) {
  console.error(error);
  return null;
}

}

/* =========================================================
APPLY CUSTOMER RATE
========================================================= */

useEffect(() => {
async function applyRate() {
if (!selectedProduct) {
setSellingRate("");
return;
}

  const customerRate =
    await getCustomerPrice(
      customerId,
      selectedProduct.id
    );

  if (
    customerRate !== null
  ) {
    setSellingRate(
      customerRate.toString()
    );
  } else {
    setSellingRate(
      String(
        selectedProduct.selling_rate ||
          0
      )
    );
  }
}

applyRate();

}, [
customerId,
selectedProduct,
]);

/* =========================================================
PRODUCT CHANGE
========================================================= */

function handleProductChange(
value: string
) {
setProductId(value);

const product =
  products.find(
    (p) => p.id === value
  );

if (!product) {
  setSellingRate("");
  return;
}

setSellingRate(
  String(
    product.selling_rate || 0
  )
);

}

/* =========================================================
TOTAL SALE
========================================================= */

const totalSale = useMemo(() => {
return saleItems.reduce(
(total, item) =>
total +
Number(item.amount || 0),
0
);
}, [saleItems]);

/* =========================================================
PAID / BALANCE
========================================================= */

const paid =
Number(paidAmount) || 0;

const balance = Math.max(
0,
totalSale - paid
);

/* =========================================================
ADD / UPDATE PRODUCT LINE
========================================================= */

async function addOrUpdateSaleItem() {
if (!productId) {
alert(
"Please select a product."
);
return;
}

const qty =
  Number(quantity);

const rate =
  Number(sellingRate);

if (
  !Number.isFinite(qty) ||
  qty <= 0
) {
  alert(
    "Enter a valid quantity."
  );
  return;
}

if (
  !Number.isFinite(rate) ||
  rate < 0
) {
  alert(
    "Enter a valid selling rate."
  );
  return;
}

const product =
  products.find(
    (p) => p.id === productId
  );

if (!product) {
  alert(
    "Product not found."
  );
  return;
}

const stock =
  Number(
    product.stock_qty
  ) || 0;

/* =====================================================
   CHECK QUANTITY ALREADY USED IN CURRENT DRAFT
   ===================================================== */

let alreadyUsed = 0;

saleItems.forEach(
  (item, index) => {
    if (
      item.product_id ===
        product.id &&
      index !==
        editingItemIndex
    ) {
      alreadyUsed +=
        Number(
          item.quantity
        ) || 0;
    }
  }
);

const requiredStock =
  alreadyUsed + qty;

/*
 * When editing a saved sale, its old stock is
 * still deducted from database. We allow the old
 * quantity to be replaced during editing.
 *
 * The final validation is also performed again
 * during updateExistingSale().
 */

if (
  !editingSaleId &&
  requiredStock > stock
) {
  alert(
    `Insufficient stock.\n\nAvailable stock: ${stock}\nRequired: ${requiredStock}`
  );

  return;
}

/* =====================================================
   BRAND
   ===================================================== */

const brand =
  brands.find(
    (b) =>
      b.id ===
      product.brand_id
  );

/* =====================================================
   NEW SALE ITEM
   ===================================================== */

const newItem: SaleItem = {
  product_id:
    product.id,

  brand_id:
    product.brand_id ||
    null,

  brand_name:
    brand?.brand_name ||
    "No Brand",

  product_name:
    product.product_name,

  pack_size:
    product.pack_size ||
    "",

  unit:
    getProductUnit(product),

  quantity: qty,

  rate: rate,

  purchase_rate:
    Number(product.purchase_rate || 0),

  amount:
    qty * rate,
};

/* =====================================================
   UPDATE DRAFT LINE
   ===================================================== */

if (
  editingItemIndex !==
  null
) {
  setSaleItems(
    (previous) =>
      previous.map(
        (item, index) =>
          index ===
          editingItemIndex
            ? {
                ...newItem,
                id: item.id,
              }
            : item
      )
  );

  setEditingItemIndex(
    null
  );
}

/* =====================================================
   ADD NEW LINE
   ===================================================== */

else {
  /*
   * Do not allow the same product twice.
   * This prevents stock calculation problems.
   */
  const existingIndex =
    saleItems.findIndex(
      (item) =>
        item.product_id ===
        product.id
    );

  if (
    existingIndex !== -1
  ) {
    const confirmed =
      window.confirm(
        "This product is already added.\n\nDo you want to replace its quantity and rate?"
      );

    if (!confirmed) {
      return;
    }

    setSaleItems(
      (previous) =>
        previous.map(
          (
            item,
            index
          ) =>
            index ===
            existingIndex
              ? newItem
              : item
        )
    );
  } else {
    setSaleItems(
      (previous) => [
        ...previous,
        newItem,
      ]
    );
  }
}

/* =====================================================
   CLEAR PRODUCT FORM
   ===================================================== */

setProductId("");
setQuantity("1");
setSellingRate("");

}

/* =========================================================
EDIT DRAFT PRODUCT
========================================================= */

function editSaleItem(
index: number
) {
const item =
saleItems[index];

if (!item) {
  return;
}

setEditingItemIndex(
  index
);

setBrandId(
  item.brand_id || ""
);

setProductSearch("");

setProductId(
  item.product_id
);

setQuantity(
  String(item.quantity)
);

setSellingRate(
  String(item.rate)
);

window.scrollTo({
  top: 250,
  behavior: "smooth",
});

}

/* =========================================================
REMOVE DRAFT PRODUCT
========================================================= */

function removeSaleItem(
index: number
) {
const item =
saleItems[index];

if (!item) {
  return;
}

const confirmed =
  window.confirm(
    `Remove "${item.product_name}" from this sale?`
  );

if (!confirmed) {
  return;
}

setSaleItems(
  (previous) =>
    previous.filter(
      (_, itemIndex) =>
        itemIndex !== index
    )
);

if (
  editingItemIndex ===
  index
) {
  cancelProductEdit();
}

}

/* =========================================================
CANCEL PRODUCT EDIT
========================================================= */

function cancelProductEdit() {
setEditingItemIndex(
null
);

setProductId("");

setQuantity("1");

setSellingRate("");

setProductSearch("");

}

/* =========================================================
CLEAR SALE FORM
========================================================= */

function clearSaleForm() {
setSaleItems([]);

setCustomerId("");

setBrandId("");

setProductId("");

setProductSearch("");

setQuantity("1");

setSellingRate("");

setPaidAmount("0");

setPaymentMethod("Cash");

setEditingItemIndex(
  null
);

setEditingSaleId(
  null
);

const today = getLocalDateString();
setSaleDate(today);
setSaleDateDisplay(formatDateInput(today));

}

/* =========================================================
SAVE NEW SALE
========================================================= */

async function saveSale() {
if (
saleItems.length === 0
) {
alert(
"Please add at least one product."
);
return;
}

if (!customerId) {
  alert(
    "Please select a customer."
  );
  return;
}

if (totalSale <= 0) {
  alert(
    "Sale total must be greater than zero."
  );
  return;
}

if (paid < 0) {
  alert(
    "Paid amount cannot be negative."
  );
  return;
}

if (paid > totalSale) {
  alert(
    "Paid amount cannot be greater than total sale."
  );
  return;
}

try {
  setLoading(true);

  /* =====================================================
     IF EDITING SAVED SALE
     ===================================================== */

  if (editingSaleId) {
    await updateExistingSale(
      editingSaleId
    );

    return;
  }

  /* =====================================================
     FINAL STOCK VALIDATION
     ===================================================== */

  for (
    const item of saleItems
  ) {
    const product =
      products.find(
        (p) =>
          p.id ===
          item.product_id
      );

    if (!product) {
      throw new Error(
        `Product not found: ${item.product_name}`
      );
    }

    const stock =
      Number(
        product.stock_qty
      ) || 0;

    if (
      Number(
        item.quantity
      ) > stock
    ) {
      throw new Error(
        `Insufficient stock for ${item.product_name}.\nAvailable: ${stock}\nRequired: ${item.quantity}`
      );
    }
  }

  /* =====================================================
     INSERT SALE HEADER
     ===================================================== */

  const {
    data: sale,
    error: saleError,
  } = await supabase
    .from("sales")
    .insert({
      sale_date:
        saleDate,

      customer_id:
        customerId,

      payment_method:
        paymentMethod,

      total_amount:
        totalSale,

      paid_amount:
        paid,

      balance_amount:
        balance,
    })
    .select()
    .single();

  if (saleError) {
    throw saleError;
  }

  if (!sale) {
    throw new Error(
      "Sale was not created."
    );
  }

  /* =====================================================
     INSERT SALE ITEMS
     ===================================================== */

  const itemsToInsert =
    saleItems.map(
      (item) => ({
        sale_id:
          sale.id,

        product_id:
          item.product_id,

        quantity:
          item.quantity,

        rate:
          item.rate,

        amount:
          item.amount,

        cost_rate:
          Number(item.purchase_rate || 0),
      })
    );

  const {
    error: itemError,
  } = await supabase
    .from("sale_items")
    .insert(
      itemsToInsert
    );

  if (itemError) {
    await supabase
      .from("sales")
      .delete()
      .eq(
        "id",
        sale.id
      );

    throw itemError;
  }

  /* =====================================================
     UPDATE STOCK
     ===================================================== */

  for (
    const item of saleItems
  ) {
    const product =
      products.find(
        (p) =>
          p.id ===
          item.product_id
      );

    if (!product) {
      continue;
    }

    const oldStock =
      Number(
        product.stock_qty
      ) || 0;

    const newStock =
      oldStock -
      Number(
        item.quantity
      );

    if (
      newStock < 0
    ) {
      throw new Error(
        `Insufficient stock for ${item.product_name}.`
      );
    }

    const {
      error:
        stockError,
    } = await supabase
      .from("products")
      .update({
        stock_qty:
          newStock,
      })
      .eq(
        "id",
        item.product_id
      );

    if (stockError) {
      throw stockError;
    }
  }

  alert(
    "Sale saved successfully."
  );

  clearSaleForm();

  await loadData();

  await loadRecentSales();
} catch (error: any) {
  console.error(
    "Save sale error:",
    error
  );

  alert(
    "Sale Error:\n" +
      (error?.message ||
        "Unable to save sale.")
  );
} finally {
  setLoading(false);
}

}

/* =========================================================
UPDATE EXISTING SALE
========================================================= */

async function updateExistingSale(
saleId: string
) {
try {
/* =====================================================
GET OLD SALE ITEMS
===================================================== */

  const {
    data: oldItems,
    error:
      oldItemsError,
  } = await supabase
    .from("sale_items")
    .select(
      "id, product_id, quantity"
    )
    .eq(
      "sale_id",
      saleId
    );

  if (oldItemsError) {
    throw oldItemsError;
  }

  /* =====================================================
     CALCULATE STOCK AFTER RESTORING OLD SALE
     ===================================================== */

  const stockMap =
    new Map<
      string,
      number
    >();

  products.forEach(
    (product) => {
      stockMap.set(
        product.id,
        Number(
          product.stock_qty
        ) || 0
      );
    }
  );

  /*
   * Restore stock from old sale.
   */
  (oldItems || []).forEach(
    (oldItem: any) => {
      const current =
        stockMap.get(
          oldItem.product_id
        ) || 0;

      stockMap.set(
        oldItem.product_id,
        current +
          Number(
            oldItem.quantity
          )
      );
    }
  );

  /* =====================================================
     CHECK NEW STOCK
     ===================================================== */

  const newQuantityMap =
    new Map<
      string,
      number
    >();

  saleItems.forEach(
    (item) => {
      const current =
        newQuantityMap.get(
          item.product_id
        ) || 0;

      newQuantityMap.set(
        item.product_id,
        current +
          Number(
            item.quantity
          )
      );
    }
  );

  for (
    const [
      productId,
      requiredQty,
    ] of newQuantityMap
  ) {
    const available =
      stockMap.get(
        productId
      ) || 0;

    if (
      requiredQty >
      available
    ) {
      const product =
        products.find(
          (p) =>
            p.id ===
            productId
        );

      throw new Error(
        `Insufficient stock for ${
          product?.product_name ||
          "product"
        }.\nAvailable after restoring old sale: ${available}\nRequired: ${requiredQty}`
      );
    }
  }

  /* =====================================================
     UPDATE STOCK
     ===================================================== */

  /*
   * First restore old stock in database.
   */
  for (
    const [
      productId,
      restoredStock,
    ] of stockMap
  ) {
    const {
      error:
        restoreError,
    } = await supabase
      .from("products")
      .update({
        stock_qty:
          restoredStock,
      })
      .eq(
        "id",
        productId
      );

    if (restoreError) {
      throw restoreError;
    }
  }

  /* =====================================================
     UPDATE SALE HEADER
     ===================================================== */

  const {
    error:
      saleUpdateError,
  } = await supabase
    .from("sales")
    .update({
      sale_date:
        saleDate,

      customer_id:
        customerId,

      payment_method:
        paymentMethod,

      total_amount:
        totalSale,

      paid_amount:
        paid,

      balance_amount:
        balance,
    })
    .eq(
      "id",
      saleId
    );

  if (saleUpdateError) {
    throw saleUpdateError;
  }

  /* =====================================================
     DELETE OLD ITEMS
     ===================================================== */

  const {
    error:
      deleteItemsError,
  } = await supabase
    .from("sale_items")
    .delete()
    .eq(
      "sale_id",
      saleId
    );

  if (deleteItemsError) {
    throw deleteItemsError;
  }

  /* =====================================================
     INSERT NEW ITEMS
     ===================================================== */

  const itemsToInsert =
    saleItems.map(
      (item) => ({
        sale_id:
          saleId,

        product_id:
          item.product_id,

        quantity:
          item.quantity,

        rate:
          item.rate,

        amount:
          item.amount,

        cost_rate:
          Number(item.purchase_rate || 0),
      })
    );

  const {
    error:
      insertItemsError,
  } = await supabase
    .from("sale_items")
    .insert(
      itemsToInsert
    );

  if (insertItemsError) {
    throw insertItemsError;
  }

  /* =====================================================
     APPLY NEW STOCK
     ===================================================== */

  for (
    const [
      productId,
      availableStock,
    ] of stockMap
  ) {
    const used =
      newQuantityMap.get(
        productId
      ) || 0;

    const finalStock =
      availableStock -
      used;

    if (
      finalStock < 0
    ) {
      throw new Error(
        "Stock cannot become negative."
      );
    }

    const {
      error:
        stockError,
    } = await supabase
      .from("products")
      .update({
        stock_qty:
          finalStock,
      })
      .eq(
        "id",
        productId
      );

    if (stockError) {
      throw stockError;
    }
  }

  alert(
    "Sale updated successfully."
  );

  clearSaleForm();

  await loadData();

  await loadRecentSales();
} catch (error: any) {
  console.error(
    "Update sale error:",
    error
  );

  alert(
    "Sale Update Error:\n" +
      (error?.message ||
        "Unable to update sale.")
  );
}

}

/* =========================================================
EDIT SAVED SALE
========================================================= */

async function editSavedSale(
saleId: string
) {
try {
setLoading(true);

  /* =====================================================
     SALE HEADER
     ===================================================== */

  const {
    data: sale,
    error:
      saleError,
  } = await supabase
    .from("sales")
    .select(
      `
      id,
      sale_date,
      customer_id,
      payment_method,
      total_amount,
      paid_amount,
      balance_amount
      `
    )
    .eq(
      "id",
      saleId
    )
    .single();

  if (saleError) {
    throw saleError;
  }

  /* =====================================================
     SALE ITEMS
     ===================================================== */

  const {
    data: items,
    error:
      itemsError,
  } = await supabase
    .from("sale_items")
    .select(
      `
      id,
      product_id,
      quantity,
      rate,
      amount,
      cost_rate
      `
    )
    .eq(
      "sale_id",
      saleId
    );

  if (itemsError) {
    throw itemsError;
  }

  setEditingSaleId(
    sale.id
  );

  const editDate = normalizeSaleDate(sale.sale_date);
  setSaleDate(editDate);
  setSaleDateDisplay(formatDateInput(editDate));

  setCustomerId(
    sale.customer_id ||
      ""
  );

  setPaymentMethod(
    sale.payment_method ||
      "Cash"
  );

  setPaidAmount(
    String(
      Number(
        sale.paid_amount
      ) || 0
    )
  );

  /* =====================================================
     CONVERT ITEMS
     ===================================================== */

  const convertedItems:
    SaleItem[] =
    (items || []).map(
      (item: any) => {
        const product =
          products.find(
            (p) =>
              p.id ===
              item.product_id
          );

        const brand =
          brands.find(
            (b) =>
              b.id ===
              product?.brand_id
          );

        return {
          id:
            item.id,

          product_id:
            item.product_id,

          brand_id:
            product?.brand_id ||
            null,

          brand_name:
            brand?.brand_name ||
            "No Brand",

          product_name:
            product?.product_name ||
            "Unknown Product",

          pack_size:
            product?.pack_size ||
            "",

          unit:
            getProductUnit(
              product
            ),

          quantity:
            Number(
              item.quantity
            ) || 0,

          rate:
            Number(
              item.rate
            ) || 0,

          purchase_rate:
            Number(
              item.cost_rate ??
              product?.purchase_rate ??
              0
            ) || 0,

          amount:
            Number(
              item.amount
            ) || 0,
        };
      }
    );

  setSaleItems(
    convertedItems
  );

  setEditingItemIndex(
    null
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
} catch (error: any) {
  console.error(
    "Edit sale error:",
    error
  );

  alert(
    "Unable to edit sale:\n" +
      (error?.message ||
        "Unknown error")
  );
} finally {
  setLoading(false);
}

}

/* =========================================================
DELETE SAVED SALE
========================================================= */

async function deleteSavedSale(
saleId: string
) {
const confirmed =
window.confirm(
"Delete this sale?\n\nThe stock used by this sale will be restored."
);

if (!confirmed) {
  return;
}

try {
  setLoading(true);

  /* =====================================================
     GET OLD ITEMS
     ===================================================== */

  const {
    data: oldItems,
    error:
      itemsError,
  } = await supabase
    .from("sale_items")
    .select(
      "product_id, quantity"
    )
    .eq(
      "sale_id",
      saleId
    );

  if (itemsError) {
    throw itemsError;
  }

  /* =====================================================
     RESTORE STOCK
     ===================================================== */

  const restoreMap =
    new Map<
      string,
      number
    >();

  (
    oldItems || []
  ).forEach(
    (item: any) => {
      const current =
        restoreMap.get(
          item.product_id
        ) || 0;

      restoreMap.set(
        item.product_id,
        current +
          Number(
            item.quantity
          )
      );
    }
  );

  for (
    const [
      productId,
      quantityToRestore,
    ] of restoreMap
  ) {
    const product =
      products.find(
        (p) =>
          p.id ===
          productId
      );

    if (!product) {
      continue;
    }

    const currentStock =
      Number(
        product.stock_qty
      ) || 0;

    const restoredStock =
      currentStock +
      quantityToRestore;

    const {
      error:
        stockError,
    } = await supabase
      .from("products")
      .update({
        stock_qty:
          restoredStock,
      })
      .eq(
        "id",
        productId
      );

    if (stockError) {
      throw stockError;
    }
  }

  /* =====================================================
     DELETE SALE ITEMS
     ===================================================== */

  const {
    error:
      deleteItemsError,
  } = await supabase
    .from("sale_items")
    .delete()
    .eq(
      "sale_id",
      saleId
    );

  if (deleteItemsError) {
    throw deleteItemsError;
  }

  /* =====================================================
     DELETE SALE HEADER
     ===================================================== */

  const {
    error:
      deleteSaleError,
  } = await supabase
    .from("sales")
    .delete()
    .eq(
      "id",
      saleId
    );

  if (deleteSaleError) {
    throw deleteSaleError;
  }

  alert(
    "Sale deleted successfully."
  );

  await loadData();

  await loadRecentSales();
} catch (error: any) {
  console.error(
    "Delete sale error:",
    error
  );

  alert(
    "Delete Sale Error:\n" +
      (error?.message ||
        "Unable to delete sale.")
  );
} finally {
  setLoading(false);
}

}

/* =========================================================
LOADING SCREEN
========================================================= */

if (loadingData) {
return (
<div className="p-8">
<h1 className="text-3xl font-bold text-blue-700">
Sales
</h1>

    <p className="mt-3 text-gray-600">
      Loading sales data...
    </p>
  </div>
);

}

/* =========================================================
RENDER
========================================================= */

return (
<div className="space-y-6">

  {/* =====================================================
      PAGE HEADER
  ===================================================== */}

  <div>
    <h1 className="text-3xl font-bold text-blue-700">
      Sales Entry
    </h1>

    <p className="text-gray-600 mt-1">
      {editingSaleId
        ? "Edit existing sale"
        : "Create a new customer sale"}
    </p>
  </div>

  {/* =====================================================
      SALE FORM
  ===================================================== */}

  <div className="bg-white rounded-2xl shadow p-6">

    {/* ===================================================
        SALE HEADER
    =================================================== */}

    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

      {/* DATE */}

      <div>
        <label className="block font-semibold mb-2">
          Sale Date
        </label>

        <input
          type="text"
          inputMode="numeric"
          value={saleDateDisplay}
          onChange={(e) => {
            const formatted = formatTypingDate(e.target.value);
            setSaleDateDisplay(formatted);

            const parsed = parseDateInput(formatted);
            if (parsed) {
              setSaleDate(parsed);
            }
          }}
          onBlur={() => {
            const parsed = parseDateInput(saleDateDisplay);

            if (parsed) {
              setSaleDate(parsed);
              setSaleDateDisplay(formatDateInput(parsed));
            } else {
              setSaleDateDisplay(formatDateInput(saleDate));
            }
          }}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          className="w-full border rounded-xl px-4 py-3"
        />

        <p className="text-sm text-gray-500 mt-1">
          Enter date as DD/MM/YYYY
        </p>
      </div>

      {/* CUSTOMER + ROUTE SEARCH */}

      <CustomerRouteSearch
        customers={customers}
        value={customerId}
        onChange={setCustomerId}
        disabled={loading || loadingData}
        label="Customer / Route"
      />

      {customerId && (
        <div className="md:col-span-4">
          <button
            type="button"
            disabled={loading || loadingData}
            onClick={loadYesterdaysSale}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-4 text-lg shadow transition disabled:bg-gray-400"
          >
            📋 Yesterday's Sale
          </button>

          <p className="mt-2 text-sm text-gray-500">
            Loads the customer's sale from yesterday. You can edit it before saving.
          </p>
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
            setPaymentMethod(
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

          <option value="Credit">
            Credit
          </option>

          <option value="Advance">
            Advance
          </option>
        </select>
      </div>

      {/* PAID */}

      <div>
        <label className="block font-semibold mb-2">
          Amount Paid
        </label>

        <input
          type="number"
          min="0"
          step="0.01"
          value={paidAmount}
          onChange={(e) =>
            setPaidAmount(
              e.target.value
            )
          }
          className="w-full border rounded-xl px-4 py-3"
          placeholder="0"
        />
      </div>

    </div>

    {/* ===================================================
        ADD PRODUCTS
    =================================================== */}

    <div className="border-t mt-7 pt-7">

      <h2 className="text-2xl font-bold text-gray-800">
        Add Products
      </h2>

      <p className="text-gray-500 mt-1 mb-5">
        Select a brand and add multiple products.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        {/* BRAND */}

        <div>
          <label className="block font-semibold mb-2">
            Brand
          </label>

          <select
            value={brandId}
            onChange={(e) => {
              setBrandId(
                e.target.value
              );

              setProductId("");

              setSellingRate("");
            }}
            className="w-full border rounded-xl px-4 py-3"
          >
            <option value="">
              Select Brand
            </option>

            {brands.map(
              (brand) => (
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
                </option>
              )
            )}
          </select>
        </div>

        {/* SEARCH */}

        <div>
          <label className="block font-semibold mb-2">
            Product Search
          </label>

          <input
            type="text"
            value={
              productSearch
            }
            onChange={(e) =>
              setProductSearch(
                e.target.value
              )
            }
            placeholder="Search product..."
            className="w-full border rounded-xl px-4 py-3"
          />
        </div>

        {/* PRODUCT */}

        <div>
          <label className="block font-semibold mb-2">
            Product
          </label>

          <select
            value={productId}
            onChange={(e) =>
              handleProductChange(
                e.target.value
              )
            }
            className="w-full border rounded-xl px-4 py-3"
          >
            <option value="">
              Select Product
            </option>

            {brandProducts.map(
              (product) => (
                <option
                  key={
                    product.id
                  }
                  value={
                    product.id
                  }
                >
                  {
                    product.product_name
                  }
                  {" - "}
                  {
                    getPackDisplay(
                      product.pack_size
                    )
                  }
                </option>
              )
            )}
          </select>
        </div>

        {/* QUANTITY */}

        <div>
          <label className="block font-semibold mb-2">
            Quantity
          </label>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(e) =>
              setQuantity(
                e.target.value
              )
            }
            className="w-full border rounded-xl px-4 py-3"
          />

          {selectedProduct && (
            <div className="mt-2 rounded-lg bg-gray-100 px-3 py-2">

              <p className="text-xs text-gray-500">
                Available Stock
              </p>

              <p
                className={`text-lg font-bold ${
                  Number(
                    selectedProduct.stock_qty ||
                      0
                  ) > 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {Number(
                  selectedProduct.stock_qty ||
                    0
                )}

                {" "}

                Litre
              </p>

            </div>
          )}
        </div>

        {/* SELLING RATE */}

        <div>
          <label className="block font-semibold mb-2">
            Selling Rate
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={
              sellingRate
            }
            onChange={(e) =>
              setSellingRate(
                e.target.value
              )
            }
            className="w-full border rounded-xl px-4 py-3"
          />

          <p className="text-sm text-gray-500 mt-1">
            Customer rate applied automatically.
          </p>
        </div>

      </div>

      {/* =================================================
          SELECTED PRODUCT INFORMATION
      ================================================= */}

      {selectedProduct && (
        <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-4">

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">

            {/* BRAND */}

            <div>
              <span className="text-gray-500 text-sm">
                Brand
              </span>

              <p className="font-bold text-blue-700">
                {
                  selectedBrand?.brand_name ||
                  "No Brand"
                }
              </p>
            </div>

            {/* PRODUCT */}

            <div>
              <span className="text-gray-500 text-sm">
                Product
              </span>

              <p className="font-bold">
                {
                  selectedProduct.product_name
                }
              </p>
            </div>

            {/* PACK */}

            <div>
              <span className="text-gray-500 text-sm">
                Pack Size
              </span>

              <p className="font-bold">
                {
                  getPackDisplay(
                    selectedProduct.pack_size
                  )
                }
              </p>
            </div>

            {/* RATE */}

            <div>
              <span className="text-gray-500 text-sm">
                Selling Rate
              </span>

              <p className="font-bold">
                ₹
                {Number(
                  selectedProduct.selling_rate ||
                    0
                ).toFixed(2)}
              </p>
            </div>

            {/* STOCK */}

            <div>
              <span className="text-gray-500 text-sm">
                Current Stock
              </span>

              <p className="font-bold text-green-600">
                {Number(
                  selectedProduct.stock_qty ||
                    0
                )}{" "}
                Litre
              </p>
            </div>

          </div>

        </div>
      )}

      {/* =================================================
          PRODUCT BUTTONS
      ================================================= */}

      <div className="flex flex-wrap gap-3 mt-5">

        <button
          type="button"
          onClick={
            addOrUpdateSaleItem
          }
          className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 rounded-xl font-bold"
        >
          {editingItemIndex !==
          null
            ? "Update Product"
            : "+ Add Product"}
        </button>

        <button
          type="button"
          onClick={
            cancelProductEdit
          }
          className="bg-gray-500 hover:bg-gray-600 text-white px-7 py-3 rounded-xl font-bold"
        >
          {editingItemIndex !==
          null
            ? "Cancel Edit"
            : "Clear Product"}
        </button>

      </div>

    </div>

    {/* ===================================================
        SALE ITEMS
    =================================================== */}

    <div className="mt-8 overflow-x-auto">

      <table className="w-full border-collapse">

        <thead>

          <tr className="bg-blue-600 text-white">

            <th className="p-3 text-left">
              Brand
            </th>

            <th className="p-3 text-left">
              Product
            </th>

            <th className="p-3 text-center">
              Pack
            </th>

            <th className="p-3 text-center">
              Qty
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

          {saleItems.length ===
          0 ? (
            <tr>
              <td
                colSpan={7}
                className="p-8 text-center text-gray-500"
              >
                No products added.
              </td>
            </tr>
          ) : (
            saleItems.map(
              (
                item,
                index
              ) => (
                <tr
                  key={`${item.product_id}-${index}`}
                  className="border-b"
                >

                  <td className="p-3 font-semibold text-blue-700">
                    {
                      item.brand_name
                    }
                  </td>

                  <td className="p-3">
                    {
                      item.product_name
                    }
                  </td>

                  <td className="p-3 text-center">
                    {
                      getPackDisplay(
                        item.pack_size
                      )
                    }
                  </td>

                  <td className="p-3 text-center font-bold">
                    {
                      item.quantity
                    }
                  </td>

                  <td className="p-3 text-right">
                    ₹
                    {item.rate.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-3 text-right font-bold">
                    ₹
                    {item.amount.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-3">

                    <div className="flex justify-center gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          editSaleItem(
                            index
                          )
                        }
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removeSaleItem(
                            index
                          )
                        }
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        Remove
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

    {/* ===================================================
        TOTALS
    =================================================== */}

    <div className="border-t mt-8 pt-6">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* TOTAL */}

        <div className="bg-blue-50 rounded-xl p-5">

          <p className="text-gray-600">
            Total Sale
          </p>

          <p className="text-3xl font-bold text-blue-700">
            ₹
            {totalSale.toFixed(
              2
            )}
          </p>

        </div>

        {/* PAID */}

        <div className="bg-green-50 rounded-xl p-5">

          <p className="text-gray-600">
            Paid
          </p>

          <p className="text-3xl font-bold text-green-600">
            ₹
            {paid.toFixed(
              2
            )}
          </p>

        </div>

        {/* BALANCE */}

        <div className="bg-red-50 rounded-xl p-5">

          <p className="text-gray-600">
            Balance
          </p>

          <p className="text-3xl font-bold text-red-600">
            ₹
            {balance.toFixed(
              2
            )}
          </p>

        </div>

      </div>

    </div>

    {/* ===================================================
        SAVE BUTTONS
    =================================================== */}

    <div className="flex flex-wrap gap-3 mt-7">

      <button
        type="button"
        disabled={loading}
        onClick={saveSale}
        className={`px-8 py-3 rounded-xl text-white font-bold ${
          loading
            ? "bg-gray-400"
            : "bg-green-600 hover:bg-green-700"
        }`}
      >
        {loading
          ? "Saving..."
          : editingSaleId
          ? "Update Sale"
          : "Save Sale"}
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={
          clearSaleForm
        }
        className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-xl font-bold"
      >
        {editingSaleId
          ? "Cancel Edit"
          : "Clear"}
      </button>

    </div>

  </div>

  {/* =====================================================
      RECENT SALES
  ===================================================== */}

  <div className="bg-white rounded-2xl shadow p-6">

    <div className="flex items-center justify-between mb-5">

      <div>
        <h2 className="text-2xl font-bold text-blue-700">
          Recent Sales
        </h2>

        <p className="text-gray-500">
          Verify and correct previous sales.
        </p>
      </div>

      <button
        type="button"
        onClick={
          loadRecentSales
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

            <th className="p-3 text-left">
              Payment
            </th>

            <th className="p-3 text-right">
              Total
            </th>

            <th className="p-3 text-right">
              Paid
            </th>

            <th className="p-3 text-right">
              Balance
            </th>

            <th className="p-3 text-center">
              Action
            </th>

          </tr>

        </thead>

        <tbody>

          {recentSales.length ===
          0 ? (
            <tr>
              <td
                colSpan={7}
                className="p-8 text-center text-gray-500"
              >
                No recent sales found.
              </td>
            </tr>
          ) : (
            recentSales.map(
              (sale) => (
                <tr
                  key={
                    sale.id
                  }
                  className="border-b hover:bg-gray-50"
                >

                  <td className="p-3">
                    {
                      formatDisplayDate(sale.sale_date)
                    }
                  </td>

                  <td className="p-3 font-semibold">
                    {
                      sale.customer_name
                    }
                  </td>

                  <td className="p-3">
                    {
                      sale.payment_method
                    }
                  </td>

                  <td className="p-3 text-right font-bold">
                    ₹
                    {sale.total_amount.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-3 text-right text-green-600 font-semibold">
                    ₹
                    {sale.paid_amount.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-3 text-right text-red-600 font-semibold">
                    ₹
                    {sale.balance_amount.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-3">

                    <div className="flex justify-center gap-2">

                      <button
                        type="button"
                        disabled={
                          loading
                        }
                        onClick={() =>
                          editSavedSale(
                            sale.id
                          )
                        }
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={
                          loading
                        }
                        onClick={() =>
                          deleteSavedSale(
                            sale.id
                          )
                        }
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
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