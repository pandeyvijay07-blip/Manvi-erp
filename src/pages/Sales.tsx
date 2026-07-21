import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function Sales() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: c } = await supabase.from("customers").select("*");
    const { data: p } = await supabase.from("products").select("*");

    setCustomers(c || []);
    setProducts(p || []);
  }

  async function saveSale() {
    const product = products.find((x) => x.id == productId);

    if (!product || !customerId) return;

    await supabase.from("sales").insert({
      customer_id: Number(customerId),
      product_id: Number(productId),
      quantity: qty,
      rate: product.selling_price,
      total: qty * product.selling_price,
      created_at: new Date().toISOString(),
    });

    alert("Sale Saved Successfully");

    setCustomerId("");
    setProductId("");
    setQty(1);
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-5 text-blue-700">
          Sales Entry
        </h1>

        <div className="bg-white shadow rounded-xl p-5">

          <select
            className="border p-2 rounded w-full mb-3"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select Customer</option>

            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="border p-2 rounded w-full mb-3"
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
            className="border p-2 rounded w-full mb-3"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />

          <button
            onClick={saveSale}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Save Sale
          </button>
        </div>
      </div>
    </Layout>
  );
}
