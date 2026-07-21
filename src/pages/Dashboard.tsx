import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [totalSales, setTotalSales] = useState(0);
  const [totalCollections, setTotalCollections] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [profit, setProfit] = useState(0);

  const [salesCount, setSalesCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [productCount, setProductCount] = useState(0);

  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const { data: sales } = await supabase
      .from("sales")
      .select("*");

    const { data: collections } = await supabase
      .from("collections")
      .select("*");

    const { data: expenses } = await supabase
      .from("expenses")
      .select("*");

    const { data: customers } = await supabase
      .from("customers")
      .select("*");

    const { data: products } = await supabase
      .from("products")
      .select("*");

    const totalSaleAmount =
      sales?.reduce(
        (sum: number, row: any) => sum + Number(row.total),
        0
      ) || 0;

    const totalCollectionAmount =
      collections?.reduce(
        (sum: number, row: any) => sum + Number(row.amount),
        0
      ) || 0;

    const totalExpenseAmount =
      expenses?.reduce(
        (sum: number, row: any) => sum + Number(row.amount),
        0
      ) || 0;

    setTotalSales(totalSaleAmount);
    setTotalCollections(totalCollectionAmount);
    setTotalExpenses(totalExpenseAmount);
    setProfit(totalSaleAmount - totalExpenseAmount);

    setSalesCount(sales?.length || 0);
    setCustomerCount(customers?.length || 0);
    setProductCount(products?.length || 0);

    setRecentSales(
      [...(sales || [])]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
        .slice(0, 10)
    );

    setLowStock(
      (products || []).filter(
        (item: any) => Number(item.stock) <= 10
      )
    );
  }  return (
    <div className="space-y-6">

      <h1 className="text-3xl font-bold text-gray-800">
        Dashboard
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-gray-500 text-sm">
            Total Sales
          </h2>

          <p className="text-2xl font-bold text-green-600">
            ₹{totalSales.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-gray-500 text-sm">
            Collections
          </h2>

          <p className="text-2xl font-bold text-blue-600">
            ₹{totalCollections.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-gray-500 text-sm">
            Expenses
          </h2>

          <p className="text-2xl font-bold text-red-600">
            ₹{totalExpenses.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-gray-500 text-sm">
            Profit
          </h2>

          <p className="text-2xl font-bold text-purple-600">
            ₹{profit.toFixed(2)}
          </p>
        </div>

      </div>

      <div className="grid grid-cols-3 gap-4">

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-gray-500">
            Customers
          </h2>

          <p className="text-3xl font-bold">
            {customerCount}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-gray-500">
            Products
          </h2>

          <p className="text-3xl font-bold">
            {productCount}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-gray-500">
            Sales Entries
          </h2>

          <p className="text-3xl font-bold">
            {salesCount}
          </p>
        </div>

      </div>      <div className="bg-white rounded-xl shadow p-5">

        <h2 className="text-xl font-semibold mb-4">
          Recent Sales
        </h2>

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead>

              <tr className="border-b">

                <th className="text-left py-2">Customer</th>

                <th className="text-left py-2">Product</th>

                <th className="text-right py-2">Qty</th>

                <th className="text-right py-2">Total</th>

              </tr>

            </thead>

            <tbody>

              {recentSales.map((sale) => (

                <tr
                  key={sale.id}
                  className="border-b hover:bg-gray-50"
                >

                  <td className="py-2">
                    {sale.customer_name || sale.customer_id}
                  </td>

                  <td className="py-2">
                    {sale.product_name || sale.product_id}
                  </td>

                  <td className="text-right py-2">
                    {sale.quantity}
                  </td>

                  <td className="text-right py-2 font-semibold">
                    ₹{Number(sale.total).toFixed(2)}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

      <div className="bg-white rounded-xl shadow p-5">

        <h2 className="text-xl font-semibold mb-4">
          Low Stock Products
        </h2>

        {lowStock.length === 0 ? (

          <p className="text-green-600">
            All products have sufficient stock.
          </p>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="border-b">

                  <th className="text-left py-2">
                    Product
                  </th>

                  <th className="text-right py-2">
                    Stock
                  </th>

                </tr>

              </thead>

              <tbody>

                {lowStock.map((item) => (

                  <tr
                    key={item.id}
                    className="border-b"
                  >

                    <td className="py-2">
                      {item.product_name}
                    </td>

                    <td className="text-right py-2 text-red-600 font-bold">
                      {item.stock}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </div>    </div>
  );
}
