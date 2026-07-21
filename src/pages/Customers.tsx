import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [area, setArea] = useState("");

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("id", { ascending: false });

    setCustomers(data || []);
  }

  async function saveCustomer() {
    if (!name) return;

    await supabase.from("customers").insert([
      {
        name,
        mobile,
        area,
      },
    ]);

    setName("");
    setMobile("");
    setArea("");

    loadCustomers();
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">
          Customers
        </h1>

        <div className="bg-white shadow rounded-xl p-4 mb-6">
          <input
            className="border p-2 rounded w-full mb-2"
            placeholder="Customer Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="border p-2 rounded w-full mb-2"
            placeholder="Mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />

          <input
            className="border p-2 rounded w-full mb-3"
            placeholder="Area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />

          <button
            onClick={saveCustomer}
            className="bg-blue-600 text-white rounded-lg px-5 py-2"
          >
            Save Customer
          </button>
        </div>

        <div className="bg-white rounded-xl shadow">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Mobile</th>
                <th className="text-left p-3">Area</th>
              </tr>
            </thead>

            <tbody>
              {customers.map((c: any) => (
                <tr key={c.id} className="border-b">
                  <td className="p-3">{c.name}</td>
                  <td className="p-3">{c.mobile}</td>
                  <td className="p-3">{c.area}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
