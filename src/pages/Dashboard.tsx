import { useState } from "react";
import Customers from "./Customers";
import Products from "./Products";
import Purchases from "./Purchases";
import Sales from "./Sales";
import Collections from "./Collections";

function Dashboard() {
  const [page, setPage] = useState("dashboard");

  if (page === "customers") return <Customers />;
  if (page === "products") return <Products />;
  if (page === "purchases") return <Purchases />;
  if (page === "sales") return <Sales />;
  if (page === "collections") return <Collections />;

  return (
    <div style={{ padding: 20 }}>
      <h1>MANVI ERP</h1>

      <button onClick={() => setPage("customers")}>Customers</button>
      <br /><br />

      <button onClick={() => setPage("products")}>Products</button>
      <br /><br />

      <button onClick={() => setPage("purchases")}>Purchases</button>
      <br /><br />

      <button onClick={() => setPage("sales")}>Sales</button>
      <br /><br />

      <button onClick={() => setPage("collections")}>Collections</button>
      <br /><br />

      <button>Expenses</button>
      <br /><br />

      <button>Reports</button>
    </div>
  );
}

export default Dashboard;
