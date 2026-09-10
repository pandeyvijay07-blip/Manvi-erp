import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import App from "./App";
import { registerMANVIPWA } from "./registerPWA";

// Register MANVI ERP as an installable Progressive Web App.
registerMANVIPWA();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("MANVI ERP root element was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);