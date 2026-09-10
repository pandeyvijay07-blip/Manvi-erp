import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function CompanySettings() {
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [upiId, setUpiId] = useState("");
  const [footer, setFooter] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      setCompanyName(data.company_name || "");
      setAddress(data.address || "");
      setMobile(data.mobile || "");
      setUpiId(data.upi_id || "");
      setFooter(data.footer || "");
    }
  }

  async function saveSettings() {
    setLoading(true);

    const { error } = await supabase
      .from("settings")
      .upsert([
        {
          id: 1,
          company_name: companyName,
          address,
          mobile,
          upi_id: upiId,
          footer,
        },
      ]);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Settings saved successfully.");
  }
    return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Company Settings
      </h1>

      <div className="bg-white rounded-lg shadow p-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <input
            type="text"
            placeholder="Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="border rounded-lg p-3"
          />

          <input
            type="text"
            placeholder="Mobile Number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="border rounded-lg p-3"
          />

          <input
            type="text"
            placeholder="UPI ID"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            className="border rounded-lg p-3"
          />

          <input
            type="text"
            placeholder="Invoice Footer"
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            className="border rounded-lg p-3"
          />

          <textarea
            placeholder="Company Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="border rounded-lg p-3 md:col-span-2"
            rows={3}
          />

        </div>

        <div className="mt-6">

          <button
            onClick={saveSettings}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg"
          >
            {loading ? "Saving..." : "Save Settings"}
          </button>

        </div>

      </div>

    </div>
  );
}