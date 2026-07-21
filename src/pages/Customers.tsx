import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  name: string;
  mobile: string;
};

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("name");

    setCustomers((data as Customer[]) || []);
  }

  async function addCustomer() {
    if (!name) return;

    await supabase.from("customers").insert({
      name,
      mobile,
    });

    setName("");
    setMobile("");

    loadCustomers();
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Customers</h1>

      <input
        placeholder="Customer Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Mobile Number"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
      />

      <br /><br />

      <button onClick={addCustomer}>
        Add Customer
      </button>

      <hr />

      {customers.map((customer) => (
        <div key={customer.id}>
          <strong>{customer.name}</strong>
          <br />
          {customer.mobile}
          <hr />
        </div>
      ))}
    </div>
  );
}

export default Customers;
