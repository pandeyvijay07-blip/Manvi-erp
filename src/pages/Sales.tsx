import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Sale = {
  id: string;
  customer: string;
  product: string;
  quantity: number;
  payment_mode: string;
};

function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customer, setCustomer] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");

  async function loadSales() {
    const { data } = await supabase
      .from("sales")
      .select("*")
      .order("id", { ascending: false });

    setSales((data as Sale[]) || []);
  }

  async function addSale() {
    if (!customer || !product || !quantity) return;

    await supabase.from("sales").insert({
      customer,
      product,
      quantity: Number(quantity),
      payment_mode: paymentMode,
    });

    setCustomer("");
    setProduct("");
    setQuantity("");
    setPaymentMode("Cash");

    loadSales();
  }

  useEffect(() => {
    loadSales();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Sales</h1>

      <input
        placeholder="Customer"
        value={customer}
        onChange={(e) => setCustomer(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Product"
        value={product}
        onChange={(e) => setProduct(e.target.value)}
      />

      <br /><br />

      <input
        type="number"
        placeholder="Quantity"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />

      <br /><br />

      <select
        value={paymentMode}
        onChange={(e) => setPaymentMode(e.target.value)}
      >
        <option>Cash</option>
        <option>UPI</option>
        <option>Credit</option>
      </select>

      <br /><br />

      <button onClick={addSale}>
        Save Sale
      </button>

      <hr />

      {sales.map((sale) => (
        <div key={sale.id}>
          <strong>{sale.customer}</strong><br />
          {sale.product} - {sale.quantity}<br />
          {sale.payment_mode}
          <hr />
        </div>
      ))}
    </div>
  );
}

export default Sales;
