import styled from "styled-components";
import { useState } from "react";

// days: Array<{ date: 'YYYY-MM-DD', items: any[] }>
export default function Calendar({
  days = [],
  onAddReminder,
  onDeleteReminder,
}) {
  const sorted = [...days].sort((a, b) => new Date(a.date) - new Date(b.date));
  const [editor, setEditor] = useState({ date: null, text: "" });

  return (
    <Wrap>
      <Legend>
        <LegendItem>
          <LegendDot $type="gradeGroup" /> Exam/Test
        </LegendItem>
        <LegendItem>
          <LegendDot $type="homework" /> Homework
        </LegendItem>
        <LegendItem>
          <LegendDot $type="reminder" /> Reminder (Erinnerung)
        </LegendItem>
        <LegendItem>
          <LegendDot $type="grade" /> Grade
        </LegendItem>
      </Legend>
      <Grid role="grid">
        {sorted.map((d) => {
          const info = summarize(d.items);
          return (
            <DayCard
              key={d.date}
              role="gridcell"
              $active={d.items?.length > 0}
              $today={isToday(d.date)}
            >
              <Header>
                <div>
                  <div className="dow">{formatDayOfWeekLong(d.date)}</div>
                  <div className="date">
                    <span className="dom">{formatDayOfMonth(d.date)}</span>
                    <span className="month">{formatMonthShort(d.date)}</span>
                  </div>
                </div>
                <Counts>
                  {info.total > 0 ? (
                    <>
                      {info.exam > 0 && (
                        <Badge $type="gradeGroup">{info.exam}</Badge>
                      )}
                      {info.homework > 0 && (
                        <Badge $type="homework">{info.homework}</Badge>
                      )}
                      {info.grade > 0 && (
                        <Badge $type="grade">{info.grade}</Badge>
                      )}
                    </>
                  ) : (
                    <Muted>No entries</Muted>
                  )}
                </Counts>
              </Header>
              {d.items?.length > 0 && (
                <ItemsList>
                  {d.items.slice(0, 4).map((it, idx) => {
                    const kind = inferKind(it);
                    const t = (it.title || "").toLowerCase();
                    const examTitle =
                      t.includes("schularbeit") ||
                      t.includes("test") ||
                      t.includes("prüfung") ||
                      t.includes("pruefung");
                    const styleType =
                      kind === "exam" || examTitle
                        ? "gradeGroup"
                        : kind === "homework"
                        ? "homework"
                        : kind === "reminder"
                        ? "reminder"
                        : kind === "grade"
                        ? "grade"
                        : undefined;
                    return (
                      <ItemRow
                        key={idx}
                        $type={styleType}
                        $exam={examTitle}
                        title={rowTitle(it)}
                      >
                        <div className="meta">
                          <span className="label">
                            {displayTypeByKind(kind)}
                          </span>
                          {it.deadlineFormatted && (
                            <span className="time">
                              {timePart(it.deadlineFormatted)}
                            </span>
                          )}
                          {it.label && (
                            <span className="subject">{it.label}</span>
                          )}
                        </div>
                        <div className="text">
                          <strong>{it.title}</strong>
                          {it.subtitle && (
                            <span className="sub">{it.subtitle}</span>
                          )}
                          {it.grade && (
                            <span className="grade">Grade {it.grade}</span>
                          )}
                        </div>
                        {onDeleteReminder &&
                          (kind === "reminder" || it.deleteable) && (
                            <RowActions>
                              <RowButton
                                type="button"
                                onClick={() => onDeleteReminder?.(it)}
                                aria-label="Delete reminder"
                                title="Delete reminder"
                              >
                                Delete
                              </RowButton>
                            </RowActions>
                          )}
                      </ItemRow>
                    );
                  })}
                  {d.items.length > 4 && (
                    <More>+{d.items.length - 4} more for this day</More>
                  )}
                </ItemsList>
              )}

              {onAddReminder && (
                <AddBox>
                  {editor.date === d.date ? (
                    <AddForm
                      onSubmit={(e) => {
                        e.preventDefault();
                        const payload = {
                          date: d.date,
                          text: editor.text.trim(),
                        };
                        if (!payload.text) return;
                        onAddReminder?.(payload);
                        setEditor({ date: null, text: "" });
                      }}
                    >
                      <input
                        className="input"
                        placeholder="Erinnerung…"
                        value={editor.text}
                        onChange={(e) =>
                          setEditor((s) => ({ ...s, text: e.target.value }))
                        }
                      />
                      <div className="actions">
                        <SmallBtn type="submit" className="btn btn-primary">
                          Save
                        </SmallBtn>
                        <SmallBtn
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setEditor({ date: null, text: "" })}
                        >
                          Cancel
                        </SmallBtn>
                      </div>
                    </AddForm>
                  ) : (
                    <AddRow>
                      <SmallBtn
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditor({ date: d.date, text: "" })}
                      >
                        + Add Erinnerung
                      </SmallBtn>
                    </AddRow>
                  )}
                </AddBox>
              )}
            </DayCard>
          );
        })}
      </Grid>
    </Wrap>
  );
}

