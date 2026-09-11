import {
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  FiBell,
  FiRefreshCw,
  FiMenu,
  FiSearch,
  FiLogOut,
  FiUser,
  FiChevronDown,
  FiHome,
  FiShoppingCart,
  FiTruck,
  FiUsers,
  FiTag,
  FiBox,
  FiDollarSign,
  FiCreditCard,
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiUserCheck,
  FiSettings,
} from "react-icons/fi";

import { supabase } from "../lib/supabase";

// ============================================
// PAGE TITLES
// ============================================

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/sales": "Sales Entry",
  "/purchases": "Purchases",
  "/suppliers": "Suppliers",
  "/brands": "Brands",
  "/products": "Products",
  "/customers": "Customers",
  "/customer-prices": "Customer Prices",
  "/walkin-sales": "Walk-in Sales",
  "/collections": "Collections",
  "/expenses": "Expenses",
  "/reports": "Reports",
  "/customer-ledger": "Customer Ledger",
  "/daily-closing": "Daily Closing",
  "/profile": "Profile",
  "/settings": "Settings",
  "/change-password": "Change Password",
  "/user-management": "User Management",
};

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

const mobileMenuItems = [
  { name: "Dashboard", path: "/", icon: FiHome },
  { name: "Sales", path: "/sales", icon: FiShoppingCart },
  { name: "Purchases", path: "/purchases", icon: FiTruck },
  { name: "Suppliers", path: "/suppliers", icon: FiUsers },
  { name: "Brands", path: "/brands", icon: FiTag },
  { name: "Products", path: "/products", icon: FiBox },
  { name: "Customers", path: "/customers", icon: FiUsers },
  { name: "Customer Prices", path: "/customer-prices", icon: FiDollarSign },
  { name: "Walk-in Sales", path: "/walkin-sales", icon: FiShoppingCart },
  { name: "Collections", path: "/collections", icon: FiDollarSign },
  { name: "Expenses", path: "/expenses", icon: FiCreditCard },
  { name: "Reports", path: "/reports", icon: FiBarChart2 },
  { name: "Customer Ledger", path: "/customer-ledger", icon: FiBookOpen },
  { name: "Daily Closing", path: "/daily-closing", icon: FiCalendar },
  { name: "User Management", path: "/user-management", icon: FiUserCheck, ownerOnly: true },
  { name: "Settings", path: "/settings", icon: FiSettings },
];

