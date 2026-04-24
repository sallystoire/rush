import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initApiClient } from "./lib/api-init";

initApiClient();

createRoot(document.getElementById("root")!).render(<App />);
