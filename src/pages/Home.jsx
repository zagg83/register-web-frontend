import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useUser } from "../context/UserContext";
import { logout } from "../utils/auth";
import Calendar from "../ui/Calendar.jsx";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [loadingDash, setLoadingDash] = useState(true);
  const [dashDays, setDashDays] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [unreadGrades, setUnreadGrades] = useState([]);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [currentGradeIndex, setCurrentGradeIndex] = useState(0);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Monday start
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  });

  //
  const refreshDashboard = useCallback(async () => {
    try {
      setErrorMsg("");
      setLoadingDash(true);
      const response = await fetch(
        import.meta.env.VITE_API_URL + "/dashboard",
        {
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
        }
      );
      const data = await response.json();
      console.log(data);
      setDashDays(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetching dashboard failed:", err);
      setErrorMsg("Failed to load dashboard");
      setDashDays([]);
    } finally {
      setLoadingDash(false);
    }
  }, [user]);

  // no local dashboard menu anymore

  // Removed unused subjects fetch effect

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => refreshDashboard(), 80);
    return () => clearTimeout(t);
  }, [user, weekStart, refreshDashboard]);

  // Fetch unread messages
  useEffect(() => {
    if (!user) return;
    let aborted = false;
    async function fetchUnreadMessages() {
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
          console.log("Unread messages:", data);
          // Filter for grade messages and parse them
          const gradeMessages = Array.isArray(data) ? data.filter(msg => msg.type === "grade") : [];
          const parsedGrades = gradeMessages.map(msg => {
            // Parse title: "Bewertung geändert · Betriebswirtschaftslehre · Abschlussbuchungen · 8+"
            const parts = msg.title.split(" · ");
            const subject = parts[1] || "Unknown Subject";
            const grade = parts[3] || "";
            return {
              id: msg.id,
              subject,
              grade,
              timeSent: msg.timeSent,
              title: msg.title
            };
          });
          setUnreadGrades(parsedGrades);
        }
      } catch (e) {
        if (!aborted) {
          console.error("Fetching unread messages failed:", e);
        }
      }
    }
    const t = setTimeout(fetchUnreadMessages, 150);
    return () => {
      aborted = true;
      clearTimeout(t);
    };
  }, [user]);



  async function markGradeAsRead(messageId) {
    try {
      if (!messageId) return;
      await fetch(import.meta.env.VITE_API_URL + "/markAsRead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-target": user.url,
        },
        body: JSON.stringify({
          id: messageId,
          username: user.username,
          password: user.password,
          url: user.url,
        }),
      });
    } catch (err) {
      console.error("Mark as read failed:", err);
    }
  }

  async function handleAddReminder({ date, text }) {
    try {
      setErrorMsg("");
      // Optimistic UI: insert reminder locally
      const tempId = `tmp-${Date.now()}`;
      const optimisticItem = {
        _optimisticId: tempId,
        type: "reminder",
        title: text,
        subtitle: "",
        deleteable: true,
      };
      setDashDays((prev) => {
        const days = Array.isArray(prev) ? [...prev] : [];
        const idx = days.findIndex((d) => d.date === date);
        if (idx >= 0) {
          const items = Array.isArray(days[idx].items)
            ? [...days[idx].items]
            : [];
          items.unshift(optimisticItem);
          days[idx] = { ...days[idx], items };
        } else {
          days.push({ date, items: [optimisticItem] });
        }
        return days;
      });

      const res = await fetch(import.meta.env.VITE_API_URL + "/save-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-target": user.url,
        },
        body: JSON.stringify({
          date,
          text,
          username: user.username,
          password: user.password,
          url: user.url,
        }),
      });
      if (!res.ok) throw new Error(`Save reminder failed: ${res.status}`);
      const json = await res.json().catch(() => null);
      return json ?? true;
    } catch (err) {
      console.error("Saving reminder failed:", err);
      setErrorMsg("Failed to save reminder");
      // Rollback optimistic item
      setDashDays((prev) => {
        const days = Array.isArray(prev)
          ? prev.map((d) => ({
              ...d,
              items: Array.isArray(d.items)
                ? d.items.filter((it) => it._optimisticId == null)
                : d.items,
            }))
          : [];
        return days;
      });
      return false;
    }
  }

  async function handleDeleteReminder(item) {
    try {
      setErrorMsg("");
      // If there's no server id (optimistic-only), we're done
      if (item == null || item.id == null) return true;

      const res = await fetch(
        import.meta.env.VITE_API_URL + "/delete-reminder",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-target": user.url,
          },
          body: JSON.stringify({
            id: item.id,
            username: user.username,
            password: user.password,
            url: user.url,
          }),
        }
      );
      if (!res.ok) throw new Error(`Delete reminder failed: ${res.status}`);
      await res.json().catch(() => null);
      return true;
    } catch (err) {
      console.error("Deleting reminder failed:", err);
      setErrorMsg("Failed to delete reminder");
      return false;
    }
  }
  //
  return (
    <Page>
      <main className="container content">
        <SectionHeader>
          <div>
            <h1>Dashboard</h1>
            <p>Overview of your recent days</p>
          </div>
        </SectionHeader>
        {errorMsg && <ErrorMsg role="alert">{errorMsg}</ErrorMsg>}
        {unreadGrades.length > 0 && (
          <GradeNotification onClick={() => {
            setCurrentGradeIndex(0);
            setShowGradeModal(true);
          }}>
            <div className="icon">📊</div>
            <div className="content">
              <div className="title">New Grades Available</div>
              <div className="subjects">
                {unreadGrades.map((grade, idx) => (
                  <span key={grade.id} className="subject">
                    {grade.subject}
                    {idx < unreadGrades.length - 1 && ", "}
                  </span>
                ))}
              </div>
            </div>
          </GradeNotification>
        )}
        {loadingDash ? (
          <LoaderWrap>
            <Spinner />
            <span>Loading dashboard…</span>
          </LoaderWrap>
        ) : (
          <Calendar
            days={dashDays}
            onWeekChange={(mondayISO) => setWeekStart(mondayISO)}
            onAddReminder={handleAddReminder}
            onDeleteReminder={handleDeleteReminder}
          />
        )}
      </main>
      
      {/* Grade Details Modal */}
      {showGradeModal && unreadGrades.length > 0 && (
        <GradeModal>
          <ModalBackdrop onClick={() => setShowGradeModal(false)} />
          <ModalContent>
            <ModalHeader>
              <h3>Grade Details</h3>
              <button 
                className="closeBtn" 
                onClick={() => setShowGradeModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </ModalHeader>
            <ModalBody>
              {(() => {
                const currentGrade = unreadGrades[currentGradeIndex];
                return (
                  <>
                    <div className="gradeInfo">
                      <div className="subject">{currentGrade.subject}</div>
                      <div className="grade">{currentGrade.grade}</div>
                      <div className="time">
                        {new Date(currentGrade.timeSent).toLocaleString()}
                      </div>
                    </div>
                    <div className="progress">
                      Grade {currentGradeIndex + 1} of {unreadGrades.length}
                    </div>
                  </>
                );
              })()}
            </ModalBody>
            <ModalFooter>
              <button 
                className="confirmBtn"
                onClick={() => {
                  const current = unreadGrades[currentGradeIndex];
                  markGradeAsRead(current?.id);
                  if (currentGradeIndex < unreadGrades.length - 1) {
                    setCurrentGradeIndex(currentGradeIndex + 1);
                  } else {
                    setShowGradeModal(false);
                    setUnreadGrades([]); // Clear all grades after viewing
                  }
                }}
              >
                {currentGradeIndex < unreadGrades.length - 1 ? 'Next Grade' : 'Confirm All'}
              </button>
            </ModalFooter>
          </ModalContent>
        </GradeModal>
      )}
    </Page>
  );
}

