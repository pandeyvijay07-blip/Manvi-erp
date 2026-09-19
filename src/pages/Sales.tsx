import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { jsPDF } from "jspdf";
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
mobile?: string | null;
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
cash_amount: number;
upi_amount: number;
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

const [cashAmount, setCashAmount] =
useState("0");

const [upiAmount, setUpiAmount] =
useState("0");

/* =========================================================
UPI / WHATSAPP BILL
========================================================= */
const [businessUpiId, setBusinessUpiId] = useState(() => {
try {
return window.localStorage.getItem("manvi_upi_id") || "";
} catch {
return "";
}
});

function saveBusinessUpiId(value: string) {
const normalized = value.trim();
setBusinessUpiId(normalized);
try {
window.localStorage.setItem("manvi_upi_id", normalized);
} catch {
// Local storage may be unavailable in restricted browsers.
}
}

function getWhatsAppNumber(value: string | null | undefined) {
const digits = String(value || "").replace(/\D/g, "");
if (!digits) return "";
if (digits.length === 10) return `91${digits}`;
if (digits.length === 12 && digits.startsWith("91")) return digits;
return digits;
}

function buildWhatsAppBillMessage(
customerName: string,
date: string,
items: SaleItem[],
total: number,
paidValue: number,
balanceValue: number,
method: string,
cashValue: number = 0,
upiValue: number = 0
) {
const itemLines = items
.map((item, index) => {
const pack = item.pack_size ? ` (${getPackDisplay(item.pack_size)})` : "";
return `${index + 1}. ${item.product_name}${pack}\n   Qty: ${item.quantity}  Rate: ₹${item.rate.toFixed(2)}  Amount: ₹${item.amount.toFixed(2)}`;
})
.join("\n");

const paymentLines = method === "Split"
? [
`Payment: Split`,
`Cash Paid: ₹${cashValue.toFixed(2)}`,
`UPI Paid: ₹${upiValue.toFixed(2)}`,
].join("\n")
: `Payment: ${method}`;

return [
"*MANVI MILK AGENCIES*",
"*BILL*",
"────────────────────────",
`Customer: ${customerName}`,
`Date: ${formatDisplayDate(date)}`,
"────────────────────────",
itemLines,
"────────────────────────",
`TOTAL: ₹${total.toFixed(2)}`,
`PAID: ₹${paidValue.toFixed(2)}`,
`BALANCE: ₹${balanceValue.toFixed(2)}`,
paymentLines,
"────────────────────────",
"Thank you for your business.",
].join("\n");
}
function openWhatsAppBill() {
if (!selectedCustomer) {
alert("Please select a customer first.");
return;
}

if (saleItems.length === 0) {
alert("Please add at least one product before sending the bill.");
return;
}

const phone = getWhatsAppNumber(selectedCustomer.mobile);
if (!phone) {
alert("This customer does not have a valid mobile number. Add the mobile number in Customers first.");
return;
}

const message = buildWhatsAppBillMessage(
selectedCustomer.customer_name,
saleDate,
saleItems,
totalSale,
paid,
balance,
paymentMethod,
Number(cashAmount) || 0,
Number(upiAmount) || 0
);

const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
window.open(url, "_blank", "noopener,noreferrer");
}

function getUpiPaymentUrl() {
if (!businessUpiId.trim() || balance <= 0) return "";

const params = new URLSearchParams({
pa: businessUpiId.trim(),
pn: "MANVI MILK AGENCIES",
am: balance.toFixed(2),
cu: "INR",
});

return `upi://pay?${params.toString()}`;
}

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
MISSED / LEFT-BEHIND CUSTOMERS
Customers who do not have any saved sale for the
currently selected sale date are shown here.
========================================================= */
const [missedCustomers, setMissedCustomers] =
useState<Customer[]>([]);

