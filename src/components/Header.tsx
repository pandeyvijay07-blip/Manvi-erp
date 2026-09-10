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
        sticky
        top-0
        z-30
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
          MOBILE MENU
      ====================================== */}

      {mobileMenu && (

        <div
          className="
            absolute
            top-full
            left-0
            right-0
            bg-white
            shadow-lg
            border-t
            md:hidden
            p-4
          "
        >

          <div
            className="
              grid
              grid-cols-2
              gap-2
            "
          >

            <button
              onClick={() => {
                setMobileMenu(false);
                navigate("/sales");
              }}
              className="
                p-3
                rounded-lg
                bg-blue-50
                text-blue-700
                font-semibold
              "
            >
              Sales
            </button>

            <button
              onClick={() => {
                setMobileMenu(false);
                navigate("/purchases");
              }}
              className="
                p-3
                rounded-lg
                bg-blue-50
                text-blue-700
                font-semibold
              "
            >
              Purchases
            </button>

            <button
              onClick={() => {
                setMobileMenu(false);
                navigate("/brands");
              }}
              className="
                p-3
                rounded-lg
                bg-blue-50
                text-blue-700
                font-semibold
              "
            >
              Brands
            </button>

            <button
              onClick={() => {
                setMobileMenu(false);
                navigate("/products");
              }}
              className="
                p-3
                rounded-lg
                bg-blue-50
                text-blue-700
                font-semibold
              "
            >
              Products
            </button>

            <button
              onClick={() => {
                setMobileMenu(false);
                navigate("/customers");
              }}
              className="
                p-3
                rounded-lg
                bg-blue-50
                text-blue-700
                font-semibold
              "
            >
              Customers
            </button>

            <button
              onClick={() => {
                setMobileMenu(false);
                navigate("/reports");
              }}
              className="
                p-3
                rounded-lg
                bg-blue-50
                text-blue-700
                font-semibold
              "
            >
              Reports
            </button>

            <button
              onClick={() => {
                setMobileMenu(false);
                navigate("/profile");
              }}
              className="
                p-3
                rounded-lg
                bg-blue-50
                text-blue-700
                font-semibold
              "
            >
              Profile
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="
                p-3
                rounded-lg
                bg-red-50
                text-red-600
                font-semibold
              "
            >
              {loggingOut
                ? "Logging out..."
                : "Logout"}
            </button>

          </div>

        </div>

      )}

    </header>
  );
}