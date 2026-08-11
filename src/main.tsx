import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles.css";
import { App } from "./App";
import { OverlayApp } from "./OverlayApp";

const mode = new URLSearchParams(window.location.search).get("mode");
if (mode === "overlay") document.documentElement.classList.add("overlay-document");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {mode === "overlay" ? <OverlayApp /> : <App />}
  </React.StrictMode>
);
