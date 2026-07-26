import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

interface Props {
  children: ReactNode;
}

const menu = [
  { name: "Dashboard", path: "/" },
  { name: "Sales", path: "/sales" },
  { name: "Purchases", path: "/purchases" },
  { name: "Products", path: "/products" },
  { name: "Stock", path: "/stock" },
  { name: "Customers", path: "/customers" },
  { name: "Suppliers", path: "/suppliers" },
  { name: "Collections", path: "/collections" },
  { name: "Expenses", path: "/expenses" },
  { name: "Reports", path: "/reports" },
];

export default function Layout({ children }: Props) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-64 bg-blue-700 text-white hidden md:flex flex-col">
        <div className="p-6 border-b border-blue-600">
          <h1 className="text-2xl font-bold">
            MANVI ERP V29
          </h1>
          <p className="text-blue-100 text-sm">
            MANVI MILK AGENCIES
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-2">
          {menu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block rounded-lg px-4 py-3 transition ${
                location.pathname === item.path
                  ? "bg-white text-blue-700"
                  : "hover:bg-blue-600"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="bg-white h-16 shadow flex items-center justify-between px-6">
          <div>
            <h2 className="font-bold text-xl">
              Dashboard
            </h2>
          </div>

          <div className="flex items-center gap-4">
            🔔
            👤 Admin
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
