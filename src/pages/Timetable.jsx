import { useEffect, useState } from "react";
import styled from "styled-components";
import { useUser } from "../context/UserContext";

export default function Timetable() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [weekStart, setWeekStart] = useState(() => iso(getMonday(new Date())));

  useEffect(() => {
    if (!user) return;
    let aborted = false;
    async function fetchTimetable() {
      try {
        setLoading(true);
        setError("");
        console.log("/calendar POST startDate=", weekStart);
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-target": user.url,
          },
          body: JSON.stringify({
            username: user.username,
            password: user.password,
            url: user.url,
            startDate: weekStart,
          }),
        });
        const json = await res.json();
        console.log(json);
        if (!aborted) setData(json);
      } catch (e) {
        if (!aborted) setError("Failed to load timetable");
        console.error("Fetching timetable failed:", e);
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    const t = setTimeout(() => fetchTimetable(), 40);
    return () => {
      clearTimeout(t);
      aborted = true;
    };
  }, [user, weekStart]);
  // Weekly stress counters derived from current week data
  let hwCount = 0;
  let examCount = 0;
  if (data && typeof data === "object") {
    for (const d of Object.keys(data)) {
      try {
        const lessons = collectLessons(data[d]) || [];
        for (const L of lessons) {
          const items = Array.isArray(L.homeworkExams) ? L.homeworkExams : [];
          for (const it of items) {
            const typeName = String(it?.typeName || "");
            if (typeName === "Hausaufgabe") hwCount += 1;
            else examCount += 1;
          }
        }
      } catch {}
    }
  }
  const totalLoad = hwCount + examCount * 2.5;
  const loadLevel = Math.min(10, Math.max(0, Math.floor(totalLoad)));

  return (
    <Main className="container content">
      <HeaderBar>
        <h1>Timetable</h1>
      </HeaderBar>
      {!loading && data && (
        <StressWrap>
          <div className="title">Stress‑o-Meter</div>
          <div className="row">
            <div className="counters">
              <span className="pill hw" title="Homework count">
                Homework: {hwCount}
              </span>
              <span className="pill exam" title="Exams count">
                Exams: {examCount}
              </span>
            </div>
            <div className="progress">
              <div
                className={`bar lvl-${loadLevel}`}
                style={{ width: `${loadLevel * 10}%` }}
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={loadLevel}
                role="progressbar"
                title={`Week stress: ${totalLoad.toFixed(
                  1
                )} / 10 (lvl ${loadLevel})`}
              />
            </div>
          </div>
        </StressWrap>
      )}
      <Controls>
        <NavButton
          type="button"
          aria-label="Vorherige Woche"
          title="Vorherige Woche"
          onClick={() => setWeekStart(iso(addDays(new Date(weekStart), -7)))}
        >
          ←
        </NavButton>
        <DateInput
          type="date"
          value={weekStart}
          onChange={(e) =>
            setWeekStart(iso(getMonday(new Date(e.target.value))))
          }
          title="Woche auswählen"
        />
        <NavButton
          type="button"
          aria-label="Nächste Woche"
          title="Nächste Woche"
          onClick={() => setWeekStart(iso(addDays(new Date(weekStart), 7)))}
        >
          →
        </NavButton>
      </Controls>
      {loading ? (
        <LoaderWrap>
          <Spinner />
          <span>Loading timetable…</span>
        </LoaderWrap>
      ) : data ? (
        <>
          <TimetableGrid data={data} anchorMondayISO={weekStart} />
        </>
      ) : null}
    </Main>
  );
}

// Detect if a day contains an entry with lesson === null (holiday marker)
function detectHoliday(node) {
  let found = false;
  (function walkHoliday(n) {
    if (!n || typeof n !== "object" || found) return;
    // Treat any explicit null lesson as holiday marker
    if (Object.prototype.hasOwnProperty.call(n, "lesson") && n.lesson == null) {
      found = true;
      return;
    }
    for (const k of Object.keys(n)) {
      try {
        walkHoliday(n[k]);
      } catch (_) {}
    }
  })(node);
  return found;
}

const Main = styled.main`
  width: 100%;
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.7) 0px,
      rgba(255, 255, 255, 0) 160px
    ),
    #f8fafc;
  min-height: 100vh;
  padding-bottom: 16px;
`;

// Modal styles
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 50;
`;

const Modal = styled.div`
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  width: min(640px, 92vw);
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  z-index: 60;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  .close {
    border: none;
    background: transparent;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
  }
