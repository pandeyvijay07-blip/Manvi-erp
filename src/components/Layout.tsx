import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import {
  FiHome,
  FiShoppingCart,
  FiTruck,
  FiBox,
  FiUsers,
  FiDollarSign,
  FiCreditCard,
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiTag,
  FiUserCheck,
  FiSettings,
} from "react-icons/fi";

import Header from "./Header";
import { supabase } from "../lib/supabase";

interface Props {
  children: ReactNode;
}

// ============================================
// USER TYPE
// ============================================

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

// ============================================
// MENU
// ============================================

const menu = [
  {
    name: "Dashboard",
    path: "/",
    icon: <FiHome />,
  },

  {
    name: "Sales",
    path: "/sales",
    icon: <FiShoppingCart />,
  },

  {
    name: "Purchases",
    path: "/purchases",
    icon: <FiTruck />,
  },

  {
    name: "Suppliers",
    path: "/suppliers",
    icon: <FiUsers />,
  },

  {
    name: "Brands",
    path: "/brands",
    icon: <FiTag />,
  },

  {
    name: "Products",
    path: "/products",
    icon: <FiBox />,
  },

  {
    name: "Customers",
    path: "/customers",
    icon: <FiUsers />,
  },

  {
    name: "Customer Prices",
    path: "/customer-prices",
    icon: <FiDollarSign />,
  },

  {
    name: "Walk-in Sales",
    path: "/walkin-sales",
    icon: <FiShoppingCart />,
  },

  {
    name: "Collections",
    path: "/collections",
    icon: <FiDollarSign />,
  },

  {
    name: "Expenses",
    path: "/expenses",
    icon: <FiCreditCard />,
  },

  {
    name: "Cash Book",
    path: "/cash-book",
    icon: <FiBookOpen />,
  },

  {
    name: "Reports",
    path: "/reports",
    icon: <FiBarChart2 />,
  },

  {
    name: "Customer Ledger",
    path: "/customer-ledger",
    icon: <FiBookOpen />,
  },

  {
    name: "Daily Closing",
    path: "/daily-closing",
    icon: <FiCalendar />,
  },

  // ==========================================
  // OWNER ONLY
  // ==========================================

  {
    name: "User Management",
    path: "/user-management",
    icon: <FiUserCheck />,
    ownerOnly: true,
  },

  {
    name: "Settings",
    path: "/settings",
    icon: <FiSettings />,
  },
];

// ============================================
// LAYOUT
// ============================================

