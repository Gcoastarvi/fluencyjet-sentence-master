import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; // ✅ Tailwind styles import (only once)
import { bootMetaDocument } from "./lib/metaDocument";

bootMetaDocument();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
// Create global toast function
window.showToast = function (msg) {
  let toast = document.getElementById("fj-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "fj-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
};
