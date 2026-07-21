import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Purchase = {
  id: string;
  supplier: string;
  product: string;
  quantity: number;
};

function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplier, setSupplier] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");

  async function loadPurchases() {
    const { data } = await supabase
      .from("purchases")
      .select("*")
      .order("id", { ascending: false });

    setPurchases((data as Purchase[]) || []);
  }

  async function addPurchase() {
    if (!supplier || !product || !quantity) return;

    await supabase.from("purchases").insert({
      supplier,
      product,
      quantity: Number(quantity),
    });

    setSupplier("");
    setProduct("");
    setQuantity("");

    loadPurchases();
  }

  useEffect(() => {
    loadPurchases();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Purchases</h1>

      <input
        placeholder="Supplier"
        value={supplier}
        onChange={(e) => setSupplier(e.target.value)}
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

      <button onClick={addPurchase}>
        Save Purchase
      </button>

      <hr />

      {purchases.map((purchase) => (
        <div key={purchase.id}>
          <strong>{purchase.supplier}</strong><br />
          {purchase.product} - {purchase.quantity}
          <hr />
        </div>
      ))}
    </div>
  );
}

export default Purchases;
