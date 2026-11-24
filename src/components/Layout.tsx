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
  FiMenu,
  FiBell,
  FiChevronRight,
  FiX,
  FiLogOut,
} from "react-icons/fi";

import { supabase } from "../lib/supabase";
import "./manvi-ui.css";

interface Props {
  children: ReactNode;
}

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

const menu = [
  { name: "Dashboard", path: "/", icon: <FiHome /> },
  { name: "Sales", path: "/sales", icon: <FiShoppingCart /> },
  { name: "Purchases", path: "/purchases", icon: <FiTruck /> },
  { name: "Suppliers", path: "/suppliers", icon: <FiUsers /> },
  { name: "Brands", path: "/brands", icon: <FiTag /> },
  { name: "Products", path: "/products", icon: <FiBox /> },
  { name: "Customers", path: "/customers", icon: <FiUsers /> },
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
  {
    name: "User Management",
    path: "/user-management",
    icon: <FiUserCheck />,
    ownerOnly: true,
  },
];

export default function Layout({ children }: Props) {
  const location = useLocation();

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  async function loadCurrentUser() {
    try {
      setLoadingUser(true);

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

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

      const {
        data,
        error,
      } = await supabase
        .from("users")
        .select(`
          id,
          name,
          email,
          role,
          active
        `)
        .eq("id", authUser.id)
        .maybeSingle();

      if (error) {
        console.error(
          "MANVI LOAD USER ERROR:",
          error
        );

        setCurrentUser({
          id: authUser.id,
          name:
            authUser.user_metadata?.name ||
            authUser.email?.split("@")[0] ||
            "User",
          email: authUser.email || "",
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
        setCurrentUser({
          id: authUser.id,
          name:
            authUser.user_metadata?.name ||
            authUser.email?.split("@")[0] ||
            "User",
          email: authUser.email || "",
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

  const userRole =
    currentUser?.role
      ?.trim()
      .toLowerCase() || "";

  const isOwner =
    userRole === "owner" ||
    userRole === "admin" ||
    userRole === "administrator";

  const visibleMenu = menu.filter(
    (item) => {
      if (item.ownerOnly) {
        return isOwner;
      }

      return true;
    }
  );

  function isActive(path: string) {
    if (path === "/") {
      return location.pathname === "/";
    }

    return (
      location.pathname === path ||
      location.pathname.startsWith(
        `${path}/`
      )
    );
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  if (loadingUser) {
    return (
      <div className="manvi-loading">
        <div className="manvi-loading-card">
          <div className="manvi-loading-logo">
            M
          </div>

          <div className="manvi-spinner" />

          <p>
            Loading MANVI ERP...
          </p>
        </div>
      </div>
    );
  }

  const currentPage =
    menu.find((item) =>
      isActive(item.path)
    )?.name || "MANVI ERP";

  return (
    <div className="manvi-app">

      {/* DESKTOP SIDEBAR */}

      <aside className="manvi-sidebar">

        <div className="manvi-logo-area">

          <div className="manvi-logo-mark">
            M
          </div>

          <div>
            <div className="manvi-logo-title">
              MANVI ERP
            </div>

            <div className="manvi-logo-subtitle">
              MANVI MILK AGENCIES
            </div>
          </div>

        </div>

        <div className="manvi-user-box">

          <div className="manvi-avatar">
            {(currentUser?.name || "U")
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="manvi-user-info">

            <strong>
              {currentUser?.name || "User"}
            </strong>

            <span>
              {currentUser?.role ||
                "Employee"}
            </span>

          </div>

        </div>

        <nav className="manvi-sidebar-nav">

          <div className="manvi-nav-label">
            MAIN MENU
          </div>

          {visibleMenu.map((item) => {

            const active =
              isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={
                  active
                    ? "manvi-nav-item active"
                    : "manvi-nav-item"
                }
              >

                <span className="manvi-nav-icon">
                  {item.icon}
                </span>

                <span className="manvi-nav-text">
                  {item.name}
                </span>

                {active && (
                  <FiChevronRight className="manvi-nav-arrow" />
                )}

              </Link>
            );
          })}

        </nav>

        <div className="manvi-sidebar-footer">

          <div>
            MANVI ERP V30
          </div>

          <span>
            Dairy Management System
          </span>

        </div>

      </aside>

      {/* MOBILE DRAWER */}

      {mobileMenuOpen && (
        <>
          <button
            className="manvi-mobile-overlay"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          />

          <aside className="manvi-mobile-drawer">

            <div className="manvi-mobile-drawer-header">

              <div className="manvi-logo-mark">
                M
              </div>

              <div>
                <strong>
                  MANVI ERP
                </strong>

                <span>
                  MANVI MILK AGENCIES
                </span>
              </div>

              <button
                className="manvi-icon-button"
                onClick={closeMobileMenu}
                aria-label="Close"
              >
                <FiX />
              </button>

            </div>

            <div className="manvi-mobile-user">

              <div className="manvi-avatar">
                {(currentUser?.name || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>

                <strong>
                  {currentUser?.name ||
                    "User"}
                </strong>

                <span>
                  {currentUser?.role ||
                    "Employee"}
                </span>

              </div>

            </div>

            <nav className="manvi-mobile-nav">

              {visibleMenu.map((item) => (

                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeMobileMenu}
                  className={
                    isActive(item.path)
                      ? "manvi-mobile-nav-item active"
                      : "manvi-mobile-nav-item"
                  }
                >

                  <span>
                    {item.icon}
                  </span>

                  <span>
                    {item.name}
                  </span>

                  <FiChevronRight />

                </Link>

              ))}

            </nav>

            <div className="manvi-mobile-drawer-footer">

              <FiLogOut />

              <span>
                Logout
              </span>

            </div>

          </aside>
        </>
      )}

      {/* MAIN AREA */}

      <div className="manvi-main">

        {/* TOP HEADER */}

        <header className="manvi-header">

          <div className="manvi-header-left">

            <button
              className="manvi-mobile-menu-button"
              onClick={() =>
                setMobileMenuOpen(true)
              }
              aria-label="Open menu"
            >
              <FiMenu />
            </button>

            <div className="manvi-mobile-title">

              <strong>
                {currentPage}
              </strong>

              <span>
                MANVI ERP V30
              </span>

            </div>

            <div className="manvi-desktop-page-title">
              {currentPage}
            </div>

          </div>

          <div className="manvi-header-right">

            <div className="manvi-business-chip">

              <span className="manvi-business-dot" />

              <span>
                MANVI MILK AGENCIES
              </span>

            </div>

            <button
              className="manvi-header-icon"
              aria-label="Notifications"
            >
              <FiBell />

              <span className="manvi-notification-dot" />

            </button>

            <div className="manvi-header-user">

              <div className="manvi-avatar small">
                {(currentUser?.name || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>

                <strong>
                  {currentUser?.name ||
                    "User"}
                </strong>

                <span>
                  {currentUser?.role ||
                    "Employee"}
                </span>

              </div>

            </div>

          </div>

        </header>

        {/* MOBILE QUICK NAV */}

        <div className="manvi-mobile-top-nav">

          <Link
            to="/"
            className={
              isActive("/")
                ? "active"
                : ""
            }
          >
            <FiHome />
            <span>Home</span>
          </Link>

          <Link
            to="/sales"
            className={
              isActive("/sales")
                ? "active"
                : ""
            }
          >
            <FiShoppingCart />
            <span>Sales</span>
          </Link>

          <Link
            to="/purchases"
            className={
              isActive("/purchases")
                ? "active"
                : ""
            }
          >
            <FiTruck />
            <span>Purchase</span>
          </Link>

          <Link
            to="/collections"
            className={
              isActive("/collections")
                ? "active"
                : ""
            }
          >
            <FiDollarSign />
            <span>Collection</span>
          </Link>

          <button
            onClick={() =>
              setMobileMenuOpen(true)
            }
          >
            <FiMenu />
            <span>More</span>
          </button>

        </div>

        {/* EXISTING PAGE */}

        <main className="manvi-content">
          {children}
        </main>

      </div>

    </div>
  );
}