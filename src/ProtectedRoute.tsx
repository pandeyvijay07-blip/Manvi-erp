import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "./lib/supabase";

type Props = {
  allowedRoles?: string[];
};

export default function ProtectedRoute({
  allowedRoles,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      // Get logged-in Supabase user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      // Find user in MANVI ERP users table
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, role, active")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error(
          "MANVI USER CHECK ERROR:",
          error
        );

        setAllowed(false);
        setLoading(false);
        return;
      }

      // User record not found
      if (!data) {
        console.error(
          "MANVI USER NOT FOUND IN users TABLE"
        );

        await supabase.auth.signOut();

        setAllowed(false);
        setLoading(false);
        return;
      }

      // Employee/Owner disabled
      if (data.active === false) {
        alert(
          "Your MANVI ERP account has been deactivated."
        );

        await supabase.auth.signOut();

        setAllowed(false);
        setLoading(false);
        return;
      }

      // Check role if route has role restriction
      if (
        allowedRoles &&
        allowedRoles.length > 0
      ) {
        const userRole =
          String(data.role || "")
            .trim()
            .toLowerCase();

        const permitted =
          allowedRoles.some(
            (role) =>
              role.toLowerCase() ===
              userRole
          );

        if (!permitted) {
          setAllowed(false);
          setLoading(false);
          return;
        }
      }

      setAllowed(true);
    } catch (error) {
      console.error(
        "MANVI PROTECTED ROUTE ERROR:",
        error
      );

      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-700">
            MANVI ERP
          </div>

          <div className="mt-2 text-gray-500">
            Checking login...
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // NOT ALLOWED
  // ==========================================

  if (!allowed) {
    return <Navigate to="/login" replace />;
  }

  // ==========================================
  // ALLOWED
  // ==========================================

  return <Outlet />;
}