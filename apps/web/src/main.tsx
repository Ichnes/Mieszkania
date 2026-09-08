import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { AuthBoundary } from "./features/auth/AuthBoundary";
import "./styles/auth.css";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthBoundary>
        <App />
      </AuthBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
