import { useEffect, useState } from "react";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import AdminDashboard from "./AdminDashboard";
import IdleTracker from "./IdleTracker";
import CountdownDisplay from "./CountdownDisplay";
import ProductiveTime from "./ProductiveTime";

// Simple Employee Dashboard component (wraps your existing dashboard)
function EmployeeDashboard({ currentUser }) {
  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome, {currentUser.username}</h1>
      <IdleTracker />
      <CountdownDisplay />
      <ProductiveTime />
      {/* Add other metric components here */}
    </div>
  );
}

export default function ElectronAppWindow() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => {
    async function initialize() {
      try {
        // Get currently logged-in user
        const res = await window.electronAPI.getCurrentUser();
        if (res.success && res.user) {
          setUser(res.user);
        } else {
          // If no user logged in, check if any admin exists
          const adminRes = await window.electronAPI.adminGetUsers();
          if (adminRes.success && adminRes.users.length === 0) {
            setShowSignup(true); // first-run: create admin
          }
        }
      } catch (err) {
        console.error("Error initializing ElectronAppWindow:", err);
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (showSignup) {
    return (
      <SignupForm
        setUser={(u) => {
          setUser(u);
          setShowSignup(false);
        }}
      />
    );
  }

  if (!user) {
    return <LoginForm setUser={setUser} />;
  }

  if (user.role === "admin") {
    return <AdminDashboard currentUser={user} setUser={setUser} />;
  }

  return <EmployeeDashboard currentUser={user} />;
}
