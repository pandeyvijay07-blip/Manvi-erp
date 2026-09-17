import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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

const UNIT_OPTIONS = [
  "Litre",
  "KG",
  "Pack",
  "Cup",
  "Piece",
];

export default function Products() {
  // =====================================================
  // DATA
  // =====================================================

  const [brands, setBrands] =
    useState<Brand[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [saving, setSaving] =
    useState(false);

  // =====================================================
  // PRODUCT FORM
  // =====================================================

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [brandId, setBrandId] =
    useState("");

  const [productName, setProductName] =
    useState("");

  const [size, setSize] =
    useState("1");

  const [unit, setUnit] =
    useState("Litre");

  const [purchaseRate, setPurchaseRate] =
    useState("0");

  const [sellingRate, setSellingRate] =
    useState("0");

  const [stockQty, setStockQty] =
    useState("0");

  // =====================================================
  // SEARCH
  // =====================================================

  const [search, setSearch] =
    useState("");

  const [filterBrandId, setFilterBrandId] =
    useState("");

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadBrands();
    loadProducts();
  }, []);

  // =====================================================
  // LOAD BRANDS
  // =====================================================

  async function loadBrands() {
    const {
      data,
      error,
    } = await supabase
      .from("brands")
      .select("id, brand_name")
      .order("brand_name");

    if (error) {
      console.error(
        "LOAD BRANDS ERROR:",
        error
      );

      alert(
        "Unable to load brands:\n\n" +
          error.message
      );

      return;
    }

    setBrands(
      (data || []) as Brand[]
    );
  }

  // =====================================================
  // LOAD PRODUCTS
  // =====================================================

  async function loadProducts() {
    setLoading(true);

    const {
      data,
      error,
    } = await supabase
      .from("products")
      .select(`
        id,
        brand_id,
        product_name,
        size,
        unit,
        purchase_rate,
        selling_rate,
        stock_qty
      `)
      .order("product_name");

    if (error) {
      console.error(
        "LOAD PRODUCTS ERROR:",
        error
      );

      alert(
        "Unable to load products:\n\n" +
          error.message
      );

      setLoading(false);
      return;
    }

    setProducts(
      (data || []) as Product[]
    );

    setLoading(false);
  }

  // =====================================================
  // GET BRAND NAME
  // =====================================================

  function getBrandName(
    id: string | null
  ) {
    if (!id) {
      return "No Brand";
    }

    const brand =
      brands.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    return (
      brand?.brand_name ||
      "No Brand"
    );
  }

  // =====================================================
  // CLEAR FORM
  // =====================================================

  function clearForm() {
    setEditingId(null);
    setBrandId("");
    setProductName("");
    setSize("1");
    setUnit("Litre");
    setPurchaseRate("0");
    setSellingRate("0");
    setStockQty("0");
  }

  // =====================================================
  // EDIT PRODUCT
  // =====================================================

  function editProduct(
    product: Product
  ) {
    setEditingId(product.id);

    setBrandId(
      product.brand_id || ""
    );

    setProductName(
      product.product_name || ""
    );

    setSize(
      String(
        product.size ?? 1
      )
    );

    setUnit(
      product.unit ||
        "Litre"
    );

    setPurchaseRate(
      String(
        product.purchase_rate ?? 0
      )
    );

    setSellingRate(
      String(
        product.selling_rate ?? 0
      )
    );

    setStockQty(
      String(
        product.stock_qty ?? 0
      )
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =====================================================
  // SAVE PRODUCT
  // =====================================================

  async function saveProduct() {
    // -----------------------------------------------
    // BRAND
    // -----------------------------------------------

    if (!brandId) {
      alert(
        "Please select a brand."
      );
      return;
    }

    // -----------------------------------------------
    // PRODUCT
    // -----------------------------------------------

    if (!productName.trim()) {
      alert(
        "Please enter product name."
      );
      return;
    }

    // -----------------------------------------------
    // SIZE
    // -----------------------------------------------

    const sizeNumber =
      Number(size);

    if (
      !Number.isFinite(
        sizeNumber
      ) ||
      sizeNumber <= 0
    ) {
      alert(
        "Please enter a valid product size."
      );
      return;
    }

    // -----------------------------------------------
    // RATES
    // -----------------------------------------------

    const purchase =
      Number(
        purchaseRate
      );

    const selling =
      Number(
        sellingRate
      );

    if (
      !Number.isFinite(
        purchase
      ) ||
      purchase < 0
    ) {
      alert(
        "Please enter a valid purchase rate."
      );
      return;
    }

    if (
      !Number.isFinite(
        selling
      ) ||
      selling < 0
    ) {
      alert(
        "Please enter a valid selling rate."
      );
      return;
    }

    // Prevent duplicate product names within the same brand.
    const duplicateProduct = products.some(
      (product) =>
        product.id !== editingId &&
        String(product.brand_id || "") === String(brandId) &&
        product.product_name.trim().toLowerCase() ===
          productName.trim().toLowerCase() &&
        Number(product.size ?? 0) === sizeNumber &&
        String(product.unit || "Litre").toLowerCase() ===
          unit.toLowerCase()
    );

    if (duplicateProduct) {
      alert(
        "This product already exists for the selected brand, size and unit."
      );
      return;
    }

    setSaving(true);

    try {
      // =================================================
      // UPDATE
      // =================================================

      if (editingId) {
        const {
          error,
        } = await supabase
          .from("products")
          .update({
            brand_id:
              brandId,

            product_name:
              productName.trim(),

            size:
              sizeNumber,

            unit:
              unit,

            purchase_rate:
              purchase,

            selling_rate:
              selling,
          })
          .eq(
            "id",
            editingId
          );

        if (error) {
          throw error;
        }

        alert(
          "Product updated successfully."
        );
      }

      // =================================================
      // ADD NEW PRODUCT
      // =================================================

      else {
        const openingStock =
          Number(
            stockQty
          );

        if (
          !Number.isFinite(
            openingStock
          ) ||
          openingStock < 0
        ) {
          alert(
            "Please enter a valid opening stock."
          );

          setSaving(false);
          return;
        }

        const {
          error,
        } = await supabase
          .from("products")
          .insert({
            brand_id:
              brandId,

            product_name:
              productName.trim(),

            size:
              sizeNumber,

            unit:
              unit,

            purchase_rate:
              purchase,

            selling_rate:
              selling,

            stock_qty:
              openingStock,
          });

        if (error) {
          throw error;
        }

        alert(
          "Product added successfully."
        );
      }

      clearForm();

      await loadProducts();

    } catch (error: any) {
      console.error(
        "SAVE PRODUCT ERROR:",
        error
      );

      alert(
        "Product Error:\n\n" +
          (
            error?.message ||
            "Unable to save product."
          )
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // DELETE PRODUCT
  // =====================================================

  async function deleteProduct(
    product: Product
  ) {
    const confirmed =
      window.confirm(
        `Delete "${product.product_name}"?\n\nProducts with transaction history should not be deleted.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(product.id);

    try {
      // =================================================
      // CHECK CUSTOMER PRICES
      // =================================================

      const {
        count: customerPriceCount,
        error: customerPriceError,
      } = await supabase
        .from("customer_prices")
        .select("product_id", {
          count: "exact",
          head: true,
        })
        .eq("product_id", product.id);

      if (customerPriceError) {
        throw customerPriceError;
      }

      if ((customerPriceCount || 0) > 0) {
        alert(
          "This product has customer prices and cannot be deleted."
        );
        return;
      }

      // =================================================
      // CHECK SALES
      // =================================================

      const {
        count: saleCount,
        error: saleError,
      } = await supabase
        .from("sale_items")
        .select("product_id", {
          count: "exact",
          head: true,
        })
        .eq("product_id", product.id);

      if (saleError) {
        throw saleError;
      }

      if ((saleCount || 0) > 0) {
        alert(
          "This product has sales history and cannot be deleted."
        );
        return;
      }

      // =================================================
      // CHECK PURCHASES
      // =================================================

      const {
        count: purchaseCount,
        error: purchaseError,
      } = await supabase
        .from("purchase_items")
        .select("product_id", {
          count: "exact",
          head: true,
        })
        .eq("product_id", product.id);

      if (purchaseError) {
        throw purchaseError;
      }

      if ((purchaseCount || 0) > 0) {
        alert(
          "This product has purchase history and cannot be deleted."
        );
        return;
      }

      // =================================================
      // DELETE
      // =================================================

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) {
        throw error;
      }

      if (editingId === product.id) {
        clearForm();
      }

      alert("Product deleted successfully.");

      await loadProducts();
    } catch (error: any) {
      console.error(
        "DELETE PRODUCT ERROR:",
        error
      );

      alert(
        "Unable to delete product:\n\n" +
          (error?.message ||
            "Unknown error.")
      );
    } finally {
      setDeletingId(null);
    }
  }

  // =====================================================
  // FILTER PRODUCTS
  // =====================================================

  const filteredProducts =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return products.filter(
        (product) => {
          // ---------------------------------------------
          // BRAND FILTER
          // ---------------------------------------------

          if (
            filterBrandId &&
            String(
              product.brand_id
            ) !==
              String(
                filterBrandId
              )
          ) {
            return false;
          }

          // ---------------------------------------------
          // SEARCH
          // ---------------------------------------------

          if (!searchText) {
            return true;
          }

          const brandName =
            getBrandName(
              product.brand_id
            ).toLowerCase();

          const productName =
            String(
              product.product_name ||
                ""
            ).toLowerCase();

          const sizeText =
            String(
              product.size ||
                ""
            ).toLowerCase();

          const unitText =
            String(
              product.unit ||
                ""
            ).toLowerCase();

          return (
            brandName.includes(
              searchText
            ) ||
            productName.includes(
              searchText
            ) ||
            sizeText.includes(
              searchText
            ) ||
            unitText.includes(
              searchText
            )
          );
        }
      );
    }, [
      products,
      brands,
      search,
      filterBrandId,
    ]);

  // =====================================================
  // TOTAL STOCK
  // =====================================================

  const totalStock =
    filteredProducts.reduce(
      (
        total,
        product
      ) =>
        total +
        Number(
          product.stock_qty ||
            0
        ),
      0
    );

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 pb-10">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-6">

        <h1 className="text-3xl font-bold text-blue-700">
          Products
        </h1>

        <p className="mt-1 text-gray-600">
          Manage brands, products,
          sizes, rates and stock.
        </p>

      </div>

      {/* =================================================
          ADD / EDIT PRODUCT
      ================================================= */}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="text-xl font-semibold">

              {editingId
                ? "Edit Product"
                : "Add New Product"}

            </h2>

            <p className="text-sm text-gray-500 mt-1">
              One brand can have multiple
              products.
            </p>

          </div>

          {editingId && (
            <button
              type="button"
              onClick={
                clearForm
              }
              className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2 rounded-lg"
            >
              Cancel Edit
            </button>
          )}

        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* =================================================
              BRAND
          ================================================= */}

          <div>

            <label className="block text-sm font-semibold mb-2">
              Brand
            </label>

            <select
              value={
                brandId
              }
              onChange={(e) =>
                setBrandId(
                  e.target.value
                )
              }
              className="w-full border border-gray-300 rounded-lg p-3 bg-white"
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

            {brands.length ===
              0 && (
              <p className="text-xs text-red-600 mt-1">
                No brands found.
                Add a brand from
                Brands section first.
              </p>
            )}

          </div>

          {/* =================================================
              PRODUCT NAME
          ================================================= */}

          <div>

            <label className="block text-sm font-semibold mb-2">
              Product Name
            </label>

            <input
              type="text"
              value={
                productName
              }
              onChange={(e) =>
                setProductName(
                  e.target.value
                )
              }
              placeholder="Example: Cow Milk"
              className="w-full border border-gray-300 rounded-lg p-3"
            />

          </div>

          {/* =================================================
              SIZE
          ================================================= */}

          <div>

            <label className="block text-sm font-semibold mb-2">
              Size
            </label>

            <input
              type="number"
              min="0.001"
              step="0.001"
              value={
                size
              }
              onChange={(e) =>
                setSize(
                  e.target.value
                )
              }
              placeholder="Example: 1"
              className="w-full border border-gray-300 rounded-lg p-3"
            />

            <p className="text-xs text-gray-500 mt-1">
              Milk examples:
              1, 2, 5 L
            </p>

          </div>

          {/* =================================================
              UNIT
          ================================================= */}

          <div>

            <label className="block text-sm font-semibold mb-2">
              Unit
            </label>

            <select
              value={
                unit
              }
              onChange={(e) =>
                setUnit(
                  e.target.value
                )
              }
              className="w-full border border-gray-300 rounded-lg p-3 bg-white"
            >

              {UNIT_OPTIONS.map(
                (item) => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {item}
                  </option>
                )
              )}

            </select>

          </div>

          {/* =================================================
              PURCHASE RATE
          ================================================= */}

          <div>

            <label className="block text-sm font-semibold mb-2">
              Purchase Rate
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={
                purchaseRate
              }
              onChange={(e) =>
                setPurchaseRate(
                  e.target.value
                )
              }
              className="w-full border border-gray-300 rounded-lg p-3"
            />

            <p className="text-xs text-gray-500 mt-1">
              Milk rate is per litre.
            </p>

          </div>

          {/* =================================================
              SELLING RATE
          ================================================= */}

          <div>

            <label className="block text-sm font-semibold mb-2">
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
              className="w-full border border-gray-300 rounded-lg p-3"
            />

            <p className="text-xs text-gray-500 mt-1">
              Milk rate is per litre.
            </p>

          </div>

          {/* =================================================
              OPENING STOCK
          ================================================= */}

          <div>

            <label className="block text-sm font-semibold mb-2">
              {editingId
                ? "Current Stock"
                : "Opening Stock"}
            </label>

            <input
              type="number"
              min="0"
              step="0.001"
              value={
                stockQty
              }
              disabled={
                !!editingId
              }
              onChange={(e) =>
                setStockQty(
                  e.target.value
                )
              }
              className={`w-full border border-gray-300 rounded-lg p-3 ${
                editingId
                  ? "bg-gray-100"
                  : "bg-white"
              }`}
            />

            {editingId && (
              <p className="text-xs text-gray-500 mt-1">
                Stock changes
                automatically from
                Purchases and Sales.
              </p>
            )}

          </div>

        </div>

        {/* =================================================
            BUTTONS
        ================================================= */}

        <div className="flex gap-3 mt-6">

          <button
            type="button"
            onClick={
              saveProduct
            }
            disabled={
              saving
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold"
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Product"
              : "Save Product"}
          </button>

          <button
            type="button"
            onClick={
              clearForm
            }
            disabled={
              saving
            }
            className="bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg"
          >
            {editingId
              ? "Cancel"
              : "Clear"}
          </button>

        </div>

      </div>

      {/* =================================================
          SEARCH / FILTER
      ================================================= */}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-4">

        <div className="grid md:grid-cols-2 gap-4">

          {/* SEARCH */}

          <div>

            <label className="block text-sm font-semibold mb-2">
              Search Product
            </label>

            <input
              type="text"
              value={
                search
              }
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search brand, product, size or unit..."
              className="w-full border border-gray-300 rounded-lg p-3"
            />

          </div>

          {/* BRAND FILTER */}

          <div>

            <label className="block text-sm font-semibold mb-2">
              Filter by Brand
            </label>

            <select
              value={
                filterBrandId
              }
              onChange={(e) =>
                setFilterBrandId(
                  e.target.value
                )
              }
              className="w-full border border-gray-300 rounded-lg p-3 bg-white"
            >

              <option value="">
                All Brands
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

        </div>

        <div className="flex justify-between mt-4 text-sm text-gray-600">

          <span>
            Showing{" "}
            <strong>
              {
                filteredProducts.length
              }
            </strong>{" "}
            of{" "}
            <strong>
              {products.length}
            </strong>{" "}
            products
          </span>

          <span className="font-bold text-blue-700">
            Total Stock:{" "}
            {totalStock}
          </span>

        </div>

      </div>

      {/* =================================================
          PRODUCT TABLE
      ================================================= */}

      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">

        <table className="w-full min-w-[1050px]">

          <thead className="bg-blue-600 text-white">

            <tr>

              <th className="p-3 text-left">
                Brand
              </th>

              <th className="p-3 text-left">
                Product
              </th>

              <th className="p-3 text-center">
                Size
              </th>

              <th className="p-3 text-left">
                Unit
              </th>

              <th className="p-3 text-right">
                Purchase
              </th>

              <th className="p-3 text-right">
                Selling
              </th>

              <th className="p-3 text-right">
                Stock
              </th>

              <th className="p-3 text-center">
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {loading && (
              <tr>

                <td
                  colSpan={8}
                  className="p-8 text-center text-gray-500"
                >
                  Loading products...
                </td>

              </tr>
            )}

            {!loading &&
              filteredProducts.map(
                (product) => (
                  <tr
                    key={
                      product.id
                    }
                    className="border-b hover:bg-gray-50"
                  >

                    {/* BRAND */}

                    <td className="p-3 font-semibold text-blue-700">
                      {
                        getBrandName(
                          product.brand_id
                        )
                      }
                    </td>

                    {/* PRODUCT */}

                    <td className="p-3 font-medium">
                      {
                        product.product_name
                      }
                    </td>

                    {/* SIZE */}

                    <td className="p-3 text-center font-semibold">
                      {Number(
                        product.size ||
                          0
                      )}
                    </td>

                    {/* UNIT */}

                    <td className="p-3">
                      {
                        product.unit ||
                          "Litre"
                      }
                    </td>

                    {/* PURCHASE */}

                    <td className="p-3 text-right">
                      ₹{" "}
                      {Number(
                        product.purchase_rate ||
                          0
                      ).toFixed(
                        2
                      )}
                    </td>

                    {/* SELLING */}

                    <td className="p-3 text-right">
                      ₹{" "}
                      {Number(
                        product.selling_rate ||
                          0
                      ).toFixed(
                        2
                      )}
                    </td>

                    {/* STOCK */}

                    <td className="p-3 text-right font-bold text-green-700">
                      {Number(
                        product.stock_qty ||
                          0
                      )}{" "}
                      {
                        product.unit ||
                          "Litre"
                      }
                    </td>

                    {/* ACTIONS */}

                    <td className="p-3">

                      <div className="flex justify-center gap-2">

                        <button
                          type="button"
                          onClick={() =>
                            editProduct(
                              product
                            )
                          }
                          disabled={
                            saving ||
                            deletingId !== null
                          }
                          className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteProduct(
                              product
                            )
                          }
                          disabled={
                            saving ||
                            deletingId !== null
                          }
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
                        >
                          {deletingId === product.id
                            ? "Checking..."
                            : "Delete"}
                        </button>

                      </div>

                    </td>

                  </tr>
                )
              )}

            {!loading &&
              filteredProducts.length ===
                0 && (
                <tr>

                  <td
                    colSpan={8}
                    className="p-8 text-center text-gray-500"
                  >
                    No products found.
                  </td>

                </tr>
              )}

          </tbody>

        </table>

      </div>

    </div>
  );
}