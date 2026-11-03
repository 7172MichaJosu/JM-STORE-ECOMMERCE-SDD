import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Providers } from "./app/providers.jsx";
import { ThemeProvider } from "./app/ThemeProvider.jsx";
import AppRouter from "./app/router.jsx";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/themes.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/accessibility.css";
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ThemeProvider>
      <Providers>
        <AppRouter />
      </Providers>
    </ThemeProvider>
  </BrowserRouter>,
);
