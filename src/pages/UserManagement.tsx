import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean | null;
  created_at?: string;
};

type ResetResult = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Employee");

  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingData, setResettingData] = useState(false);

  // =====================================================
  // LOAD USERS
  // =====================================================

  async function loadUsers() {
    setLoadingUsers(true);

    try {
      const { data, error } = await supabase
        .from("users")
        .select(`
          id,
          name,
          email,
          role,
          active,
          created_at
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const formattedUsers: UserRecord[] = (data || []).map(
        (user: any) => ({
          id: user.id,
          name: user.name || "",
          email: user.email || "",
          role: user.role || "Employee",
          active:
            user.active === null
              ? true
              : Boolean(user.active),
          created_at: user.created_at,
        })
      );

      setUsers(formattedUsers);
    } catch (error: any) {
      console.error("LOAD USERS ERROR:", error);

      alert(
        "Unable to load users:\n\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoadingUsers(false);
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadUsers();
  }, []);

  // =====================================================
  // CREATE EMPLOYEE
  // =====================================================

  async function createEmployee(
    e: React.FormEvent
  ) {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      alert("Please enter employee name.");
      return;
    }

    if (!cleanEmail) {
      alert("Please enter employee email.");
      return;
    }

    if (!password) {
      alert("Please enter employee password.");
      return;
    }

    if (password.length < 6) {
      alert(
        "Password must contain at least 6 characters."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData.session) {
        alert(
          "Your owner login session has expired.\n\nPlease login again."
        );
        return;
      }

      const {
        data,
        error,
      } = await supabase.functions.invoke(
        "create-employee",
        {
          body: {
            action: "create",
            name: cleanName,
            email: cleanEmail,
            password,
            role: "Employee",
            active: true,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      alert(
        "Employee created successfully!\n\n" +
          `Name: ${cleanName}\n` +
          `Email: ${cleanEmail}\n` +
          `Role: Employee\n` +
          `Status: Active`
      );

      setName("");
      setEmail("");
      setPassword("");
      setRole("Employee");

      await loadUsers();
    } catch (error: any) {
      console.error(
        "CREATE EMPLOYEE ERROR:",
        error
      );

      alert(
        "Unable to create employee:\n\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // TOGGLE ACTIVE
  // =====================================================

  async function toggleActive(
    user: UserRecord
  ) {
    const currentActive =
      user.active !== false;

    const newActive =
      !currentActive;

    const action = newActive
      ? "activate"
      : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${user.name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from("users")
        .update({
          active: newActive,
        })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      setUsers((previous) =>
        previous.map((item) =>
          item.id === user.id
            ? {
                ...item,
                active: newActive,
              }
            : item
        )
      );
    } catch (error: any) {
      console.error(
        "UPDATE USER ERROR:",
        error
      );

      alert(
        "Unable to update employee:\n\n" +
          (error?.message || "Unknown error")
      );
    }
  }

  // =====================================================
  // DELETE EMPLOYEE
  // =====================================================

  async function deleteEmployee(
    user: UserRecord
  ) {
    const isOwner =
      user.role?.toLowerCase() === "owner";

    if (isOwner) {
      alert(
        "The Owner account cannot be deleted."
      );
      return;
    }

    const confirmed = window.confirm(
      `DELETE EMPLOYEE?\n\n` +
        `Name: ${user.name}\n` +
        `Email: ${user.email}\n\n` +
        `This will permanently delete the employee account.\n` +
        `They will no longer be able to login.\n\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(user.id);

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData.session) {
        throw new Error(
          "Your owner login session has expired. Please login again."
        );
      }

      const {
        data,
        error,
      } = await supabase.functions.invoke(
        "create-employee",
        {
          body: {
            action: "delete",
            user_id: user.id,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setUsers((previous) =>
        previous.filter(
          (item) => item.id !== user.id
        )
      );

      alert(
        `Employee deleted successfully.\n\n` +
          `${user.name} can no longer login to MANVI ERP.`
      );
    } catch (error: any) {
      console.error(
        "DELETE EMPLOYEE ERROR:",
        error
      );

      alert(
        "Unable to delete employee:\n\n" +
          (error?.message || "Unknown error")
      );
    } finally {
      setDeletingId(null);
    }
  }

  // =====================================================
  // OWNER-ONLY FRESH START
  // =====================================================

  async function clearBusinessData() {
    const firstConfirm = window.confirm(
      "⚠️ START FRESH?\n\n" +
        "This will permanently delete ALL transaction/entry data:\n\n" +
        "• Sales\n" +
        "• Sale items\n" +
        "• Collections\n" +
        "• Collection allocations\n" +
        "• Purchases\n" +
        "• Purchase items (if present)\n" +
        "• Expenses\n" +
        "• Daily Closings\n" +
        "• Customer advances (if present)\n\n" +
        "It will also reset:\n" +
        "• Customer opening balances → ₹0\n" +
        "• Product stock → 0\n\n" +
        "Users, employees, customers, products, brands,\n" +
        "suppliers and customer prices will be KEPT.\n\n" +
        "THIS ACTION CANNOT BE UNDONE.\n\n" +
        "Continue?"
    );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.prompt(
      "FINAL CONFIRMATION\n\n" +
        "Type exactly:\n\n" +
        "DELETE ALL DATA\n\n" +
        "to permanently clear MANVI ERP transaction data."
    );

    if (secondConfirm !== "DELETE ALL DATA") {
      alert("Reset cancelled. Nothing was deleted.");
      return;
    }

    setResettingData(true);

    try {
      // The database function performs the actual Owner check.
      const {
        data,
        error,
      } = await supabase.rpc(
        "reset_manvi_business_data"
      );

      if (error) {
        throw error;
      }

      const result =
        (data || {}) as ResetResult;

      alert(
        result.message ||
          "MANVI ERP business data cleared successfully."
      );

      // Refresh users and return the page to a clean state.
      await loadUsers();
    } catch (error: any) {
      console.error(
        "RESET BUSINESS DATA ERROR:",
        error
      );

      alert(
        "Unable to clear business data:\n\n" +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setResettingData(false);
    }
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    value?: string
  ) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="mx-auto max-w-7xl pb-10">

      {/* HEADER */}

      <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">

        <p className="text-sm font-semibold text-blue-100">
          MANVI MILK AGENCIES
        </p>

        <h1 className="mt-1 text-3xl font-bold">
          User Management
        </h1>

        <p className="mt-2 text-sm text-blue-100">
          Owner can create and manage MANVI ERP employees.
        </p>

      </div>

      {/* ADD EMPLOYEE */}

      <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">

        <div className="mb-6">

          <h2 className="text-xl font-bold text-slate-800">
            Add Employee
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Create an employee login for MANVI ERP.
          </p>

        </div>

        <form
          onSubmit={createEmployee}
          className="grid gap-5 md:grid-cols-2"
        >

          {/* NAME */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Employee Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Enter employee name"
              autoComplete="off"
              disabled={loading}
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                p-3
                outline-none
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
                disabled:bg-slate-100
              "
            />

          </div>

          {/* EMAIL */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Employee Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="employee@gmail.com"
              autoComplete="off"
              disabled={loading}
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                p-3
                outline-none
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
                disabled:bg-slate-100
              "
            />

          </div>

          {/* PASSWORD */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Temporary Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
              disabled={loading}
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                p-3
                outline-none
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
                disabled:bg-slate-100
              "
            />

          </div>

          {/* ROLE */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Role
            </label>

            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value)
              }
              disabled={loading}
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                bg-white
                p-3
                outline-none
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
                disabled:bg-slate-100
              "
            >

              <option value="Employee">
                Employee
              </option>

            </select>

          </div>

          {/* STATUS */}

          <div className="md:col-span-2">

            <div className="
              flex
              items-center
              gap-3
              rounded-xl
              border
              border-green-200
              bg-green-50
              px-4
              py-3
            ">

              <span className="
                h-3
                w-3
                rounded-full
                bg-green-500
              " />

              <div>

                <p className="font-bold text-green-700">
                  New employee will be Active
                </p>

                <p className="text-xs text-green-600">
                  Employee can login immediately after creation.
                </p>

              </div>

            </div>

          </div>

          {/* BUTTON */}

          <div className="md:col-span-2">

            <button
              type="submit"
              disabled={loading || resettingData}
              className="
                w-full
                rounded-xl
                bg-blue-600
                px-6
                py-4
                font-bold
                text-white
                shadow-lg
                transition
                hover:bg-blue-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >

              {loading
                ? "Creating Employee..."
                : "+ Create Employee"}

            </button>

          </div>

        </form>

      </div>

      {/* DANGER ZONE */}

      <div className="mb-6 rounded-2xl border-2 border-red-200 bg-red-50 p-6 shadow-lg">

        <div className="
          flex
          flex-col
          gap-5
          md:flex-row
          md:items-center
          md:justify-between
        ">

          <div>

            <p className="text-sm font-bold uppercase tracking-wide text-red-600">
              Owner Only • Danger Zone
            </p>

            <h2 className="mt-1 text-xl font-bold text-red-800">
              Start Fresh
            </h2>

            <p className="mt-1 max-w-2xl text-sm text-red-700">
              Permanently clear business transaction entries and reset
              customer opening balances and product stock to zero.
              Users and master setup are kept.
            </p>

          </div>

          <button
            type="button"
            onClick={clearBusinessData}
            disabled={
              resettingData ||
              loading ||
              loadingUsers
            }
            className="
              shrink-0
              rounded-xl
              bg-red-700
              px-6
              py-4
              font-bold
              text-white
              shadow-lg
              transition
              hover:bg-red-800
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >

            {resettingData
              ? "Clearing All Data..."
              : "⚠ Delete All Entry Data"}

          </button>

        </div>

      </div>

      {/* EMPLOYEE LIST */}

      <div className="rounded-2xl bg-white p-6 shadow-lg">

        <div className="
          mb-5
          flex
          flex-col
          gap-3
          md:flex-row
          md:items-center
          md:justify-between
        ">

          <div>

            <h2 className="text-xl font-bold text-slate-800">
              Employees & Users
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage employee access to MANVI ERP.
            </p>

          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={
              loadingUsers ||
              resettingData
            }
            className="
              rounded-lg
              bg-slate-700
              px-5
              py-2
              font-semibold
              text-white
              hover:bg-slate-800
              disabled:opacity-50
            "
          >

            {loadingUsers
              ? "Refreshing..."
              : "↻ Refresh"}

          </button>

        </div>

        {loadingUsers ? (

          <div className="p-10 text-center text-slate-500">
            Loading users...
          </div>

        ) : users.length === 0 ? (

          <div className="
            rounded-xl
            border-2
            border-dashed
            border-slate-300
            p-10
            text-center
          ">

            <p className="font-semibold text-slate-500">
              No users found.
            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[950px] border-collapse">

              <thead className="bg-slate-800 text-white">

                <tr>

                  <th className="p-3 text-left">
                    Name
                  </th>

                  <th className="p-3 text-left">
                    Email
                  </th>

                  <th className="p-3 text-left">
                    Role
                  </th>

                  <th className="p-3 text-center">
                    Status
                  </th>

                  <th className="p-3 text-left">
                    Created
                  </th>

                  <th className="p-3 text-center">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody>

                {users.map((user) => {

                  const isActive =
                    user.active !== false;

                  const isOwner =
                    user.role?.toLowerCase() ===
                    "owner";

                  const isDeleting =
                    deletingId === user.id;

                  return (

                    <tr
                      key={user.id}
                      className="
                        border-b
                        border-slate-200
                        hover:bg-slate-50
                      "
                    >

                      <td className="
                        p-3
                        font-semibold
                        text-slate-800
                      ">
                        {user.name}
                      </td>

                      <td className="
                        p-3
                        text-slate-600
                      ">
                        {user.email}
                      </td>

                      <td className="p-3">

                        <span
                          className={`
                            inline-flex
                            rounded-full
                            px-3
                            py-1
                            text-xs
                            font-bold
                            ${
                              isOwner
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }
                          `}
                        >

                          {isOwner
                            ? "Owner"
                            : "Employee"}

                        </span>

                      </td>

                      <td className="p-3 text-center">

                        <span
                          className={`
                            inline-flex
                            items-center
                            gap-2
                            rounded-full
                            px-3
                            py-1
                            text-xs
                            font-bold
                            ${
                              isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }
                          `}
                        >

                          <span
                            className={`
                              h-2
                              w-2
                              rounded-full
                              ${
                                isActive
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }
                            `}
                          />

                          {isActive
                            ? "Active"
                            : "Inactive"}

                        </span>

                      </td>

                      <td className="
                        p-3
                        text-sm
                        text-slate-500
                      ">
                        {formatDate(
                          user.created_at
                        )}
                      </td>

                      <td className="p-3">

                        {isOwner ? (

                          <div className="flex justify-center">

                            <span className="
                              inline-flex
                              rounded-lg
                              bg-purple-100
                              px-4
                              py-2
                              text-sm
                              font-bold
                              text-purple-700
                            ">
                              Owner
                            </span>

                          </div>

                        ) : (

                          <div className="
                            flex
                            items-center
                            justify-center
                            gap-2
                          ">

                            <button
                              type="button"
                              disabled={
                                isDeleting ||
                                resettingData
                              }
                              onClick={() =>
                                toggleActive(user)
                              }
                              className={`
                                rounded-lg
                                px-4
                                py-2
                                text-sm
                                font-semibold
                                text-white
                                ${
                                  isActive
                                    ? "bg-red-600 hover:bg-red-700"
                                    : "bg-green-600 hover:bg-green-700"
                                }
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                              `}
                            >

                              {isActive
                                ? "Deactivate"
                                : "Activate"}

                            </button>

                            <button
                              type="button"
                              disabled={
                                isDeleting ||
                                resettingData
                              }
                              onClick={() =>
                                deleteEmployee(user)
                              }
                              className="
                                rounded-lg
                                bg-red-700
                                px-4
                                py-2
                                text-sm
                                font-bold
                                text-white
                                hover:bg-red-800
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                              "
                            >

                              {isDeleting
                                ? "Deleting..."
                                : "Delete"}

                            </button>

                          </div>

                        )}

                      </td>

                    </tr>

                  );
                })}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>
  );
}
