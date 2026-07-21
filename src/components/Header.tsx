import { Link, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Header() {
  const location = useLocation();

  const menu = [
    { name: "Dashboard", path: "/" },
    { name: "Customers", path: "/customers" },
    { name: "Products", path: "/products" },
    { name: "Purchases", path: "/purchases" },
    { name: "Sales", path: "/sales" },
    { name: "Collections", path: "/collections" },
    { name: "Expenses", path: "/expenses" },
    { name: "Reports", path: "/reports" },
  ];

  return (
    <header className="bg-blue-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between">

          <div className="flex items-center gap-3">

            <img
              src={logo}
              alt="MANVI MILK AGENCIES"
              className="w-14 h-14 rounded-full bg-white p-1 shadow"
            />

            <div>
              <h1 className="text-2xl font-bold text-white">
                MANVI MILK AGENCIES
              </h1>

              <p className="text-blue-100 text-sm">
                Dairy ERP Management System
              </p>
            </div>

          </div>

          <nav className="flex flex-wrap gap-2 mt-4 md:mt-0">

            {menu.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  location.pathname === item.path
                    ? "bg-white text-blue-700"
                    : "text-white hover:bg-blue-600"
                }`}
              >
                {item.name}
              </Link>
            ))}

          </nav>

        </div>

      </div>
    </header>
  );
      }
