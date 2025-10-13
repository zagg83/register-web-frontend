import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useUser } from "../context/UserContext";
import { logout } from "../utils/auth";

export default function Menu() {
  const [open, setOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState([]);
  const { user } = useUser();
  const navigate = useNavigate();
  const msgBtnRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch unread non-grade messages for indicator + dropdown
  useEffect(() => {
    if (!user) return;
    let aborted = false;
    async function fetchUnread() {
      try {
        const res = await fetch(import.meta.env.VITE_API_URL + "/unread", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-target": user.url,
          },
          body: JSON.stringify({
            username: user.username,
            password: user.password,
            url: user.url,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!aborted) {
          const nonGradeUnread = Array.isArray(data)
            ? data.filter(
                (m) => m?.type !== "grade" && m?.unreadIndicator && !m?.timeRead
              )
            : [];
          setUnreadMsgs(nonGradeUnread);
        }
      } catch (e) {
        if (!aborted) {
          console.error("Fetching unread failed:", e);
          setUnreadMsgs([]);
        }
      }
    }
    const t = setTimeout(fetchUnread, 120);
    return () => {
      aborted = true;
      clearTimeout(t);
    };
  }, [user]);

  // Close dropdown on outside click or route change intents
  useEffect(() => {
    function onDocClick(e) {
      const btn = msgBtnRef.current;
      const box = dropdownRef.current;
      if (!btn && !box) return;
      if (btn?.contains(e.target) || box?.contains(e.target)) return;
      setMsgOpen(false);
    }
    if (msgOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [msgOpen]);

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  return (
    <Bar>
      <Brand to="/dashboard">School Register</Brand>
      <Spacer />
      <Burger aria-label="Menu" onClick={() => setOpen((v) => !v)}>
        ☰
      </Burger>
      <Links data-open={open} onClick={() => setOpen(false)}>
        <MenuLink to="/dashboard">Dashboard</MenuLink>
        <MenuLink to="/calendar">Kalender</MenuLink>
        <MenuLink to="/absences">Absenzen</MenuLink>
        <MenuLink to="/messages">Nachrichten</MenuLink>
        <MenuLink to="/grades">Noten</MenuLink>
        <MenuLink to="/zeugnis">Zeugnis</MenuLink>
      </Links>
      <Right>
        <UserName title={user?.username || ""}>{user?.username}</UserName>
        <LogoutBtn onClick={onLogout}>Logout</LogoutBtn>
        <MsgWrap>
          <MessagesBtn
            ref={msgBtnRef}
            onClick={() => setMsgOpen((v) => !v)}
            title="Newest messages"
            aria-label="Messages"
            aria-expanded={msgOpen}
            aria-haspopup="true"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 7.5C3 6.12 4.12 5 5.5 5h13c1.38 0 2.5 1.12 2.5 2.5v9c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 19 3 17.88 3 16.5v-9Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 7l8 6 8-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {unreadMsgs.length > 0 && (
              <span
                className="badge"
                aria-label={`${unreadMsgs.length} unread messages`}
              >
                {unreadMsgs.length > 9 ? "9+" : unreadMsgs.length}
              </span>
            )}
          </MessagesBtn>
          {msgOpen && (
            <MsgDropdown
              ref={dropdownRef}
              role="menu"
              aria-label="Unread messages"
            >
              {unreadMsgs.length === 0 ? (
                <div className="empty">No unread messages</div>
              ) : (
                <ul>
                  {unreadMsgs.slice(0, 8).map((m, idx) => (
                    <li key={m.id ?? idx}>
                      <button
                        type="button"
                        className="itemBtn"
                        title={m.title || m.subject || "Open messages"}
                        onClick={() => {
                          setMsgOpen(false);
                          navigate("/messages");
                        }}
                      >
                        <span className="dot" />
                        <span className="label">
                          {m.title || m.subject || "(no subject)"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="footer">
                <button
                  type="button"
                  className="viewAll"
                  onClick={() => {
                    setMsgOpen(false);
                    navigate("/messages");
                  }}
                >
                  View all messages
                </button>
              </div>
            </MsgDropdown>
          )}
        </MsgWrap>
      </Right>
    </Bar>
  );
}

const Bar = styled.nav`
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 68px;
  padding: 0 16px;
  background: #0f172a; /* slate-900 */
  color: #fff;
`;

const Brand = styled(NavLink)`
  color: #e5e7eb;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.15rem;
  &:hover {
    color: #fff;
  }
`;

const Spacer = styled.div`
  flex: 1;
`;

const Burger = styled.button`
  display: none;
  @media (max-width: 900px) {
    display: block;
  }
  background: transparent;
  color: #e5e7eb;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 1rem;
  cursor: pointer;
`;

const Links = styled.div`
  display: flex;
  gap: 12px;
  @media (max-width: 900px) {
    position: fixed;
    left: 0;
    right: 0;
    top: 56px;
    background: #0f172a;
    flex-direction: column;
    padding: 8px 12px 12px;
    border-bottom: 1px solid #334155;
    display: none;
    &[data-open="true"] {
      display: flex;
    }
  }
`;

const MenuLink = styled(NavLink)`
  color: #cbd5e1;
  text-decoration: none;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 1rem;
  &.active {
    background: #1f2937;
    color: #fff;
  }
  &:hover {
    color: #fff;
  }
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MsgWrap = styled.div`
  position: relative;
`;

const UserName = styled.span`
  color: #94a3b8;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.95rem;
  @media (max-width: 500px) {
    display: none;
  }
`;

const LogoutBtn = styled.button`
  background: #334155;
  color: #fff;
  border: 1px solid #475569;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 0.95rem;
  cursor: pointer;
  &:hover {
    background: #475569;
  }
`;

const MessagesBtn = styled.button`
  appearance: none;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
  color: #ffffff;
  border: 0;
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35), 0 2px 6px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease,
    transform 0.05s ease;
  &:hover {
    filter: brightness(1.05);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.45),
      0 3px 8px rgba(0, 0, 0, 0.2);
  }
  &:active {
    transform: translateY(1px);
  }
  &:focus-visible {
    outline: 3px solid rgba(59, 130, 246, 0.7);
    outline-offset: 2px;
  }
  position: relative;
  /* Optional badge support */
  .badge {
    position: absolute;
    top: -3px;
    right: -3px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: #ef4444; /* red */
    color: #fff;
    font-size: 10px;
    line-height: 16px;
    border: 1px solid #fee2e2;
  }
`;

const MsgDropdown = styled.div`
  position: absolute;
  right: 0;
  top: 46px;
  width: min(320px, 90vw);
  background: #0b1224; /* darker than nav for contrast */
  color: #e5e7eb;
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  padding: 8px;
  z-index: 50;
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 300px;
    overflow: auto;
  }
  li + li {
    margin-top: 4px;
  }
  .itemBtn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: 0;
    color: inherit;
    padding: 8px;
    border-radius: 10px;
    cursor: pointer;
  }
  .itemBtn:hover {
    background: #111a33;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    flex: 0 0 auto;
  }
  .label {
    flex: 1 1 auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty {
    padding: 8px;
    color: #94a3b8;
  }
  .footer {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #1f2937;
    display: flex;
    justify-content: flex-end;
  }
  .viewAll {
    background: #1f2937;
    color: #e5e7eb;
    border: 1px solid #334155;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
  }
  .viewAll:hover {
    background: #273246;
  }
`;
