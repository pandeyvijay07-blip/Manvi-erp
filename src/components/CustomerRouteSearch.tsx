import { useEffect, useMemo, useState } from "react";

export type RouteCustomer = {
  id: string;
  customer_name: string;
  route?: string | null;
};

type Props = {
  customers: RouteCustomer[];
  value: string;
  onChange: (customerId: string) => void;
  disabled?: boolean;
  label?: string;
};

export default function CustomerRouteSearch({
  customers,
  value,
  onChange,
  disabled = false,
  label = "Customer",
}: Props) {
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === value),
    [customers, value]
  );

  const [routeSearch, setRouteSearch] = useState(
    selectedCustomer?.route || ""
  );
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    if (selectedCustomer) {
      setRouteSearch(selectedCustomer.route || "");
    }
  }, [selectedCustomer]);

  const routes = useMemo(() => {
    return Array.from(
      new Set(
        customers
          .map((customer) => (customer.route || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const routeQuery = routeSearch.trim().toLowerCase();
    const customerQuery = customerSearch.trim().toLowerCase();

    return customers
      .filter((customer) => {
        const customerRoute = (customer.route || "").trim().toLowerCase();
        const customerName = customer.customer_name.trim().toLowerCase();

        if (routeQuery && !customerRoute.includes(routeQuery)) {
          return false;
        }

        if (customerQuery && !customerName.includes(customerQuery)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const routeA = (a.route || "").trim();
        const routeB = (b.route || "").trim();
        const routeCompare = routeA.localeCompare(routeB, undefined, {
          numeric: true,
        });

        if (routeCompare !== 0) return routeCompare;

        return a.customer_name.localeCompare(b.customer_name);
      });
  }, [customers, routeSearch, customerSearch]);

  function handleRouteChange(nextRoute: string) {
    setRouteSearch(nextRoute);

    const selectedStillMatches = customers.find((customer) => {
      if (customer.id !== value) return false;

      const customerRoute = (customer.route || "").trim().toLowerCase();
      const query = nextRoute.trim().toLowerCase();

      return !query || customerRoute.includes(query);
    });

    if (!selectedStillMatches && value) {
      onChange("");
    }
  }

  function handleCustomerChange(customerId: string) {
    onChange(customerId);

    const customer = customers.find((item) => item.id === customerId);
    if (customer) {
      setRouteSearch(customer.route || "");
      setCustomerSearch(customer.customer_name);
    }
  }

  function clearSearch() {
    setRouteSearch("");
    setCustomerSearch("");
    onChange("");
  }

  return (
    <div className="w-full">
      <label className="mb-2 block font-semibold text-slate-700">
        {label}
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Search Route
          </label>

          <input
            type="text"
            value={routeSearch}
            onChange={(e) => handleRouteChange(e.target.value)}
            disabled={disabled}
            placeholder="Type route e.g. Route 1"
            list="customer-route-options"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />

          <datalist id="customer-route-options">
            {routes.map((route) => (
              <option key={route} value={route} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Search Customer
          </label>

          <input
            type="text"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            disabled={disabled}
            placeholder="Type customer name"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-600">
            Customers on selected route
          </label>

          {(routeSearch || customerSearch || value) && (
            <button
              type="button"
              onClick={clearSearch}
              disabled={disabled}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>

        <select
          value={value}
          onChange={(e) => handleCustomerChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        >
          <option value="">
            {filteredCustomers.length > 0
              ? "Select Customer"
              : "No customer found on this route"}
          </option>

          {filteredCustomers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.customer_name}
              {customer.route?.trim() ? ` — ${customer.route}` : ""}
            </option>
          ))}
        </select>

        <p className="mt-2 text-xs text-slate-500">
          {filteredCustomers.length} customer
          {filteredCustomers.length === 1 ? "" : "s"} found
          {routeSearch.trim() ? ` on route matching “${routeSearch.trim()}”` : ""}.
        </p>
      </div>
    </div>
  );
}
