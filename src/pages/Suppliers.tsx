import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type SupplierRow = {
  id: string;
  name: string;
  mobile: string;
  address: string;
  opening_balance: number;
  total_purchases: number;
  total_paid: number;
  purchase_outstanding: number;
  outstanding: number;
};

type PurchaseRow = {
  supplier_name: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
};

function money(value: number) {
  return `₹ ${Number(value || 0).toFixed(2)}`;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const item = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const message = text(item.message);
    const details = text(item.details);
    const hint = text(item.hint);

    return [message, details, hint]
      .filter(Boolean)
      .join(" • ") || fallback;
  }

  return error instanceof Error
    ? error.message
    : fallback;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [loadWarning, setLoadWarning] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    setLoadWarning("");

    try {
      /*
       * STEP 1
       * Load Supplier Master independently.
       *
       * The actual MANVI supplier schema uses:
       * id, supplier_name, mobile, address, opening_balance.
       */
      const {
        data: supplierData,
        error: supplierError,
      } = await supabase
        .from("suppliers")
        .select(
          `
            id,
            supplier_name,
            mobile,
            address,
            opening_balance
          `
        )
        .order("supplier_name", { ascending: true });

      if (supplierError) {
        throw supplierError;
      }

      /*
       * STEP 2
       * Load purchase totals separately.
       *
       * A purchase-read problem must NOT hide the entire
       * Supplier Master screen.
       */
      const {
        data: purchaseData,
        error: purchaseError,
      } = await supabase
        .from("purchases")
        .select(
          `
            supplier_name,
            total_amount,
            paid_amount,
            balance_amount
          `
        );

      if (purchaseError) {
        setLoadWarning(
          `Supplier master loaded, but purchase totals could not be loaded: ${getErrorMessage(
            purchaseError,
            "Unknown purchase query error."
          )}`
        );
      }

      const purchaseMap = new Map<
        string,
        {
          total: number;
          paid: number;
          balance: number;
        }
      >();

      (purchaseData || []).forEach(
        (purchase: PurchaseRow) => {
          const supplierNameFromPurchase = text(
            purchase.supplier_name
          );

          if (!supplierNameFromPurchase) {
            return;
          }

          const key =
            supplierNameFromPurchase.toLowerCase();

          const current =
            purchaseMap.get(key) || {
              total: 0,
              paid: 0,
              balance: 0,
            };

          const total = Number(
            purchase.total_amount || 0
          );

          const paid = Number(
            purchase.paid_amount || 0
          );

          const savedBalance = Number(
            purchase.balance_amount
          );

          const balance = Number.isFinite(
            savedBalance
          )
            ? Math.max(savedBalance, 0)
            : Math.max(total - paid, 0);

          if (Number.isFinite(total)) {
            current.total += total;
          }

          if (Number.isFinite(paid)) {
            current.paid += paid;
          }

          if (Number.isFinite(balance)) {
            current.balance += balance;
          }

          purchaseMap.set(key, current);
        }
      );

      const rows: SupplierRow[] = (
        supplierData || []
      ).map((supplier: any) => {
        const name = text(supplier.supplier_name);
        const key = name.toLowerCase();

        const purchaseSummary =
          purchaseMap.get(key) || {
            total: 0,
            paid: 0,
            balance: 0,
          };

        const opening = Math.max(
          Number(supplier.opening_balance || 0),
          0
        );

        return {
          id: String(supplier.id),
          name,
          mobile: text(supplier.mobile),
          address: text(supplier.address),
          opening_balance: opening,
          total_purchases: purchaseSummary.total,
          total_paid: purchaseSummary.paid,
          purchase_outstanding:
            purchaseSummary.balance,
          outstanding:
            opening +
            purchaseSummary.balance,
        };
      });

      setSuppliers(rows);
    } catch (error) {
      console.error(
        "SUPPLIER LOADING ERROR:",
        error
      );

      setSuppliers([]);

      alert(
        `Unable to load suppliers.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveSupplier() {
    const cleanName = supplierName.trim();
    const cleanMobile = mobile.trim();
    const cleanAddress = address.trim();
    const opening = Number(openingBalance);

    if (!cleanName) {
      alert("Enter supplier name.");
      return;
    }

    if (!Number.isFinite(opening) || opening < 0) {
      alert(
        "Opening balance must be a valid amount."
      );
      return;
    }

    const duplicate = suppliers.some(
      (supplier) =>
        supplier.id !== editingId &&
        supplier.name.toLowerCase() ===
          cleanName.toLowerCase()
    );

    if (duplicate) {
      alert(
        "A supplier with this name already exists."
      );
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("suppliers")
          .update({
            supplier_supplier_name: cleanName,
            mobile: cleanMobile || null,
            address: cleanAddress || null,
            opening_balance: opening,
          })
          .eq("id", editingId);

        if (error) {
          throw error;
        }

        alert(
          "Supplier updated successfully."
        );
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert({
            supplier_supplier_name: cleanName,
            mobile: cleanMobile || null,
            address: cleanAddress || null,
            opening_balance: opening,
          });

        if (error) {
          throw error;
        }

        alert(
          "Supplier added successfully."
        );
      }

      clearForm();
      await loadSuppliers();
    } catch (error) {
      console.error(
        "SAVE SUPPLIER ERROR:",
        error
      );

      alert(
        `Unable to save supplier.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setSaving(false);
    }
  }

  function editSupplier(
    supplier: SupplierRow
  ) {
    setEditingId(supplier.id);
    setSupplierName(supplier.name);
    setMobile(supplier.mobile);
    setAddress(supplier.address);
    setOpeningBalance(
      String(supplier.opening_balance)
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteSupplier(id: string) {
    const supplier = suppliers.find(
      (item) => item.id === id
    );

    if (!supplier) {
      return;
    }

    if (
      supplier.total_purchases > 0 ||
      supplier.purchase_outstanding > 0
    ) {
      alert(
        "This supplier has purchase transactions. Resolve those purchase records before deleting the supplier."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete supplier "${supplier.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }

      if (editingId === id) {
        clearForm();
      }

      alert(
        "Supplier deleted successfully."
      );

      await loadSuppliers();
    } catch (error) {
      console.error(
        "DELETE SUPPLIER ERROR:",
        error
      );

      alert(
        `Unable to delete supplier.\n\n${getErrorMessage(
          error,
          "Unknown error."
        )}`
      );
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setEditingId(null);
    setSupplierName("");
    setMobile("");
    setAddress("");
    setOpeningBalance("0");
  }

  const filteredSuppliers = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return suppliers;
    }

    return suppliers.filter(
      (supplier) =>
        supplier.name
          .toLowerCase()
          .includes(query) ||
        supplier.mobile
          .toLowerCase()
          .includes(query) ||
        supplier.address
          .toLowerCase()
          .includes(query)
    );
  }, [suppliers, search]);

  const totalSuppliers =
    suppliers.length;

  const totalOpeningBalance =
    suppliers.reduce(
      (sum, supplier) =>
        sum +
        Number(
          supplier.opening_balance || 0
        ),
      0
    );

  const totalPurchases =
    suppliers.reduce(
      (sum, supplier) =>
        sum +
        Number(
          supplier.total_purchases || 0
        ),
      0
    );

  const totalPaid =
    suppliers.reduce(
      (sum, supplier) =>
        sum +
        Number(
          supplier.total_paid || 0
        ),
      0
    );

  const totalOutstanding =
    suppliers.reduce(
      (sum, supplier) =>
        sum +
        Number(
          supplier.outstanding || 0
        ),
      0
    );

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-700">
          Suppliers
        </h1>

        <p className="mt-1 text-gray-600">
          Manage supplier master, opening balances,
          purchases and outstanding.
        </p>
      </div>

      {/* WARNING */}
      {loadWarning && (
        <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          <p className="font-bold">
            Partial data loaded
          </p>

          <p className="mt-1">
            {loadWarning}
          </p>

          <button
            type="button"
            onClick={() => void loadSuppliers()}
            className="mt-3 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow">
          <p className="text-sm text-gray-500">
            Total Suppliers
          </p>

          <p className="mt-2 text-3xl font-bold text-blue-700">
            {totalSuppliers}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow">
          <p className="text-sm text-gray-500">
            Opening Balance
          </p>

          <p className="mt-2 text-2xl font-bold text-orange-600">
            {money(totalOpeningBalance)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow">
          <p className="text-sm text-gray-500">
            Total Purchases
          </p>

          <p className="mt-2 text-2xl font-bold text-purple-700">
            {money(totalPurchases)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow">
          <p className="text-sm text-gray-500">
            Supplier Outstanding
          </p>

          <p className="mt-2 text-2xl font-bold text-red-600">
            {money(totalOutstanding)}
          </p>
        </div>
      </div>

      {/* FORM */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              {editingId
                ? "Edit Supplier"
                : "Add Supplier"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Supplier master information.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={clearForm}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Supplier Name
            </label>

            <input
              type="text"
              value={supplierName}
              onChange={(e) =>
                setSupplierName(e.target.value)
              }
              placeholder="Example: Amul"
              className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Mobile
            </label>

            <input
              type="tel"
              value={mobile}
              onChange={(e) =>
                setMobile(e.target.value)
              }
              placeholder="Supplier mobile"
              className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Opening Balance
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={openingBalance}
              onChange={(e) =>
                setOpeningBalance(
                  e.target.value
                )
              }
              className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
            />

            <p className="mt-1 text-xs text-gray-500">
              Existing payable amount before current purchases.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Address
            </label>

            <input
              type="text"
              value={address}
              onChange={(e) =>
                setAddress(e.target.value)
              }
              placeholder="Supplier address"
              className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={saveSupplier}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Supplier"
              : "Save Supplier"}
          </button>

          {!editingId && (
            <button
              type="button"
              onClick={clearForm}
              disabled={saving}
              className="rounded-lg bg-slate-500 px-6 py-3 font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* SEARCH */}
      <div className="mb-4 rounded-xl bg-white p-5 shadow-lg">
        <label className="mb-2 block text-sm font-semibold">
          Search Supplier
        </label>

        <input
          type="text"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search by supplier name, mobile or address..."
          className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
        />

        <p className="mt-3 text-sm text-gray-500">
          Showing{" "}
          <span className="font-semibold text-slate-800">
            {filteredSuppliers.length}
          </span>{" "}
          supplier
          {filteredSuppliers.length === 1
            ? ""
            : "s"}
        </p>
      </div>

      {/* PAYMENT / OUTSTANDING */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="text-sm text-green-700">
            Payments Recorded Through Purchases
          </p>

          <p className="mt-1 text-2xl font-bold text-green-800">
            {money(totalPaid)}
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">
            Amount Still Payable To Suppliers
          </p>

          <p className="mt-1 text-2xl font-bold text-red-800">
            {money(totalOutstanding)}
          </p>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-lg">
        <table className="w-full min-w-[1050px]">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="p-3 text-left">
                Supplier
              </th>

              <th className="p-3 text-left">
                Mobile
              </th>

              <th className="p-3 text-left">
                Address
              </th>

              <th className="p-3 text-right">
                Opening
              </th>

              <th className="p-3 text-right">
                Purchases
              </th>

              <th className="p-3 text-right">
                Paid
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
                  colSpan={8}
                  className="p-8 text-center text-gray-500"
                >
                  Loading suppliers...
                </td>
              </tr>
            )}

            {!loading &&
              filteredSuppliers.map(
                (supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b hover:bg-slate-50"
                  >
                    <td className="p-3 font-semibold text-slate-800">
                      {supplier.name || "-"}
                    </td>

                    <td className="p-3">
                      {supplier.mobile || "-"}
                    </td>

                    <td className="max-w-[280px] p-3">
                      <div className="truncate">
                        {supplier.address || "-"}
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      {money(
                        supplier.opening_balance
                      )}
                    </td>

                    <td className="p-3 text-right font-semibold text-purple-700">
                      {money(
                        supplier.total_purchases
                      )}
                    </td>

                    <td className="p-3 text-right font-semibold text-green-700">
                      {money(
                        supplier.total_paid
                      )}
                    </td>

                    <td
                      className={`p-3 text-right font-bold ${
                        supplier.outstanding > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {money(
                        supplier.outstanding
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            editSupplier(
                              supplier
                            )
                          }
                          className="rounded bg-yellow-500 px-3 py-1 text-sm font-semibold text-white hover:bg-yellow-600"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteSupplier(
                              supplier.id
                            )
                          }
                          className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

            {!loading &&
              filteredSuppliers.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="p-8 text-center text-gray-500"
                  >
                    No suppliers found.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      {/* LOGIC */}
      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold">
          Supplier balance
        </p>

        <p className="mt-1">
          Outstanding = Opening Balance + unpaid
          purchase balances. Paid amounts are taken
          from purchase payment records.
        </p>
      </div>
    </div>
  );
}
