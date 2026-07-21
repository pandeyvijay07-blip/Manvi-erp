import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [sales, setSales] = useState(0);
  const [collections, setCollections] = useState(0);
  const [customers, setCustomers] = useState(0);
  const [products, setProducts] = useState(0);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const { data: salesData } = await supabase.from("sales").select("total");
    const { data: collectionData } = await supabase.from("collections").select("amount");
    const { count: customerCount } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true });
    const { count: productCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    setSales((salesData || []).reduce((sum, row) => sum + Number(row.total || 0), 0));
    setCollections((collectionData || []).reduce((sum, row) => sum + Number(row.amount || 0), 0));
    setCustomers(customerCount || 0);
    setProducts(productCount || 0);
  }

  return (
    <Layout>
      <div className="p-6 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold text-blue-700 mb-6">
          MANVI MILK AGENCIES
        </h1>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl shadow">
            <p className="text-gray-500">Total Sales</p>
            <h2 className="text-2xl font-bold text-green-600">₹{sales}</h2>
          </div>

          <div className="bg-white p-5 rounded-xl shadow">
            <p className="text-gray-500">Collections</p>
            <h2 className="text-2xl font-bold text-blue-600">₹{collections}</h2>
          </div>

          <div className="bg-white p-5 rounded-xl shadow">
            <p className="text-gray-500">Customers</p>
            <h2 className="text-2xl font-bold">{customers}</h2>
          </div>

          <div className="bg-white p-5 rounded-xl shadow">
            <p className="text-gray-500">Products</p>
            <h2 className="text-2xl font-bold">{products}</h2>
          </div>
        </div>
      </div>
    </Layout>
  );
}
