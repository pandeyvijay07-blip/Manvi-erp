import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Collections() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Cash");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .order("name");

    const { data: collectionData } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });

    setCustomers(customerData || []);
    setCollections(collectionData || []);
  }

  function getCustomerName(id: string) {
    return customers.find((c) => c.id === id)?.name || "-";
  }
    async function saveCollection() {
    if (!customerId || !amount) {
      alert("Please select a customer and enter an amount.");
      return;
    }

    const { error } = await supabase
      .from("collections")
      .insert({
        customer_id: customerId,
        amount: Number(amount),
        payment_mode: mode,
        created_at: new Date().toISOString(),
      });

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();

    setCustomerId("");
    setAmount("");
    setMode("Cash");

    alert("Collection Saved Successfully");
    }
    return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">
        Collections
      </h1>

      <div className="bg-white rounded-xl shadow p-4 space-y-4">

        <div>
          <label className="block mb-1 font-medium">
            Customer
          </label>

          <select
            className="w-full border rounded-lg p-2"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select Customer</option>

            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">
            Amount
          </label>

          <input
            type="number"
            className="w-full border rounded-lg p-2"
            placeholder="Enter Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">
            Payment Mode
          </label>

          <select
            className="w-full border rounded-lg p-2"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option>Cash</option>
            <option>UPI</option>
            <option>Bank</option>
          </select>
        </div>

        <button
          onClick={saveCollection}
          className="w-full bg-green-600 text-white rounded-lg py-3 font-semibold"
        >
          Save Collection
        </button>

      </div>
            <div className="mt-8 bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">
          Collection History
        </h2>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Customer</th>
              <th className="text-right p-2">Amount</th>
              <th className="text-left p-2">Mode</th>
              <th className="text-left p-2">Date</th>
            </tr>
          </thead>

          <tbody>
            {collections.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center p-4 text-gray-500"
                >
                  No collections found
                </td>
              </tr>
            ) : (
              collections.map((collection) => (
                <tr
                  key={collection.id}
                  className="border-b"
                >
                  <td className="p-2">
                    {getCustomerName(collection.customer_id)}
                  </td>

                  <td className="text-right p-2">
                    ₹{collection.amount}
                  </td>

                  <td className="p-2">
                    {collection.payment_mode}
                  </td>

                  <td className="p-2">
                    {new Date(
                      collection.created_at
                    ).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