`;

const ModalBody = styled.div`
  padding: 12px 16px;
  dl {
    margin: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 10px;
    padding: 6px 0;
  }
  dt {
    color: #64748b;
  }
  dd {
    margin: 0;
  }
  .content-item {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  .content-item .type {
    color: #334155;
    font-weight: 600;
  }
  .content-item .name {
    color: #111827;
  }

  @media (max-width: 630px) {
    .row {
      grid-template-columns: 96px 1fr;
    }
  }
`;

const ModalFooter = styled.div`
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  button {
    background: #111827;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
  }
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

const ErrorMsg = styled.div`
  font-weight: 700;
`;

// ========== Timetable Grid ========== //

function TimetableGrid({ data, anchorMondayISO }) {
  // Build week view state
  const allDates = Object.keys(data).sort();
  const weekStart = anchorMondayISO
    ? new Date(anchorMondayISO)
    : getMonday(new Date(allDates[0]));
  const weekDates = Array.from({ length: 5 }, (_, i) =>
    iso(addDays(weekStart, i))
  );
  // Current user (to display name/username in modal)
  const { user } = useUser();

  // Modal state for lesson details
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null); // { lesson: L, date: iso }
  function openLesson(lesson, dateISO) {
    setSelected({ lesson, date: dateISO });
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
    setSelected(null);
  }
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Pre-extract per-day lessons for the week and detect holidays
  const perDay = new Map();
  const holidays = new Map();
  for (const d of weekDates) {
    const dayNode = data[d];
    perDay.set(d, dayNode ? collectLessons(dayNode) : []);
    holidays.set(d, dayNode ? detectHoliday(dayNode) : false);
  }

  // Fixed school hours 1..11
  const hours = Array.from({ length: 11 }, (_, i) => i + 1);

  return (
    <>
      <GridWrap>
        <Grid>
          {/* Header row */}
          <div className="corner" style={{ gridColumn: 1, gridRow: 1 }} />
          {weekDates.map((d, idx) => (
            <div
              key={d}
              className="day-header"
              style={{ gridColumn: idx + 2, gridRow: 1 }}
            >
              <span className="dow">{formatDowShort(d)}</span>
              <span className="date">{formatDayMonth(d)}</span>
            </div>
          ))}

          {/* Hour labels */}
          {hours.map((h) => (
            <div
              key={"h-" + h}
              className="hour-label"
              style={{ gridColumn: 1, gridRow: h + 1 }}
            >
              {h}
            </div>
          ))}

          {/* Lesson cards */}
          {weekDates.map((d, idx) => {
            const lessons = perDay.get(d) || [];
            const isHoliday = holidays.get(d);
            if (isHoliday && lessons.length === 0) {
              return (
                <div
                  key={`${d}-holiday`}
                  className="holiday-card"
                  style={{ gridColumn: idx + 2, gridRow: `2 / span 11` }}
                  title="Holiday"
                  role="status"
                >
                  {/* Confetti bits */}
                  {Array.from({ length: 14 }).map((_, i) => (
                    <span key={i} className={`confetti c${i}`} />
                  ))}
                  <div className="holiday-inner">
                    <span className="sparkle">Ferien</span>
                    <span className="emoji">🎉</span>
                  </div>
                </div>
              );
            }
            return lessons.map((L, i) => {
              const startRow = (L.hour ?? 1) + 1; // +1 because row 1 is header
              const span = (L.toHour ?? L.hour) - (L.hour ?? 1) + 1;
              const subject = L.subject?.name ?? "";
              const room = L.rooms?.[0]?.name;
              const teachers = (L.teachers || [])
                .map((t) => t.lastName)
                .filter(Boolean)
                .join(", ");
              const hwItems = Array.isArray(L.homeworkExams)
                ? L.homeworkExams
                : [];
              const hasHomework = hwItems.some((h) => {
                const typeName = String(h?.typeName || "");
                if (typeName === "Hausaufgabe") return true;
                // Fallback heuristics if typeName missing
                const type = String(h?.type || h?.kind || "").toLowerCase();
                const name = String(h?.name || "").toLowerCase();
                return (
                  type.includes("home") ||
                  type.includes("hw") ||
                  name.includes("home") ||
                  name.includes("hausaufgabe") ||
                  name.includes("ha ")
                );
              });
              const hasAnyMark = hwItems.length > 0;
              return (
                <div
                  key={`${d}-${i}`}
                  className="card"
                  style={{
                    gridColumn: idx + 2,
                    gridRow: `${startRow} / span ${span}`,
                  }}
                  data-subject={subject?.toLowerCase()}
                  title={subject}
                  role="button"
                  tabIndex={0}
                  onClick={() => openLesson(L, d)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openLesson(L, d);
                  }}
                >
                  {hasAnyMark && (
                    <span
                      className={`mark ${hasHomework ? "homework" : "exam"}`}
                      title={
                        hwItems[0]?.name || (hasHomework ? "Homework" : "Exam")
                      }
                    />
                  )}
                  <div className="line1">
                    <span className="subject">{subject || "—"}</span>
                  </div>
                  {room && (
                    <div className="line2">
                      <span className="room">{room}</span>
                    </div>
                  )}
                  {teachers && <div className="line3">{teachers}</div>}
                </div>
              );
            });
          })}
        </Grid>
      </GridWrap>

      {open && selected && (
        <>
          <Backdrop onClick={closeModal} />
          <Modal role="dialog" aria-modal="true" aria-labelledby="lessonTitle">
            <ModalHeader>
              <h3 id="lessonTitle">
                {selected.lesson?.subject?.name || "Lesson"}
              </h3>
              <button className="close" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </ModalHeader>
            <ModalBody>
              <dl>
                <div className="row">
                  <dt>Datum</dt>
                  <dd>
                    {formatDayMonth(selected.date)} (
                    {formatDowShort(selected.date)})
                  </dd>
                </div>
                <div className="row">
                  <dt>Stunde</dt>
                  <dd>
                    {selected.lesson.hour}
                    {selected.lesson.toHour &&
                    selected.lesson.toHour !== selected.lesson.hour
                      ? `–${selected.lesson.toHour}`
                      : ""}
                  </dd>
                </div>
                <div className="row">
                  <dt>Zeit</dt>
                  <dd>
                    {selected.lesson.timeStartObject?.text}
                    {selected.lesson.timeEndObject?.text
                      ? `–${selected.lesson.timeEndObject.text}`
                      : ""}
                  </dd>
                </div>
                {(selected.lesson.teachers?.length ?? 0) > 0 && (
                  <div className="row">
                    <dt>Lehrer</dt>
                    <dd>
                      {selected.lesson.teachers
                        .map((t) => t.lastName)
                        .filter(Boolean)
                        .join(", ")}
                    </dd>
                  </div>
                )}
                {(selected.lesson.rooms?.length ?? 0) > 0 && (
                  <div className="row">
                    <dt>Raum</dt>
                    <dd>{selected.lesson.rooms?.[0]?.name}</dd>
                  </div>
                )}
                {Array.isArray(selected.lesson.lessonContents) &&
                  selected.lesson.lessonContents.length > 0 && (
                    <div className="row">
                      <dt>Material</dt>
                      <dd>
                        {selected.lesson.lessonContents
                          .map((c) => c.name)
                          .filter(Boolean)
                          .join(", ")}
                      </dd>
                    </div>
                  )}
                {Array.isArray(selected.lesson.homeworkExams) &&
                  selected.lesson.homeworkExams.length > 0 && (
                    <div className="row">
                      <dt>Test/HA</dt>
                      <dd>
                        {selected.lesson.homeworkExams.map((h, idx) => (
                          <div key={idx}>{h.name}</div>
                        ))}
                      </dd>
                    </div>
                  )}
              </dl>
            </ModalBody>
            <ModalFooter>
              <button onClick={closeModal}>Schließen</button>
            </ModalFooter>
          </Modal>
        </>
      )}
    </>
  );
}

