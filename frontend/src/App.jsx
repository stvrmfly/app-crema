import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import Products from './pages/Products.jsx';
import Inventory from './pages/Inventory.jsx';
import Expenses from './pages/Expenses.jsx';
import Reports from './pages/Reports.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import Tour, { onTourStart } from './components/Tour.jsx'; // TOUR

export const ROUTE_ORDER = ['/app', '/app/orders', '/app/products', '/app/inventory', '/app/expenses', '/app/reports'];

function KeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!location.pathname.startsWith('/app')) return;

    function onKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

      const key = e.key.toLowerCase();
      let direction = 0;
      if (key === 'arrowright' || key === 'd') direction = 1;
      else if (key === 'arrowleft' || key === 'a') direction = -1;
      if (direction === 0) return;

      const idx = ROUTE_ORDER.indexOf(location.pathname);
      const current = idx === -1 ? 0 : idx;
      const next = (current + direction + ROUTE_ORDER.length) % ROUTE_ORDER.length;

      e.preventDefault();
      navigate(ROUTE_ORDER[next]);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, location.pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-fade-up">
      <Routes location={location}>
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/orders" element={<Orders />} />
        <Route path="/app/products" element={<Products />} />
        <Route path="/app/inventory" element={<Inventory />} />
        <Route path="/app/expenses" element={<Expenses />} />
        <Route path="/app/reports" element={<Reports />} />
      </Routes>
    </div>
  );
}

function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const fromLanding = location.state?.fromLanding;

  function handleSignOut() {
    if (exiting) return;
    setExiting(true);
    // Sidebar leaves at 0ms, shell at 120ms — both 380ms. Wait for shell to finish.
    setTimeout(() => navigate('/', { state: { fromApp: true } }), 500);
  }

  const navAnim = exiting
    ? 'animate-drop-up-nav'
    : fromLanding
      ? 'animate-drop-in-nav'
      : '';
  const shellAnim = exiting
    ? 'animate-drop-up-shell'
    : fromLanding
      ? 'animate-drop-in-shell'
      : '';

  return (
    <>
      <NavBar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        onSignOut={handleSignOut}
        animClass={navAnim}
      />
      <main className={`fixed top-6 bottom-6 right-5 surface-shell border border-divider/60 shadow-lifted rounded-2xl overflow-y-auto transition-[left] duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] ${collapsed ? 'left-[5.75rem]' : 'left-[16.75rem]'} ${shellAnim}`}>
        <div className="px-8 pt-10 pb-8">
          <AnimatedRoutes />
        </div>
      </main>
    </>
  );
}

function AppRouter() {
  const location = useLocation();
  const isApp = location.pathname.startsWith('/app');

  if (isApp) return <AppShell />;

  return (
    <Routes location={location}>
      <Route path="/" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<LoginPage />} />
    </Routes>
  );
}

// TOUR: global mount so the tour survives route changes
function TourMount() {
  const [activeFrom, setActiveFrom] = useState(null); // null = inactive; number = start at that idx
  useEffect(() => onTourStart((fromStep) => setActiveFrom(fromStep ?? 0)), []);
  return activeFrom !== null
    ? <Tour initialStep={activeFrom} onClose={() => setActiveFrom(null)} />
    : null;
}

export default function App() {
  return (
    <BrowserRouter>
      <KeyboardShortcuts />
      <TourMount />
      <AppRouter />
    </BrowserRouter>
  );
}
