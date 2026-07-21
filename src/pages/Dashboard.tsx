import { useState } from "react";
import Customers from "./Customers";

function Dashboard() {
  const [page, setPage] = useState("dashboard");

  if (page === "customers") {
    return <Customers />;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>MANVI ERP</h1>

      <button onClick={() => setPage("customers")}>
        Customers
      </button>

      <br /><br />

      <button>Products</button>
      <br /><br />

      <button>Purchases</button>
      <br /><br />

      <button>Sales</button>
      <br /><br />

      <button>Collections</button>
      <br /><br />

      <button>Expenses</button>
      <br /><br />

      <button>Reports</button>
    </div>
  );
}

export default Dashboard;
