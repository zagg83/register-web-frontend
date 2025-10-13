import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import { UserProvider } from "./context/UserContext.jsx";
import Home from "./pages/Home.jsx";
import Timetable from "./pages/Timetable.jsx";
import Absences from "./pages/Absences.jsx";
import Grades from "./pages/Grades.jsx";
import Messages from "./pages/Messages.jsx";
import Zeugnis from "./pages/Zeugnis.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <UserProvider>
              <App />
            </UserProvider>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Home />} />
          <Route path="calendar" element={<Timetable />} />
          <Route path="absences" element={<Absences />} />
          <Route path="messages" element={<Messages />} />
          <Route path="grades" element={<Grades />} />
          <Route path="zeugnis" element={<Zeugnis />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