// TimetableCell removed; grid layout places cards directly as grid items

function collectLessons(node) {
  const out = [];
  walk(node, (entry) => out.push(entry));
  // sort by start hour
  out.sort((a, b) => (a.hour || 0) - (b.hour || 0));
  // merge overlapping/adjacent blocks to form proper multi-hour spans
  const merged = [];
  for (const L of out) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...L });
      continue;
    }

    const lastEnd = last.toHour ?? last.hour;
    const currEnd = L.toHour ?? L.hour;
    const subjectsMatch =
      (last.subject?.name || "") === (L.subject?.name || "");
    const hasSubjectContinuation =
      !L.subject?.name || !last.subject?.name || subjectsMatch;
    const overlapsOrAdjacent =
      L.hour <= lastEnd + 1 && currEnd >= last.hour - 1; // overlap or touch

    if (hasSubjectContinuation && overlapsOrAdjacent) {
      // extend the previous block
      if (!last.subject && L.subject) last.subject = L.subject;
      if ((!last.rooms || last.rooms.length === 0) && L.rooms?.length)
        last.rooms = L.rooms;
      if ((!last.teachers || last.teachers.length === 0) && L.teachers?.length)
        last.teachers = L.teachers;
      if (
        (!last.homeworkExams || last.homeworkExams.length === 0) &&
        L.homeworkExams?.length
      )
        last.homeworkExams = L.homeworkExams;
      last.toHour = Math.max(lastEnd, currEnd);
      // preserve the later end time metadata
      if (
        (L.timeEndObject?.text || "") &&
        (!last.timeEndObject?.text || currEnd >= lastEnd)
      ) {
        last.timeEndObject = L.timeEndObject;
      }
      // also keep the earlier start if one had it
      if (!last.timeStartObject && L.timeStartObject)
        last.timeStartObject = L.timeStartObject;
    } else {
      merged.push({ ...L });
    }
  }
  return merged;
}

