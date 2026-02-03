import { HashRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import Auth from "./pages/Auth";
import App from "./App";
import Protected from "./components/Protected";

export default function Router() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<LandingPage />} />
        <Route path="/how" element={<LandingPage />} />
        <Route path="/faq" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/app"
          element={
            <Protected>
              <App />
            </Protected>
          }
        />
      </Routes>
    </HashRouter>
  );
}
