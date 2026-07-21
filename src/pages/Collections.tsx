import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Collection = {
  id: string;
  customer: string;
  amount: number;
  payment_mode: string;
};

function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");

  async function loadCollections() {
    const { data } = await supabase
      .from("collections")
      .select("*")
      .order("id", { ascending: false });

    setCollections((data as Collection[]) || []);
  }

  async function addCollection() {
    if (!customer || !amount) return;

    await supabase.from("collections").insert({
      customer,
      amount: Number(amount),
      payment_mode: paymentMode,
    });

    setCustomer("");
    setAmount("");
    setPaymentMode("Cash");

    loadCollections();
  }

  useEffect(() => {
    loadCollections();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Collections</h1>

      <input
        placeholder="Customer"
        value={customer}
        onChange={(e) => setCustomer(e.target.value)}
      />

      <br /><br />

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <br /><br />

      <select
        value={paymentMode}
        onChange={(e) => setPaymentMode(e.target.value)}
      >
        <option>Cash</option>
        <option>UPI</option>
        <option>Bank</option>
      </select>

      <br /><br />

      <button onClick={addCollection}>
        Save Collection
      </button>

      <hr />

      {collections.map((item) => (
        <div key={item.id}>
          <strong>{item.customer}</strong><br />
          ₹{item.amount} ({item.payment_mode})
          <hr />
        </div>
      ))}
    </div>
  );
}

export default Collections;
