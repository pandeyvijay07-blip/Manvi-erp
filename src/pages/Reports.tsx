import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function Reports() {
  const [report, setReport] = useState<any[]>([]);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    const { data: customers } = await supabase
      .from("customers")
      .select("id,name");

    const result = [];

    for (const c of customers || []) {
      const { data: sales } = await supabase
        .from("sales")
        .select("total")
        .eq("customer_id", c.id);

      const { data: collections } = await supabase
        .from("collections")
        .select("amount")
        .eq("customer_id", c.id);

      const totalSales = (sales || []).reduce(
        (sum, x) => sum + Number(x.total || 0),
        0
      );

      const totalCollection = (collections || []).reduce(
        (sum, x) => sum + Number(x.amount || 0),
        0
      );

      result.push({
        name: c.name,
        sales: totalSales,
        collection: totalCollection,
        balance: totalSales - totalCollection,
      });
    }

    setReport(result);
  }

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-5">
          Customer Balance Report
        </h1>

        <table className="w-full bg-white rounded-xl shadow">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-right">Sales</th>
              <th className="p-3 text-right">Collections</th>
              <th className="p-3 text-right">Balance</th>
            </tr>
          </thead>

          <tbody>
            {report.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="p-3">{r.name}</td>
                <td className="p-3 text-right">₹{r.sales}</td>
                <td className="p-3 text-right">₹{r.collection}</td>
                <td className="p-3 text-right font-bold text-red-600">
                  ₹{r.balance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
