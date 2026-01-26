import { useLocation, useNavigate } from "react-router-dom";
import { setSession } from "../auth/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation() as any;

  function login() {
    setSession({ token: "dev", user: { name: "Dev" } });
    navigate(location.state?.from ?? "/", { replace: true });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <button onClick={login}>Login</button>
    </main>
  );
}