function isToday(iso) {
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function formatDayOfWeekLong(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long" });
}
function formatDayOfMonth(iso) {
  const d = new Date(iso);
  return d.getDate();
}
function formatMonthShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function timePart(deadlineFormatted) {
  // Try to extract time like HH:MM from a string such as "Dienstag, 07.10.2025, 11:35"
  const match = deadlineFormatted.match(/(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

function displayType(type) {
  // Do NOT assume gradeGroup == Exam; backend often sets type=gradeGroup for various items
  if (type === "homework") return "Homework";
  if (type === "grade") return "Grade";
  // fallback label for everything else, including gradeGroup
  return "Item";
}

function rowTitle(it) {
  const bits = [it.title, it.subtitle, it.deadlineFormatted].filter(Boolean);
  if (it.grade) bits.push(`grade: ${it.grade}`);
  return bits.join(" — ");
}

function summarize(items = []) {
  let exam = 0,
    homework = 0,
    grade = 0;
  for (const it of items) {
    if (it?.type === "gradeGroup") exam++;
    else if (it?.type === "homework") homework++;
    else if (it?.type === "grade") grade++;
  }
  return { exam, homework, grade, total: items.length };
}

// Helpers for rendering rows with consistent labels and colors
function displayTypeByKind(kind) {
  if (kind === "exam") return "Exam";
  if (kind === "homework") return "Homework";
  if (kind === "reminder") return "Reminder";
  if (kind === "grade") return "Grade";
  return "Item";
}

function inferKind(it) {
  if (!it) return "item";
  if (it.type === "grade") return "grade";
  const title = (it.title || "").toLowerCase();
  const isExam =
    title.includes("schularbeit") ||
    title.includes("test") ||
    title.includes("prüfung") ||
    title.includes("pruefung");
  // Treat explicit Erinnerung as its own segment
  if (/erinnerung/.test(title)) return "reminder";
  const isHomework =
    it.type === "homework" || it.homework === 1 || /hausaufgabe/.test(title);
  if (isExam) return "exam";
  if (isHomework) return "homework";
  return "item";
}

const Wrap = styled.div`
  width: 100%;
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: 12px 16px;
  flex-wrap: wrap;
  margin: 8px 0 16px 0;
  color: var(--muted);
`;

const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
`;

const LegendDot = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  &::before {
    content: "";
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #e5e7eb;
    ${(p) => p.$type === "gradeGroup" && `background:#d97706;`}
    ${(p) => p.$type === "homework" && `background:#2563eb;`}
    ${(p) => p.$type === "grade" && `background:#059669;`}
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
`;

const DayCard = styled.div`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.1s;
  ${(p) =>
    p.$active &&
    `border-color: var(--primary); box-shadow: 0 8px 20px rgba(37,99,235,0.12);`}
  ${(p) =>
    p.$today && `outline: 2px dashed var(--primary); outline-offset: 4px;`}
  &:hover {
    transform: translateY(-1px);
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  .dow {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .date {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .dom {
    font-size: 1.5rem;
    font-weight: 700;
  }
  .month {
    color: var(--muted);
    font-size: 0.9rem;
  }
`;

const Counts = styled.div`
  display: inline-flex;
  gap: 6px;
  align-items: center;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  min-width: 24px;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.8rem;
  border: 1px solid transparent;
  background: #eef2ff;
  color: #1e40af;
  border-color: #e0e7ff;
  ${(p) =>
    p.$type === "gradeGroup" &&
    `background:#fffbeb;color:#92400e;border-color:#fef3c7;`}
  ${(p) =>
    p.$type === "homework" &&
    `background:#eff6ff;color:#1e3a8a;border-color:#dbeafe;`}
  ${(p) =>
    p.$type === "grade" &&
    `background:#ecfdf5;color:#065f46;border-color:#d1fae5;`}
`;

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ItemRow = styled.div`
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: #fff;
  ${(p) =>
    p.$type === "gradeGroup" && `border-color:#fbbf24; background:#fef3c7;`}
  ${(p) =>
    p.$type === "homework" && `border-color:#93c5fd; background:#e0f2fe;`}
  ${(p) => p.$type === "grade" && `border-color:#34d399; background:#ecfdf5;`}
  /* Stronger emphasis for explicit exam titles like Schularbeit or Test */
  ${(p) =>
    p.$exam &&
    `border-color:#f87171; background:#fef2f2; box-shadow: 0 0 0 2px rgba(239,68,68,0.12) inset;`}
  .meta {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 4px;
  }
  .label {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .time {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .subject {
    font-size: 0.75rem;
    color: #111827;
    font-weight: 600;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .text strong {
    font-weight: 600;
  }
  .sub {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .grade {
    color: #065f46;
    font-weight: 600;
    font-size: 0.85rem;
  }
  position: relative;
`;

const More = styled.div`
  color: var(--muted);
  font-size: 0.85rem;
`;

const Muted = styled.span`
  color: var(--muted);
  font-size: 0.9rem;
`;

const RowActions = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
`;

const RowButton = styled.button`
  appearance: none;
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 0.8rem;
  &:hover {
    background: #fecaca;
  }
`;

const AddBox = styled.div`
  margin-top: 10px;
`;

const AddRow = styled.div``;

const AddForm = styled.form`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  .actions {
    display: flex;
    gap: 8px;
  }
`;

const SmallBtn = styled.button`
  font-size: 0.9rem;
`;
