import { useState } from "react";
import Customers from "./Customers";
import Products from "./Products";
import Purchases from "./Purchases";
import Sales from "./Sales";
import Collections from "./Collections";
import Expenses from "./Expenses";

function Dashboard() {
  const [page, setPage] = useState("dashboard");

  switch (page) {
    case "customers":
      return <Customers />;
    case "products":
      return <Products />;
    case "purchases":
      return <Purchases />;
    case "sales":
      return <Sales />;
    case "collections":
      return <Collections />;
    case "expenses":
      return <Expenses />;
    default:
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

          <button onClick={() => setPage("expenses")}>Expenses</button>
          <br /><br />

          <button>Reports</button>
        </div>
      );
  }
}

export default Dashboard;
