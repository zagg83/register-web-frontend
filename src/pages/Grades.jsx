import styled from "styled-components";
import { useEffect, useRef, useState } from "react";
import { useUser } from "../context/UserContext";
import Chart from "chart.js/auto";

export default function Grades() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]); // normalized subjects
  const [openIds, setOpenIds] = useState(() => new Set());
  const [summary, setSummary] = useState({
    averageSemester: "-",
    averageYear: "-",
    negativeSubjectsSemester: "-",
    negativeSubjectsYear: "-",
  });

  useEffect(() => {
    if (!user) return;
    let aborted = false;
    async function fetchGrades() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/grades", {
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
          const normalized = normalizeGrades(data);
          setItems(normalized);
          // Build a flat array of all grades: { grade, subject, date }
          const allGrades = buildFlatGrades(normalized);
          console.log("All grades (flat):", allGrades);
          // capture top-level summary if present
          setSummary({
            averageSemester: data?.averageSemester ?? "-",
            averageYear: data?.averageYear ?? "-",
            negativeSubjectsSemester: data?.negativeSubjectsSemester ?? "-",
            negativeSubjectsYear: data?.negativeSubjectsYear ?? "-",
          });
          // start collapsed; user expands subjects manually
        }
      } catch (e) {
        console.error("Fetching grades failed:", e);
        if (!aborted) {
          setError("Failed to load grades");
          setItems([]);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    const t = setTimeout(fetchGrades, 80);
    return () => {
      aborted = true;
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy();
        } catch {}
        chartInstanceRef.current = null;
      }
      clearTimeout(t);
    };
  }, [user]);

  // items is already an array of subjects with entries
  const subjects = items;

  // --- Chart.js refs/state
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const subjectChartRefs = useRef(new Map()); // Map of subjectId -> chart instance

  // Create/update chart after items change and canvas is mounted
  useEffect(() => {
    if (!chartCanvasRef.current) return;
    if (!Array.isArray(items) || items.length === 0) {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy();
        } catch {}
        chartInstanceRef.current = null;
      }
      return;
    }
    const { labels, data, yMin, yMax, ticks } = buildAverageSeries(items);
    if (!data.length) {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy();
        } catch {}
        chartInstanceRef.current = null;
      }
      return;
    }
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }
    const canvas = chartCanvasRef.current;
    // Ensure the canvas has explicit width/height for Chart.js sizing
    if (!canvas.width || !canvas.height) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(300, Math.floor(rect.width));
      canvas.height = Math.max(150, Math.floor(rect.height));
    }
    const ctx = canvas.getContext("2d");
    const manyPoints = data.length > 200;
    chartInstanceRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Cumulative average",
            data,
            tension: 0.25,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, .15)",
            pointRadius: manyPoints ? 0 : 2,
            pointHitRadius: manyPoints ? 4 : 6,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: manyPoints ? false : undefined,
        parsing: true,
        normalized: true,
        scales: {
          x: { title: { display: true, text: "Date" } },
          y: {
            title: { display: true, text: "Average" },
            min: yMin,
            max: yMax,
            ticks: {
              stepSize: ticks.length > 6 ? 1 : 0.5,
              callback: function (value) {
                return ticks.includes(value) ? value : "";
              },
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true },
          // decimation disabled for label-based datasets
          decimation: { enabled: false },
        },
        datasets: {
          line: {
            segment: { borderWidth: 2 },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy();
        } catch {}
        chartInstanceRef.current = null;
      }
    };
  }, [items]);

  return (
    <Main className="container content">
      <Header>
        <h1>Grades</h1>
        <p>Your latest grades grouped by subject</p>
      </Header>
      <SummaryBar>
        <div className="pill primary">
          <span className="label">Semester Avg</span>
          <span className="val">{summary.averageSemester}</span>
        </div>
        <div className="pill">
          <span className="label">Year Avg</span>
          <span className="val">{summary.averageYear}</span>
        </div>
        <div className="pill warn" title="Negative subjects this semester">
          <span className="label">Neg. (Sem)</span>
          <span className="val">{summary.negativeSubjectsSemester}</span>
        </div>
        <div className="pill warn" title="Negative subjects this year">
          <span className="label">Neg. (Year)</span>
          <span className="val">{summary.negativeSubjectsYear}</span>
        </div>
        <div className="pill muted">
          <span className="label">Subjects</span>
          <span className="val">{items.length}</span>
        </div>
      </SummaryBar>
      {error && <Error role="alert">{error}</Error>}
      {loading ? (
        <Loading>Loading…</Loading>
      ) : items.length === 0 ? (
        <Empty>No grades found.</Empty>
      ) : (
        <List>
          {subjects.map((s) => {
            const key = s.subjectId ?? s.subject;
            const open = openIds.has(key);
            const avgNum = getAvgNumber(s.averageSemester, s.entries);
            const risky = Number.isFinite(avgNum) && avgNum < 6;
            return (
              <SubjectCard
                key={key}
                data-open={open ? "true" : undefined}
                data-risk={risky ? "true" : undefined}
                style={{ "--collapsed-height": "72px" }}
              >
                <button
                  type="button"
                  className="headBtn"
                  onClick={() =>
                    setOpenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  aria-expanded={open}
                  title={open ? "Collapse" : "Expand"}
                >
                  <span className="subject">{s.subject}</span>
                  <span className="spacer" />
                  <span
                    className={`avg ${risky ? "warn" : ""}`}
                    title={`Semester avg`}
                  >
                    Avg: {displayAvg(s.averageSemester, s.entries)}
                  </span>
                  {risky && (
                    <span
                      className="riskBadge"
                      title="Average below passing threshold"
                    >
                      ⚠️
                    </span>
                  )}
                  <span className={`chev ${open ? "open" : ""}`} aria-hidden>
                    ▾
                  </span>
                </button>
                {open && (
                  <div
                    className="details"
                    style={{
                      height: open ? "auto" : "0px",
                      overflow: open ? "visible" : "hidden",
                    }}
                  >
                    {/* Subject mini chart */}
                    {s.entries.length > 0 && (
                      <SubjectChart
                        subject={s}
                        chartRefs={subjectChartRefs}
                        isOpen={open}
                      />
                    )}
                    <ul className="rows">
                      {s.entries.length === 0 ? (
                        <li className="row">
                          <span className="title">No grades yet</span>
                        </li>
                      ) : (
                        s.entries.map((e, idx) => (
                          <li key={e.id ?? idx} className="row">
                            <span className={`grade g-${gradeBand(e.grade)}`}>
                              {displayGrade(e.grade)}
                            </span>
                            <span className="title">
                              {e.title || e.type || "—"}
                            </span>
                            {typeof e.weight === "number" && (
                              <span className="weight" title="Gewichtung in %">
                                {e.weight.toFixed(e.weight % 1 ? 1 : 0)}%
                              </span>
                            )}
                            <span className="date">{formatDate(e.date)}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </SubjectCard>
            );
          })}
        </List>
      )}
      {/* Average over time chart */}
      {!loading && items.length > 0 && (
        <ChartCard>
          <h2>Average over time</h2>
          <div className="chartWrap">
            <canvas ref={chartCanvasRef} />
          </div>
        </ChartCard>
      )}
    </Main>
  );
}
function normalizeGrades(data) {
  if (!data) return [];
  // Already normalized
  if (Array.isArray(data)) return data;
  // API shape with { subjects: [...] }
  if (Array.isArray(data.subjects)) {
    const toNum = (v) => {
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : NaN;
    };
    return data.subjects.map((s) => {
      const subjectName =
        s.subject?.name || s.subjectName || s.name || "(Unknown)";
      const subjectId = s.subjectId ?? s.subject?.id;
      const entries = (s.grades || [])
        .map((g) => mapGradeEntry(g))
        .sort(sortByDateDesc);
      const avgSem = toNum(s.averageSemester);
      const avgYear = toNum(s.averageYear);
      return {
        subject: subjectName,
        subjectId,
        averageSemester: Number.isFinite(avgSem) ? avgSem : "-",
        averageYear: Number.isFinite(avgYear) ? avgYear : "-",
        entries,
      };
    });
  }
  return [];
}

// Subject mini chart component
function SubjectChart({ subject, chartRefs, isOpen }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    // Build data for this subject
    const entries = subject.entries || [];
    const validEntries = entries
      .filter((e) => e.date && e.grade)
      .map((e) => ({ ...e, n: toNumber(e.grade) }))
      .filter((e) => Number.isFinite(e.n))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (validEntries.length === 0) return;

    const labels = validEntries.map(() => "");
    const data = validEntries.map((e) => e.n);

    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    // Create new chart
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(200, Math.floor(rect.width));
    canvas.height = Math.max(80, Math.floor(rect.height));

    const ctx = canvas.getContext("2d");
    chartInstanceRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: subject.subject,
            data,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.1)",
            tension: 0.25,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            display: false,
          },
          y: {
            display: true,
            title: { display: false },
            min: 4,
            max: 10,
            ticks: { maxTicksLimit: 4 },
          },
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Grade Progress",
            font: {
              size: 12,
              weight: "bold",
            },
            color: "#64748b",
            padding: 8,
          },
          tooltip: {
            enabled: true,
            callbacks: {
              title: (context) => `${subject.subject}`,
              label: (context) => {
                const entry = validEntries[context.dataIndex];
                return `Grade: ${context.parsed.y} (${formatDate(entry.date)})`;
              },
            },
          },
        },
        elements: {
          point: {
            hoverBackgroundColor: "#2563eb",
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [isOpen, subject]);

  if (!isOpen) return null;

  return (
    <SubjectChartWrapper>
      <div className="chartWrap">
        <canvas ref={canvasRef} />
      </div>
    </SubjectChartWrapper>
  );
}

// Compute cumulative average series from normalized subjects
function buildAverageSeries(subjects) {
  const all = buildFlatGrades(subjects)
    .filter((g) => g && g.date)
    .map((g) => ({ ...g, n: toNumber(g.grade) }))
    .filter((g) => Number.isFinite(g.n))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = [];
  const data = [];
  let sum = 0;
  let count = 0;
  for (const g of all) {
    sum += g.n;
    count += 1;
    labels.push(formatDate(g.date));
    data.push(Number((sum / count).toFixed(2)));
  }

  // Calculate dynamic Y-axis range
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal;
  const padding = Math.max(0.5, range * 0.1); // 10% padding or minimum 0.5

  const yMin = Math.max(1, Math.floor(minVal - padding));
  const yMax = Math.min(10, Math.ceil(maxVal + padding));

  // Generate appropriate tick marks
  const tickStep = yMax - yMin <= 2 ? 0.5 : 1;
  const ticks = [];
  for (let i = yMin; i <= yMax; i += tickStep) {
    ticks.push(Number(i.toFixed(1)));
  }

  return { labels, data, yMin, yMax, ticks };
}
function mapGradeEntry(it) {
  if (!it) return {};
  const grade = it.grade ?? it.value ?? it.mark ?? it.score ?? null;
  const date =
    it.date || it.dateGiven || it.createdAt || it.time || it.timestamp || null;
  const title =
    it.title ||
    it.description ||
    it.exam ||
    it.kind ||
    it.category ||
    it.type ||
    "";
  const rawW =
    it.weight ??
    it.weighting ??
    it.percentage ??
    it.weightPercent ??
    it.weight_percentage ??
    it.faktor ??
    null;
  const weight = normalizeWeight(rawW);
  return { id: it.id, grade, date, title, type: it.type, weight };
}

function normalizeWeight(v) {
  if (v == null || v === "") return null;
  let n = Number(String(v).replace(",", "."));
  if (!isFinite(n)) return null;
  // If 0..1 assume fraction, convert to percent
  if (n > 0 && n <= 1) n = n * 100;
  // Clamp to sensible range
  if (n < 0) n = 0;
  if (n > 1000) return null; // unlikely
  return Math.round(n * 100) / 100; // keep 2 decimals
}

function sortByDateDesc(a, b) {
  return new Date(b.date || 0) - new Date(a.date || 0);
}

function groupBySubject(items) {
  const map = new Map();
  for (const it of items) {
    const key = it.subject || "(Unknown)";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  const groups = [];
  for (const [subject, entries] of map.entries()) {
    const nums = entries
      .map((e) => toNumber(e.grade))
      .filter((n) => isFinite(n));
    const avg = nums.length
      ? nums.reduce((a, b) => a + b, 0) / nums.length
      : NaN;
    groups.push({ subject, avg, entries: entries.sort(sortByDateDesc) });
  }
  groups.sort((a, b) => a.subject.localeCompare(b.subject));
  return groups;
}
function toNumber(v) {
  if (v == null) return NaN;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? NaN : n;
}

function displayGrade(v) {
  if (v == null || v === "") return "-";
  return String(v);
}

function displayAvg(avgField, entries) {
  if (avgField && avgField !== "-" && isFinite(Number(avgField))) {
    const n = Number(avgField);
    return isFinite(n) ? n.toFixed(2) : "-";
  }
  const nums = entries.map((e) => toNumber(e.grade)).filter((n) => isFinite(n));
  if (!nums.length) return "-";
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return avg.toFixed(2);
}

function getAvgNumber(avgField, entries) {
  if (avgField && avgField !== "-" && isFinite(Number(avgField))) {
    const n = Number(avgField);
    return isFinite(n) ? n : NaN;
  }
  const nums = entries.map((e) => toNumber(e.grade)).filter((n) => isFinite(n));
  if (!nums.length) return NaN;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function gradeBand(v) {
  const n = toNumber(v);
  if (!isFinite(n)) return "na";
  if (n >= 9) return "a";
  if (n >= 7) return "b";
  if (n >= 6) return "c";
  if (n >= 4) return "d";
  return "e";
}

function formatDate(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    // Return ISO yyyy-mm-dd so Chart.js treats x as categorical in order
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${m}-${day}`;
  } catch {
    return d;
  }
}

// Build a flat list of all grades across subjects: [{ grade, subject, date }]
function buildFlatGrades(subjects) {
  if (!Array.isArray(subjects)) return [];
  const out = [];
  for (const s of subjects) {
    const subj = s?.subject ?? "(Unknown)";
    const entries = Array.isArray(s?.entries) ? s.entries : [];
    for (const e of entries) {
      out.push({
        grade: e?.grade ?? null,
        subject: subj,
        date: e?.date ?? null,
      });
    }
  }
  return out;
}

const Main = styled.main`
  /* Base color across whole page with a soft top fade */
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.7) 0px,
      rgba(255, 255, 255, 0) 160px
    ),
    #f8fafc;
  min-height: 100vh;
  padding-bottom: 16px;
`;

const Header = styled.div`
  margin-bottom: 12px;
  h1 {
    margin: 0 0 4px 0;
  }
  p {
    margin: 0;
    color: var(--muted);
  }
`;

const SummaryBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  padding: 6px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #f3f4f6;
    color: #0f172a;
    border: 1px solid #e5e7eb;
    font-size: 0.92rem;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }
  .pill:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 14px rgba(2, 6, 23, 0.06);
  }
  .pill.primary {
    background: #eff6ff;
    color: #1e40af;
    border-color: #dbeafe;
  }
  .pill.warn {
    background: #fef2f2;
    color: #b91c1c;
    border-color: #fee2e2;
  }
  .pill.muted {
    background: #f9fafb;
    color: #334155;
  }
  .label {
    color: #64748b;
    font-weight: 600;
  }
  .val {
    font-weight: 800;
  }
`;

const Error = styled.div`
  color: #b91c1c;
  font-weight: 700;
  margin-bottom: 8px;
`;

const Loading = styled.div`
  color: var(--muted);
`;

const Empty = styled.div`
  color: var(--muted);
`;

const List = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  align-items: start; /* prevent cards from stretching to tallest row item */
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`;

const SubjectCard = styled.section`
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  padding: 6px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
  min-height: 48px; /* uniform collapsed height */
  display: flex;
  flex-direction: column;
  align-self: start; /* keep each card at its content height */
  position: relative;
  transition: box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease;
  &:before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    border-radius: 12px 12px 0 0;
    background: linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6);
    opacity: 0.7;
  }
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgba(2, 6, 23, 0.08);
  }
  &[data-risk="true"] {
    border-color: #fecaca;
    background: #fff7f7;
  }
  .headBtn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 0;
    cursor: pointer;
    padding: 8px 8px;
    border-radius: 10px;
    transition: background-color 120ms ease;
    flex-wrap: nowrap;
    min-width: 0; /* allow subject to truncate */
  }
  .headBtn:hover {
    background: #f8fafc;
  }
  .subject {
    font-weight: 800;
    color: #0f172a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .spacer { flex: 1 1 auto; }
  .avg {
    font-weight: 800;
    background: #2563eb;
    color: #ffffff;
    border: 1px solid #1d4ed8;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.85rem;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  }
  .avg.warn {
    background: #dc2626;
    color: #ffffff;
    border-color: #b91c1c;
    box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
  }
  .riskBadge {
    margin-left: 4px;
  }
  .chev { color:#64748b; transition: transform .15s ease, background-color .15s ease; margin-left: 4px; background:#eef2f7; border-radius:8px; padding:0 4px; }
  .chev.open { transform: rotate(180deg); }
  .details { padding: 6px 4px 8px; }
  .rows {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    display: grid;
    grid-template-columns: 36px 1fr auto auto;
    align-items: center;
    gap: 4px;
    padding: 4px 4px;
    border-radius: 8px;
    transition: background-color 120ms ease;
    min-width: 0;
  }
  .row:hover { background:#f8fafc; }
  }
  .grade {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    padding: 2px 0;
    border-radius: 6px;
    font-weight: 700;
    border: 1px solid transparent;
    box-shadow: inset 0 -1px 0 rgba(0,0,0,0.06);
  }
  .g-a {
    background: #ecfdf5;
    color: #065f46;
    border-color: #d1fae5;
  }
  .g-b {
    background: #eff6ff;
    color: #1e40af;
    border-color: #dbeafe;
  }
  .g-c {
    background: #fffbeb;
    color: #92400e;
    border-color: #fef3c7;
  }
  .g-d {
    background: #fef2f2;
    color: #b91c1c;
    border-color: #fee2e2;
  }
  .g-e {
    background: #f3f4f6;
    color: #1f2937;
    border-color: #e5e7eb;
  }
  .g-na {
    background: #f3f4f6;
    color: #6b7280;
    border-color: #e5e7eb;
  }
  .title {
    font-size: 0.9rem;
    color: #111827;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .date {
    color: #64748b;
    font-size: 0.8rem;
  }
  .weight {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    padding: 1px 6px;
    font-size: 0.75rem;
    white-space: nowrap;
    flex-shrink: 0;
  }
  @media (max-width: 640px) {
    padding: 6px;
    min-height: 52px;
    .subject { font-size: 0.98rem; }
    .avg { font-size: 0.8rem; padding: 1px 6px; }
    .row { grid-template-columns: 36px 1fr auto; }
    .grade { width: 34px; padding: 2px 0; }
    .date { display: none; }
  }
`;

const ChartCard = styled.section`
  margin-top: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  padding: 10px 10px 6px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
  h2 {
    margin: 0 0 6px 2px;
    font-size: 1rem;
    color: #0f172a;
  }
  .chartWrap {
    position: relative;
    height: 220px;
    width: 100%;
  }
  .chartWrap canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
`;

const SubjectChartWrapper = styled.div`
  margin-bottom: 8px;
  .chartWrap {
    position: relative;
    height: 160px;
    width: 100%;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f8fafc;
    padding: 4px;
  }
  .chartWrap canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
`;
