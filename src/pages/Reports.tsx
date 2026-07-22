import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Reports() {
  const [sales, setSales] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: salesData } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: collectionData } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: customerData } = await supabase
      .from("customers")
      .select("*");

    const { data: productData } = await supabase
      .from("products")
      .select("*");

    setSales(salesData || []);
    setCollections(collectionData || []);
    setCustomers(customerData || []);
    setProducts(productData || []);
  }

  function getCustomerName(id: string) {
    return customers.find((c) => c.id === id)?.name || "-";
  }

  function getProductName(id: string) {
    return products.find((p) => p.id === id)?.product_name || "-";
  }  const totalSales = sales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const totalCollections = collections.reduce(
    (sum, collection) => sum + Number(collection.amount || 0),
    0
  );

  const pendingAmount = totalSales - totalCollections;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">
        Reports
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        <div className="bg-blue-600 text-white rounded-xl p-4">
          <h2 className="text-lg">Total Sales</h2>
          <p className="text-3xl font-bold">
            ₹{totalSales.toFixed(2)}
          </p>
        </div>

        <div className="bg-green-600 text-white rounded-xl p-4">
          <h2 className="text-lg">Collections</h2>
          <p className="text-3xl font-bold">
            ₹{totalCollections.toFixed(2)}
          </p>
        </div>

        <div className="bg-red-600 text-white rounded-xl p-4">
          <h2 className="text-lg">Outstanding</h2>
          <p className="text-3xl font-bold">
            ₹{pendingAmount.toFixed(2)}
          </p>
        </div>

      </div>
            <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">
          Sales Report
        </h2>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Customer</th>
              <th className="text-left p-2">Product</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-right p-2">Rate</th>
              <th className="text-right p-2">Total</th>
            </tr>
          </thead>

          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center p-4 text-gray-500"
                >
                  No sales found
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-b"
                >
                  <td className="p-2">
                    {getCustomerName(sale.customer_id)}
                  </td>

                  <td className="p-2">
                    {getProductName(sale.product_id)}
                  </td>

                  <td className="text-right p-2">
              <div className="mt-8 bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">
          Collection Report
        </h2>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Customer</th>
              <th className="text-right p-2">Amount</th>
              <th className="text-left p-2">Payment Mode</th>
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
