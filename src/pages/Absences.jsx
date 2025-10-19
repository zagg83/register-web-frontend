import { useEffect, useState } from "react";
import styled from "styled-components";
import { useUser } from "../context/UserContext";

export default function Absences() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [showPercInfo, setShowPercInfo] = useState(false);

  useEffect(() => {
    if (!user) return;
    let aborted = false;
    async function fetchAbsences() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/absences", {
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
        const json = await res.json();
        if (!aborted) setData(json);
      } catch (e) {
        if (!aborted) setError("Failed to load absences");
        console.error("Fetching absences failed:", e);
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    const t = setTimeout(fetchAbsences, 100);
    return () => {
      aborted = true;
      clearTimeout(t);
    };
  }, [user]);

  const groups = Array.isArray(data?.absences) ? data.absences : [];
  const stats = data?.statistics;
  const future = Array.isArray(data?.futureAbsences) ? data.futureAbsences : [];

  return (
    <Main className="container content">
      <Header>
        <div>
          <h1>Absences</h1>
          <p>Overview of your absences</p>
        </div>
      </Header>

      {error && <ErrorMsg role="alert">{error}</ErrorMsg>}
      {loading ? (
        <LoaderWrap>
          <Spinner />
          <span>Loading absences…</span>
        </LoaderWrap>
      ) : (
        <>
          {stats && (
            <Stats>
              <StatBox>
                <label>Total</label>
                <strong>{stats.counter}</strong>
              </StatBox>
              <StatBox data-high={Number(stats.percentage) > 25}>
                <label>
                  Percentage
                  {Number(stats.percentage) > 25 && (
                    <span className="infoWrap">
                      <InfoButton
                        type="button"
                        aria-label="Absence percentage warning"
                        title="Absence percentage warning"
                      >
                        i
                      </InfoButton>
                      <WarnPopover className="popover" role="alert">
                        Your absence percentage is high. Come to school!
                      </WarnPopover>
                    </span>
                  )}
                </label>
                <strong>{stats.percentage}%</strong>
              </StatBox>
              <StatBox>
                <label>Justified</label>
                <strong>{stats.justified}</strong>
              </StatBox>
              <StatBox>
                <label>Not justified</label>
                <strong>{stats.notJustified}</strong>
              </StatBox>
              <StatBox>
                <label>Delayed</label>
                <strong>{stats.delayed}</strong>
              </StatBox>
            </Stats>
          )}

          {future.length > 0 && (
            <Section>
              <h2>Upcoming</h2>
              <GroupList>
                {future.map((g, i) => (
                  <GroupCard
                    key={`f-${i}`}
                    data-approved={g.justified === 2 ? "true" : undefined}
                  >
                    <GroupHeader>
                      <div className="left">
                        <span className="date">{formatDate(g.date)}</span>
                        {g.reason && <span className="reason">{g.reason}</span>}
                        {g.justified === 1 &&
                          (g.reason ? (
                            <Badge className="justified">justified</Badge>
                          ) : (
                            <Badge
                              className="pending"
                              title="Awaiting justification details"
                            >
                              pending
                            </Badge>
                          ))}
                        {g.justified === 2 && (
                          <Badge
                            className="approved"
                            aria-label="Approved"
                            title="Approved by school"
                          >
                            ✓ approved
                          </Badge>
                        )}
                      </div>
                      {g.reason_signature && (
                        <div className="sig">{g.reason_signature}</div>
                      )}
                    </GroupHeader>
                  </GroupCard>
                ))}
              </GroupList>
            </Section>
          )}

          <Section>
            <h2>History</h2>
            {groups.length === 0 ? (
              <Muted>No absences</Muted>
            ) : (
              <GroupList>
                {groups.map((g, idx) => (
                  <GroupCard
                    key={idx}
                    data-approved={g.justified === 2 ? "true" : undefined}
                  >
                    <GroupHeader>
                      <div className="left">
                        <span className="date">{formatDate(g.date)}</span>
                        {g.reason && <span className="reason">{g.reason}</span>}
                        {g.justified === 1 && (
                          <Badge className="justified">justified</Badge>
                        )}
                        {g.justified === 2 && (
                          <Badge
                            className="approved"
                            aria-label="Approved"
                            title="Approved by school"
                          >
                            ✓ approved
                          </Badge>
                        )}
                      </div>
                      <div className="right">
                        {g.reason_signature && (
                          <span className="sig">{g.reason_signature}</span>
                        )}
                        {g.reason_timestamp && (
                          <span className="ts">{g.reason_timestamp}</span>
                        )}
                      </div>
                    </GroupHeader>
                    {Array.isArray(g.group) && g.group.length > 0 && (
                      <Entries>
                        {g.group.map((it) => (
                          <EntryRow
                            key={it.id}
                            data-approved={
                              it.justified === 2 ? "true" : undefined
                            }
                          >
                            <div className="left">
                              <span className="hour">{hourLabel(it.hour)}</span>
                              <span className="minutes">{it.minutes} min</span>
                            </div>
                            <div className="right">
                              <div className="top">
                                {it.reason && (
                                  <span className="reason">{it.reason}</span>
                                )}
                                {it.justified === 1 &&
                                  (it.reason || it.note ? (
                                    <span className="just">justified</span>
                                  ) : (
                                    <span className="pending">pending</span>
                                  ))}
                                {it.justified === 2 && (
                                  <span className="approved">✓ approved</span>
                                )}
                              </div>
                              {it.note && <div className="note">{it.note}</div>}
                            </div>
                          </EntryRow>
                        ))}
                      </Entries>
                    )}
                  </GroupCard>
                ))}
              </GroupList>
            )}
          </Section>
        </>
      )}
    </Main>
  );
}

