import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { assertClientEnv } from "./env.ts";
import "./index.css";

assertClientEnv();

createRoot(document.getElementById("root")!).render(<App />);
