import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import api from './services/api';
import PracticeLayout from './components/PracticeLayout';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GoalSetup from './pages/GoalSetup';
import AdminDashboard from './pages/AdminDashboard';
import WritingCategories from './pages/WritingCategories';
import Writing from './pages/Writing';
import WritingHistory from './pages/WritingHistory';
import WritingHistoryContent from './pages/WritingHistoryContent';
import Speaking from './pages/Speaking';
import Reading from './pages/Reading';
import Listening from './pages/Listening';
import MockTests from './pages/MockTests';
import PlansBilling from './pages/PlansBilling';
import Checkout from './pages/Checkout';
import ProfileSettings from './pages/ProfileSettings';
const TOKEN_KEY = 'band_buddy_access_token';

const practicePages = [
  ['/writing', 'Writing', WritingCategories],
  ['/writing/practice', 'Writing practice', Writing],
  ['/writing/history', 'My writing history', WritingHistoryContent],
  ['/practice/history', 'Practice history', WritingHistory],
  ['/speaking', 'Speaking', Speaking],
  ['/reading', 'Reading', Reading],
  ['/listening', 'Listening', Listening],
  ['/mock-tests', 'Mock tests', MockTests],
  ['/mock-tests/listening', 'Listening mock', MockTests],
];

function StudentGate({ setup = false }) {
  const { key } = useLocation();
  const token = sessionStorage.getItem(TOKEN_KEY);
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    const signal = controller.signal;

    async function check() {
      try {
        const { data: user } = await api.get('/auth/me', { signal });
        if (signal.aborted) return;

        if (user.role === 'admin') {
          setResult({ key, token, retry, admin: true });
          return;
        }

        const { data } = await api.get('/dashboard/goal', { signal });
        if (signal.aborted) return;

        setResult({ key, token, retry, hasGoal: Boolean(data.goal) });
      } catch (error) {
        if (signal.aborted) return;

        if (error.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setResult({ key, token, retry, signedOut: true });
          return;
        }

        setResult({ key, token, retry, failed: true });
      }
    }

    void check();
    return () => controller.abort();
  }, [key, token, retry]);

  if (!token) return <Navigate to="/login" replace />;

  if (result?.key !== key || result?.token !== token || result?.retry !== retry) {
    return (
      <p className="db-route-status" role="status">
        Loading your learning space…
      </p>
    );
  }

  if (result.signedOut) return <Navigate to="/login" replace />;

  if (result.failed) {
    return (
      <main className="db-route-status">
        <p role="alert">Could not check your IELTS goal. Please try again.</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </button>
      </main>
    );
  }

  if (result.admin) return <Navigate to="/admin" replace />;
  if (setup && result.hasGoal) return <Navigate to="/dashboard" replace />;
  if (!setup && !result.hasGoal) return <Navigate to="/goal-setup" replace />;

  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminDashboard />} />

        <Route element={<StudentGate setup />}>
          <Route path="/goal-setup" element={<GoalSetup />} />
        </Route>

        <Route element={<StudentGate />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/plans" element={<PlansBilling />} />
          <Route path="/checkout" element={<Checkout />} />
<Route path="/profile-settings" element={<ProfileSettings />} />
          {practicePages.map(([path, title, Page]) => (
            <Route
              key={path}
              path={path}
              element={
                <PracticeLayout title={title}>
                  <Page />
                </PracticeLayout>
              }
            />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}