export default function Layout({
  children,
}: Props) {
  const location = useLocation();

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  // ==========================================
  // LOAD CURRENT USER
  // ==========================================

  async function loadCurrentUser() {
    try {
      setLoadingUser(true);

      // ----------------------------------------
      // AUTH SESSION
      // ----------------------------------------

      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "MANVI GET SESSION ERROR:",
          sessionError
        );

        setCurrentUser(null);
        return;
      }

      const authUser =
        sessionData.session?.user;

      if (!authUser) {
        setCurrentUser(null);
        return;
      }

      // ----------------------------------------
      // USERS TABLE
      // ----------------------------------------

      const {
        data,
        error,
      } = await supabase
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

      if (error) {
        console.error(
          "MANVI LOAD USER ERROR:",
          error
        );

        // --------------------------------------
        // AUTH METADATA FALLBACK
        // --------------------------------------

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

        return;
      }

      if (data) {
        setCurrentUser(
          data as CurrentUser
        );
      } else {
        // --------------------------------------
        // FALLBACK
        // --------------------------------------

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
        "MANVI CURRENT USER ERROR:",
        error
      );

      setCurrentUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  // ==========================================
  // INITIAL USER LOAD
  // ==========================================

  useEffect(() => {
    loadCurrentUser();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!session?.user) {
            setCurrentUser(null);
          } else {
            loadCurrentUser();
          }
        }
      );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // ROLE CHECK
  // ==========================================

  const userRole =
    currentUser?.role
      ?.trim()
      .toLowerCase() || "";

  const isOwner =
    userRole === "owner" ||
    userRole === "admin" ||
    userRole === "administrator";

  // ==========================================
  // FILTER MENU
  // ==========================================

  const visibleMenu =
    menu.filter((item) => {
      if (item.ownerOnly) {
        return isOwner;
      }

      return true;
    });

  // ==========================================
  // ACTIVE PAGE
  // ==========================================

  function isActive(
    path: string
  ) {
    return (
      location.pathname === path
    );
  }

  // ==========================================
  // LOADING
  // ==========================================

  if (loadingUser) {
    return (
      <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-slate-100 flex">

        {/* SIDEBAR */}

        <aside
          className="
            hidden
            md:flex
            w-64
            flex-col
            bg-gradient-to-b
            from-blue-700
            to-blue-900
            text-white
            shadow-xl
            fixed
            left-0
            top-0
            bottom-0
            z-40
          "
        >

          <div className="p-5 border-b border-blue-500">

            <div className="flex items-center gap-3">

              <div
                className="
                  w-12
                  h-12
                  rounded-full
                  bg-white
                  text-blue-700
                  flex
                  items-center
                  justify-center
                  text-xl
                  font-bold
                  shadow
                "
              >
                M
              </div>

              <div>

                <h1 className="text-xl font-bold">
                  MANVI ERP
                </h1>

                <p className="text-xs text-blue-100">
                  MANVI MILK AGENCIES
                </p>

              </div>

            </div>

          </div>

        </aside>

        {/* LOADING */}

        <div
          className="
            flex-1
            md:ml-64
            flex
            items-center
            justify-center
          "
        >

          <div className="text-center">

            <div
              className="
                w-12
                h-12
                border-4
                border-blue-600
                border-t-transparent
                rounded-full
                animate-spin
                mx-auto
                mb-4
              "
            />

            <p className="font-semibold text-blue-700">
              Loading MANVI ERP...
            </p>

          </div>

        </div>

      </div>
    );
  }

  // ==========================================
  // MAIN UI
  // ==========================================

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-slate-100 flex">

      {/* ======================================
          SIDEBAR
      ======================================= */}

      <aside
        className="
          hidden
          md:flex
          w-64
          flex-col
          bg-gradient-to-b
          from-blue-700
          to-blue-900
          text-white
          shadow-xl
          fixed
          left-0
          top-0
          bottom-0
          z-40
        "
      >

        {/* ==================================
            LOGO
        =================================== */}

        <div
          className="
            p-5
            border-b
            border-blue-500
          "
        >

          <div className="flex items-center gap-3">

            <div
              className="
                w-12
                h-12
                rounded-full
                bg-white
                text-blue-700
                flex
                items-center
                justify-center
                text-xl
                font-bold
                shadow
              "
            >
              M
            </div>

            <div>

              <h1 className="text-xl font-bold">
                MANVI ERP
              </h1>

              <p className="text-xs text-blue-100">
                MANVI MILK AGENCIES
              </p>

            </div>

          </div>

        </div>

        {/* ==================================
            USER ROLE
        =================================== */}

        <div
          className="
            px-4
            py-3
            border-b
            border-blue-600
          "
        >

          <p className="text-xs text-blue-200">
            Logged in as
          </p>

          <p className="font-semibold truncate">
            {currentUser?.name || "User"}
          </p>

          <span
            className="
              inline-block
              mt-1
              rounded-full
              bg-white/20
              px-2
              py-1
              text-[11px]
              font-bold
            "
          >
            {currentUser?.role || "Employee"}
          </span>

        </div>

        {/* ==================================
            NAVIGATION
        =================================== */}

        <nav
          className="
            flex-1
            p-3
            space-y-1
            overflow-y-auto
          "
        >

          {visibleMenu.map(
            (item) => {

              const active =
                isActive(
                  item.path
                );

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex
                    items-center
                    gap-3
                    px-4
                    py-3
                    rounded-xl
                    transition
                    duration-200
                    ${
                      active
                        ? "bg-white text-blue-700 font-semibold shadow"
                        : "text-white hover:bg-blue-600"
                    }
                  `}
                >

                  <span className="text-lg">
                    {item.icon}
                  </span>

                  <span>
                    {item.name}
                  </span>

                </Link>
              );
            }
          )}

        </nav>

        {/* ==================================
            FOOTER
        =================================== */}

        <div
          className="
            p-4
            border-t
            border-blue-600
            text-xs
            text-blue-100
          "
        >

          <p>
            MANVI ERP V29
          </p>

          <p className="mt-1">
            Dairy Management System
          </p>

        </div>

      </aside>

      {/* ======================================
          MAIN AREA
      ======================================= */}

      <div
        className="
          flex
          flex-1
          min-w-0
          w-full
          max-w-full
          flex-col
          overflow-x-hidden
          md:ml-64
        "
      >

        {/* HEADER */}

        <Header />

        {/* PAGE */}

        <main
          className="
            flex-1
            min-w-0
            w-full
            max-w-full
            overflow-x-hidden
            p-3
            sm:p-4
            md:p-6
          "
        >

          {children}

        </main>

      </div>

    </div>
  );
}