function walk(node, push) {
  if (!node) return;
  if (typeof node !== "object") return;
  // A leaf lesson object
  if (node.isLesson === 1 && node.lesson) {
    const L = node.lesson;
    push({
      hour: L.hour,
      toHour: L.toHour,
      subject: L.subject,
      teachers: L.teachers,
      rooms: L.rooms,
      homeworkExams: L.homeworkExams,
      lessonContents: L.lessonContents,
      timeStartObject: L.timeStartObject,
      timeEndObject: L.timeEndObject,
    });
    return;
  }
  // Otherwise descend
  for (const k of Object.keys(node)) {
    walk(node[k], push);
  }
}

function formatDowShort(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}
function formatDayMonth(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "numeric" });
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  // e.g., 06.10.2025
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function iso(date) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  return addDays(d, diff);
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const HeaderBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
`;

const Controls = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 4px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.04);
`;

const NavButton = styled.button`
  appearance: none;
  background: #f8fafc;
  border: 1px solid var(--border);
  color: #0f172a;
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.05s;
  &:hover {
    background: #f1f5f9;
  }
  &:active {
    transform: translateY(1px);
  }
`;

const DateInput = styled.input`
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-size: 0.95rem;
  line-height: 34px;
  transition: border-color 0.15s, box-shadow 0.15s;
  &:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
`;

// Stress bar styles
const StressWrap = styled.section`
  margin-top: 14px;
  margin-bottom: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
  .title {
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 6px;
    letter-spacing: 0.2px;
    font-size: 1.2rem;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .counters {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.85rem;
    border: 1px solid var(--border);
    background: #f8fafc;
    color: #0f172a;
  }
  .pill.hw {
    border-color: #93c5fd;
    background: #eff6ff;
    color: #1e3a8a;
  }
  .pill.exam {
    border-color: #fbbf24;
    background: #fffbeb;
    color: #92400e;
  }
  .pill.total {
    border-color: #e5e7eb;
    background: #f9fafb;
    color: #111827;
  }
  .progress {
    position: relative;
    height: 14px;
    border-radius: 999px;
    background: #f1f5f9;
    border: 1px solid #e5e7eb;
    overflow: hidden;
  }
  .bar {
    height: 100%;
    transition: width 0.25s ease, background-color 0.25s ease;
    background: #22c55e; /* default green */
  }
  /* Color ramp by level 0..10 */
  .bar.lvl-0,
  .bar.lvl-1,
  .bar.lvl-2 {
    background: #22c55e;
  }
  .bar.lvl-3,
  .bar.lvl-4 {
    background: #84cc16;
  }
  .bar.lvl-5,
  .bar.lvl-6 {
    background: #f59e0b;
  }
  .bar.lvl-7,
  .bar.lvl-8 {
    background: #f97316;
  }
  .bar.lvl-9,
  .bar.lvl-10 {
    background: #ef4444;
  }
`;

const TopControls = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
  align-items: center;
  button {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px 8px;
    cursor: pointer;
  }
  input[type="date"] {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px 8px;
  }
`;

const GridWrap = styled.div`
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #f1f5f9; /* light blue-ish */
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  -webkit-overflow-scrolling: touch;

  @media (max-width: 768px) {
    border-radius: 10px;
  }
  @media (max-width: 630px) {
    border-radius: 0;
    width: 100vw;
    margin-left: calc(50% - 50vw); /* break out of container to full width */
    height: calc(100vh - 120px); /* fill screen minus header/controls */
    overflow: hidden; /* no scrolling */
  }
