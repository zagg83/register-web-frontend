import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login, getUser } from "../utils/auth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-check: if we already have credentials in localStorage, verify with backend
  const didCheck = useRef(false);
  useEffect(() => {
    if (didCheck.current) return;
    didCheck.current = true;

    const u = getUser();
    if (!u) return;

    (async () => {
      try {
        const res = await fetch(import.meta.env.VITE_API_URL + "/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-target": u.url,
          },
          body: JSON.stringify({
            username: u.username,
            password: u.password,
            url: u.url,
          }),
        });

        if (!res.ok) return; // stay on login
        const data = await res.json().catch(() => null);
        if (data && data.isLoggedIn === false) return;

        // Considered logged-in: persist (refresh timestamp) and redirect
        login(u.username, u.password);
        const redirectTo = location.state?.from?.pathname || "/";
        navigate(redirectTo, { replace: true });
      } catch (e) {
        // ignore and stay on login
      }
    })();
  }, [location.state, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }
    const response = await fetch(import.meta.env.VITE_API_URL + "/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target": "https://wfo-bruneck.digitalesregister.it/v2",
      },
      body: JSON.stringify({
        username,
        password,
        url: "https://wfo-bruneck.digitalesregister.it/v2",
      }),
    });
    if (!response.ok) {
      setError("Invalid username or password");
      return;
    }
    if (response.json().isLoggedIn === false) {
      setError("Invalid username or password");
      return;
    }
    login(username, password);
    const redirectTo = location.state?.from?.pathname || "/";
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="center-screen">
      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 420 }}>
        <h2>Sign in</h2>
        <p>Access your digital class register</p>
        <div className="form-field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 8 }}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
