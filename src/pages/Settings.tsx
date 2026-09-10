import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Settings() {
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("₹");
  const [billPrefix, setBillPrefix] = useState("INV");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error(error);
      return;
    }

    if (data) {
      setCompanyName(data.business_name || "");
      setPhone(data.mobile || "");
      setEmail(data.email || "");
      setAddress(data.business_address || "");
      setCurrency(data.currency || "₹");
      setBillPrefix(data.bill_prefix || "INV");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    const { error } = await supabase
      .from("settings")
      .upsert({
        business_name: companyName,
        business_address: address,
        mobile: phone,
        email: email,
        bill_prefix: billPrefix,
        currency: currency,
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Settings saved successfully.");
  }

  return (
    <div className="max-w-4xl mx-auto mt-8">

      <div className="bg-white rounded-xl shadow-lg p-8">

        <h1 className="text-3xl font-bold text-blue-700 mb-6">
          Settings
        </h1>

        <form onSubmit={handleSave} className="space-y-5">

          <div>

            <label className="block mb-2 font-medium">
              Business Name
            </label>

            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div className="grid md:grid-cols-2 gap-5">

            <div>

              <label className="block mb-2 font-medium">
                Mobile
              </label>

              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded-lg p-3"
              />

            </div>

            <div>

              <label className="block mb-2 font-medium">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-lg p-3"
              />

            </div>

          </div>

          <div>

            <label className="block mb-2 font-medium">
              Business Address
            </label>

            <textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div className="grid md:grid-cols-2 gap-5">

            <div>

              <label className="block mb-2 font-medium">
                Bill Prefix
              </label>

              <input
                type="text"
                value={billPrefix}
                onChange={(e) => setBillPrefix(e.target.value)}
                className="w-full border rounded-lg p-3"
              />

            </div>

            <div>

              <label className="block mb-2 font-medium">
                Currency
              </label>

              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border rounded-lg p-3"
              >
                <option value="₹">₹ Indian Rupee</option>
                <option value="$">$ US Dollar</option>
                <option value="€">€ Euro</option>
              </select>

            </div>

          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            {loading ? "Saving..." : "Save Settings"}
          </button>

        </form>

      </div>

    </div>
  );
}