function hourLabel(h) {
  if (typeof h !== "number") return "";
  return `${h}. Stunde`;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

const Main = styled.main`
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
  margin-bottom: 14px;
  h1 {
    margin: 0 0 4px 0;
  }
  p {
    margin: 0;
    color: var(--muted);
  }
`;

const ErrorMsg = styled.div`
  color: #991b1b;
  background: #fee2e2;
  border: 1px solid #fecaca;
  padding: 8px 12px;
  border-radius: 10px;
  margin-bottom: 12px;
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

const Section = styled.section`
  margin-top: 16px;
  h2 {
    margin: 0 0 8px 0;
    font-size: 1rem;
    color: #0f172a;
  }
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
`;

const StatBox = styled.div`
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: #fff;
  label {
    display: block;
    font-size: 0.8rem;
    color: var(--muted);
  }
  strong {
    font-size: 1.1rem;
  }
  position: relative;
  &[data-high="true"] {
    border-color: #fecaca;
    background: #fff1f2;
  }
  .infoWrap {
    position: relative;
    display: inline-block;
  }
  .infoWrap .popover {
    position: absolute;
    left: 0;
    top: 125%;
    z-index: 10;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-3px);
    transition: opacity 0.12s ease, transform 0.12s ease;
  }
  .infoWrap:hover .popover {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }
`;

const InfoButton = styled.button`
  margin-left: 6px;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid #fecaca;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
`;

const WarnPopover = styled.div`
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #7f1d1d;
  font-size: 0.85rem;
`;

const GroupList = styled.div`
  display: grid;
  gap: 12px;
`;

const GroupCard = styled.div`
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  &[data-approved="true"] {
    border-color: #86efac; /* green border */
    background: #f0fdf4; /* subtle green background */
  }
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  .left {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .date {
    font-weight: 700;
  }
  .reason {
    color: #334155;
  }
  .sig {
    color: var(--muted);
  }
  .ts {
    color: var(--muted);
    font-size: 0.85rem;
  }
`;

const Badge = styled.span`
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #d1fae5;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.75rem;
  &.approved {
    background: #ecfdf5;
    color: #065f46;
    border-color: #d1fae5;
  }
  &.justified {
    background: #eef2ff;
    color: #1e40af;
    border-color: #e0e7ff;
  }
`;

const Entries = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EntryRow = styled.div`
  display: flex;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: #f8fafc;
  &[data-approved="true"] {
    border-color: #86efac; /* green border */
    background: #f0fdf4; /* subtle green background */
  }
  .left {
    display: inline-flex;
    gap: 8px;
    color: var(--muted);
    min-width: 140px;
  }
  .hour {
    font-weight: 600;
    color: #111827;
  }
  .minutes {
    font-size: 0.9rem;
  }
  .right {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .top {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .reason {
    font-weight: 600;
  }
  .just {
    background: #eef2ff;
    color: #1e40af;
    border: 1px solid #e0e7ff;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.75rem;
  }
  .approved {
    background: #ecfdf5;
    color: #065f46;
    border: 1px solid #d1fae5;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .note {
    color: #334155;
  }
`;

const Muted = styled.div`
  color: var(--muted);
`;
