import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "./lib/supabase";

import Layout from "./components/Layout";

// ================================
// PAGES
// ================================

import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Brands from "./pages/Brands";
import Products from "./pages/Products";
import CustomerPrices from "./pages/CustomerPrices";

import Purchases from "./pages/Purchases";
import Suppliers from "./pages/Suppliers";
import Sales from "./pages/Sales";
import WalkInSales from "./pages/WalkInSales";

import Collections from "./pages/Collections";
import Expenses from "./pages/Expenses";

import Reports from "./pages/Reports";
import CustomerLedger from "./pages/CustomerLedger";
import DailyClosing from "./pages/DailyClosing";

import Invoice from "./pages/Invoice";

import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import ChangePassword from "./pages/ChangePassword";

import Login from "./pages/Login";

import UserManagement from "./pages/UserManagement";

// =====================================================
// CURRENT USER
// =====================================================

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

// =====================================================
// PROTECTED APP
// =====================================================

function ProtectedApp() {
  const [loading, setLoading] =
    useState(true);

  const [loggedIn, setLoggedIn] =
    useState(false);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  // ===================================================
  // LOAD USER
  // ===================================================

  async function loadUser() {
    try {
      setLoading(true);

      // -----------------------------------------------
      // AUTH SESSION
      // -----------------------------------------------

      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "MANVI SESSION ERROR:",
          sessionError
        );

        setLoggedIn(false);
        setCurrentUser(null);

        return;
      }

      const authUser =
        sessionData.session?.user;

      if (!authUser) {
        setLoggedIn(false);
        setCurrentUser(null);

        return;
      }

      setLoggedIn(true);

      // -----------------------------------------------
      // LOAD USER PROFILE
      // -----------------------------------------------

      const {
        data: profile,
        error: profileError,
      } =
        await supabase
          .from("users")
          .select(
            `
              id,
              name,
              email,
              role,
              active
            `
          )
          .eq(
            "id",
            authUser.id
          )
          .maybeSingle();

      if (profileError) {
        console.error(
          "MANVI USER PROFILE ERROR:",
          profileError
        );

        // ---------------------------------------------
        // METADATA FALLBACK
        // ---------------------------------------------

        const fallbackUser: CurrentUser = {
          id: authUser.id,

          name:
            authUser.user_metadata?.name ||
            authUser.email?.split("@")[0] ||
            "User",

          email:
            authUser.email || "",

          role:
            authUser.user_metadata?.role ||
            "Employee",

          active: true,
        };

        setCurrentUser(
          fallbackUser
        );

        return;
      }

      if (profile) {
        setCurrentUser(
          profile as CurrentUser
        );
      } else {
        // ---------------------------------------------
        // NO PROFILE
        // ---------------------------------------------

        setCurrentUser({
          id: authUser.id,

          name:
            authUser.user_metadata?.name ||
            authUser.email?.split("@")[0] ||
            "User",

          email:
            authUser.email || "",

          role:
            authUser.user_metadata?.role ||
            "Employee",

          active: true,
        });
      }

    } catch (error) {

      console.error(
        "MANVI LOAD USER ERROR:",
        error
      );

      setLoggedIn(false);
      setCurrentUser(null);

    } finally {

      setLoading(false);

    }
  }

  // ===================================================
  // INITIAL SESSION
  // ===================================================

  useEffect(() => {

    loadUser();

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {

          if (!session?.user) {

            setLoggedIn(false);
            setCurrentUser(null);

          } else {

            setLoggedIn(true);

            // Delay avoids Supabase auth lock issues
            setTimeout(() => {
              loadUser();
            }, 0);

          }

        }
      );

    return () => {

      listener.subscription.unsubscribe();

    };

  }, []);

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {

    return (
      <div
        className="
          min-h-screen
          flex
          items-center
          justify-center
          bg-slate-100
        "
      >

        <div className="text-center">

          <div
            className="
              w-14
              h-14
              border-4
              border-blue-600
              border-t-transparent
              rounded-full
              animate-spin
              mx-auto
              mb-4
            "
          />

          <p
            className="
              text-blue-700
              font-semibold
            "
          >
            Loading MANVI ERP...
          </p>

        </div>

      </div>
    );
  }

  // ===================================================
  // NOT LOGGED IN
  // ===================================================

  if (!loggedIn) {

    return (
      <Navigate
        to="/login"
        replace
      />
    );

  }

  // ===================================================
  // CHECK ACTIVE ACCOUNT
  // ===================================================

  if (
    currentUser &&
    currentUser.active === false
  ) {

    return (
      <div
        className="
          min-h-screen
          flex
          items-center
          justify-center
          bg-slate-100
          p-6
        "
      >

        <div
          className="
            w-full
            max-w-md
            rounded-2xl
            bg-white
            p-8
            text-center
            shadow-xl
          "
        >

          <div
            className="
              mx-auto
              mb-5
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-full
              bg-red-100
              text-3xl
            "
          >
            !
          </div>

          <h1
            className="
              text-2xl
              font-bold
              text-slate-800
            "
          >
            Account Inactive
          </h1>

          <p
            className="
              mt-3
              text-slate-500
            "
          >
            Your MANVI ERP account has been
            deactivated.
          </p>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            className="
              mt-6
              w-full
              rounded-xl
              bg-blue-600
              px-5
              py-3
              font-bold
              text-white
              hover:bg-blue-700
            "
          >
            Logout
          </button>

        </div>

      </div>
    );

  }

  // ===================================================
  // ROLE
  // ===================================================

  const role =
    currentUser?.role
      ?.trim()
      .toLowerCase() || "";

  const isOwner =
    role === "owner" ||
    role === "admin" ||
    role === "administrator";

  // ===================================================
  // ERP
  // ===================================================

  return (

    <Layout>

      <Routes>

        {/* ============================================
            DASHBOARD
        ============================================ */}

        <Route
          path="/"
          element={<Dashboard employeeOnly={!isOwner} />}
        />

        {/* ============================================
            MASTER
        ============================================ */}

        <Route
          path="/customers"
          element={<Customers />}
        />

        <Route
          path="/brands"
          element={<Brands />}
        />

        <Route
          path="/products"
          element={<Products />}
        />

        <Route
          path="/customer-prices"
          element={<CustomerPrices />}
        />

        {/* ============================================
            TRANSACTIONS
        ============================================ */}

        <Route
          path="/purchases"
          element={<Purchases />}
        />

        <Route
          path="/suppliers"
          element={<Suppliers />}
        />

        <Route
          path="/sales"
          element={<Sales />}
        />

        <Route
          path="/walkin-sales"
          element={<WalkInSales />}
        />

        <Route
          path="/collections"
          element={<Collections />}
        />

        <Route
          path="/expenses"
          element={<Expenses />}
        />

        {/* ============================================
            REPORTS
        ============================================ */}

        <Route
          path="/reports"
          element={<Reports />}
        />

        <Route
          path="/customer-ledger"
          element={<CustomerLedger />}
        />

        <Route
          path="/daily-closing"
          element={<DailyClosing />}
        />

        {/* ============================================
            INVOICE
        ============================================ */}

        <Route
          path="/invoice/:id"
          element={<Invoice />}
        />

        {/* ============================================
            PROFILE
        ============================================ */}

        <Route
          path="/profile"
          element={<Profile />}
        />

        <Route
          path="/settings"
          element={<Settings />}
        />

        <Route
          path="/change-password"
          element={<ChangePassword />}
        />

        {/* ============================================
            USER MANAGEMENT
            OWNER ONLY
        ============================================ */}

        <Route
          path="/user-management"
          element={
            isOwner ? (
              <UserManagement />
            ) : (
              <Navigate
                to="/"
                replace
              />
            )
          }
        />

        {/* ============================================
            UNKNOWN ROUTE
        ============================================ */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

    </Layout>
  );
}

// =====================================================
// APP
// =====================================================

export default function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* ============================================
            LOGIN
        ============================================ */}

        <Route
          path="/login"
          element={<Login />}
        />

        {/* ============================================
            PROTECTED ERP
        ============================================ */}

        <Route
          path="/*"
          element={<ProtectedApp />}
        />

      </Routes>

    </BrowserRouter>
  );
}