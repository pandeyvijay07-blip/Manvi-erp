import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [packSize, setPackSize] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("id", { ascending: false });

    setProducts(data || []);
  }

  async function saveProduct() {
    if (!brand || !product) {
      alert("Please fill required fields");
      return;
    }

    const { error } = await supabase
      .from("products")
      .insert([
        {
          brand,
          product_name: product,
          pack_size: packSize,
          selling_price: Number(price),
          stock: 0,
        },
      ]);

    if (error) {
      alert(error.message);
      return;
    }

    setBrand("");
    setProduct("");
    setPackSize("");
    setPrice("");

    loadProducts();

    alert("Product Saved");
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">
          Products
        </h1>

        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <input
            className="border p-2 rounded w-full mb-2"
            placeholder="Brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />

          <input
            className="border p-2 rounded w-full mb-2"
            placeholder="Product Name"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          />

          <input
            className="border p-2 rounded w-full mb-2"
            placeholder="Pack Size"
            value={packSize}
            onChange={(e) => setPackSize(e.target.value)}
          />

          <input
            className="border p-2 rounded w-full mb-3"
            placeholder="Selling Price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />

          <button
            onClick={saveProduct}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg"
          >
            Save Product
          </button>
        </div>

        <div className="bg-white rounded-xl shadow">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">Brand</th>
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-left">Pack Size</th>
                <th className="p-3 text-left">Price</th>
                <th className="p-3 text-left">Stock</th>
              </tr>
            </thead>

            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="p-3">{p.brand}</td>
                  <td className="p-3">{p.product_name}</td>
                  <td className="p-3">{p.pack_size}</td>
                  <td className="p-3">₹{p.selling_price}</td>
                  <td className="p-3">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
            }
