import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Brand = {
  id: string;
  brand_name: string;
  created_at?: string;
};

export default function Brands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandName, setBrandName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBrands();
  }, []);

  async function loadBrands() {
    setLoading(true);

    const { data, error } = await supabase
      .from("brands")
      .select("id, brand_name, created_at")
      .order("brand_name");

    if (error) {
      console.error(error);
      alert("Unable to load brands: " + error.message);
      setLoading(false);
      return;
    }

    setBrands((data || []) as Brand[]);
    setLoading(false);
  }

  function clearForm() {
    setBrandName("");
    setEditingId(null);
  }

  async function saveBrand() {
    const name = brandName.trim();

    if (!name) {
      alert("Please enter brand name.");
      return;
    }

    setLoading(true);

    try {
      // EDIT
      if (editingId) {
        const { error } = await supabase
          .from("brands")
          .update({
            brand_name: name,
          })
          .eq("id", editingId);

        if (error) throw error;

        alert("Brand updated successfully.");
      }

      // ADD
      else {
        const { data: existing } = await supabase
          .from("brands")
          .select("id")
          .ilike("brand_name", name)
          .limit(1);

        if (existing && existing.length > 0) {
          alert("This brand already exists.");
          setLoading(false);
          return;
        }

        const { error } = await supabase
          .from("brands")
          .insert({
            brand_name: name,
          });

        if (error) throw error;

        alert("Brand added successfully.");
      }

      clearForm();
      await loadBrands();

    } catch (error: any) {
      console.error("BRAND ERROR:", error);

      alert(
        "Brand Error: " +
          (error?.message || "Unable to save brand.")
      );
    } finally {
      setLoading(false);
    }
  }

  function editBrand(brand: Brand) {
    setEditingId(brand.id);
    setBrandName(brand.brand_name);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteBrand(brand: Brand) {
    const confirmed = window.confirm(
      `Delete brand "${brand.brand_name}"?\n\nOnly delete a brand if its products are not being used.`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("brands")
        .delete()
        .eq("id", brand.id);

      if (error) throw error;

      alert("Brand deleted successfully.");

      if (editingId === brand.id) {
        clearForm();
      }

      await loadBrands();

    } catch (error: any) {
      console.error("DELETE BRAND ERROR:", error);

      alert(
        "Unable to delete brand: " +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">

      {/* HEADER */}

      <div className="mb-6">

        <h1 className="text-3xl font-bold text-blue-700">
          Brands
        </h1>

        <p className="mt-1 text-gray-600">
          Add and manage milk brands.
        </p>

      </div>

      {/* ADD BRAND */}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">

        <h2 className="text-xl font-bold mb-2">
          {editingId ? "Edit Brand" : "Add New Brand"}
        </h2>

        <p className="text-sm text-gray-500 mb-5">
          One brand can have multiple products.
        </p>

        <div className="flex flex-col md:flex-row gap-3">

          <input
            type="text"
            value={brandName}
            onChange={(e) =>
              setBrandName(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                saveBrand();
              }
            }}
            placeholder="Example: Amul"
            className="flex-1 border rounded-lg p-3"
          />

          <button
            type="button"
            onClick={saveBrand}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-7 py-3 rounded-lg font-semibold"
          >
            {loading
              ? "Saving..."
              : editingId
              ? "Update Brand"
              : "+ Add Brand"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={clearForm}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg"
            >
              Cancel
            </button>
          )}

        </div>

      </div>

      {/* BRAND LIST */}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">

        <div className="p-5 border-b">

          <h2 className="text-xl font-bold">
            Brand List
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            {brands.length} brands
          </p>

        </div>

        {loading && brands.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Loading brands...
          </div>
        ) : brands.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No brands found.
          </div>
        ) : (
          <div className="divide-y">

            {brands.map((brand, index) => (

              <div
                key={brand.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >

                <div className="flex items-center gap-4">

                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    {index + 1}
                  </div>

                  <div>
                    <p className="font-semibold text-lg">
                      {brand.brand_name}
                    </p>

                    <p className="text-xs text-gray-500">
                      Brand
                    </p>
                  </div>

                </div>

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={() => editBrand(brand)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteBrand(brand)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                  >
                    Delete
                  </button>

                </div>

              </div>

            ))}

          </div>
        )}

      </div>

    </div>
  );
}