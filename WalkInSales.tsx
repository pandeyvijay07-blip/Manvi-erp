import { useState } from "react";

type CartItem = {
  id: number;
  product: string;
  qty: number;
  rate: number;
};

export default function WalkInSales() {
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState(0);
  const [payment, setPayment] = useState("Cash");
  const [cart, setCart] = useState<CartItem[]>([]);

  const addItem = () => {
    if (!product || qty <= 0 || rate <= 0) return;

    setCart([
      ...cart,
      {
        id: Date.now(),
        product,
        qty,
        rate,
      },
    ]);

    setProduct("");
    setQty(1);
    setRate(0);
  };

  const removeItem = (id: number) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const grandTotal = cart.reduce(
    (sum, item) => sum + item.qty * item.rate,
    0
  );

  const saveSale = () => {
    console.log({
      payment,
      cart,
      total: grandTotal,
    });

    alert("Walk-in Sale Saved");

    setCart([]);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Walk-in Sales</h1>

      <div className="grid gap-3">

        <input
          className="border rounded p-2"
          placeholder="Product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />

        <input
          className="border rounded p-2"
          type="number"
          placeholder="Quantity"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />

        <input
          className="border rounded p-2"
          type="number"
          placeholder="Rate"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
        />

        <button
          className="bg-blue-600 text-white rounded p-2"
          onClick={addItem}
        >
          Add Item
        </button>

      </div>

      <table className="w-full mt-6 border">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {cart.map((item) => (
            <tr key={item.id}>
              <td>{item.product}</td>
              <td>{item.qty}</td>
              <td>₹{item.rate}</td>
              <td>₹{item.qty * item.rate}</td>
              <td>
                <button
                  className="text-red-600"
                  onClick={() => removeItem(item.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <h2 className="text-xl font-bold">
          Grand Total: ₹{grandTotal}
        </h2>

        <select
          className="border rounded p-2 mt-3"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
        >
          <option>Cash</option>
          <option>UPI</option>
        </select>

        <button
          className="bg-green-600 text-white rounded p-2 ml-3"
          onClick={saveSale}
        >
          Save Sale
        </button>
      </div>
    </div>
  );
}
