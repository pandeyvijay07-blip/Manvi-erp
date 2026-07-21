import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [sales, setSales] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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

  const totalSales = sales.reduce(
    (sum, item) => sum + Number(item.total || 0),
    0
  );

  const totalCollections = collections.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const lowStock = products.filter(
    (p) => Number(p.stock || 0) <= 10
  );
    return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">
        Dashboard
      </h1>

      <div className="grid grid-cols-2 gap-4">

        <div className="bg-blue-600 text-white rounded-xl p-4 shadow">
          <p className="text-sm">Total Sales</p>
          <h2 className="text-2xl font-bold">
            ₹{totalSales.toFixed(2)}
          </h2>
        </div>

        <div className="bg-green-600 text-white rounded-xl p-4 shadow">
          <p className="text-sm">Collections</p>
          <h2 className="text-2xl font-bold">
            ₹{totalCollections.toFixed(2)}
          </h2>
        </div>

        <div className="bg-purple-600 text-white rounded-xl p-4 shadow">
          <p className="text-sm">Customers</p>
          <h2 className="text-2xl font-bold">
            {customers.length}
          </h2>
        </div>

        <div className="bg-orange-600 text-white rounded-xl p-4 shadow">
          <p className="text-sm">Products</p>
          <h2 className="text-2xl font-bold">
            {products.length}
          </h2>
        </div>

      </div>

      <div className="mt-6 bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">
          Low Stock Alert
        </h2>

        {lowStock.length === 0 ? (
          <p className="text-green-600">
            All products have sufficient stock.
          </p>
        ) : (
          <ul className="space-y-2">
            {lowStock.map((product) => (
              <li
                key={product.id}
                className="flex justify-between border-b pb-2"
              >
                <span>{product.product_name}</span>
                <span className="font-bold text-red-600">
                  {product.stock}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
            <div className="mt-6 bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">
          Recent Sales
        </h2>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Customer</th>
              <th className="text-left p-2">Product</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-right p-2">Total</th>
            </tr>
          </thead>

          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center p-4 text-gray-500"
                >
                  No sales available
                </td>
              </tr>
            ) : (
              sales.slice(0, 10).map((sale) => (
                <tr key={sale.id} className="border-b">
                  <td className="p-2">{sale.customer_id}</td>
                  <td className="p-2">{sale.product_id}</td>
                  <td className="text-right p-2">
                    {sale.quantity}
                  </td>
                  <td className="text-right p-2 font-semibold">
                    ₹{sale.total}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
            <div className="mt-6 bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">
          Business Summary
        </h2>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total Sales</span>
            <span className="font-bold">
              ₹{totalSales.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Total Collections</span>
            <span className="font-bold">
              ₹{totalCollections.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Outstanding</span>
            <span className="font-bold text-red-600">
              ₹{(totalSales - totalCollections).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Total Customers</span>
            <span className="font-bold">
              {customers.length}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Total Products</span>
            <span className="font-bold">
              {products.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
