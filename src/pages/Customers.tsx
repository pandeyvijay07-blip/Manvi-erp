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
  outstanding: number;
};

type SaleBalance = {
  customer_id: string | null;
  balance_amount: number | string | null;
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [routeSearch, setRouteSearch] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [route, setRoute] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);

    try {
      // -----------------------------------------
      // LOAD CUSTOMERS
      // -----------------------------------------

      const { data: customerData, error: customerError } =
        await supabase
          .from("customers")
          .select(
            `
              id,
              customer_name,
              mobile,
              address,
              area,
              route,
              opening_balance
            `
          )
          .order("customer_name", {
            ascending: true,
          });

      if (customerError) {
        throw customerError;
      }

      // -----------------------------------------
      // LOAD UNPAID SALES
      // -----------------------------------------

      const { data: salesData, error: salesError } =
        await supabase
          .from("sales")
          .select(
            `
              customer_id,
              balance_amount
            `
          )
          .gt("balance_amount", 0);

      if (salesError) {
        throw salesError;
      }

      // -----------------------------------------
      // CALCULATE SALES OUTSTANDING
      // -----------------------------------------

      const outstandingMap: Record<string, number> = {};

      (salesData || []).forEach(
        (sale: SaleBalance) => {
          if (!sale.customer_id) {
            return;
          }

          outstandingMap[sale.customer_id] =
            (outstandingMap[sale.customer_id] || 0) +
            Number(sale.balance_amount || 0);
        }
      );

      // -----------------------------------------
      // COMBINE OPENING BALANCE + SALES BALANCE
      // -----------------------------------------

      const finalCustomers: Customer[] = (
        customerData || []
      ).map((customer) => {
        const opening =
          Number(customer.opening_balance || 0);

        const salesOutstanding =
          outstandingMap[customer.id] || 0;

        return {
          id: customer.id,
          customer_name:
            customer.customer_name || "",
          mobile: customer.mobile || "",
          address: customer.address || "",
          area: customer.area || "",
          route: customer.route || "",
          opening_balance: opening,

          // TOTAL OUTSTANDING
          outstanding:
            opening + salesOutstanding,
        };
      });

      setCustomers(finalCustomers);
    } catch (error) {
      console.error(
        "CUSTOMER LOADING ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to load customers.";

      alert(message);
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------
  // SAVE CUSTOMER
  // -----------------------------------------

  async function saveCustomer() {
    if (!customerName.trim()) {
      alert("Enter customer name.");
      return;
    }

    const opening = Number(openingBalance);

    if (Number.isNaN(opening) || opening < 0) {
      alert(
        "Opening balance must be a valid amount."
      );
      return;
    }

    setLoading(true);

    try {
      const cleanRoute = route.trim();

      // ---------------------------------------
      // UPDATE EXISTING CUSTOMER
      // ---------------------------------------

      if (editingId) {
        const { error } = await supabase
          .from("customers")
          .update({
            customer_name:
              customerName.trim(),
            mobile: mobile.trim(),
            address: address.trim(),
            area: area.trim(),
            route: cleanRoute || null,
            opening_balance: opening,
          })
          .eq("id", editingId);

        if (error) {
          throw error;
        }

        alert(
          "Customer updated successfully."
        );
      } else {
        // -------------------------------------
        // ADD NEW CUSTOMER
        // -------------------------------------

        const { error } = await supabase
          .from("customers")
          .insert({
            customer_name:
              customerName.trim(),
            mobile: mobile.trim(),
            address: address.trim(),
            area: area.trim(),
            route: cleanRoute || null,
            opening_balance: opening,
          });

        if (error) {
          throw error;
        }

        alert(
          "Customer added successfully."
        );
      }

      clearForm();

      await loadCustomers();
    } catch (error) {
      console.error(
        "SAVE CUSTOMER ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to save customer.";

      alert(message);
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------
  // EDIT CUSTOMER
  // -----------------------------------------

  function editCustomer(
    customer: Customer
  ) {
    setEditingId(customer.id);

    setCustomerName(
      customer.customer_name || ""
    );

    setMobile(
      customer.mobile || ""
    );

    setAddress(
      customer.address || ""
    );

    setArea(
      customer.area || ""
    );

    setRoute(
      customer.route || ""
    );

    setOpeningBalance(
      String(
        customer.opening_balance || 0
      )
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // -----------------------------------------
  // DELETE CUSTOMER
  // -----------------------------------------

  async function deleteCustomer(
    id: string
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this customer?"
      );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }

      alert(
        "Customer deleted successfully."
      );

      await loadCustomers();
    } catch (error) {
      console.error(
        "DELETE CUSTOMER ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete customer.";

      alert(message);
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------
  // CLEAR FORM
  // -----------------------------------------

  function clearForm() {
    setEditingId(null);

    setCustomerName("");
    setMobile("");
    setAddress("");
    setArea("");
    setRoute("");
    setOpeningBalance("0");
  }

  // -----------------------------------------
  // ROUTES
  // -----------------------------------------

  const availableRoutes = useMemo(() => {
    return Array.from(
      new Set(
        customers
          .map((customer) =>
            (customer.route || "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [customers]);

  // -----------------------------------------
  // SEARCH
  // -----------------------------------------

  const filteredCustomers =
    customers.filter((customer) => {
      const searchText =
        search.toLowerCase().trim();

      const routeText =
        routeSearch.toLowerCase().trim();

      const matchesRoute =
        !routeText ||
        customer.route
          .toLowerCase()
          .includes(routeText);

      const matchesSearch =
        !searchText ||
        customer.customer_name
          .toLowerCase()
          .includes(searchText) ||
        customer.mobile
          .toLowerCase()
          .includes(searchText) ||
        customer.area
          .toLowerCase()
          .includes(searchText) ||
        customer.route
          .toLowerCase()
          .includes(searchText);

      return matchesRoute && matchesSearch;
    });

  // -----------------------------------------
  // TOTALS
  // -----------------------------------------

  const totalCustomers =
    customers.length;

  const totalOutstanding =
    customers.reduce(
      (sum, customer) =>
        sum +
        Number(customer.outstanding || 0),
      0
    );

  const totalOpeningBalance =
    customers.reduce(
      (sum, customer) =>
        sum +
        Number(
          customer.opening_balance || 0
        ),
      0
    );

  // -----------------------------------------
  // UI
  // -----------------------------------------

  return (
    <div className="max-w-7xl mx-auto">

      {/* PAGE TITLE */}

      <div className="mb-6">

        <h1 className="text-3xl font-bold text-blue-700">
          Customers
        </h1>

        <p className="text-gray-600 mt-1">
          Manage customers, routes and
          outstanding balances.
        </p>

      </div>

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        <div className="bg-white rounded-xl shadow p-5 border">

          <p className="text-gray-500">
            Total Customers
          </p>

          <p className="text-3xl font-bold text-blue-700 mt-2">
            {totalCustomers}
          </p>

        </div>

        <div className="bg-white rounded-xl shadow p-5 border">

          <p className="text-gray-500">
            Opening Balance
          </p>

          <p className="text-3xl font-bold text-orange-600 mt-2">
            ₹{" "}
            {totalOpeningBalance.toFixed(2)}
          </p>

        </div>

        <div className="bg-white rounded-xl shadow p-5 border">

          <p className="text-gray-500">
            Total Outstanding
          </p>

          <p className="text-3xl font-bold text-red-600 mt-2">
            ₹{" "}
            {totalOutstanding.toFixed(2)}
          </p>

        </div>

      </div>

      {/* ADD / EDIT CUSTOMER */}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">

        <h2 className="text-xl font-semibold mb-5">

          {editingId
            ? "Edit Customer"
            : "Add Customer"}

        </h2>

        <div className="grid md:grid-cols-2 gap-4">

          {/* NAME */}

          <div>

            <label className="block mb-2 font-medium">
              Customer Name
            </label>

            <input
              className="w-full border rounded-lg p-3"
              placeholder="Customer Name"
              value={customerName}
              onChange={(e) =>
                setCustomerName(
                  e.target.value
                )
              }
            />

          </div>

          {/* MOBILE */}

          <div>

            <label className="block mb-2 font-medium">
              Mobile
            </label>

            <input
              className="w-full border rounded-lg p-3"
              placeholder="Mobile"
              value={mobile}
              onChange={(e) =>
                setMobile(
                  e.target.value
                )
              }
            />

          </div>

          {/* AREA */}

          <div>

            <label className="block mb-2 font-medium">
              Area
            </label>

            <input
              className="w-full border rounded-lg p-3"
              placeholder="Area"
              value={area}
              onChange={(e) =>
                setArea(
                  e.target.value
                )
              }
            />

          </div>

          {/* ROUTE */}

          <div>

            <label className="block mb-2 font-medium">
              Route
            </label>

            <input
              type="text"
              list="customer-routes"
              className="w-full border rounded-lg p-3"
              placeholder="Enter or select route"
              value={route}
              onChange={(e) =>
                setRoute(
                  e.target.value
                )
              }
            />

            <datalist id="customer-routes">
              {availableRoutes.map(
                (routeName) => (
                  <option
                    key={routeName}
                    value={routeName}
                  />
                )
              )}
            </datalist>

            <p className="text-sm text-gray-500 mt-1">
              Example: Route 1, Route 2,
              North, South
            </p>

          </div>

          {/* OPENING BALANCE */}

          <div>

            <label className="block mb-2 font-medium">
              Opening Balance
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border rounded-lg p-3"
              placeholder="Opening Balance"
              value={openingBalance}
              onChange={(e) =>
                setOpeningBalance(
                  e.target.value
                )
              }
            />

            <p className="text-sm text-gray-500 mt-1">
              Existing amount payable by
              the customer.
            </p>

          </div>

          {/* ADDRESS */}

          <div className="md:col-span-2">

            <label className="block mb-2 font-medium">
              Address
            </label>

            <textarea
              className="w-full border rounded-lg p-3"
              placeholder="Address"
              rows={3}
              value={address}
              onChange={(e) =>
                setAddress(
                  e.target.value
                )
              }
            />

          </div>

        </div>

        {/* BUTTONS */}

        <div className="flex gap-3 mt-5">

          <button
            onClick={saveCustomer}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold"
          >
            {loading
              ? "Saving..."
              : editingId
              ? "Update Customer"
              : "Save Customer"}
          </button>

          {editingId && (
            <button
              onClick={clearForm}
              disabled={loading}
              className="bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg"
            >
              Cancel
            </button>
          )}

        </div>

      </div>

      {/* SEARCH */}

      <div className="bg-white rounded-xl shadow-lg p-5 mb-4">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>

            <label className="block mb-2 font-medium">
              Search Customer
            </label>

            <input
              type="text"
              placeholder="Search by name, mobile, area or route..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-medium">
              Search Route
            </label>

            <input
              type="text"
              list="search-routes"
              placeholder="Type Route 1, Route 2..."
              value={routeSearch}
              onChange={(e) =>
                setRouteSearch(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

            <datalist id="search-routes">
              {availableRoutes.map(
                (routeName) => (
                  <option
                    key={routeName}
                    value={routeName}
                  />
                )
              )}
            </datalist>

          </div>

        </div>

        {(search.trim() ||
          routeSearch.trim()) && (
          <div className="mt-3 text-sm text-gray-600">
            Showing{" "}
            <span className="font-semibold">
              {filteredCustomers.length}
            </span>{" "}
            matching customer
            {filteredCustomers.length === 1
              ? ""
              : "s"}
          </div>
        )}

      </div>

      {/* CUSTOMER TABLE */}

      <div className="bg-white rounded-xl shadow-lg overflow-x-auto">

        <table className="w-full">

          <thead className="bg-blue-600 text-white">

            <tr>

              <th className="p-3 text-left">
                Customer
              </th>

              <th className="p-3 text-left">
                Route
              </th>

              <th className="p-3 text-left">
                Mobile
              </th>

              <th className="p-3 text-left">
                Area
              </th>

              <th className="p-3 text-right">
                Opening Balance
              </th>

              <th className="p-3 text-right">
                Outstanding
              </th>

              <th className="p-3 text-center">
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {loading && (
              <tr>

                <td
                  colSpan={7}
                  className="p-6 text-center"
                >
                  Loading customers...
                </td>

              </tr>
            )}

            {!loading &&
              filteredCustomers.map(
                (customer) => (

                  <tr
                    key={customer.id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="p-3 font-medium">
                      {customer.customer_name}
                    </td>

                    <td className="p-3 font-medium text-blue-700">
                      {customer.route || "-"}
                    </td>

                    <td className="p-3">
                      {customer.mobile || "-"}
                    </td>

                    <td className="p-3">
                      {customer.area || "-"}
                    </td>

                    <td className="p-3 text-right">
                      ₹{" "}
                      {Number(
                        customer.opening_balance ||
                          0
                      ).toFixed(2)}
                    </td>

                    <td
                      className={`p-3 text-right font-bold ${
                        customer.outstanding > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      ₹{" "}
                      {Number(
                        customer.outstanding ||
                          0
                      ).toFixed(2)}
                    </td>

                    <td className="p-3">

                      <div className="flex justify-center gap-2">

                        <button
                          onClick={() =>
                            editCustomer(
                              customer
                            )
                          }
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            deleteCustomer(
                              customer.id
                            )
                          }
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                        >
                          Delete
                        </button>

                      </div>

                    </td>

                  </tr>

                )
              )}

            {!loading &&
              filteredCustomers.length ===
                0 && (

                <tr>

                  <td
                    colSpan={7}
                    className="p-6 text-center text-gray-500"
                  >
                    No customers found.
                  </td>

                </tr>

              )}

          </tbody>

        </table>

      </div>

    </div>
  );
}
