import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FiHome,
  FiShoppingCart,
  FiTruck,
  FiBox,
  FiDatabase,
  FiUsers,
  FiUserPlus,
  FiDollarSign,
  FiCreditCard,
  FiBarChart2,
  FiBell,
  FiSearch,
  FiRefreshCw,
  FiMenu,
} from "react-icons/fi";

interface Props {
  children: ReactNode;
}

const menu = [
  { name: "Dashboard", path: "/", icon: <FiHome /> },
  { name: "Sales", path: "/sales", icon: <FiShoppingCart /> },
  { name: "Purchases", path: "/purchases", icon: <FiTruck /> },
  { name: "Products", path: "/products", icon: <FiBox /> },
  { name: "Stock", path: "/stock", icon: <FiDatabase /> },
  { name: "Customers", path: "/customers", icon: <FiUsers /> },
  { name: "Suppliers", path: "/suppliers", icon: <FiUserPlus /> },
  { name: "Collections", path: "/collections", icon: <FiDollarSign /> },
  { name: "Expenses", path: "/expenses", icon: <FiCreditCard /> },
  { name: "Reports", path: "/reports", icon: <FiBarChart2 /> },
];

export default function Layout({ children }: Props) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-slate-100">

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-gradient-to-b from-blue-700 to-blue-900 text-white shadow-xl">

        <div className="p-6 border-b border-blue-500">

          <div className="flex items-center gap-3">

            <div className="w-12 h-12 rounded-full bg-white text-blue-700 flex items-center justify-center text-xl font-bold">
              M
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                MANVI ERP
              </h1>

              <p className="text-blue-100 text-sm">
                MANVI MILK AGENCIES
              </p>
            </div>

          </div>

        </div>

        <nav className="flex-1 p-4 space-y-2">

          {menu.map((item) => (

            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                location.pathname === item.path
                  ? "bg-white text-blue-700 font-semibold shadow"
                  : "hover:bg-blue-600"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.name}
            </Link>

          ))}

        </nav>

        <div className="p-4 border-t border-blue-600 text-sm text-blue-100">
          Last Sync<br />
          Today 10:30 AM
        </div>

      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">

        {/* Header */}
        <header className="bg-white shadow px-6 h-20 flex items-center justify-between">

          <div className="flex items-center gap-4">

            <button className="md:hidden text-2xl">
              <FiMenu />
            </button>

            <div>

              <h2 className="text-2xl font-bold text-slate-800">
                Dashboard
              </h2>

              <p className="text-gray-500 text-sm">
                Welcome to MANVI ERP V29
              </p>

            </div>

          </div>

          <div className="flex items-center gap-4">

            <div className="hidden lg:flex items-center bg-slate-100 rounded-xl px-3 py-2">

              <FiSearch className="text-gray-500" />

              <input
                placeholder="Search..."
                className="bg-transparent outline-none px-2"
              />

            </div>

            <button className="text-xl">
              <FiRefreshCw />
            </button>

            <button className="relative text-xl">
              <FiBell />
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                5
              </span>
            </button>

            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold">
                A
              </div>

              <div className="hidden md:block">

                <p className="font-semibold">
                  Admin
                </p>

                <p className="text-xs text-gray-500">
                  Administrator
                </p>

              </div>

            </div>

          </div>

        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>

      </div>

    </div>
  );
}
