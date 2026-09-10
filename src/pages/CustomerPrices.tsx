import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  customer_name: string;
};

type Product = {
  id: string;
  product_name: string;
  selling_rate: number;
};

type CustomerPrice = {
  id?: string;
  customer_id: string;
  product_id: string;
  selling_rate: number;
};

export default function CustomerPrices() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<CustomerPrice[]>([]);

  const [customerId, setCustomerId] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadProducts();
  }, []);

  useEffect(() => {
    if (customerId) {
      loadCustomerPrices(customerId);
    } else {
      setPrices([]);
    }
  }, [customerId]);

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("id, customer_name")
      .order("customer_name");

    if (error) {
      alert(error.message);
      return;
    }

    setCustomers(data || []);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        product_name,
        selling_rate
      `)
      .order("product_name");

    if (error) {
      alert(error.message);
      return;
    }

    setProducts(data || []);
  }

  async function loadCustomerPrices(id: string) {
    setLoading(true);

    const { data, error } = await supabase
      .from("customer_prices")
      .select("*")
      .eq("customer_id", id);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const rows: CustomerPrice[] = [];

    for (const product of products) {
      const existing = data?.find(
        (x) => x.product_id === product.id
      );

      rows.push({
        id: existing?.id,
        customer_id: id,
        product_id: product.id,
        selling_rate:
          existing?.selling_rate ??
          product.selling_rate,
      });
    }

    setPrices(rows);

    setLoading(false);
  }

  function changeRate(
    productId: string,
    value: string
  ) {
    setPrices((old) =>
      old.map((row) =>
        row.product_id === productId
          ? {
              ...row,
              selling_rate: Number(value),
            }
          : row
      )
    );
  }
    async function savePrices() {
    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("customer_prices")
        .upsert(
          prices.map((row) => ({
            customer_id: row.customer_id,
            product_id: row.product_id,
            selling_rate: Number(row.selling_rate),
          })),
          {
            onConflict: "customer_id,product_id",
          }
        );

      if (error) throw error;

      alert("Customer prices saved successfully.");

      await loadCustomerPrices(customerId);

    } catch (error: any) {
      console.error(error);

      alert(
        "Save Error: " +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedCustomer =
    customers.find(
      (c) => c.id === customerId
    );

  const getRate = (
    productId: string
  ) => {
    return (
      prices.find(
        (p) => p.product_id === productId
      )?.selling_rate ?? 0
    );
  };
    return (
    <div className="max-w-6xl mx-auto p-6">

      <h1 className="text-3xl font-bold text-blue-700 mb-6">
        Customer Product Prices
      </h1>

      <div className="bg-white rounded-xl shadow-lg p-6">

        {/* Customer Selection */}

        <div className="mb-6">

          <label className="block mb-2 font-semibold">
            Select Customer
          </label>

          <select
            value={customerId}
            onChange={(e) =>
              setCustomerId(e.target.value)
            }
            className="w-full border rounded-lg p-3"
          >
            <option value="">
              Select Customer
            </option>

            {customers.map((customer) => (
              <option
                key={customer.id}
                value={customer.id}
              >
                {customer.customer_name}
              </option>
            ))}
          </select>

        </div>

        {selectedCustomer && (

          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">

            <p className="font-semibold text-blue-700">
              Customer :
              {" "}
              {selectedCustomer.customer_name}
            </p>

          </div>

        )}

        <div className="overflow-x-auto">

          <table className="w-full border">

            <thead className="bg-blue-600 text-white">

              <tr>

                <th className="p-3 text-left">
                  Product
                </th>

                <th className="p-3 text-center">
                  Selling Rate
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={2}
                    className="p-5 text-center"
                  >
                    Loading...
                  </td>

                </tr>

              ) : (

                products.map((product) => (

                  <tr
                    key={product.id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="p-3 font-medium">
                      {product.product_name}
                    </td>

                    <td className="p-3">

                      <input
                        type="number"
                        step="0.01"
                        value={getRate(product.id)}
                        onChange={(e) =>
                          changeRate(
                            product.id,
                            e.target.value
                          )
                        }
                        className="w-36 border rounded-lg p-2 text-center"
                      />

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

        <div className="flex justify-end mt-6">

          <button
            onClick={savePrices}
            disabled={!customerId || loading}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-semibold"
          >
            {loading
              ? "Saving..."
              : "Save All Prices"}
          </button>

        </div>

      </div>
          </div>
  );
}