const Page = styled.div``;

const HeaderBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 25;
  background: #ffffffcc;
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
`;

const HeaderInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
`;

const Brand = styled.div`
  font-weight: 800;
  font-size: 1.15rem;
`;

const UserBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ErrorMsg = styled.div`
  font-weight: 700;
`;

//

const Username = styled.span`
  color: var(--muted);
`;

const LogoutButton = styled.button`
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #f3f4f6;
  color: #111827;
  cursor: pointer;
  transition: background 0.15s ease;
  &:hover {
    background: #e5e7eb;
  }
`;

const SectionHeader = styled.div`
  margin-bottom: 16px;
  h1 {
    margin: 0 0 4px 0;
  }
  display: flex;
  align-items: end;
  justify-content: space-between;
`;

const LoaderWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
`;

const Spinner = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const GradeNotification = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
  }
  .icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }
  .content {
    flex: 1;
  }
  .title {
    font-weight: 700;
    font-size: 1rem;
    margin-bottom: 2px;
  }
  .subjects {
    font-size: 0.9rem;
    opacity: 0.9;
  }
  .subject {
    font-weight: 600;
  }
`;

const GradeModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const ModalBackdrop = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
`;

const ModalContent = styled.div`
  position: relative;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
  
  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #1f2937;
  }
  
  .closeBtn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    
    &:hover {
      background-color: #f3f4f6;
    }
  }
`;

const ModalBody = styled.div`
  padding: 24px;
  
  .gradeInfo {
    text-align: center;
    margin-bottom: 20px;
    
    .subject {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 12px;
    }
    
    .grade {
      font-size: 3rem;
      font-weight: 800;
      color: #3b82f6;
      margin-bottom: 8px;
    }
    
    .time {
      font-size: 0.9rem;
      color: #6b7280;
    }
  }
  
  .progress {
    text-align: center;
    font-size: 0.9rem;
    color: #6b7280;
    padding: 8px 12px;
    background: #f9fafb;
    border-radius: 8px;
  }
`;

const ModalFooter = styled.div`
  padding: 16px 24px 24px;
  display: flex;
  justify-content: center;
  
  .confirmBtn {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
`;

// Removed inline dashboard menu styles
