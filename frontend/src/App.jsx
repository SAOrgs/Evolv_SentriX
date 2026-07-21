import { useState, useEffect } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AlertsPage from "./pages/AlertsPage";
import PermitsPage from "./pages/PermitsPage";
import TimelinePage from "./pages/TimelinePage";

const PAGES = {
  dashboard: Dashboard,
  alerts: AlertsPage,
  permits: PermitsPage,
  timeline: TimelinePage,
};

function currentPage() {
  return window.location.hash.replace("#", "") || "dashboard";
}

export default function App() {
  const [page, setPage] = useState(currentPage);

  useEffect(() => {
    function onHash() {
      setPage(currentPage());
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function navigate(id) {
    window.location.hash = id;
  }

  const Page = PAGES[page] || Dashboard;

  return (
    <Layout activePage={page} onNavigate={navigate}>
      <Page />
    </Layout>
  );
}
