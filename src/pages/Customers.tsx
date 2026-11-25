import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  customer_name: string;
  mobile: string;
  address: string;
  area: string;
  route: string;
  opening_balance: number;
  sales_outstanding: number;
  outstanding: number;
  whatsapp_opt_in: boolean;
  whatsapp_opt_in_at: string | null;
};

type SaleBalance = {
  customer_id: string | null;
  balance_amount: number | string | null;
};

type BalanceFilter = "all" | "due" | "clear";

const money = (value: number | string | null | undefined) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [routeSearch, setRouteSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");

  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [route, setRoute] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void loadCustomers();
  }, []);

  // Outstanding calculation deliberately matches the existing V29 rule:
  // customer opening balance + balances on unpaid sales.
  async function loadCustomers() {
    setLoading(true);
    try {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select(
          "id, customer_name, mobile, address, area, route, opening_balance, whatsapp_opt_in, whatsapp_opt_in_at",
        )
        .order("customer_name", { ascending: true });

      if (customerError) throw customerError;

      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("customer_id, balance_amount")
        .gt("balance_amount", 0);

      if (salesError) throw salesError;

      const outstandingMap: Record<string, number> = {};
      (salesData || []).forEach((sale: SaleBalance) => {
        if (!sale.customer_id) return;
        outstandingMap[sale.customer_id] =
          (outstandingMap[sale.customer_id] || 0) +
          Number(sale.balance_amount || 0);
      });

      const finalCustomers: Customer[] = (customerData || []).map((customer) => {
        const opening = Number(customer.opening_balance || 0);
        const salesOutstanding = outstandingMap[customer.id] || 0;
        return {
          id: String(customer.id),
          customer_name: customer.customer_name || "",
          mobile: customer.mobile || "",
          address: customer.address || "",
          area: customer.area || "",
          route: customer.route || "",
          opening_balance: opening,
          sales_outstanding: salesOutstanding,
          outstanding: opening + salesOutstanding,
          whatsapp_opt_in: Boolean(customer.whatsapp_opt_in),
          whatsapp_opt_in_at: customer.whatsapp_opt_in_at || null,
        };
      });

      setCustomers(finalCustomers);
    } catch (error) {
      console.error("CUSTOMER LOADING ERROR:", error);
      alert(error instanceof Error ? error.message : "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCustomer() {
    if (!customerName.trim()) {
      alert("Enter customer name.");
      return;
    }

    const opening = Number(openingBalance);
    if (!Number.isFinite(opening) || opening < 0) {
      alert("Opening balance must be a valid amount.");
      return;
    }

    if (whatsappOptIn && !mobile.trim()) {
      alert("Enter customer mobile number before enabling WhatsApp messages.");
      return;
    }

    setLoading(true);
    try {
      const cleanRoute = route.trim();
      const whatsappOptInAt = whatsappOptIn ? new Date().toISOString() : null;
      const customerPayload = {
        customer_name: customerName.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        area: area.trim(),
        route: cleanRoute || null,
        opening_balance: opening,
        whatsapp_opt_in: whatsappOptIn,
        whatsapp_opt_in_at: whatsappOptInAt,
      };

      if (editingId) {
        const { error } = await supabase
          .from("customers")
          .update(customerPayload)
          .eq("id", editingId);
        if (error) throw error;
        alert("Customer updated successfully.");
      } else {
        const { error } = await supabase
          .from("customers")
          .insert(customerPayload);
        if (error) throw error;
        alert("Customer added successfully.");
      }

      clearForm();
      await loadCustomers();
    } catch (error) {
      console.error("SAVE CUSTOMER ERROR:", error);
      alert(error instanceof Error ? error.message : "Unable to save customer.");
    } finally {
      setLoading(false);
    }
  }

  function editCustomer(customer: Customer) {
    setEditingId(customer.id);
    setCustomerName(customer.customer_name);
    setMobile(customer.mobile);
    setAddress(customer.address);
    setArea(customer.area);
    setRoute(customer.route);
    setOpeningBalance(String(customer.opening_balance || 0));
    setWhatsappOptIn(customer.whatsapp_opt_in);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteCustomer(id: string) {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
      alert("Customer deleted successfully.");
      await loadCustomers();
    } catch (error) {
      console.error("DELETE CUSTOMER ERROR:", error);
      alert(error instanceof Error ? error.message : "Unable to delete customer.");
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setEditingId(null);
    setCustomerName("");
    setMobile("");
    setAddress("");
    setArea("");
    setRoute("");
    setOpeningBalance("0");
    setWhatsappOptIn(false);
  }

  const availableRoutes = useMemo(
    () =>
      Array.from(
        new Set(customers.map((customer) => customer.route.trim()).filter(Boolean)),
      ).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      ),
    [customers],
  );

  const totalOutstanding = customers.reduce((sum, customer) => sum + customer.outstanding, 0);
  const totalOpeningBalance = customers.reduce(
    (sum, customer) => sum + customer.opening_balance,
    0,
  );
  const totalSalesOutstanding = customers.reduce(
    (sum, customer) => sum + customer.sales_outstanding,
    0,
  );
  const dueCustomers = customers.filter((customer) => customer.outstanding > 0).length;
  const whatsappCustomers = customers.filter((customer) => customer.whatsapp_opt_in).length;

  const routeSummaries = useMemo(() => {
    const grouped = new Map<string, { count: number; due: number }>();
    customers.forEach((customer) => {
      const key = customer.route.trim() || "No Route";
      const current = grouped.get(key) || { count: 0, due: 0 };
      current.count += 1;
      current.due += customer.outstanding;
      grouped.set(key, current);
    });
    return Array.from(grouped.entries())
      .filter(([routeName]) => routeName !== "No Route")
      .sort(([a], [b]) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      );
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const searchText = search.toLowerCase().trim();
    const routeText = routeSearch.toLowerCase().trim();
    return customers
      .filter((customer) => {
        const matchesRoute =
          !routeText || customer.route.toLowerCase().includes(routeText);
        const matchesSearch =
          !searchText ||
          customer.customer_name.toLowerCase().includes(searchText) ||
          customer.mobile.toLowerCase().includes(searchText) ||
          customer.area.toLowerCase().includes(searchText) ||
          customer.route.toLowerCase().includes(searchText);
        const matchesBalance =
          balanceFilter === "all" ||
          (balanceFilter === "due" && customer.outstanding > 0) ||
          (balanceFilter === "clear" && customer.outstanding <= 0);
        return matchesRoute && matchesSearch && matchesBalance;
      })
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [customers, search, routeSearch, balanceFilter]);

  const filteredOutstanding = filteredCustomers.reduce(
    (sum, customer) => sum + customer.outstanding,
    0,
  );

  const inputClass =
    "w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";
  const cardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            MANVI MILK AGENCIES
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Customer Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Customer directory, route allocation and outstanding balances.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCustomers()}
          disabled={loading}
          className="min-h-[42px] rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "↻ Refresh Data"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <div className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Customers</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">{customers.length}</p>
          <p className="mt-1 text-xs text-slate-500">{availableRoutes.length} routes</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customers With Due</p>
          <p className="mt-2 text-2xl font-extrabold text-rose-600 sm:text-3xl">{dueCustomers}</p>
          <p className="mt-1 text-xs text-slate-500">Accounts with balance above zero</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Outstanding</p>
          <p className="mt-2 text-xl font-extrabold text-rose-600 sm:text-2xl">{money(totalOutstanding)}</p>
          <p className="mt-1 text-xs text-slate-500">Opening + unpaid sales balance</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opening Balance</p>
          <p className="mt-2 text-xl font-extrabold text-amber-600 sm:text-2xl">{money(totalOpeningBalance)}</p>
          <p className="mt-1 text-xs text-slate-500">Opening amount entered</p>
        </div>
        <div className={`${cardClass} col-span-2 xl:col-span-1`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unpaid Sales</p>
          <p className="mt-2 text-xl font-extrabold text-blue-700 sm:text-2xl">{money(totalSalesOutstanding)}</p>
          <p className="mt-1 text-xs text-slate-500">Sum of unpaid sale balances</p>
        </div>
      </div>

      {/* Route-wise overview */}
      <section className={cardClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Route-wise Customer Summary</h2>
            <p className="text-xs text-slate-500">Select a route to filter the customer list.</p>
          </div>
          {routeSearch && (
            <button
              type="button"
              onClick={() => setRouteSearch("")}
              className="text-sm font-bold text-blue-700 hover:underline"
            >
              Clear route filter
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {routeSummaries.map(([routeName, summary]) => {
            const selected = routeSearch.toLowerCase() === routeName.toLowerCase();
            return (
              <button
                type="button"
                key={routeName}
                onClick={() => setRouteSearch(routeName === "No Route" ? "" : selected ? "" : routeName)}
                className={`min-w-[150px] rounded-xl border px-3 py-2 text-left transition ${
                  selected
                    ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                <span className="block truncate text-sm font-bold text-slate-800">{routeName}</span>
                <span className="mt-1 block text-xs text-slate-500">{summary.count} customers</span>
                <span className="mt-1 block text-sm font-extrabold text-rose-600">{money(summary.due)}</span>
              </button>
            );
          })}
          {routeSummaries.length === 0 && (
            <p className="py-2 text-sm text-slate-500">No routes added yet.</p>
          )}
        </div>
      </section>

      {/* Add / edit form */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {editingId ? "Edit Customer" : "Add New Customer"}
            </h2>
            <p className="text-xs text-slate-500">Maintain customer contact and route details.</p>
          </div>
          {editingId && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              Editing customer
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div>
            <label className={labelClass}>Customer Name *</label>
            <input className={inputClass} placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Mobile Number</label>
            <input type="tel" className={inputClass} placeholder="10 digit mobile number" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Area</label>
            <input className={inputClass} placeholder="Area / locality" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Route</label>
            <input type="text" list="customer-routes-v30" className={inputClass} placeholder="Enter or select route" value={route} onChange={(e) => setRoute(e.target.value)} />
            <datalist id="customer-routes-v30">
              {availableRoutes.map((routeName) => <option key={routeName} value={routeName} />)}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Opening Balance (₹)</label>
            <input type="number" min="0" step="0.01" className={inputClass} placeholder="0.00" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Existing payable amount before recorded sales.</p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Address</label>
            <textarea className={`${inputClass} min-h-[80px]`} rows={2} placeholder="Customer address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                className="mt-1 h-5 w-5 accent-emerald-600"
              />
              <span>
                <span className="block text-sm font-bold text-emerald-900">Customer has opted in to WhatsApp messages</span>
                <span className="mt-1 block text-xs text-emerald-800">Enable only when the customer has agreed to receive eligible sale and collection messages.</span>
                {whatsappOptIn && !mobile.trim() && (
                  <span className="mt-1 block text-xs font-bold text-rose-600">Enter a mobile number before saving WhatsApp opt-in.</span>
                )}
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={() => void saveCustomer()}
            disabled={loading}
            className="min-h-[44px] rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Saving..." : editingId ? "Update Customer" : "+ Save Customer"}
          </button>
          {editingId && (
            <button type="button" onClick={clearForm} disabled={loading} className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              Cancel Edit
            </button>
          )}
        </div>
      </section>

      {/* Search and balance filters */}
      <section className={cardClass}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Search Customer</label>
            <input type="search" className={inputClass} placeholder="Name, mobile, area or route..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Filter Route</label>
            <input type="text" list="customer-route-search-v30" className={inputClass} placeholder="All routes" value={routeSearch} onChange={(e) => setRouteSearch(e.target.value)} />
            <datalist id="customer-route-search-v30">
              {availableRoutes.map((routeName) => <option key={routeName} value={routeName} />)}
            </datalist>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {([
            ["all", "All Customers"],
            ["due", "Customers With Due"],
            ["clear", "No Outstanding"],
          ] as [BalanceFilter, string][]).map(([value, label]) => (
            <button
              type="button"
              key={value}
              onClick={() => setBalanceFilter(value)}
              className={`min-h-[38px] rounded-full border px-4 py-2 text-xs font-extrabold transition ${
                balanceFilter === value
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs font-semibold text-slate-500">
            {filteredCustomers.length} shown · {money(filteredOutstanding)} outstanding
          </span>
        </div>
      </section>

      {/* Customer list */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Customer Outstanding Register</h2>
            <p className="text-xs text-slate-500">Highest outstanding customers are shown first.</p>
          </div>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-extrabold text-rose-700">
            Total {money(totalOutstanding)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide">Customer</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide">Route / Area</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide">Mobile</th>
                <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide">WhatsApp</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">Opening</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">Unpaid Sales</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">Total Outstanding</th>
                <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Loading customer data...</td></tr>
              )}
              {!loading && filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/70">
                  <td className="px-3 py-3">
                    <span className="block font-bold text-slate-900">{customer.customer_name}</span>
                    {customer.address && <span className="mt-0.5 block max-w-[220px] truncate text-xs text-slate-500">{customer.address}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="block font-semibold text-blue-800">{customer.route || "No Route"}</span>
                    <span className="text-xs text-slate-500">{customer.area || "-"}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{customer.mobile || "-"}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${customer.whatsapp_opt_in ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                      {customer.whatsapp_opt_in ? "Enabled" : "Off"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{money(customer.opening_balance)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-blue-700">{money(customer.sales_outstanding)}</td>
                  <td className="px-3 py-3 text-right">
                    <span className={`rounded-lg px-2.5 py-1.5 font-extrabold tabular-nums ${customer.outstanding > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {money(customer.outstanding)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center gap-2">
                      <button type="button" onClick={() => editCustomer(customer)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600">Edit</button>
                      <button type="button" onClick={() => void deleteCustomer(customer.id)} disabled={loading} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="font-bold text-slate-700">No customers found</p>
                    <p className="mt-1 text-sm text-slate-500">Change the search or balance filter and try again.</p>
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && filteredCustomers.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-100 font-extrabold text-slate-800">
                <tr>
                  <td colSpan={4} className="px-3 py-3">Filtered Total ({filteredCustomers.length} customers)</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(filteredCustomers.reduce((sum, customer) => sum + customer.opening_balance, 0))}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(filteredCustomers.reduce((sum, customer) => sum + customer.sales_outstanding, 0))}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-rose-700">{money(filteredOutstanding)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Outstanding calculation: opening balance plus unpaid sales balance, using the existing V29 calculation. This page does not create collection or sale entries.
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">WhatsApp Opt-in</p>
          <p className="mt-1 text-lg font-extrabold text-emerald-700">{whatsappCustomers}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">No Outstanding</p>
          <p className="mt-1 text-lg font-extrabold text-slate-800">{customers.length - dueCustomers}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Customers With Due</p>
          <p className="mt-1 text-lg font-extrabold text-rose-700">{dueCustomers}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Routes</p>
          <p className="mt-1 text-lg font-extrabold text-blue-700">{availableRoutes.length}</p>
        </div>
      </div>
    </div>
  );
}
