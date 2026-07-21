import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function Collections() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Cash");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data } = await supabase.from("customers").select("*");
    setCustomers(data || []);
  }

  async function saveCollection() {
    if (!customerId || !amount) return;

    await supabase.from("collections").insert({
      customer_id: Number(customerId),
      amount: Number(amount),
      payment_mode: mode,
      created_at: new Date().toISOString(),
    });

    alert("Collection Saved");

    setCustomerId("");
    setAmount("");
    setMode("Cash");
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">
          Collections
        </h1>

        <div className="bg-white rounded-xl shadow p-5">
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

          <input
            type="number"
            placeholder="Amount"
            className="border p-2 rounded w-full mb-3"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <select
            className="border p-2 rounded w-full mb-3"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option>Cash</option>
            <option>UPI</option>
            <option>Bank</option>
          </select>

          <button
            onClick={saveCollection}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Save Collection
          </button>
        </div>
      </div>
    </Layout>
  );
}
