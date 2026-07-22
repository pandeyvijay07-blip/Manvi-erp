import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function Sales() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .order("name");

    const { data: productData } = await supabase
      .from("products")
      .select("*")
      .order("product_name");

    const { data: salesData } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });

    setCustomers(customerData || []);
    setProducts(productData || []);
    setSales(salesData || []);
  }

  function getCustomerName(id: string) {
    return customers.find((c) => c.id === id)?.name || "-";
  }

  function getProductName(id: string) {
    return products.find((p) => p.id === id)?.product_name || "-";
  }

  async function saveSale() {
    if (!customerId || !productId) {
      alert("Select customer and product");
      return;
    }

    const product = products.find((p) => p.id === productId);

    if (!product) {
      alert("Product not found");
      return;
    }

    const { data: customerPrice } = await supabase
      .from("customer_prices")
      .select("price")
      .eq("customer_id", customerId)
      .eq("product_id", productId)
      .maybeSingle();

    const rate = Number(
      customerPrice?.price ?? product.selling_price
    );

    const total = qty * rate;

    const { error } = await supabase
      .from("sales")
      .insert({
        customer_id: customerId,
        product_id: productId,
        quantity: qty,
        rate,
        total,
        created_at: new Date().toISOString(),
      });

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("products")
      .update({
        stock: Math.max(0, Number(product.stock || 0) - qty),
      })
      .eq("id", productId);

    setCustomerId("");
    setProductId("");
    setQty(1);

    loadData();

    alert("Sale Saved");
    }
  return (
     <Layout>
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Sales Entry</h1>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div>
            <label className="block mb-1 font-medium">Customer</label>
            <select
              className="w-full border rounded-lg p-3"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select Customer</option>

              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">Product</label>
            <select
              className="w-full border rounded-lg p-3"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select Product</option>

              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">Quantity</label>
            <input
              type="number"
              min="1"
              className="w-full border rounded-lg p-3"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>

          <button
            onClick={saveSale}
            className="w-full bg-blue-600 text-white rounded-lg p-3"
          >
            Save Sale
          </button>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Recent Sales</h2>

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
                  <td colSpan={5} className="text-center p-6">
                    No sales found
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="border-b">
                    <td className="p-2">
                      {getCustomerName(sale.customer_id)}
                    </td>

                    <td className="p-2">
                      {getProductName(sale.product_id)}
                    </td>

                    <td className="text-right p-2">
                      {sale.quantity}
                    </td>

                    <td className="text-right p-2">
                      ₹{sale.rate}
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
      </div>
    </Layout>
  );
}
