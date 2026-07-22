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
    if (!productId || !quantity || !rate) {
      alert("Fill all fields");
      return;
    }

    const qty = Number(quantity);
    const price = Number(rate);

    const { error } = await supabase.from("purchases").insert({
      product_id: productId,
      quantity: qty,
      rate: price,
      total: qty * price,
      created_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
      return;
    }

    const product = products.find((p) => p.id == productId);

    if (product) {
      await supabase
        .from("products")
        .update({
          stock: Number(product.stock || 0) + qty,
        })
        .eq("id", productId);
    }

    alert("Purchase Saved");

    setProductId("");
    setQuantity("");
    setRate("");

    loadProducts();
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">
          Purchase Entry
        </h1>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">

          <select
            className="border rounded-lg p-3 w-full"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Select Product</option>

            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_name}
              </option>
            ))}
          </select>

          <input
            className="border rounded-lg p-3 w-full"
            type="number"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <input
            className="border rounded-lg p-3 w-full"
            type="number"
            placeholder="Purchase Rate"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />

          <button
            onClick={savePurchase}
            className="bg-blue-600 text-white rounded-lg px-5 py-3 w-full"
          >
            Save Purchase
          </button>
        </div>
      </div>
    </Layout>
  );
}
