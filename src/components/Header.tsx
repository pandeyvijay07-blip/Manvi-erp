import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="bg-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">

        <div className="flex items-center gap-3">

          <img
            src="/logo.png"
            alt="MANVI MILK AGENCIES"
            className="w-12 h-12 rounded-full bg-white p-1"
          />

          <div>
            <h1 className="text-xl font-bold">
              MANVI MILK AGENCIES
            </h1>

            <p className="text-sm">
              Dairy ERP Management System
            </p>
          </div>

        </div>

        <div className="flex gap-4">

          <Link to="/">Dashboard</Link>

          <Link to="/customers">Customers</Link>

          <Link to="/products">Products</Link>

          <Link to="/purchases">Purchases</Link>

          <Link to="/sales">Sales</Link>

          <Link to="/collections">Collections</Link>

          <Link to="/expenses">Expenses</Link>

          <Link to="/reports">Reports</Link>

        </div>

      </div>
    </header>
  );
}
