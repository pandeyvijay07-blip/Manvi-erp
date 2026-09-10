import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  product_name: string;
  selling_rate: number;
  walkin_rate: number | null;
  purchase_rate: number;
  stock_qty: number;
};

type CartItem = {
  product_id: string;
  product_name: string;
  qty: number;
  rate: number;
  cost_rate: number;
  amount: number;
};

type RecentWalkInSale = {
  id: string;
  sale_date: string;
  payment_method: string;
  total_amount: number;
  paid_amount: number;
};

function getTodayLocalDate() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function formatDateDDMMYYYY(dateString: string) {
  const parts = String(dateString || "")
    .slice(0, 10)
    .split("-");

  if (parts.length !== 3) {
    return "-";
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function WalkInSales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recentSales, setRecentSales] = useState<
    RecentWalkInSale[]
  >([]);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState("1");
  const [rate, setRate] = useState("0");

  const [paymentMethod, setPaymentMethod] =
    useState("Cash");

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [productSearch, setProductSearch] =
    useState("");

  const grandTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.amount,
        0
      ),
    [cart]
  );

  const filteredProducts = useMemo(() => {
    const search = productSearch
      .trim()
      .toLowerCase();

    if (!search) {
      return products;
    }

    return products.filter((product) =>
      product.product_name
        .toLowerCase()
        .includes(search)
    );
  }, [products, productSearch]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoadingData(true);

    try {
      await Promise.all([
        loadProducts(),
        loadRecentSales(),
      ]);
    } finally {
      setLoadingData(false);
    }
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        product_name,
        selling_rate,
        walkin_rate,
        purchase_rate,
        stock_qty
      `)
      .order("product_name");

    if (error) {
      throw error;
    }

    setProducts(
      (data || []).map((product) => ({
        ...product,
        selling_rate:
          Number(product.selling_rate) || 0,
        walkin_rate:
          product.walkin_rate === null || product.walkin_rate === undefined
            ? null
            : Number(product.walkin_rate),
        purchase_rate:
          Number(product.purchase_rate) || 0,
        stock_qty:
          Number(product.stock_qty) || 0,
      }))
    );
  }

  async function loadRecentSales() {
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        sale_date,
        customer_id,
        sale_type,
        payment_method,
        total_amount,
        paid_amount
      `)
      .is("customer_id", null)
      .eq("sale_type", "WALKIN")
      .order("sale_date", {
        ascending: false,
      })
      .limit(20);

    if (error) {
      console.error(
        "Walk-in recent sales error:",
        error
      );
      return;
    }

    setRecentSales(
      (data || []).map((sale: any) => ({
        id: String(sale.id),
        sale_date: String(
          sale.sale_date || ""
        ).slice(0, 10),
        payment_method:
          sale.payment_method || "Cash",
        total_amount:
          Number(sale.total_amount) || 0,
        paid_amount:
          Number(sale.paid_amount) || 0,
      }))
    );
  }

  function handleProductChange(id: string) {
    setSelectedProduct(id);

    const product = products.find(
      (p) => p.id === id
    );

    if (!product) {
      setRate("0");
      return;
    }

    const fixedWalkInRate =
      product.walkin_rate === null ||
      product.walkin_rate === undefined
        ? null
        : Number(product.walkin_rate);

    setRate(
      String(
        fixedWalkInRate !== null
          ? fixedWalkInRate
          : Number(product.selling_rate || 0)
      )
    );
  }

  function addItem() {
    if (!selectedProduct) {
      alert("Please select a product.");
      return;
    }

    const product = products.find(
      (p) => p.id === selectedProduct
    );

    if (!product) {
      alert("Product not found.");
      return;
    }

    const quantity = Number(qty);
    const fixedWalkInRate =
      product.walkin_rate === null ||
      product.walkin_rate === undefined
        ? null
        : Number(product.walkin_rate);

    const enteredRate = Number(rate);
    const saleRate =
      fixedWalkInRate !== null
        ? fixedWalkInRate
        : enteredRate;

    const availableStock =
      Number(product.stock_qty) || 0;

    if (fixedWalkInRate !== null) {
      setRate(String(fixedWalkInRate));
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      alert("Enter valid quantity.");
      return;
    }

    if (
      !Number.isFinite(saleRate) ||
      saleRate <= 0
    ) {
      alert(
        "Enter a valid Walk-in Rate for this product."
      );
      return;
    }

    if (fixedWalkInRate !== null && Math.abs(saleRate - fixedWalkInRate) > 0.000001) {
      alert(
        `Walk-in Rate is fixed at ₹${fixedWalkInRate.toFixed(2)} for this product.`
      );
      setRate(String(fixedWalkInRate));
      return;
    }

    const existing = cart.find(
      (item) =>
        item.product_id === product.id
    );

    const existingQty =
      existing?.qty || 0;

    const totalQty =
      existingQty + quantity;

    if (totalQty > availableStock) {
      alert(
        `Only ${availableStock} stock available.`
      );
      return;
    }

    if (existing) {
      setCart((currentCart) =>
        currentCart.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                qty: totalQty,
                rate: saleRate,
                cost_rate:
                  Number(
                    product.purchase_rate
                  ) || 0,
                amount:
                  totalQty * saleRate,
              }
            : item
        )
      );
    } else {
      setCart((currentCart) => [
        ...currentCart,
        {
          product_id: product.id,
          product_name:
            product.product_name,
          qty: quantity,
          rate: saleRate,
          cost_rate:
            Number(
              product.purchase_rate
            ) || 0,
          amount:
            quantity * saleRate,
        },
      ]);
    }

    setSelectedProduct("");
    setProductSearch("");
    setQty("1");
    setRate("0");
  }

  function removeItem(index: number) {
    setCart((currentCart) =>
      currentCart.filter(
        (_, i) => i !== index
      )
    );
  }

  function clearBill() {
    setCart([]);
    setSelectedProduct("");
    setProductSearch("");
    setQty("1");
    setRate("0");
    setPaymentMethod("Cash");
  }

  async function saveSale() {
    if (cart.length === 0) {
      alert(
        "Please add at least one product."
      );
      return;
    }

    // Validate the complete cart again immediately
    // before writing anything to the database.
    for (const item of cart) {
      const product = products.find(
        (p) => p.id === item.product_id
      );

      if (!product) {
        alert(
          `Product not found: ${item.product_name}`
        );
        return;
      }

      const stock =
        Number(product.stock_qty) || 0;

      if (
        Number(item.qty) <= 0 ||
        Number(item.qty) > stock
      ) {
        alert(
          `${item.product_name}: only ${stock} stock available.`
        );
        return;
      }
    }

    setLoading(true);

    let createdSaleId: string | null = null;

    // Track stock values changed during this save.
    // They can be restored if a later database step fails.
    const stockChanges: {
      productId: string;
      previousStock: number;
    }[] = [];

    const walkInRateChanges: {
      productId: string;
      previousWalkInRate: number | null;
    }[] = [];

    try {
      const saleDate =
        getTodayLocalDate();

      // ---------------------------------------------
      // 1. SAVE SALES HEADER
      // ---------------------------------------------

      const {
        data: sale,
        error: saleError,
      } = await supabase
        .from("sales")
        .insert([
          {
            sale_date: saleDate,
            customer_id: null,
            sale_type: "WALKIN",
            payment_method:
              paymentMethod,
            total_amount:
              grandTotal,
            paid_amount:
              grandTotal,
            balance_amount: 0,
          },
        ])
        .select()
        .single();

      if (saleError) {
        throw saleError;
      }

      if (!sale?.id) {
        throw new Error(
          "Walk-in sale was not created."
        );
      }

      createdSaleId = String(sale.id);

      // ---------------------------------------------
      // 2. SAVE SALE ITEMS
      // ---------------------------------------------

      const saleItems = cart.map(
        (item) => ({
          sale_id: sale.id,
          product_id:
            item.product_id,
          quantity:
            item.qty,
          rate:
            item.rate,
          cost_rate:
            item.cost_rate,
          amount:
            item.amount,
        })
      );

      const {
        error: itemError,
      } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemError) {
        throw itemError;
      }

      // ---------------------------------------------
      // 3. SAVE FIRST-TIME WALK-IN RATES
      // ---------------------------------------------

      for (const item of cart) {
        const product = products.find(
          (p) => p.id === item.product_id
        );

        if (!product) {
          throw new Error(
            `Product not found: ${item.product_name}`
          );
        }

        const existingWalkInRate =
          product.walkin_rate === null ||
          product.walkin_rate === undefined
            ? null
            : Number(product.walkin_rate);

        if (existingWalkInRate === null) {
          const chosenRate = Number(item.rate) || 0;

          if (chosenRate <= 0) {
            throw new Error(
              `Invalid Walk-in Rate for ${item.product_name}.`
            );
          }

          walkInRateChanges.push({
            productId: item.product_id,
            previousWalkInRate: null,
          });

          const { error: rateError } = await supabase
            .from("products")
            .update({
              walkin_rate: chosenRate,
            })
            .eq("id", item.product_id);

          if (rateError) {
            throw rateError;
          }
        } else if (Math.abs(existingWalkInRate - Number(item.rate)) > 0.000001) {
          throw new Error(
            `${item.product_name}: Walk-in Rate is already fixed at ₹${existingWalkInRate.toFixed(2)}.`
          );
        }
      }

      // ---------------------------------------------
      // 4. UPDATE STOCK
      // ---------------------------------------------

      for (const item of cart) {
        const product = products.find(
          (p) =>
            p.id === item.product_id
        );

        if (!product) {
          throw new Error(
            `Product not found: ${item.product_name}`
          );
        }

        const previousStock =
          Number(
            product.stock_qty
          ) || 0;

        const quantity =
          Number(item.qty) || 0;

        const newStock =
          previousStock - quantity;

        if (newStock < 0) {
          throw new Error(
            `Insufficient stock for ${item.product_name}.`
          );
        }

        stockChanges.push({
          productId:
            item.product_id,
          previousStock,
        });

        const {
          error: stockError,
        } = await supabase
          .from("products")
          .update({
            stock_qty: newStock,
          })
          .eq(
            "id",
            item.product_id
          );

        if (stockError) {
          throw stockError;
        }
      }

      // ---------------------------------------------
      // 5. REFRESH EVERYTHING
      // ---------------------------------------------

      alert(
        "Walk-in Sale Saved Successfully."
      );

      clearBill();

      await Promise.all([
        loadProducts(),
        loadRecentSales(),
      ]);
    } catch (error: any) {
      console.error(
        "WALK-IN SAVE ERROR:",
        error
      );

      // ---------------------------------------------
      // ROLLBACK FIRST-TIME WALK-IN RATES
      // ---------------------------------------------

      for (const change of walkInRateChanges.reverse()) {
        const { error: restoreRateError } = await supabase
          .from("products")
          .update({
            walkin_rate: change.previousWalkInRate,
          })
          .eq("id", change.productId);

        if (restoreRateError) {
          console.error(
            "WALK-IN RATE ROLLBACK ERROR:",
            restoreRateError
          );
        }
      }

      // ---------------------------------------------
      // ROLLBACK STOCK CHANGES
      // ---------------------------------------------

      for (
        const change of stockChanges.reverse()
      ) {
        const {
          error: restoreError,
        } = await supabase
          .from("products")
          .update({
            stock_qty:
              change.previousStock,
          })
          .eq(
            "id",
            change.productId
          );

        if (restoreError) {
          console.error(
            "STOCK ROLLBACK ERROR:",
            restoreError
          );
        }
      }

      // ---------------------------------------------
      // ROLLBACK SALE + ITEMS
      // ---------------------------------------------

      if (createdSaleId) {
        const {
          error: deleteItemsError,
        } = await supabase
          .from("sale_items")
          .delete()
          .eq(
            "sale_id",
            createdSaleId
          );

        if (deleteItemsError) {
          console.error(
            "SALE ITEM ROLLBACK ERROR:",
            deleteItemsError
          );
        }

        const {
          error: deleteSaleError,
        } = await supabase
          .from("sales")
          .delete()
          .eq(
            "id",
            createdSaleId
          );

        if (deleteSaleError) {
          console.error(
            "SALE ROLLBACK ERROR:",
            deleteSaleError
          );
        }
      }

      alert(
        "Walk-in Sale was not completed.\n\n" +
          (error?.message ||
            "Unknown error") +
          "\n\nNo partial sale should remain."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">

      {/* PAGE HEADER */}

      <div>
        <h1 className="text-3xl font-bold text-blue-700">
          Walk-in Sales
        </h1>

        <p className="mt-1 text-gray-600">
          Counter sale without a customer account.
        </p>
      </div>

      {/* SALE FORM */}

      <div className="rounded-2xl bg-white p-6 shadow-lg">

        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-gray-600">
            Sale Date
          </p>

          <p className="mt-1 text-xl font-bold text-blue-700">
            {formatDateDDMMYYYY(
              getTodayLocalDate()
            )}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Walk-in sale is stored as
            <span className="font-semibold">
              {" "}WALKIN
            </span>
            {" "}with no customer outstanding.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">

          {/* PRODUCT SEARCH */}

          <div>

            <label className="mb-2 block font-medium">
              Search Product
            </label>

            <input
              type="text"
              value={productSearch}
              onChange={(e) =>
                setProductSearch(
                  e.target.value
                )
              }
              placeholder="Search product..."
              className="w-full rounded-lg border p-3"
            />

          </div>

          {/* PRODUCT */}

          <div>

            <label className="mb-2 block font-medium">
              Product
            </label>

            <select
              value={selectedProduct}
              onChange={(e) =>
                handleProductChange(
                  e.target.value
                )
              }
              className="w-full rounded-lg border p-3"
              disabled={loadingData}
            >
              <option value="">
                Select Product
              </option>

              {filteredProducts.map(
                (product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.product_name}{" "}
                    — Stock:{" "}
                    {Number(
                      product.stock_qty || 0
                    )}
                  </option>
                )
              )}

            </select>

          </div>

          {/* QUANTITY */}

          <div>

            <label className="mb-2 block font-medium">
              Quantity
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) =>
                setQty(e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />

          </div>

          {/* RATE */}

          <div>

            <label className="mb-2 block font-medium">
              Walk-in Rate
            </label>

            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              readOnly={
                !!selectedProduct &&
                (() => {
                  const p = products.find(
                    (item) => item.id === selectedProduct
                  );
                  return p?.walkin_rate !== null &&
                    p?.walkin_rate !== undefined;
                })()
              }
              className={`w-full rounded-lg border p-3 ${
                selectedProduct &&
                (() => {
                  const p = products.find(
                    (item) => item.id === selectedProduct
                  );
                  return p?.walkin_rate !== null &&
                    p?.walkin_rate !== undefined;
                })()
                  ? "bg-gray-100 text-gray-700"
                  : "bg-white"
              }`}
            />

            <p className="mt-1 text-sm text-gray-500">
              {(() => {
                const p = products.find(
                  (item) => item.id === selectedProduct
                );
                if (!p) return "Select a product.";
                return p.walkin_rate === null ||
                  p.walkin_rate === undefined
                  ? "First-time setup: change the rate here. It will be fixed after saving the first walk-in sale."
                  : "Fixed Walk-in Rate. Bulk/customer selling rate is separate.";
              })()}
            </p>

          </div>

          {/* PAYMENT */}

          <div>

            <label className="mb-2 block font-medium">
              Payment
            </label>

            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value
                )
              }
              className="w-full rounded-lg border p-3"
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
            </select>

          </div>

        </div>

        {/* ADD PRODUCT */}

        <div className="mt-5">

          <button
            onClick={addItem}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add Product
          </button>

        </div>

        {/* CART */}

        <div className="mt-8 overflow-x-auto">

          <table className="w-full border">

            <thead className="bg-blue-600 text-white">

              <tr>

                <th className="p-3 text-left">
                  Product
                </th>

                <th className="p-3 text-center">
                  Qty
                </th>

                <th className="p-3 text-center">
                  Rate
                </th>

                <th className="p-3 text-center">
                  Cost
                </th>

                <th className="p-3 text-center">
                  Amount
                </th>

                <th className="p-3 text-center">
                  Action
                </th>

              </tr>

            </thead>

            <tbody>

              {cart.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-5 text-center text-gray-500"
                  >
                    No products added.
                  </td>
                </tr>
              ) : (
                cart.map(
                  (item, index) => (
                    <tr
                      key={
                        `${item.product_id}-${index}`
                      }
                      className="border-b"
                    >

                      <td className="p-3">
                        {item.product_name}
                      </td>

                      <td className="p-3 text-center">
                        {item.qty}
                      </td>

                      <td className="p-3 text-center">
                        ₹{" "}
                        {item.rate.toFixed(2)}
                      </td>

                      <td className="p-3 text-center text-gray-600">
                        ₹{" "}
                        {item.cost_rate.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-center font-semibold">
                        ₹{" "}
                        {item.amount.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-center">

                        <button
                          onClick={() =>
                            removeItem(index)
                          }
                          disabled={loading}
                          className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>

                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

        </div>

        {/* TOTAL */}

        <div className="mt-8 flex flex-col gap-3 rounded-xl bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-gray-500">
              Products in cart
            </p>

            <p className="text-xl font-bold">
              {cart.length}
            </p>
          </div>

          <div className="text-left sm:text-right">

            <p className="text-gray-500">
              Grand Total
            </p>

            <p className="text-3xl font-bold text-green-600">
              ₹ {grandTotal.toFixed(2)}
            </p>

          </div>

        </div>

        {/* BUTTONS */}

        <div className="mt-8 flex flex-wrap gap-4">

          <button
            onClick={saveSale}
            disabled={
              loading ||
              cart.length === 0 ||
              grandTotal <= 0
            }
            className="rounded-lg bg-green-600 px-8 py-3 font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading
              ? "Saving..."
              : "Save Sale"}
          </button>

          <button
            onClick={clearBill}
            disabled={loading}
            className="rounded-lg bg-gray-600 px-8 py-3 font-semibold text-white hover:bg-gray-700 disabled:bg-gray-400"
          >
            Clear Bill
          </button>

        </div>

      </div>

      {/* RECENT WALK-IN SALES */}

      <div className="rounded-2xl bg-white p-6 shadow-lg">

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">

          <div>
            <h2 className="text-2xl font-bold text-blue-700">
              Recent Walk-in Sales
            </h2>

            <p className="text-gray-500">
              Walk-in payments are already paid at the counter.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRecentSales}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
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
                  Type
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

              </tr>
            </thead>

            <tbody>

              {recentSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-gray-500"
                  >
                    No walk-in sales found.
                  </td>
                </tr>
              ) : (
                recentSales.map(
                  (sale) => (
                    <tr
                      key={sale.id}
                      className="border-b hover:bg-gray-50"
                    >

                      <td className="p-3">
                        {formatDateDDMMYYYY(
                          sale.sale_date
                        )}
                      </td>

                      <td className="p-3 font-semibold">
                        Walk-in
                      </td>

                      <td className="p-3">
                        {sale.payment_method}
                      </td>

                      <td className="p-3 text-right font-bold">
                        ₹{" "}
                        {sale.total_amount.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-right font-bold text-green-600">
                        ₹{" "}
                        {sale.paid_amount.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-3 text-right font-bold text-gray-600">
                        ₹ 0.00
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
