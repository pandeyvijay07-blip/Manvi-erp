import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function Purchases() {
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [rate, setRate] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("product_name");

    setProducts(data || []);
  }

  async function savePurchase() {
    if (!productId || !quantity || !rate) return;

    await supabase.from("purchases").insert({
      product_id: Number(productId),
      quantity: Number(quantity),
      rate: Number(rate),
      total: Number(quantity) * Number(rate),
      created_at: new Date().toISOString(),
    });

    alert("Purchase Saved");

    setProductId("");
    setQuantity("");
    setRate("");
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-5">
          Purchase Entry
        </h1>

        <div className="bg-white rounded-xl shadow p-5">
          <select
            className="border rounded p-2 w-full mb-3"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Select Product</option>

            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand} - {p.product_name}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Quantity"
            className="border rounded p-2 w-full mb-3"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <input
            type="number"
            placeholder="Purchase Rate"
            className="border rounded p-2 w-full mb-3"
            value={rate}
            onChange={(e) => setRate(e.target.value
