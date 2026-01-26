import { useAuth } from "../auth/useAuth";

export default function DashboardPage() {
  const auth = useAuth();

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>
      <button onClick={auth.logout}>Logout</button>
    </div>
  );
}
