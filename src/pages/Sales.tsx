        <div className="bg-white rounded-xl shadow p-6 space-y-4">

          <div>
            <label className="block mb-1 font-medium">
              Customer
            </label>

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
            <label className="block mb-1 font-medium">
              Product
            </label>

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
            <label className="block mb-1 font-medium">
              Quantity
            </label>

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
          <h2 className="text-xl font-bold mb-4">
            Recent Sales
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
