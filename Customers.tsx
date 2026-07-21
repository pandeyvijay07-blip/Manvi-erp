import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

type Customer = {
  id: number;
  name: string;
  mobile: string;
  area: string;
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("id", { ascending: false });

    if (!error && data) {
      setCustomers(data);
    }
  }

  async function addCustomer() {
    if (!name.trim()) {
      alert("Enter customer name");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("customers").insert([
      {
        name,
        mobile,
        area,
      },
    ]);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setMobile("");
    setArea("");

    loadCustomers();
  }

  return (
    <Layout title="Customers">
      <h3>Add Customer</h3>

      <input
        placeholder="Customer Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <input
        placeholder="Mobile Number"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <input
        placeholder="Area / Route"
        value={area}
        onChange={(e) => setArea(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <button
        onClick={addCustomer}
        disabled={loading}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 20,
        }}
      >
        {loading ? "Saving..." : "Add Customer"}
      </button>

      <h3>Customer List</h3>

      {customers.length === 0 ? (
        <p>No customers found.</p>
      ) : (
        customers.map((customer) => (
          <div
            key={customer.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              marginBottom: 10,
            }}
          >
            <b>{customer.name}</b>

            <br />

            Mobile: {customer.mobile || "-"}

            <br />

            Area: {customer.area || "-"}
          </div>
        ))
      )}
    </Layout>
  );
}