// ============================================
// HEADER
// ============================================

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loggingOut, setLoggingOut] =
    useState(false);

  // ==========================================
  // PAGE TITLE
  // ==========================================

  const pageTitle =
    pageTitles[location.pathname] ||
    "MANVI ERP";

  // ==========================================
  // LOAD CURRENT USER
  // ==========================================

  async function loadCurrentUser() {
    try {
      // ----------------------------------------
      // GET AUTH SESSION
      // ----------------------------------------

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "MANVI AUTH SESSION ERROR:",
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

      const authEmail =
        authUser.email || "";

      console.log(
        "MANVI AUTH USER:",
        authUser.id,
        authEmail
      );

      // ----------------------------------------
      // TRY BY AUTH USER ID
      // ----------------------------------------

      let userData: CurrentUser | null = null;

      const {
        data: idData,
        error: idError,
      } = await supabase
        .from("users")
        .select(
          "id, name, email, role, active"
        )
        .eq("id", authUser.id)
        .maybeSingle();

      if (!idError && idData) {
        userData =
          idData as CurrentUser;
      }

      // ----------------------------------------
      // IF NOT FOUND, TRY EMAIL
      // ----------------------------------------

      if (!userData && authEmail) {
        console.log(
          "MANVI: User not found by ID. Trying email..."
        );

        const {
          data: emailData,
          error: emailError,
        } = await supabase
          .from("users")
          .select(
            "id, name, email, role, active"
          )
          .ilike(
            "email",
            authEmail
          )
          .maybeSingle();

        if (
          !emailError &&
          emailData
        ) {
          userData =
            emailData as CurrentUser;
        } else if (emailError) {
          console.error(
            "MANVI EMAIL USER ERROR:",
            emailError
          );
        }
      }

      // ----------------------------------------
      // FOUND USER
      // ----------------------------------------

      if (userData) {
        console.log(
          "MANVI CURRENT USER:",
          userData
        );

        setCurrentUser({
          id: userData.id,
          name:
            userData.name ||
            authEmail.split("@")[0] ||
            "User",
          email:
            userData.email ||
            authEmail,
          role:
            userData.role ||
            "Employee",
          active:
            userData.active !== false,
        });

        return;
      }

      // ----------------------------------------
      // AUTH METADATA FALLBACK
      // ----------------------------------------

      const metadata =
        authUser.user_metadata || {};

      console.log(
        "MANVI USER METADATA:",
        metadata
      );

      setCurrentUser({
        id: authUser.id,

        name:
          metadata.name ||
          metadata.full_name ||
          authEmail.split("@")[0] ||
          "User",

        email:
          authEmail,

        role:
          metadata.role ||
          "Employee",

        active: true,
      });

    } catch (error) {
      console.error(
        "MANVI CURRENT USER ERROR:",
        error
      );

      setCurrentUser(null);
    }
  }

  // ==========================================
  // LOAD USER
  // ==========================================

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [location.pathname]);

  // ==========================================
  // AUTH LISTENER
  // ==========================================

  useEffect(() => {
    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        async (_event, session) => {

          if (!session?.user) {
            setCurrentUser(null);
            return;
          }

          await loadCurrentUser();
        }
      );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // REFRESH
  // ==========================================

  function refreshPage() {
    window.location.reload();
  }

  // ==========================================
  // SEARCH
  // ==========================================

  function handleSearch(
    value: string
  ) {
    setSearch(value);

    const text =
      value.trim().toLowerCase();

    if (text === "sales") {
      navigate("/sales");
    } else if (text === "products") {
      navigate("/products");
    } else if (text === "brands") {
      navigate("/brands");
    } else if (text === "customers") {
      navigate("/customers");
    } else if (text === "purchases") {
      navigate("/purchases");
    } else if (text === "suppliers") {
      navigate("/suppliers");
    } else if (text === "reports") {
      navigate("/reports");
    } else if (text === "collections") {
      navigate("/collections");
    } else if (text === "expenses") {
      navigate("/expenses");
    } else if (text === "profile") {
      navigate("/profile");
    } else if (
      text === "users" ||
      text === "user management" ||
      text === "employees"
    ) {
      navigate("/user-management");
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to logout from MANVI ERP?"
      );

    if (!confirmed) {
      return;
    }

    setLoggingOut(true);

    try {
      const {
        error,
      } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          "MANVI LOGOUT ERROR:",
          error
        );

        alert(
          "Logout Error:\n\n" +
          error.message
        );

        return;
      }

      setCurrentUser(null);
      setUserMenuOpen(false);

      navigate("/login", {
        replace: true,
      });

    } catch (error: any) {
      console.error(
        "MANVI LOGOUT EXCEPTION:",
        error
      );

      alert(
        "Logout Error:\n\n" +
        (
          error?.message ||
          "Unable to logout."
        )
      );

    } finally {
      setLoggingOut(false);
    }
  }

  // ==========================================
  // DISPLAY USER
  // ==========================================

  const displayName =
    currentUser?.name ||
    "User";

  const displayRole =
    currentUser?.role ||
    "Employee";

  const avatarLetter =
    displayName
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "U";

  const isOwner = [
    "owner",
    "admin",
    "administrator",
  ].includes(
    displayRole.trim().toLowerCase()
  );

  const visibleMobileMenuItems =
    mobileMenuItems.filter(
      (item) => !item.ownerOnly || isOwner
    );

  // ==========================================
  // UI
  // ==========================================

  return (
    <header
      className="
        bg-white
        shadow
        min-h-[80px]
        flex
        items-center
        justify-between
        px-4
        md:px-6
        py-3
        relative
        sticky
        top-0
        z-50
      "
    >

      {/* =====================================
          LEFT
      ====================================== */}

      <div className="flex items-center gap-3">

        <button
          type="button"
          onClick={() =>
            setMobileMenu(!mobileMenu)
          }
          className="
            md:hidden
            text-2xl
            text-blue-700
          "
        >
          <FiMenu />
        </button>

        <div>
          <h2
            className="
              text-xl
              md:text-2xl
              font-bold
              text-slate-800
            "
          >
            {pageTitle}
          </h2>

          <p
            className="
              text-gray-500
              text-xs
              md:text-sm
            "
          >
            MANVI ERP V29
          </p>
        </div>

      </div>

      {/* =====================================
          RIGHT
      ====================================== */}

      <div
        className="
          flex
          items-center
          gap-2
          md:gap-4
        "
      >

        {/* SEARCH */}

        <div
          className="
            hidden
            lg:flex
            items-center
            bg-slate-100
            rounded-xl
            px-3
            py-2
          "
        >

          <FiSearch
            className="text-gray-500"
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              handleSearch(
                e.target.value
              )
            }
            placeholder="Search module..."
            className="
              bg-transparent
              outline-none
              px-2
              w-40
            "
          />

        </div>

        {/* REFRESH */}

        <button
          type="button"
          onClick={refreshPage}
          className="
            text-xl
            text-slate-600
            hover:text-blue-700
          "
          title="Refresh"
        >
          <FiRefreshCw />
        </button>

        {/* NOTIFICATION */}

        <button
          type="button"
          className="
            relative
            text-xl
            text-slate-600
          "
          title="Notifications"
        >

          <FiBell />

          <span
            className="
              absolute
              -top-2
              -right-2
              bg-red-600
              text-white
              text-[10px]
              rounded-full
              w-5
              h-5
              flex
              items-center
              justify-center
            "
          >
            0
          </span>

        </button>

        {/* =================================
            USER
        ================================= */}

        <div className="relative">

          <button
            type="button"
            onClick={() =>
              setUserMenuOpen(
                !userMenuOpen
              )
            }
            className="
              flex
              items-center
              gap-2
              rounded-xl
              px-2
              py-1
              hover:bg-slate-50
            "
          >

            {/* AVATAR */}

            <div
              className="
                w-10
                h-10
                md:w-11
                md:h-11
                rounded-full
                bg-blue-700
                text-white
                flex
                items-center
                justify-center
                font-bold
              "
            >
              {avatarLetter}
            </div>

            {/* USER NAME */}

            <div
              className="
                hidden
                md:block
                text-left
              "
            >

              <p className="font-semibold">
                {displayName}
              </p>

              <p
                className="
                  text-xs
                  text-gray-500
                "
              >
                {displayRole}
              </p>

            </div>

            <FiChevronDown
              className="
                hidden
                md:block
                text-slate-500
              "
            />

          </button>

          {/* =================================
              DROPDOWN
          ================================= */}

          {userMenuOpen && (

            <div
              className="
                absolute
                right-0
                mt-2
                w-64
                rounded-xl
                bg-white
                shadow-xl
                border
                border-slate-200
                overflow-hidden
                z-50
              "
            >

              {/* USER INFO */}

              <div
                className="
                  border-b
                  border-slate-200
                  bg-slate-50
                  px-4
                  py-4
                "
              >

                <p className="font-bold text-slate-800">
                  {displayName}
                </p>

                <p className="text-sm text-slate-500 break-all">
                  {currentUser?.email || ""}
                </p>

                <span
                  className="
                    inline-block
                    mt-2
                    rounded-full
                    bg-blue-100
                    px-3
                    py-1
                    text-xs
                    font-bold
                    text-blue-700
                  "
                >
                  {displayRole}
                </span>

              </div>

              {/* PROFILE */}

              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate("/profile");
                }}
                className="
                  flex
                  w-full
                  items-center
                  gap-3
                  px-4
                  py-3
                  text-left
                  text-slate-700
                  hover:bg-blue-50
                  hover:text-blue-700
                "
              >

                <FiUser />

                <span className="font-semibold">
                  My Profile
                </span>

              </button>

              {/* LOGOUT */}

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="
                  flex
                  w-full
                  items-center
                  gap-3
                  border-t
                  border-slate-100
                  px-4
                  py-3
                  text-left
                  font-semibold
                  text-red-600
                  hover:bg-red-50
                  disabled:opacity-50
                "
              >

                <FiLogOut />

                <span>
                  {loggingOut
                    ? "Logging out..."
                    : "Logout"}
                </span>

              </button>

            </div>

          )}

        </div>

      </div>

      {/* =====================================
          MOBILE LEFT NAVIGATION DRAWER
      ====================================== */}

      {mobileMenu && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenu(false)}
            className="
              fixed
              inset-0
              z-40
              bg-slate-900/50
              md:hidden
            "
          />

          {/* Drawer */}
          <aside
            className="
              fixed
              left-0
              top-0
              bottom-0
              z-50
              flex
              w-[82vw]
              max-w-[360px]
              flex-col
              overflow-hidden
              bg-white
              shadow-2xl
              md:hidden
            "
          >
            {/* Drawer header */}
            <div className="shrink-0 border-b border-slate-200 bg-white px-5 pb-4 pt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-700 shadow-sm ring-1 ring-blue-100">
                    M
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold text-blue-700">
                      MANVI ERP
                    </p>
                    <p className="truncate text-xs font-medium text-slate-500">
                      MANVI MILK AGENCIES
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenu(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-1">
                {visibleMobileMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => {
                        setMobileMenu(false);
                        navigate(item.path);
                      }}
                      className={`
                        flex
                        w-full
                        items-center
                        gap-4
                        rounded-xl
                        px-4
                        py-3.5
                        text-left
                        transition
                        ${
                          active
                            ? "bg-blue-600 text-white shadow-md"
                            : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        }
                      `}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="truncate text-[15px] font-semibold">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="my-4 border-t border-slate-200" />

              {/* User */}
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                    {avatarLetter}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {displayRole}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="mt-2 flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <FiLogOut className="h-5 w-5 shrink-0" />
                <span>{loggingOut ? "Logging out..." : "Logout"}</span>
              </button>
            </nav>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-200 px-5 py-4 text-xs text-slate-500">
              <p className="font-semibold text-blue-700">MANVI ERP V29</p>
              <p className="mt-1">Dairy Management System</p>
            </div>
          </aside>
        </>
      )}

    </header>
  );
}