const [loadingMissedCustomers, setLoadingMissedCustomers] =
useState(false);

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
      .select("id, customer_name, mobile, route")
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
          balance_amount,
          cash_amount,
          upi_amount
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
        cash_amount:
          Number(
            sale.cash_amount
          ) || 0,
        upi_amount:
          Number(
            sale.upi_amount
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
LOAD MISSED / LEFT-BEHIND CUSTOMERS

A customer is considered missed when there is no saved
sale for that customer on the selected sale date.
Walk-in sales do not affect this list because they have
no customer_id.
========================================================= */
async function loadMissedCustomers() {
  if (!saleDate || customers.length === 0) {
    setMissedCustomers([]);
    return;
  }

  try {
    setLoadingMissedCustomers(true);

    const {
      data: salesForDate,
      error,
    } = await supabase
      .from("sales")
      .select("customer_id")
      .eq("sale_date", saleDate);

    if (error) {
      throw error;
    }

    const soldCustomerIds = new Set(
      (salesForDate || [])
        .map((sale: any) => String(sale.customer_id || ""))
        .filter(Boolean)
    );

    const leftBehind = customers.filter(
      (customer) => !soldCustomerIds.has(String(customer.id))
    );

    setMissedCustomers(leftBehind);
  } catch (error: any) {
    console.error(
      "Missed customers error:",
      error
    );

    setMissedCustomers([]);
  } finally {
    setLoadingMissedCustomers(false);
  }
}

function selectMissedCustomer(customerIdToSelect: string) {
  setCustomerId(customerIdToSelect);

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
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

useEffect(() => {
if (!loadingData) {
loadMissedCustomers();
}
}, [
customers,
saleDate,
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
PUNCH TODAY'S SALE
Loads the customer's latest previous sale and prepares
the same products/quantities as today's draft.
It does NOT save until Save Sale is pressed.
========================================================= */
async function punchTodaysSale() {
  if (!customerId) {
    alert("Please select a customer first.");
    return;
  }

  try {
    setLoading(true);

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
      .lt("sale_date", saleDate)
      .order("sale_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousSaleError) {
      throw previousSaleError;
    }

    if (!previousSale) {
      alert("No previous sale found for this customer.");
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
      alert("Previous sale has no products.");
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
      alert("Previous sale products could not be found.");
      return;
    }

    setSaleItems(validItems);
    setPaymentMethod(previousSale.payment_method || "Cash");
    setPaidAmount("0");
    setCashAmount("0");
    setUpiAmount("0");
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
      `Today's sale prepared from ${formatDisplayDate(
        previousSale.sale_date
      )}.\n\nPlease check the quantities and press Save Sale.`
    );
  } catch (error: any) {
    console.error("Punch today's sale error:", error);
    alert(
      "Unable to punch today's sale:\n" +
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

const cashPaid = Math.max(0, Number(cashAmount) || 0);
const upiPaid = Math.max(0, Number(upiAmount) || 0);

const paid =
  paymentMethod === "Split"
    ? cashPaid + upiPaid
    : Math.max(0, Number(paidAmount) || 0);

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

setCashAmount("0");

setUpiAmount("0");

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

if (paymentMethod === "Split" && cashPaid < 0) {
  alert("Cash amount cannot be negative.");
  return;
}

if (paymentMethod === "Split" && upiPaid < 0) {
  alert("UPI amount cannot be negative.");
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

      cash_amount:
        paymentMethod === "Split" ? cashPaid : paymentMethod === "Cash" ? paid : 0,

      upi_amount:
        paymentMethod === "Split" ? upiPaid : paymentMethod === "UPI" ? paid : 0,
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
  await loadMissedCustomers();
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

      cash_amount:
        paymentMethod === "Split" ? cashPaid : paymentMethod === "Cash" ? paid : 0,

      upi_amount:
        paymentMethod === "Split" ? upiPaid : paymentMethod === "UPI" ? paid : 0,
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
  await loadMissedCustomers();
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
      balance_amount,
      cash_amount,
      upi_amount
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

  setCashAmount(
    String(Number(sale.cash_amount) || 0)
  );

  setUpiAmount(
    String(Number(sale.upi_amount) || 0)
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
BILL SETTINGS
The information saved in Settings is loaded every time a bill
is generated/printed so the latest business details appear on
the bill automatically.
========================================================= */
async function loadBillSettings() {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Bill settings error:", error);
    // Bills can still be generated with the business-name fallback.
    return null;
  }

  return (data || null) as any;
}

function getBillSetting(settings: any, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = settings?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
}

function getBillCurrencySymbol(currency: string) {
  const value = String(currency || "").trim();
  if (!value) return "₹";
  if (value.includes("₹") || value.toUpperCase() === "INR" || value.toUpperCase().includes("INDIAN RUPEE")) {
    return "₹";
  }
  return value;
}

/* =========================================================
GENERATE SAVED BILL PDF
========================================================= */
async function generateSavedBillPdf(saleId: string): Promise<File | null> {
  try {
    setLoading(true);

    const [{ data: sale, error: saleError }, { data: items, error: itemsError }, settings] =
      await Promise.all([
        supabase
          .from("sales")
          .select("id, sale_no, sale_date, customer_id, payment_method, total_amount, paid_amount, balance_amount, cash_amount, upi_amount")
          .eq("id", saleId)
          .single(),
        supabase
          .from("sale_items")
          .select("product_id, quantity, rate, amount")
          .eq("sale_id", saleId)
          .order("id", { ascending: true }),
        loadBillSettings(),
      ]);

    if (saleError) throw saleError;
    if (itemsError) throw itemsError;
    if (!sale) throw new Error("Sale not found.");

    const customer = customers.find((c) => c.id === sale.customer_id);
    const customerName = customer?.customer_name || "Walk-in";

    const businessName = getBillSetting(settings, ["business_name", "businessName", "name"], "MANVI MILK AGENCIES");
    const mobile = getBillSetting(settings, ["mobile", "phone", "business_mobile", "whatsapp_number", "whatsappNumber"]);
    const email = getBillSetting(settings, ["email", "business_email"]);
    const address = getBillSetting(settings, ["business_address", "address", "businessAddress"]);
    const billPrefix = getBillSetting(settings, ["bill_prefix", "invoice_prefix", "billPrefix", "invoicePrefix"], "INV");
    const currency = getBillCurrencySymbol(getBillSetting(settings, ["currency"], "INR"));
    const footer = getBillSetting(settings, ["invoice_footer", "bill_footer", "footer"], "Thank you for your business.");
    const billNo = String(sale.sale_no || `${billPrefix}${String(sale.id).slice(0, 8).toUpperCase()}`);

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 14;
    let y = 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(businessName, pageWidth / 2, y, { align: "center" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (mobile) {
      doc.text(`Mobile: ${mobile}`, pageWidth / 2, y, { align: "center" });
      y += 5;
    }
    if (email) {
      doc.text(`Email: ${email}`, pageWidth / 2, y, { align: "center" });
      y += 5;
    }
    if (address) {
      const addressLines = doc.splitTextToSize(address, pageWidth - left * 2);
      doc.text(addressLines, pageWidth / 2, y, { align: "center" });
      y += Math.max(5, addressLines.length * 4);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("BILL", pageWidth / 2, y + 2, { align: "center" });
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Bill No: ${billNo}`, left, y);
    doc.text(`Date: ${formatDisplayDate(sale.sale_date)}`, pageWidth - left, y, { align: "right" });
    y += 7;
    doc.text(`Customer: ${customerName}`, left, y);
    y += 7;

    const method = String(sale.payment_method || "Cash");
    doc.text(`Payment: ${method}`, left, y);
    y += 7;
    if (method === "Split") {
      doc.text(`${currency} Cash: ${Number(sale.cash_amount || 0).toFixed(2)}    ${currency} UPI: ${Number(sale.upi_amount || 0).toFixed(2)}`, left, y);
      y += 7;
    }

    const cols = [left, 25, 125, 196];
    const headers = ["#", "Product", "Qty", "Amount"];
    doc.setFillColor(235, 242, 255);
    doc.rect(left, y - 5, pageWidth - left * 2, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.text(headers[0], cols[0], y);
    doc.text(headers[1], cols[1], y);
    doc.text(headers[2], cols[2], y, { align: "right" });
    doc.text(headers[3], cols[3], y, { align: "right" });
    y += 6;

    doc.setFont("helvetica", "normal");
    for (let i = 0; i < (items || []).length; i++) {
      const item: any = items![i];
      const product = products.find((p) => p.id === item.product_id);
      const name = String(product?.product_name || "Product");
      const pack = product?.pack_size ? ` (${String(product.pack_size)})` : "";
      const lines = doc.splitTextToSize(name + pack, 75);
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
      doc.text(String(i + 1), cols[0], y);
      doc.text(lines, cols[1], y);
      doc.text(Number(item.quantity || 0).toFixed(2).replace(/\.00$/, ""), cols[2], y, { align: "right" });
      doc.text(`${currency} ${Number(item.amount || 0).toFixed(2)}`, cols[3], y, { align: "right" });
      y += Math.max(6, lines.length * 5);
    }

    y += 4;
    doc.line(left, y, pageWidth - left, y);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: ${currency} ${Number(sale.total_amount || 0).toFixed(2)}`, pageWidth - left, y, { align: "right" });
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`PAID: ${currency} ${Number(sale.paid_amount || 0).toFixed(2)}`, pageWidth - left, y, { align: "right" });
    y += 7;
    doc.text(`BALANCE: ${currency} ${Number(sale.balance_amount || 0).toFixed(2)}`, pageWidth - left, y, { align: "right" });
    y += 14;
    doc.setFontSize(9);
    doc.text(footer, pageWidth / 2, y, { align: "center" });

    const safeCustomer = customerName.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "Customer";
    const fileName = `MANVI_BILL_${safeCustomer}_${String(sale.sale_date).slice(0, 10)}.pdf`;
    const blob = doc.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });
    doc.save(fileName);
    return file;
  } catch (error: any) {
    console.error("Generate PDF bill error:", error);
    alert("Unable to generate bill PDF:\n" + (error?.message || "Unknown error"));
    return null;
  } finally {
    setLoading(false);
  }
}

async function shareSavedBillPdf(saleId: string) {
  const file = await generateSavedBillPdf(saleId);
  if (!file) return;

  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: "MANVI BILL",
        text: "Bill",
        files: [file],
      });
    } else {
      alert("Bill PDF generated and downloaded. On mobile, open the PDF and use Share → WhatsApp.");
    }
  } catch (error: any) {
    if (error?.name !== "AbortError") {
      alert("Bill PDF was generated and downloaded. You can share the downloaded PDF on WhatsApp.");
    }
  }
}

/* =========================================================
PRINT SAVED BILL
========================================================= */
async function printSavedBill(saleId: string) {
  try {
    setLoading(true);

    const [{ data: sale, error: saleError }, { data: items, error: itemsError }] =
      await Promise.all([
        supabase
          .from("sales")
          .select("id, sale_no, sale_date, customer_id, payment_method, total_amount, paid_amount, balance_amount, cash_amount, upi_amount")
          .eq("id", saleId)
          .single(),
        supabase
          .from("sale_items")
          .select("product_id, quantity, rate, amount")
          .eq("sale_id", saleId)
          .order("id", { ascending: true }),
      ]);

    if (saleError) throw saleError;
    if (itemsError) throw itemsError;
    if (!sale) throw new Error("Sale not found.");

    const settings = await loadBillSettings();
    const customer = customers.find((c) => c.id === sale.customer_id);
    const customerName = customer?.customer_name || "Walk-in";
    const businessName = getBillSetting(settings, ["business_name", "businessName", "name"], "MANVI MILK AGENCIES");
    const mobile = getBillSetting(settings, ["mobile", "phone", "business_mobile", "whatsapp_number", "whatsappNumber"]);
    const email = getBillSetting(settings, ["email", "business_email"]);
    const address = getBillSetting(settings, ["business_address", "address", "businessAddress"]);
    const billPrefix = getBillSetting(settings, ["bill_prefix", "invoice_prefix", "billPrefix", "invoicePrefix"], "INV");
    const currency = getBillCurrencySymbol(getBillSetting(settings, ["currency"], "INR"));
    const footer = getBillSetting(settings, ["invoice_footer", "bill_footer", "footer"], "Thank you for your business.");
    const billNo = String(sale.sale_no || `${billPrefix}${String(sale.id).slice(0, 8).toUpperCase()}`);
    const safe = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const rows = (items || [])
      .map((item: any, index: number) => {
        const product = products.find((p) => p.id === item.product_id);
        return `<tr>
          <td>${index + 1}</td>
          <td>${safe(product?.product_name || "Product")}</td>
          <td>${safe(product?.pack_size || "")}</td>
          <td>${Number(item.quantity || 0)}</td>
          <td>₹ ${Number(item.amount || 0).toFixed(2)}</td>
        </tr>`;
      })
      .join("");

    const method = String(sale.payment_method || "Cash");
    const splitHtml = method === "Split"
      ? `<div>Cash: ₹ ${Number(sale.cash_amount || 0).toFixed(2)} &nbsp; | &nbsp; UPI: ₹ ${Number(sale.upi_amount || 0).toFixed(2)}</div>`
      : "";

    const html = `<!doctype html><html><head><title>MANVI BILL</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{text-align:center;margin:0 0 4px}h2{text-align:center;margin:0 0 18px;font-size:16px} .meta{margin-bottom:16px;line-height:1.7}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f1f5f9}td:nth-child(1),td:nth-child(4){text-align:center}td:nth-child(5){text-align:right}.totals{margin-top:18px;margin-left:auto;width:300px;line-height:1.8}.grand{font-size:18px;font-weight:bold;border-top:2px solid #111;padding-top:6px}.footer{text-align:center;margin-top:28px;font-size:13px;color:#555}@media print{body{padding:8px}}
      </style></head><body>
      <h1>${safe(businessName)}</h1>
      ${mobile ? `<div style="text-align:center">Mobile: ${safe(mobile)}</div>` : ""}
      ${email ? `<div style="text-align:center">Email: ${safe(email)}</div>` : ""}
      ${address ? `<div style="text-align:center;margin-bottom:8px">${safe(address)}</div>` : ""}
      <h2>BILL</h2>
      <div class="meta"><strong>Bill No:</strong> ${safe(billNo)}<br><strong>Customer:</strong> ${safe(customerName)}<br><strong>Date:</strong> ${safe(formatDisplayDate(sale.sale_date))}<br><strong>Payment:</strong> ${safe(method)} ${splitHtml}</div>
      <table><thead><tr><th>#</th><th>Product</th><th>Pack</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div>Total: ${currency} ${Number(sale.total_amount || 0).toFixed(2)}</div><div>Paid: ${currency} ${Number(sale.paid_amount || 0).toFixed(2)}</div><div>Balance: ${currency} ${Number(sale.balance_amount || 0).toFixed(2)}</div><div class="grand">Net Total: ${currency} ${Number(sale.total_amount || 0).toFixed(2)}</div></div>
      <div class="footer">${safe(footer)}</div>
      <script>window.onload=function(){window.print();}</script></body></html>`;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) throw new Error("Popup blocked. Please allow popups for MANVI ERP.");
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } catch (error: any) {
    console.error("Print bill error:", error);
    alert("Unable to open bill:\n" + (error?.message || "Unknown error"));
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
  await loadMissedCustomers();
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
            onClick={punchTodaysSale}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-4 text-lg shadow transition disabled:bg-gray-400"
          >
            ⚡ Punch Today's Sale
          </button>

          <p className="mt-2 text-sm text-gray-500">
            Loads the customer's last sale for today's entry. Check quantities before saving.
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

          <option value="Split">
            Split (Cash + UPI)
          </option>
        </select>
      </div>

      {/* PAID */}

      {paymentMethod === "Split" ? (
        <>
          <div>
            <label className="block font-semibold mb-2">
              Cash Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              className="w-full border rounded-xl px-4 py-3"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">
              UPI Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={upiAmount}
              onChange={(e) => setUpiAmount(e.target.value)}
              className="w-full border rounded-xl px-4 py-3"
              placeholder="0"
            />
          </div>
        </>
      ) : (
        <div>
          <label className="block font-semibold mb-2">
            Amount Paid
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            className="w-full border rounded-xl px-4 py-3"
            placeholder="0"
          />
        </div>
      )}

    </div>

    {paymentMethod === "Split" && (
      <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div><span className="text-gray-600">Cash:</span> <strong>₹ {cashPaid.toFixed(2)}</strong></div>
          <div><span className="text-gray-600">UPI:</span> <strong>₹ {upiPaid.toFixed(2)}</strong></div>
          <div><span className="text-gray-600">Total Paid:</span> <strong>₹ {paid.toFixed(2)}</strong></div>
        </div>
        {paid > totalSale && (
          <p className="mt-2 text-sm font-semibold text-red-600">Cash + UPI cannot exceed the sale total.</p>
        )}
      </div>
    )}

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
        UPI QR + WHATSAPP
    =================================================== */}
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-purple-800">UPI QR</h3>
            <p className="text-sm text-purple-700 mt-1">Scan to pay the current balance.</p>
          </div>
          <span className="font-bold text-purple-800">₹ {balance.toFixed(2)}</span>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="bg-white p-3 rounded-xl border">
            {getUpiPaymentUrl() ? (
              <QRCodeSVG value={getUpiPaymentUrl()} size={180} includeMargin />
            ) : (
              <div className="w-[180px] h-[180px] flex items-center justify-center text-center text-sm text-gray-500 p-4">
                Enter the business UPI ID below to generate the QR.
              </div>
            )}
          </div>

          <div className="w-full">
            <label className="block font-semibold mb-2">Business UPI ID</label>
            <input
              type="text"
              value={businessUpiId}
              onChange={(e) => saveBusinessUpiId(e.target.value)}
              placeholder="example@upi"
              className="w-full border rounded-xl px-4 py-3 bg-white"
            />
            <p className="text-xs text-gray-500 mt-2">Saved on this device for future bills.</p>
            {balance <= 0 && (
              <p className="text-sm font-semibold text-green-700 mt-2">No balance due.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
        <h3 className="text-xl font-bold text-green-800">WhatsApp Bill</h3>
        <p className="text-sm text-green-700 mt-1">Open WhatsApp with the customer bill already prepared.</p>

        <div className="mt-4 rounded-xl bg-white border p-4">
          <p className="font-semibold">Customer</p>
          <p className="text-gray-700">{selectedCustomer?.customer_name || "Select customer"}</p>
          <p className="text-sm text-gray-500 mt-1">
            Mobile: {selectedCustomer?.mobile || "Not available"}
          </p>
        </div>

        <button
          type="button"
          onClick={openWhatsAppBill}
          disabled={!selectedCustomer || saleItems.length === 0}
          className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl font-bold"
        >
          📲 WhatsApp Bill
        </button>
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
      MISSED / LEFT-BEHIND CUSTOMERS
  ===================================================== */}

  <div className="bg-white rounded-2xl shadow p-6">

    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">

      <div>
        <h2 className="text-2xl font-bold text-red-600">
          Customers Left Behind
        </h2>

        <p className="text-gray-500 mt-1">
          Customers with no saved sale for {formatDisplayDate(saleDate)}.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-full bg-red-100 px-4 py-2 font-bold text-red-700">
          {missedCustomers.length} Missed
        </span>

        <button
          type="button"
          onClick={loadMissedCustomers}
          disabled={loadingMissedCustomers || loadingData}
          className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
        >
          {loadingMissedCustomers ? "Checking..." : "Refresh"}
        </button>
      </div>

    </div>

    {loadingMissedCustomers ? (
      <div className="rounded-xl bg-gray-50 p-6 text-center text-gray-500">
        Checking customers for this date...
      </div>
    ) : missedCustomers.length === 0 ? (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="text-lg font-bold text-green-700">
          ✓ No customer left behind
        </div>
        <p className="mt-1 text-green-600">
          Every customer has a saved sale for {formatDisplayDate(saleDate)}.
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {missedCustomers.map((customer) => (
          <div
            key={customer.id}
            className="rounded-xl border-2 border-red-100 bg-red-50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-gray-900 truncate">
                  {customer.customer_name}
                </div>

                {customer.route ? (
                  <div className="mt-1 text-sm font-medium text-blue-700">
                    Route: {customer.route}
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-gray-500">
                    Route: Not set
                  </div>
                )}

                {customer.mobile ? (
                  <div className="mt-1 text-sm text-gray-600">
                    Mobile: {customer.mobile}
                  </div>
                ) : null}
              </div>

              <span className="shrink-0 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                MISSED
              </span>
            </div>

            <button
              type="button"
              onClick={() => selectMissedCustomer(customer.id)}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
            >
              Select Customer / Punch Sale
            </button>
          </div>
        ))}
      </div>
    )}

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
                    <div>{sale.payment_method}</div>
                    {sale.payment_method === "Split" && (
                      <div className="text-xs text-gray-500 mt-1">
                        C ₹{sale.cash_amount.toFixed(2)} + UPI ₹{sale.upi_amount.toFixed(2)}
                      </div>
                    )}
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
                        disabled={loading}
                        onClick={() => void generateSavedBillPdf(sale.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                      >
                        📄 Generate Bill
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void shareSavedBillPdf(sale.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                      >
                        📲 WhatsApp PDF
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void printSavedBill(sale.id)}
                        className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                      >
                        🖨️ Print
                      </button>

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