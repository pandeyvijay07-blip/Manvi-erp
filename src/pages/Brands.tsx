import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Brand = {
  id: string;
  brand_name: string;
  created_at?: string;
};

type ProductRow = {
  id: string;
  brand_id: string | null;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function getErrorMessage(error: unknown, fallback = "Unknown error.") {
  if (error && typeof error === "object") {
    const item = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const message = text(item.message);
    const details = text(item.details);
    const hint = text(item.hint);

    return (
      [message, details, hint].filter(Boolean).join(" • ") ||
      fallback
    );
  }

  return error instanceof Error ? error.message : fallback;
}

export default function Brands() {
  const [brands, setBrands] = useState<Brand[]>([]);

  const [brandName, setBrandName] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [loadWarning, setLoadWarning] = useState("");

  useEffect(() => {
    void loadBrands();
  }, []);

  // ---------------------------------------------------------
  // LOAD BRANDS
  // ---------------------------------------------------------

  async function loadBrands() {
    setLoading(true);
    setLoadWarning("");

    try {
      const { data, error } = await supabase
        .from("brands")
        .select("id, brand_name, created_at")
        .order("brand_name", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      setBrands((data || []) as Brand[]);
    } catch (error) {
      console.error("LOAD BRANDS ERROR:", error);

      setBrands([]);

      alert(
        `Unable to load brands.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // CLEAR FORM
  // ---------------------------------------------------------

  function clearForm() {
    setBrandName("");
    setEditingId(null);
  }

  // ---------------------------------------------------------
  // SAVE / UPDATE BRAND
  // ---------------------------------------------------------

  async function saveBrand() {
    const cleanName = brandName.trim();

    if (!cleanName) {
      alert("Please enter brand name.");
      return;
    }

    if (cleanName.length > 100) {
      alert("Brand name cannot exceed 100 characters.");
      return;
    }

    // Duplicate check for BOTH ADD and EDIT
    const duplicate = brands.some(
      (brand) =>
        brand.id !== editingId &&
        brand.brand_name.trim().toLowerCase() ===
          cleanName.toLowerCase()
    );

    if (duplicate) {
      alert("This brand already exists.");
      return;
    }

    setSaving(true);

    try {
      // -----------------------------------------------------
      // EDIT
      // -----------------------------------------------------

      if (editingId) {
        const { error } = await supabase
          .from("brands")
          .update({
            brand_name: cleanName,
          })
          .eq("id", editingId);

        if (error) {
          throw error;
        }

        alert("Brand updated successfully.");
      }

      // -----------------------------------------------------
      // ADD
      // -----------------------------------------------------

      else {
        const { error } = await supabase
          .from("brands")
          .insert({
            brand_name: cleanName,
          });

        if (error) {
          throw error;
        }

        alert("Brand added successfully.");
      }

      clearForm();

      await loadBrands();
    } catch (error) {
      console.error("SAVE BRAND ERROR:", error);

      alert(
        `Unable to save brand.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------
  // EDIT BRAND
  // ---------------------------------------------------------

  function editBrand(brand: Brand) {
    setEditingId(brand.id);
    setBrandName(brand.brand_name);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ---------------------------------------------------------
  // DELETE BRAND
  // ---------------------------------------------------------

  async function deleteBrand(brand: Brand) {
    const confirmed = window.confirm(
      `Delete brand "${brand.brand_name}"?\n\n` +
        `The brand can only be deleted if no products are linked to it.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(brand.id);

    try {
      // -----------------------------------------------------
      // CHECK WHETHER PRODUCTS USE THIS BRAND
      // -----------------------------------------------------

      const { data: products, error: productError } =
        await supabase
          .from("products")
          .select("id, brand_id")
          .eq("brand_id", brand.id);

      if (productError) {
        throw productError;
      }

      const productRows = (products || []) as ProductRow[];

      if (productRows.length > 0) {
        alert(
          `Cannot delete "${brand.brand_name}".\n\n` +
            `${productRows.length} product${
              productRows.length === 1 ? "" : "s"
            } linked to this brand.\n\n` +
            `Please remove or change the brand from those products first.`
        );

        return;
      }

      // -----------------------------------------------------
      // DELETE
      // -----------------------------------------------------

      const { error } = await supabase
        .from("brands")
        .delete()
        .eq("id", brand.id);

      if (error) {
        throw error;
      }

      if (editingId === brand.id) {
        clearForm();
      }

      alert("Brand deleted successfully.");

      await loadBrands();
    } catch (error) {
      console.error("DELETE BRAND ERROR:", error);

      alert(
        `Unable to delete brand.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ---------------------------------------------------------
  // FILTER
  // ---------------------------------------------------------

  const filteredBrands = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return brands;
    }

    return brands.filter((brand) =>
      brand.brand_name.toLowerCase().includes(query)
    );
  }, [brands, search]);

  // ---------------------------------------------------------
  // STATS
  // ---------------------------------------------------------

  const totalBrands = brands.length;
  const filteredCount = filteredBrands.length;

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 pb-10">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-700">
          Brands
        </h1>

        <p className="mt-1 text-gray-600">
          Manage milk brands used in MANVI ERP.
        </p>
      </div>

      {/* =====================================================
          SUMMARY
      ====================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow">
          <p className="text-sm text-gray-500">
            Total Brands
          </p>

          <p className="mt-2 text-3xl font-bold text-blue-700">
            {totalBrands}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow">
          <p className="text-sm text-gray-500">
            Showing
          </p>

          <p className="mt-2 text-3xl font-bold text-purple-700">
            {filteredCount}
          </p>
        </div>
      </div>

      {/* =====================================================
          ADD / EDIT FORM
      ====================================================== */}

      <div className="mb-6 rounded-xl bg-white p-5 shadow-lg sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {editingId ? "Edit Brand" : "Add New Brand"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              One brand can have multiple products.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={clearForm}
              disabled={saving}
              className="w-full rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={brandName}
            maxLength={100}
            disabled={saving}
            onChange={(e) =>
              setBrandName(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveBrand();
              }
            }}
            placeholder="Example: Amul"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />

          <button
            type="button"
            onClick={() => void saveBrand()}
            disabled={saving || !brandName.trim()}
            className="w-full rounded-lg bg-blue-600 px-7 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Brand"
              : "+ Add Brand"}
          </button>
        </div>
      </div>

      {/* =====================================================
          SEARCH
      ====================================================== */}

      <div className="mb-4 rounded-xl bg-white p-5 shadow-lg">
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Search Brand
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search brand name..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-lg bg-slate-500 px-5 py-3 font-semibold text-white hover:bg-slate-600"
            >
              Clear Search
            </button>
          )}
        </div>

        <p className="mt-3 text-sm text-gray-500">
          Showing{" "}
          <span className="font-semibold text-slate-800">
            {filteredCount}
          </span>{" "}
          brand{filteredCount === 1 ? "" : "s"}.
        </p>
      </div>

      {/* =====================================================
          BRAND LIST
      ====================================================== */}

      <div className="overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="border-b p-5">
          <h2 className="text-xl font-bold text-slate-800">
            Brand List
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Add, edit or delete your milk brands.
          </p>
        </div>

        {/* LOADING */}

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading brands...
          </div>
        ) : filteredBrands.length === 0 ? (
          /* EMPTY */

          <div className="p-8 text-center">
            <p className="font-semibold text-slate-700">
              {brands.length === 0
                ? "No brands found."
                : "No matching brands found."}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {brands.length === 0
                ? "Add your first milk brand above."
                : "Try another search term."}
            </p>
          </div>
        ) : (
          /* LIST */

          <div className="divide-y">
            {filteredBrands.map((brand, index) => {
              const isEditing =
                editingId === brand.id;

              const isDeleting =
                deletingId === brand.id;

              return (
                <div
                  key={brand.id}
                  className={`flex flex-col gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between ${
                    isEditing
                      ? "bg-blue-50"
                      : ""
                  }`}
                >
                  {/* BRAND INFO */}

                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-slate-800">
                        {brand.brand_name}
                      </p>

                      <p className="text-xs text-gray-500">
                        Milk Brand
                      </p>
                    </div>
                  </div>

                  {/* ACTIONS */}

                  <div className="flex w-full gap-2 sm:w-auto">
                    <button
                      type="button"
                      onClick={() =>
                        editBrand(brand)
                      }
                      disabled={
                        saving ||
                        deletingId !== null
                      }
                      className="flex-1 rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-white hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteBrand(brand)
                      }
                      disabled={
                        saving ||
                        deletingId !== null
                      }
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                    >
                      {isDeleting
                        ? "Checking..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================
          INFORMATION
      ====================================================== */}

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold">
          Brand management
        </p>

        <p className="mt-1">
          A brand can contain multiple products.
          Brands linked to products cannot be deleted.
        </p>
      </div>
    </div>
  );
}