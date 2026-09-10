import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Sale = {
  id: string;
  sale_date: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_method: string;
  customer_id: string;
};

type Customer = {
  customer_name: string;
  mobile: string | null;
  address: string | null;
};

type Settings = {
  business_name: string;
  business_address: string | null;
  mobile: string | null;
  email: string | null;
  bill_prefix: string | null;
  currency: string | null;
};

type Product = {
  product_name: string;
  pack_size: string | null;
};

type SaleItem = {
  id: string;
  quantity: number;
  rate: number;
  amount: number;
  products: Product | null;
};

export default function Invoice() {
  const { id } = useParams();

  const [sale, setSale] = useState<Sale | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (id) {
      loadInvoice(id);
    } else {
      setErrorMessage("Invoice ID not found.");
      setLoading(false);
    }
  }, [id]);
    async function loadInvoice(saleId: string) {
    setLoading(true);
    setErrorMessage("");

    try {
      // Load Sale
      const { data: saleData, error: saleError } =
        await supabase
          .from("sales")
          .select("*")
          .eq("id", saleId)
          .single();

      if (saleError) {
        throw saleError;
      }

      if (!saleData) {
        setErrorMessage("Sale not found.");
        setLoading(false);
        return;
      }

      setSale(saleData as Sale);

      // Load Customer
      const { data: customerData, error: customerError } =
        await supabase
          .from("customers")
          .select(`
            customer_name,
            mobile,
            address
          `)
          .eq("id", saleData.customer_id)
          .single();

      if (customerError) {
        console.error(
          "Customer loading error:",
          customerError
        );
      } else {
        setCustomer(customerData as Customer);
      }

      // Load Sale Items
      const { data: itemData, error: itemError } =
        await supabase
          .from("sale_items")
          .select(`
            id,
            quantity,
            rate,
            amount,
            products (
              product_name,
              pack_size
            )
          `)
          .eq("sale_id", saleId);

      if (itemError) {
        console.error(
          "Sale items loading error:",
          itemError
        );
      } else {
        setItems(
          (itemData ?? []) as unknown as SaleItem[]
        );
      }

      // Load Business Settings
      const { data: settingsData, error: settingsError } =
        await supabase
          .from("settings")
          .select(`
            business_name,
            business_address,
            mobile,
            email,
            bill_prefix,
            currency
          `)
          .limit(1)
          .maybeSingle();

      if (settingsError) {
        console.error(
          "Settings loading error:",
          settingsError
        );
      } else if (settingsData) {
        setSettings(settingsData as Settings);
      }

    } catch (error) {
      console.error("Invoice loading error:", error);

      setErrorMessage(
        "Unable to load invoice."
      );
    } finally {
      setLoading(false);
    }
  }
    if (loading) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-semibold text-blue-600">
          Loading Invoice...
        </h2>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-semibold text-red-600">
          {errorMessage}
        </h2>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-semibold text-red-600">
          Invoice not found.
        </h2>
      </div>
    );
  }

  const currency =
    settings?.currency || "₹";

  const billPrefix =
    settings?.bill_prefix || "INV";

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 bg-white">

      {/* Print Button */}

      <div className="flex justify-end mb-6 print:hidden">

        <button
          type="button"
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
        >
          Print Invoice
        </button>

      </div>

      {/* Invoice Container */}

      <div className="border-2 border-gray-800 rounded-lg p-5 md:p-8">

        {/* Business Header */}

        <div className="text-center border-b pb-6">

          <h1 className="text-3xl md:text-4xl font-bold text-blue-700">
            {settings?.business_name || "MANVI MILK AGENCIES"}
          </h1>

          {settings?.business_address && (
            <p className="mt-2 text-gray-700">
              {settings.business_address}
            </p>
          )}

          {settings?.mobile && (
            <p className="text-gray-700">
              Mobile: {settings.mobile}
            </p>
          )}

          {settings?.email && (
            <p className="text-gray-700">
              Email: {settings.email}
            </p>
          )}

        </div>

        {/* Invoice + Customer Information */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-b">

          {/* Customer */}

          <div>

            <h2 className="text-lg font-bold mb-3">
              Bill To
            </h2>

            {customer ? (
              <>
                <p className="font-semibold">
                  {customer.customer_name}
                </p>

                {customer.mobile && (
                  <p>
                    Mobile: {customer.mobile}
                  </p>
                )}

                {customer.address && (
                  <p>
                    Address: {customer.address}
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-500">
                Customer details unavailable
              </p>
            )}

          </div>

          {/* Invoice Details */}

          <div className="md:text-right">

            <p>
              <strong>Invoice No:</strong>{" "}
              {billPrefix}-{sale.id.slice(0, 8).toUpperCase()}
            </p>

            <p className="mt-1">
              <strong>Date:</strong>{" "}
              {new Date(
                sale.sale_date
              ).toLocaleDateString("en-IN")}
            </p>

            <p className="mt-1">
              <strong>Payment:</strong>{" "}
              {sale.payment_method || "-"}
            </p>

          </div>

        </div>
                {/* Product Table */}

        <div className="mt-8 overflow-x-auto">

          <table className="w-full border-collapse border">

            <thead className="bg-blue-600 text-white">

              <tr>
                <th className="border p-3">
                  Product
                </th>

                <th className="border p-3">
                  Pack
                </th>

                <th className="border p-3">
                  Qty
                </th>

                <th className="border p-3">
                  Rate
                </th>

                <th className="border p-3">
                  Amount
                </th>
              </tr>

            </thead>

            <tbody>

              {items.length === 0 ? (

                <tr>

                  <td
                    colSpan={5}
                    className="border p-6 text-center text-gray-500"
                  >
                    No Products Found
                  </td>

                </tr>

              ) : (

                items.map((item) => (

                  <tr key={item.id}>

                    <td className="border p-3">
                      {item.products?.product_name || "-"}
                    </td>

                    <td className="border p-3 text-center">
                      {item.products?.pack_size || "-"}
                    </td>

                    <td className="border p-3 text-center">
                      {Number(item.quantity)}
                    </td>

                    <td className="border p-3 text-right">
                      {currency}{" "}
                      {Number(item.rate).toFixed(2)}
                    </td>

                    <td className="border p-3 text-right">
                      {currency}{" "}
                      {Number(item.amount).toFixed(2)}
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

        {/* Invoice Totals */}

        <div className="flex justify-end mt-8">

          <div className="w-full md:w-80">

            <div className="flex justify-between border-b py-2">

              <span className="font-semibold">
                Total
              </span>

              <span className="font-bold">
                {currency}{" "}
                {Number(
                  sale.total_amount ?? 0
                ).toFixed(2)}
              </span>

            </div>

            <div className="flex justify-between border-b py-2">

              <span className="font-semibold">
                Paid
              </span>

              <span>
                {currency}{" "}
                {Number(
                  sale.paid_amount ?? 0
                ).toFixed(2)}
              </span>

            </div>

            <div className="flex justify-between py-3">

              <span className="font-bold text-red-600">
                Balance
              </span>

              <span className="font-bold text-red-600">
                {currency}{" "}
                {Number(
                  sale.balance_amount ?? 0
                ).toFixed(2)}
              </span>

            </div>

          </div>

        </div>

        {/* Footer */}

        <div className="mt-12 border-t pt-6 text-center">

          <p className="font-bold">
            Thank You For Your Business
          </p>

          <p className="text-gray-600 mt-1">
            {settings?.business_name ||
              "MANVI MILK AGENCIES"}
          </p>

          <p className="text-sm text-gray-500 mt-1">
            Computer Generated Invoice
          </p>

        </div>

      </div>

    </div>
  );
}