import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });

    setExpenses(data || []);
  }

  async function saveExpense() {
    if (!purpose || !amount) return;

    await supabase.from("expenses").insert({
      purpose,
      amount: Number(amount),
      created_at: new Date().toISOString(),
    });

    setPurpose("");
    setAmount("");

    loadExpenses();
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">Expenses</h1>

        <div className="bg-white rounded-xl shadow p-5 mb-5">
          <input
            className="border p-2 rounded w-full mb-3"
            placeholder="Purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />

          <input
            className="border p-2 rounded w-full mb-3"
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <button
            onClick={saveExpense}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg"
          >
            Save Expense
          </button>
        </div>
      </div>
    </Layout>
  );
}
