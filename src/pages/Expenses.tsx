import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Expense = {
  id: string;
  purpose: string;
  amount: number;
};

function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");

  async function loadExpenses() {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("id", { ascending: false });

    setExpenses((data as Expense[]) || []);
  }

  async function addExpense() {
    if (!purpose || !amount) return;

    await supabase.from("expenses").insert({
      purpose,
      amount: Number(amount),
    });

    setPurpose("");
    setAmount("");

    loadExpenses();
  }

  useEffect(() => {
    loadExpenses();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Expenses</h1>

      <input
        placeholder="Purpose"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
      />

      <br /><br />

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <br /><br />

      <button onClick={addExpense}>
        Save Expense
      </button>

      <hr />

      {expenses.map((expense) => (
        <div key={expense.id}>
          <strong>{expense.purpose}</strong>
          <br />
          ₹{expense.amount}
          <hr />
        </div>
      ))}
    </div>
  );
}

export default Expenses;
