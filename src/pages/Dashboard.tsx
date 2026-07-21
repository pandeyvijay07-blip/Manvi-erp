import Layout from "../components/Layout";

export default function Dashboard() {
  return (
    <Layout>
      <div className="p-6 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold text-blue-700">
          MANVI MILK AGENCIES
        </h1>
        <p className="text-gray-600 mb-6">
          Dairy ERP Dashboard
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="text-gray-500">Today's Sales</h3>
            <p className="text-2xl font-bold text-green-600">₹0.00</p>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="text-gray-500">Collections</h3>
            <p className="text-2xl font-bold text-blue-600">₹0.00</p>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="text-gray-500">Pending Balance</h3>
            <p className="text-2xl font-bold text-red-600">₹0.00</p>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="text-gray-500">Products</h3>
            <p className="text-2xl font-bold text-purple-600">0</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow mt-6 p-5">
          <h2 className="text-xl font-semibold mb-3">
            Recent Activity
          </h2>

          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Customer</th>
                <th className="text-left py-2">Product</th>
                <th className="text-left py-2">Amount</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="py-2">No records</td>
                <td>-</td>
                <td>₹0.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
