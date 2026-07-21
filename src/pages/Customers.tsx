import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("name");

    setCustomers(data || []);
  }

  const filteredCustomers = customers.filter((c) =>
    (
      c.name +
      " " +
      (c.mobile || "") +
      " " +
      (c.area || "")
    )
      .toLowerCase()
      .includes(search.toLowerCase())
  );
    function clearForm() {
    setEditingId(null);
    setName("");
    setMobile("");
    setAddress("");
    setArea("");
  }

  async function saveCustomer() {
    if (!name.trim()) {
      alert("Customer name is required");
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("customers")
        .update({
          name,
          mobile,
          address,
          area,
        })
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        return;
      }

      alert("Customer updated successfully");
    } else {
      const { error } = await supabase
        .from("customers")
        .insert({
          name,
          mobile,
          address,
          area,
        });

      if (error) {
        alert(error.message);
        return;
      }

      alert("Customer added successfully");
    }

    clearForm();
    loadCustomers();
  }

  function editCustomer(customer: any) {
    setEditingId(customer.id);
    setName(customer.name || "");
    setMobile(customer.mobile || "");
    setAddress(customer.address || "");
    setArea(customer.area || "");
  }

  async function deleteCustomer(id: string) {
    if (!confirm("Delete this customer?")) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadCustomers();
    alert("Customer deleted");
  }
    return (
    <div className="space-y-6">

      <h1 className="text-3xl font-bold">
        Customers
      </h1>

      <div className="bg-white rounded-xl shadow p-5">

        <div className="grid md:grid-cols-2 gap-4">

          <input
            className="border rounded-lg p-3"
            placeholder="Customer Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="border rounded-lg p-3"
            placeholder="Mobile Number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />

          <input
            className="border rounded-lg p-3"
            placeholder="Area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />

          <input
            className="border rounded-lg p-3"
            placeholder="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

        </div>

        <div className="flex gap-3 mt-5">

          <button
            onClick={saveCustomer}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg"
          >
            {editingId ? "Update Customer" : "Add Customer"}
          </button>

          <button
            onClick={clearForm}
            className="bg-gray-500 text-white px-5 py-2 rounded-lg"
          >
            Clear
          </button>

        </div>

      </div>

      <div className="bg-white rounded-xl shadow p-5">

        <input
          className="border rounded-lg p-3 w-full"
          placeholder="Search Customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>
            <div className="bg-white rounded-xl shadow p-5">

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead>

              <tr className="border-b">

                <th className="text-left py-3">Name</th>
                <th className="text-left py-3">Mobile</th>
                <th className="text-left py-3">Area</th>
                <th className="text-left py-3">Address</th>
                <th className="text-center py-3">Action</th>

              </tr>

            </thead>

            <tbody>

              {filteredCustomers.length === 0 ? (

                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-6 text-gray-500"
                  >
                    No customers found
                  </td>
                </tr>

              ) : (

                filteredCustomers.map((customer) => (

                  <tr
                    key={customer.id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="py-3">{customer.name}</td>

                    <td className="py-3">
                      {customer.mobile || "-"}
                    </td>

                    <td className="py-3">
                      {customer.area || "-"}
                    </td>

                    <td className="py-3">
                      {customer.address || "-"}
                    </td>

                    <td className="py-3">

                      <div className="flex gap-2 justify-center">

                        <button
                          onClick={() => editCustomer(customer)}
                          className="bg-yellow-500 text-white px-3 py-1 rounded"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteCustomer(customer.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded"
                        >
                          Delete
                        </button>

                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}
