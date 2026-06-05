import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/main.css";
// TEMPORARY — Step 1 storage test. Remove after verification.
import "./features/megastack/megaStackTest.js";

createRoot(document.getElementById("root")).render(<App />);
