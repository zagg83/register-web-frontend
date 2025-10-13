import { createContext, useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../utils/auth";

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    const userObj = getUser();
    if (!userObj) {
      navigate("/login", { replace: true });
      return;
    }
    setUser(userObj);
    const fetchUser = async () => {
      try {
        const response = await fetch(import.meta.env.VITE_API_URL + "/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-target": userObj.url,
          },
          body: JSON.stringify({
            username: userObj.username,
            password: userObj.password,
            url: userObj.url,
          }),
        });
        if (!response.ok) {
          navigate("/login", { replace: true });
          return;
        }
        const data = await response.json();
        if (data.isLoggedIn === false) {
          navigate("/login", { replace: true });
          return;
        }
        setUser(userObj);
      } catch (err) {
        console.error("Login fetch failed:", err);
      }
    };
    fetchUser();
  }, [navigate]);

  return (
    <UserContext.Provider value={{ user }}>{children}</UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