`;

const Grid = styled.div`
  /* Columns: 1 for hour labels + 5 for days */
  display: grid;
  grid-template-columns: 58px repeat(5, minmax(120px, 1fr));
  grid-template-rows: 28px repeat(11, 50px);
  gap: 6px;
  padding: 6px;

  .day-header {
    display: flex;
    gap: 6px;
    align-items: baseline;
    padding: 4px 2px;
    font-weight: 600;
    color: #0f172a;
  }
  .day-header .date {
    color: #64748b;
    font-weight: 500;
  }

  .hour-label {
    text-align: right;
    padding: 4px 2px;
    color: #64748b;
    font-weight: 600;
    font-size: 0.8rem;
  }

  .card {
    position: relative;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 5px 7px 5px 9px;
    background: #ffffff;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.07);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .card .mark {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
  }
  .card .mark.exam {
    background: #ef4444; /* red for exam */
  }
  .card .mark.homework {
    background: #3b82f6; /* blue for homework */
  }
  .card .line1 {
    display: block;
  }
  .card .subject {
    font-weight: 700;
    color: #111827;
    font-size: clamp(0.76rem, 2.6vw, 0.85rem);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card .room {
    background: #eef2ff;
    color: #1e40af;
    border: 1px solid #e0e7ff;
    border-radius: 6px;
    padding: 1px 5px;
    display: inline-block;
    font-size: 0.68rem;
    white-space: nowrap;
  }
  .card .line2 {
    margin-top: 3px;
  }
  /* Holiday full-column card */
  .holiday-card {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed #60a5fa;
    border-radius: 12px;
    background: linear-gradient(180deg, #eff6ff, #ffffff);
    color: #1e3a8a;
    box-shadow: inset 0 0 0 3px rgba(59, 130, 246, 0.08);
    position: relative;
    overflow: hidden;
  }
  .holiday-card .holiday-inner {
    font-weight: 800;
    font-size: clamp(1rem, 2.8vw, 1.2rem);
    letter-spacing: 0.3px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    animation: shimmer 2.2s linear infinite;
    background: linear-gradient(90deg, #1e3a8a, #3b82f6, #1e3a8a);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .holiday-card .emoji {
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1));
  }
  .holiday-card .confetti {
    position: absolute;
    top: -10px;
    width: 8px;
    height: 12px;
    opacity: 0.85;
    animation: fall 3.2s linear infinite;
  }
  /* Spread confetti across card */
  ${Array.from({ length: 14 })
    .map(
      (_, i) => `
    .holiday-card .c${i} {
      left: ${Math.round((i + 1) * (100 / 15))}%;
      background: hsl(${(i * 40) % 360} 90% 60%);
      transform: rotate(${(i * 23) % 360}deg);
      animation-delay: ${(i * 0.12).toFixed(2)}s;
    }
  `
    )
    .join("\n")}
  @keyframes fall {
    0% {
      transform: translateY(-10px) rotate(0deg);
    }
    100% {
      transform: translateY(120%) rotate(360deg);
    }
  }
  @keyframes shimmer {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: 200% 50%;
    }
  }
  .card .line3 {
    margin-top: 2px;
    color: #6b7280;
    font-size: 0.72rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Responsive tweaks */
  @media (max-width: 768px) {
    grid-template-columns: 44px repeat(5, minmax(92px, 1fr));
    grid-template-rows: 28px repeat(11, 1fr);
    gap: 6px;
    padding: 6px;
    .hour-label {
      font-size: 0.8rem;
    }
    .card {
      padding: 5px 6px 5px 8px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
    }
    .card .subject {
      font-size: clamp(0.72rem, 2.8vw, 0.82rem);
    }
    .card .line3 {
      font-size: 0.7rem;
    }
  }
  @media (max-width: 630px) {
    /* Fit all columns and rows into viewport without scroll */
    grid-template-columns: 28px repeat(5, 1fr);
    grid-template-rows: 20px repeat(11, 1fr);
    gap: 2px;
    padding: 2px;
    .hour-label {
      font-size: 0.7rem;
    }
    .day-header {
      font-size: 0.8rem;
    }
    .card {
      padding: 4px 5px;
      border-radius: 6px;
    }
    .card .subject {
      font-size: clamp(0.66rem, 3.2vw, 0.78rem);
    }
    .card .room {
      font-size: 0.6rem;
      padding: 1px 4px;
    }
    .card .line3 {
      display: none;
    }
  }
`;
