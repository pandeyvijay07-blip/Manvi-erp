import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  customer_name: string;
};

type Product = {
  id: string;
  product_name: string;
  selling_rate: number;
};

type CustomerPrice = {
  id?: string;
  customer_id: string;
  product_id: string;
  selling_rate: number;
};

export default function CustomerPrices() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<CustomerPrice[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [loading, setLoading] = useState(false);

  // Add Product
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newProductRate, setNewProductRate] = useState("");

  // Editing
  const [editingProductId, setEditingProductId] = useState<string | null>(
    null
  );
  const [editingRate, setEditingRate] = useState("");

  useEffect(() => {
    loadCustomers();
    loadProducts();
  }, []);

  useEffect(() => {
    if (customerId) {
      loadCustomerPrices(customerId);
    } else {
      setPrices([]);
    }

    setShowAddProduct(false);
    setNewProductId("");
    setNewProductRate("");
    setEditingProductId(null);
    setEditingRate("");
  }, [customerId]);

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("id, customer_name")
      .order("customer_name");

    if (error) {
      alert(error.message);
      return;
    }

    setCustomers(data || []);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        product_name,
        selling_rate
      `)
      .order("product_name");

    if (error) {
      alert(error.message);
      return;
    }

    setProducts(data || []);
  }

  /*
   * IMPORTANT:
   * Only actual rows from customer_prices are assigned
   * to the customer.
   *
   * We DO NOT create rows for every Product Master product.
   */
  async function loadCustomerPrices(id: string) {
    setLoading(true);

    const { data, error } = await supabase
      .from("customer_prices")
      .select(`
        id,
        customer_id,
        product_id,
        selling_rate
      `)
      .eq("customer_id", id);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const rows: CustomerPrice[] = (data || []).map((row: any) => ({
      id: row.id,
      customer_id: row.customer_id,
      product_id: row.product_id,
      selling_rate: Number(row.selling_rate) || 0,
    }));

    setPrices(rows);

    setLoading(false);
  }

  function getProductName(productId: string) {
    return (
      products.find((product) => product.id === productId)
        ?.product_name || "Unknown Product"
    );
  }

  function getProductMasterRate(productId: string) {
    return (
      Number(
        products.find((product) => product.id === productId)?.selling_rate
      ) || 0
    );
  }

  /*
   * ADD PRODUCT TO CUSTOMER
   */
  async function addProduct() {
    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    if (!newProductId) {
      alert("Please select a product.");
      return;
    }

    const rate = Number(newProductRate);

    if (!Number.isFinite(rate) || rate < 0) {
      alert("Please enter a valid selling rate.");
      return;
    }

    const alreadyAssigned = prices.some(
      (price) => price.product_id === newProductId
    );

    if (alreadyAssigned) {
      alert("This product is already assigned to this customer.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("customer_prices")
        .upsert(
          {
            customer_id: customerId,
            product_id: newProductId,
            selling_rate: rate,
          },
          {
            onConflict: "customer_id,product_id",
          }
        );

      if (error) throw error;

      alert("Product added to customer successfully.");

      setNewProductId("");
      setNewProductRate("");
      setShowAddProduct(false);

      await loadCustomerPrices(customerId);
    } catch (error: any) {
      console.error(error);

      alert(
        "Add Product Error: " +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * START EDIT
   */
  function startEdit(row: CustomerPrice) {
    setEditingProductId(row.product_id);
    setEditingRate(String(row.selling_rate));
  }

  /*
   * SAVE EDITED CUSTOMER RATE
   */
  async function saveEdit(row: CustomerPrice) {
    const rate = Number(editingRate);

    if (!Number.isFinite(rate) || rate < 0) {
      alert("Please enter a valid selling rate.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("customer_prices")
        .update({
          selling_rate: rate,
        })
        .eq("customer_id", customerId)
        .eq("product_id", row.product_id);

      if (error) throw error;

      alert("Customer rate updated successfully.");

      setEditingProductId(null);
      setEditingRate("");

      await loadCustomerPrices(customerId);
    } catch (error: any) {
      console.error(error);

      alert(
        "Update Error: " +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * DELETE CUSTOMER PRODUCT ASSIGNMENT
   *
   * This DOES NOT delete the Product Master product.
   * This DOES NOT delete old sales.
   */
  async function deleteProduct(row: CustomerPrice) {
    const productName = getProductName(row.product_id);

    const confirmed = window.confirm(
      `Remove "${productName}" from this customer?\n\n` +
        `This will NOT delete the product from Product Master.\n` +
        `Old sales will also remain unchanged.`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("customer_prices")
        .delete()
        .eq("customer_id", customerId)
        .eq("product_id", row.product_id);

      if (error) throw error;

      alert("Product removed from customer.");

      await loadCustomerPrices(customerId);
    } catch (error: any) {
      console.error(error);

      alert(
        "Delete Error: " +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * SAVE ALL EXISTING CUSTOMER PRICES
   *
   * Kept for compatibility with your existing page.
   */
  async function savePrices() {
    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    if (prices.length === 0) {
      alert("No products assigned to this customer.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("customer_prices")
        .upsert(
          prices.map((row) => ({
            customer_id: row.customer_id,
            product_id: row.product_id,
            selling_rate: Number(row.selling_rate),
          })),
          {
            onConflict: "customer_id,product_id",
          }
        );

      if (error) throw error;

      alert("Customer prices saved successfully.");

      await loadCustomerPrices(customerId);
    } catch (error: any) {
      console.error(error);

      alert(
        "Save Error: " +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId
  );

  /*
   * Products available for ADD.
   *
   * Already assigned products are excluded.
   */
  const availableProducts = products.filter(
    (product) =>
      !prices.some(
        (price) => price.product_id === product.id
      )
  );

  return (
    <div className="max-w-6xl mx-auto p-6">

      <h1 className="text-3xl font-bold text-blue-700 mb-6">
        Customer Product Prices
      </h1>

      <div className="bg-white rounded-xl shadow-lg p-6">

        {/* Customer Selection */}

        <div className="mb-6">

          <label className="block mb-2 font-semibold">
            Select Customer
          </label>

          <select
            value={customerId}
            onChange={(e) =>
              setCustomerId(e.target.value)
            }
            className="w-full border rounded-lg p-3"
          >
            <option value="">
              Select Customer
            </option>

            {customers.map((customer) => (
              <option
                key={customer.id}
                value={customer.id}
              >
                {customer.customer_name}
              </option>
            ))}
          </select>

        </div>

        {selectedCustomer && (

          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">

            <p className="font-semibold text-blue-700">
              Customer :
              {" "}
              {selectedCustomer.customer_name}
            </p>

          </div>

        )}

        {selectedCustomer && (

          <div className="flex justify-end mb-4">

            <button
              type="button"
              onClick={() =>
                setShowAddProduct((old) => !old)
              }
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold"
            >
              {showAddProduct
                ? "Cancel Add Product"
                : "+ Add Product"}
            </button>

          </div>

        )}

        {/* ADD PRODUCT PANEL */}

        {showAddProduct && selectedCustomer && (

          <div className="mb-6 bg-gray-50 border rounded-xl p-5">

            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Add Product for {selectedCustomer.customer_name}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div>
                <label className="block mb-2 font-semibold">
                  Product
                </label>

                <select
                  value={newProductId}
                  onChange={(e) => {
                    const value = e.target.value;

                    setNewProductId(value);

                    if (value) {
                      const masterRate =
                        getProductMasterRate(value);

                      setNewProductRate(
                        masterRate > 0
                          ? String(masterRate)
                          : ""
                      );
                    } else {
                      setNewProductRate("");
                    }
                  }}
                  className="w-full border rounded-lg p-3"
                >
                  <option value="">
                    Select Product
                  </option>

                  {availableProducts.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.product_name}
                    </option>
                  ))}
                </select>

              </div>

              <div>
                <label className="block mb-2 font-semibold">
                  Customer Selling Rate
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={newProductRate}
                  onChange={(e) =>
                    setNewProductRate(e.target.value)
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="Enter rate"
                />
              </div>

              <div className="flex items-end">

                <button
                  type="button"
                  onClick={addProduct}
                  disabled={
                    loading ||
                    !newProductId ||
                    !newProductRate
                  }
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-semibold"
                >
                  {loading
                    ? "Saving..."
                    : "Add Product"}
                </button>

              </div>

            </div>

            {availableProducts.length === 0 && (

              <p className="mt-3 text-sm text-gray-600">
                All products are already assigned to this
                customer.
              </p>

            )}

          </div>

        )}

        {/* ASSIGNED PRODUCTS */}

        <div className="overflow-x-auto">

          <table className="w-full border">

            <thead className="bg-blue-600 text-white">

              <tr>

                <th className="p-3 text-left">
                  Product
                </th>

                <th className="p-3 text-center">
                  Selling Rate
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
                    colSpan={3}
                    className="p-5 text-center"
                  >
                    Loading...
                  </td>

                </tr>

              ) : !customerId ? (

                <tr>

                  <td
                    colSpan={3}
                    className="p-8 text-center text-gray-500"
                  >
                    Please select a customer.
                  </td>

                </tr>

              ) : prices.length === 0 ? (

                <tr>

                  <td
                    colSpan={3}
                    className="p-8 text-center text-gray-500"
                  >
                    No products assigned to this customer.
                    <br />
                    <span className="text-sm">
                      Click "+ Add Product" to assign products.
                    </span>
                  </td>

                </tr>

              ) : (

                prices.map((row) => (

                  <tr
                    key={row.id || row.product_id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="p-3 font-medium">
                      {getProductName(row.product_id)}
                    </td>

                    <td className="p-3 text-center">

                      {editingProductId ===
                      row.product_id ? (

                        <input
                          type="number"
                          step="0.01"
                          value={editingRate}
                          onChange={(e) =>
                            setEditingRate(e.target.value)
                          }
                          className="w-36 border rounded-lg p-2 text-center"
                          autoFocus
                        />

                      ) : (

                        <span className="font-semibold">
                          ₹
                          {Number(
                            row.selling_rate
                          ).toFixed(2)}
                        </span>

                      )}

                    </td>

                    <td className="p-3">

                      <div className="flex justify-center gap-2">

                        {editingProductId ===
                        row.product_id ? (

                          <>
                            <button
                              type="button"
                              onClick={() =>
                                saveEdit(row)
                              }
                              disabled={loading}
                              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold"
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingProductId(null);
                                setEditingRate("");
                              }}
                              disabled={loading}
                              className="bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold"
                            >
                              Cancel
                            </button>
                          </>

                        ) : (

                          <>
                            <button
                              type="button"
                              onClick={() =>
                                startEdit(row)
                              }
                              disabled={loading}
                              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteProduct(row)
                              }
                              disabled={loading}
                              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold"
                            >
                              Delete
                            </button>
                          </>

                        )}

                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

        {/* SAVE ALL */}

        {customerId && prices.length > 0 && (

          <div className="flex justify-end mt-6">

            <button
              type="button"
              onClick={savePrices}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-semibold"
            >
              {loading
                ? "Saving..."
                : "Save All Prices"}
            </button>

          </div>

        )}

      </div>

    </div>
  );
}