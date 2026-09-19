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

type EmployeeRecord = {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  uses_erp: boolean;
  user_id: string | null;
  active: boolean;
  created_at?: string;
};

type ResetResult = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [usesERP, setUsesERP] = useState(true);
  const [role, setRole] = useState("Employee");

  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingData, setResettingData] = useState(false);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, role, active, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers((data || []).map((user: any) => ({
        id: user.id,
        name: user.name || "",
        email: user.email || "",
        role: user.role || "Employee",
        active: user.active === null ? true : Boolean(user.active),
        created_at: user.created_at,
      })));
    } catch (error: any) {
      console.error("LOAD USERS ERROR:", error);
      alert("Unable to load users:\n\n" + (error?.message || "Unknown error"));
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadEmployees() {
    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, mobile, email, uses_erp, user_id, active, created_at")
        .order("name", { ascending: true });

      if (error) throw error;
      setEmployees((data || []) as EmployeeRecord[]);
    } catch (error: any) {
      console.error("LOAD EMPLOYEES ERROR:", error);
      alert(
        "Unable to load employee master.\n\n" +
          (error?.message || "Make sure the employees table SQL has been run in Supabase.")
      );
    } finally {
      setLoadingEmployees(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    void loadEmployees();
  }, []);

  function resetEmployeeForm() {
    setName("");
    setEmail("");
    setMobile("");
    setPassword("");
    setUsesERP(true);
    setRole("Employee");
  }

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim();

    if (!cleanName) {
      alert("Please enter employee name.");
      return;
    }

    if (usesERP) {
      if (!cleanEmail) {
        alert("Email is required for an ERP employee login.");
        return;
      }
      if (!password) {
        alert("Password is required for an ERP employee login.");
        return;
      }
      if (password.length < 6) {
        alert("Password must contain at least 6 characters.");
        return;
      }
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        throw new Error("Your owner login session has expired. Please login again.");
      }

      let userId: string | null = null;

      if (usesERP) {
        const { data, error } = await supabase.functions.invoke("create-employee", {
          body: {
            action: "create",
            name: cleanName,
            email: cleanEmail,
            password,
            role: "Employee",
            active: true,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        userId = data?.user?.id || data?.user_id || null;

        // The edge function normally creates the users row. Resolve it by email
        // as a fallback so the employee master remains connected.
        if (!userId) {
          const { data: userRow } = await supabase
            .from("users")
            .select("id")
            .ilike("email", cleanEmail)
            .maybeSingle();
          userId = userRow?.id || null;
        }
      }

      const employeePayload = {
        name: cleanName,
        mobile: cleanMobile || null,
        email: cleanEmail || null,
        uses_erp: usesERP,
        user_id: userId,
        active: true,
      };

      const { error: employeeError } = await supabase
        .from("employees")
        .insert(employeePayload);

      if (employeeError) {
        throw employeeError;
      }

      alert(
        usesERP
          ? `ERP employee created successfully.\n\nName: ${cleanName}\nLogin: ${cleanEmail}`
          : `Non-ERP employee added successfully.\n\nName: ${cleanName}\nNo ERP login was created.`
      );

      resetEmployeeForm();
      await Promise.all([loadUsers(), loadEmployees()]);
    } catch (error: any) {
      console.error("CREATE EMPLOYEE ERROR:", error);
      alert("Unable to add employee:\n\n" + (error?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleEmployeeActive(employee: EmployeeRecord) {
    const newActive = !employee.active;
    if (!window.confirm(`${newActive ? "Activate" : "Deactivate"} ${employee.name}?`)) return;

    try {
      const { error } = await supabase
        .from("employees")
        .update({ active: newActive })
        .eq("id", employee.id);
      if (error) throw error;

      setEmployees((previous) =>
        previous.map((item) => item.id === employee.id ? { ...item, active: newActive } : item)
      );
    } catch (error: any) {
      alert("Unable to update employee:\n\n" + (error?.message || "Unknown error"));
    }
  }

  async function deleteEmployee(employee: EmployeeRecord) {
    if (!window.confirm(
      `Delete employee master record?\n\n${employee.name}\n\nSalary, advance and holiday history may remain linked. The employee login, if any, is NOT deleted by this button.`
    )) return;

    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", employee.id);
      if (error) throw error;

      setEmployees((previous) => previous.filter((item) => item.id !== employee.id));
    } catch (error: any) {
      alert("Unable to delete employee master record:\n\n" + (error?.message || "Unknown error"));
    }
  }

  async function toggleActive(user: UserRecord) {
    const currentActive = user.active !== false;
    const newActive = !currentActive;
    if (!window.confirm(`${newActive ? "Activate" : "Deactivate"} ${user.name}?`)) return;

    try {
      const { error } = await supabase.from("users").update({ active: newActive }).eq("id", user.id);
      if (error) throw error;
      setUsers((previous) => previous.map((item) => item.id === user.id ? { ...item, active: newActive } : item));
    } catch (error: any) {
      alert("Unable to update user:\n\n" + (error?.message || "Unknown error"));
    }
  }

  async function deleteUser(user: UserRecord) {
    if (user.role?.toLowerCase() === "owner") {
      alert("The Owner account cannot be deleted.");
      return;
    }

    if (!window.confirm(`Delete ERP login for ${user.name}?\n\nThey will no longer be able to login to MANVI ERP.`)) return;

    setDeletingId(user.id);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error("Your owner login session has expired. Please login again.");

      const { data, error } = await supabase.functions.invoke("create-employee", {
        body: { action: "delete", user_id: user.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await supabase.from("employees").update({ uses_erp: false, user_id: null }).eq("user_id", user.id);
      setUsers((previous) => previous.filter((item) => item.id !== user.id));
      await loadEmployees();
      alert(`${user.name}'s ERP login was deleted. The employee master remains available.`);
    } catch (error: any) {
      alert("Unable to delete ERP login:\n\n" + (error?.message || "Unknown error"));
    } finally {
      setDeletingId(null);
    }
  }

  async function clearBusinessData() {
    const firstConfirm = window.confirm(
      "⚠️ START FRESH?\n\n" +
        "This will permanently delete ALL transaction/entry data:\n\n" +
        "• Sales\n• Sale items\n• Collections\n• Collection allocations\n• Purchases\n• Purchase items (if present)\n• Expenses\n• Daily Closings\n• Customer advances (if present)\n\n" +
        "It will also reset:\n• Customer opening balances → ₹0\n• Product stock → 0\n\n" +
        "Users, employees, customers, products, brands, suppliers and customer prices will be KEPT.\n\nTHIS ACTION CANNOT BE UNDONE.\n\nContinue?"
    );
    if (!firstConfirm) return;

    const secondConfirm = window.prompt(
      "FINAL CONFIRMATION\n\nType exactly:\n\nDELETE ALL DATA\n\nto permanently clear MANVI ERP transaction data."
    );
    if (secondConfirm !== "DELETE ALL DATA") {
      alert("Reset cancelled. Nothing was deleted.");
      return;
    }

    setResettingData(true);
    try {
      const { data, error } = await supabase.rpc("reset_manvi_business_data");
      if (error) throw error;
      const result = (data || {}) as ResetResult;
      alert(result.message || "MANVI ERP business data cleared successfully.");
      await Promise.all([loadUsers(), loadEmployees()]);
    } catch (error: any) {
      alert("Unable to clear business data:\n\n" + (error?.message || "Unknown error"));
    } finally {
      setResettingData(false);
    }
  }

  function formatDate(value?: string) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <div className="mx-auto max-w-7xl pb-10">
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">
        <p className="text-sm font-semibold text-blue-100">MANVI MILK AGENCIES</p>
        <h1 className="mt-1 text-3xl font-bold">Employees & User Management</h1>
        <p className="mt-2 text-sm text-blue-100">Add employees with or without MANVI ERP login.</p>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="text-xl font-bold text-slate-800">Add Employee</h2>
        <p className="mt-1 text-sm text-slate-500">Non-ERP employees do not need an email/password login.</p>

        <form onSubmit={createEmployee} className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Employee Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter employee name" disabled={loading} className="w-full rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:outline-none disabled:bg-slate-100" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Mobile</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile number" inputMode="tel" disabled={loading} className="w-full rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:outline-none disabled:bg-slate-100" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email {usesERP ? "*" : "(optional)"}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@gmail.com" disabled={loading || !usesERP} className="w-full rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:outline-none disabled:bg-slate-100" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">ERP Login</label>
            <select value={usesERP ? "yes" : "no"} onChange={(e) => setUsesERP(e.target.value === "yes")} disabled={loading} className="w-full rounded-xl border border-slate-300 bg-white p-3 focus:border-blue-500 focus:outline-none">
              <option value="yes">Yes — employee will use ERP</option>
              <option value="no">No — employee will NOT use ERP</option>
            </select>
          </div>

          {usesERP && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Temporary Password *</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" autoComplete="new-password" disabled={loading} className="w-full rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:outline-none disabled:bg-slate-100" />
            </div>
          )}

          {usesERP && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} disabled={loading} className="w-full rounded-xl border border-slate-300 bg-white p-3 focus:border-blue-500 focus:outline-none">
                <option value="Employee">Employee</option>
              </select>
            </div>
          )}

          <div className={`md:col-span-2 rounded-xl border p-4 ${usesERP ? "border-blue-200 bg-blue-50" : "border-green-200 bg-green-50"}`}>
            <p className={`font-bold ${usesERP ? "text-blue-700" : "text-green-700"}`}>
              {usesERP ? "ERP Employee" : "Non-ERP Employee"}
            </p>
            <p className={`mt-1 text-sm ${usesERP ? "text-blue-600" : "text-green-600"}`}>
              {usesERP
                ? "An ERP login will be created. This employee can sign in to MANVI ERP."
                : "Only an employee master record will be created. No login, email or password is required."}
            </p>
          </div>

          <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={loading || resettingData} className="flex-1 rounded-xl bg-blue-600 px-6 py-4 font-bold text-white shadow-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Saving Employee..." : usesERP ? "+ Add ERP Employee" : "+ Add Non-ERP Employee"}
            </button>
            <button type="button" onClick={resetEmployeeForm} disabled={loading} className="rounded-xl bg-slate-500 px-6 py-4 font-bold text-white hover:bg-slate-600 disabled:opacity-50">Clear</button>
          </div>
        </form>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Employee Master</h2>
            <p className="mt-1 text-sm text-slate-500">All employees are listed here, including employees who never use ERP.</p>
          </div>
          <button type="button" onClick={loadEmployees} disabled={loadingEmployees} className="rounded-lg bg-slate-700 px-5 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{loadingEmployees ? "Refreshing..." : "↻ Refresh"}</button>
        </div>

        {employees.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500">No employees added yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="bg-blue-700 text-white">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Mobile</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-center">ERP</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">{employee.name}</td>
                    <td className="p-3">{employee.mobile || "-"}</td>
                    <td className="p-3 text-slate-600">{employee.email || "-"}</td>
                    <td className="p-3 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${employee.uses_erp ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>
                        {employee.uses_erp ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${employee.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {employee.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => void toggleEmployeeActive(employee)} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${employee.active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}>
                          {employee.active ? "Deactivate" : "Activate"}
                        </button>
                        <button type="button" onClick={() => void deleteEmployee(employee)} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border-2 border-red-200 bg-red-50 p-6 shadow-lg">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-red-600">Owner Only • Danger Zone</p>
            <h2 className="mt-1 text-xl font-bold text-red-800">Start Fresh</h2>
            <p className="mt-1 max-w-2xl text-sm text-red-700">Clear business transaction entries and reset customer opening balances and product stock. Users and employee master are kept.</p>
          </div>
          <button type="button" onClick={clearBusinessData} disabled={resettingData || loading || loadingUsers} className="shrink-0 rounded-xl bg-red-700 px-6 py-4 font-bold text-white shadow-lg hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
            {resettingData ? "Clearing All Data..." : "⚠ Delete All Entry Data"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">ERP Users</h2>
            <p className="mt-1 text-sm text-slate-500">Only employees with an ERP login appear here.</p>
          </div>
          <button type="button" onClick={loadUsers} disabled={loadingUsers} className="rounded-lg bg-slate-700 px-5 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{loadingUsers ? "Refreshing..." : "↻ Refresh"}</button>
        </div>

        {loadingUsers ? (
          <div className="p-8 text-center text-slate-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500">No ERP users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-left">Created</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isOwner = user.role?.toLowerCase() === "owner";
                  const isActive = user.active !== false;
                  return (
                    <tr key={user.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-3 font-semibold">{user.name}</td>
                      <td className="p-3 text-slate-600">{user.email}</td>
                      <td className="p-3">{isOwner ? "Owner" : "Employee"}</td>
                      <td className="p-3 text-center">{isActive ? "Active" : "Inactive"}</td>
                      <td className="p-3 text-sm text-slate-500">{formatDate(user.created_at)}</td>
                      <td className="p-3">
                        {isOwner ? (
                          <span className="flex justify-center rounded-lg bg-purple-100 px-4 py-2 text-sm font-bold text-purple-700">Owner</span>
                        ) : (
                          <div className="flex justify-center gap-2">
                            <button type="button" disabled={deletingId === user.id} onClick={() => void toggleActive(user)} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${isActive ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}>{isActive ? "Deactivate" : "Activate"}</button>
                            <button type="button" disabled={deletingId === user.id} onClick={() => void deleteUser(user)} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">{deletingId === user.id ? "Deleting..." : "Delete Login"}</button>
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
