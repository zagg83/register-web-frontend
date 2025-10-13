import styled from "styled-components";
import { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";

export default function Messages() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [openIds, setOpenIds] = useState(() => new Set());

  useEffect(() => {
    if (!user) return;
    let aborted = false;
    async function fetchMessages() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(import.meta.env.VITE_API_URL + "/messages", {
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
        if (!aborted) setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Fetching messages failed:", e);
        if (!aborted) {
          setError("Failed to load messages");
          setItems([]);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    const t = setTimeout(fetchMessages, 60);
    return () => {
      aborted = true;
      clearTimeout(t);
    };
  }, [user]);

  async function markMessageAsRead(messageId) {
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
    } catch (e) {
      console.error("Mark message as read failed:", e);
    }
  }

  return (
    <Main className="container content">
      <Header>
        <h1>Messages</h1>
        <p>Newest messages from your account</p>
      </Header>
      {error && <ErrorMsg role="alert">{error}</ErrorMsg>}
      {loading ? (
        <Loader>Loading…</Loader>
      ) : items.length === 0 ? (
        <Empty>No messages.</Empty>
      ) : (
        <List role="list">
          {[...items]
            .sort((a, b) => new Date(rawDate(b)) - new Date(rawDate(a)))
            .slice(0, 50)
            .map((m, i) => (
              <Row
                key={m.id ?? i}
                role="listitem"
                data-unread={isUnread(m) ? "true" : undefined}
                data-open={openIds.has(m.id ?? i) ? "true" : undefined}
              >
                <button
                  type="button"
                  className="rowBtn"
                  onClick={() => {
                    const key = m.id ?? i;
                    const willOpen = !openIds.has(key);
                    setOpenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                    if (willOpen && isUnread(m)) {
                      // Optimistically mark as read in UI
                      setItems((prev) => {
                        return Array.isArray(prev)
                          ? prev.map((it) =>
                              (it.id ?? it._k) === (m.id ?? i)
                                ? { ...it, timeRead: new Date().toISOString(), unreadIndicator: false }
                                : it
                            )
                          : prev;
                      });
                      // Notify server
                      markMessageAsRead(m.id);
                    }
                  }}
                  aria-expanded={openIds.has(m.id ?? i)}
                  aria-controls={`msg-${m.id ?? i}`}
                  title={openIds.has(m.id ?? i) ? "Collapse" : "Expand"}
                >
                  <div className="top">
                    <div className="lead">
                      <span className="subject">{subjectOf(m)}</span>
                    </div>
                    <span
                      className={`chev ${openIds.has(m.id ?? i) ? "open" : ""}`}
                      aria-hidden
                    >
                      ▾
                    </span>
                  </div>
                  <div className="dateLine">
                    <span className="date" title={rawDate(m)}>
                      {formatDate({ time: m.timeSent || rawDate(m) })}
                    </span>
                  </div>
                  <div className="fromLine">Von: {m.fromName || fromOf(m)}</div>
                </button>
                {openIds.has(m.id ?? i) && (
                  <div id={`msg-${m.id ?? i}`} className="details">
                    {m.recipientString && (
                      <div className="meta">{m.recipientString}</div>
                    )}
                    <div className="body">
                      {renderQuill(m.text) ||
                        (previewOf(m) && <p>{previewOf(m)}</p>) || (
                          <p>No content.</p>
                        )}
                    </div>
                    {Array.isArray(m.submissions) &&
                      m.submissions.length > 0 && (
                        <Attach>
                          {m.submissions.map((s, idx) => (
                            <span
                              key={s.id ?? idx}
                              className="file"
                              title={s.originalName || s.file}
                            >
                              <span className="type">
                                {s.typeName || s.type || "FILE"}
                              </span>
                              <span className="name">
                                {s.originalName || s.file || "attachment"}
                              </span>
                            </span>
                          ))}
                        </Attach>
                      )}
                  </div>
                )}
              </Row>
            ))}
        </List>
      )}
    </Main>
  );
}

function subjectOf(m) {
  return m?.subject || m?.title || "(no subject)";
}
function fromOf(m) {
  return m?.from || m?.sender?.name || m?.sender || "";
}
function rawDate(m) {
  return (
    m?.timeSent ||
    m?.date ||
    m?.createdAt ||
    m?.created_at ||
    m?.timestamp ||
    ""
  );
}
function formatDate(m) {
  const d = m?.time || rawDate(m);
  if (!d) return "";
  try {
    const dt = new Date(d);
    return dt.toLocaleString();
  } catch {
    return d;
  }
}
function previewOf(m) {
  const s = m?.text || m?.content || m?.body || "";
  return String(s).length > 160 ? String(s).slice(0, 160) + "…" : s;
}

function isUnread(m) {
  // Consider message unread only if API marks it unread and there is no timeRead
  return Boolean(m?.unreadIndicator && !m?.timeRead);
}

// Very small Quill Delta (ops) to JSX renderer (paragraphs + bullet lists)
function renderQuill(text) {
  if (!text) return null;
  let delta = null;
  if (typeof text === "string") {
    try {
      delta = JSON.parse(text);
    } catch {
      return <p>{text}</p>;
    }
  } else if (typeof text === "object") {
    delta = text;
  }
  const ops = Array.isArray(delta?.ops) ? delta.ops : [];
  if (ops.length === 0) return null;
  const blocks = [];
  let list = [];
  for (const op of ops) {
    const insert = op.insert ?? "";
    const isBullet = op.attributes && op.attributes.list === "bullet";
    const lines = String(insert).split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const endsWithBreak = i < lines.length - 1;
      if (isBullet) {
        if (line) list.push(line);
        if (endsWithBreak) {
          // end of this bullet item
        }
      } else {
        // flush bullets before a paragraph
        if (list.length) {
          blocks.push({ type: "ul", items: list });
          list = [];
        }
        if (line) blocks.push({ type: "p", text: line });
      }
      if (endsWithBreak && !isBullet) {
        // newline ends a paragraph - already pushed
      }
    }
  }
  if (list.length) blocks.push({ type: "ul", items: list });
  return (
    <>
      {blocks.map((b, idx) =>
        b.type === "ul" ? (
          <ul key={`ul-${idx}`}>
            {b.items.map((t, i) => (
              <li key={`li-${idx}-${i}`}>{t}</li>
            ))}
          </ul>
        ) : (
          <p key={`p-${idx}`}>{b.text}</p>
        )
      )}
    </>
  );
}

const Main = styled.main`
  background: linear-gradient(180deg, rgba(255,255,255,0.7) 0px, rgba(255,255,255,0) 160px), #f8fafc;
  min-height: 100vh;
  padding-bottom: 16px;
`;

const Header = styled.div`
  margin-bottom: 12px;
  h1 {
    margin: 0 0 4px 0;
    font-weight: 800;
    letter-spacing: 0.2px;
  }
  p {
    margin: 0;
    color: var(--muted);
    font-size: 0.95rem;
  }
`;

const ErrorMsg = styled.div`
  font-weight: 700;
  margin-bottom: 8px;
`;

const Loader = styled.div`
  color: var(--muted);
`;

const Empty = styled.div`
  color: var(--muted);
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Row = styled.div`
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  transition: background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
  &:hover { background: #f8fafc; border-color: #e5e7eb; }
  .rowBtn {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: 0;
    padding: 12px;
    cursor: pointer;
    border-radius: 12px;
  }
  &[data-unread="true"] .rowBtn { box-shadow: 0 2px 10px rgba(59,130,246,0.08); }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .lead {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    flex: 1 1 auto;
    min-width: 0; /* allow ellipsis inside */
  }
  .subject {
    position: relative;
    display: inline-block;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 800;
    color: #0f172a;
    font-size: 1.02rem;
    letter-spacing: 0.15px;
    padding-left: 14px; /* space for dot */
  }
  &[data-unread="true"] .subject { color: #1e40af; }
  .subject::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #cbd5e1; /* muted for read */
  }
  &[data-unread="true"] .subject::before { background: #3b82f6; }
  .subject:hover { color: #1f2937; }
  .chev { color: #64748b; transition: transform .15s ease; font-size: 1.1rem; }
  .chev.open { transform: rotate(180deg); }
  .dateLine { margin-top: 4px; }
  .dateLine .date {
    color: #64748b;
    font-size: 0.9rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
  .fromLine {
    margin-top: 2px;
    color: #64748b;
    font-size: 0.9rem;
    font-style: italic;
    opacity: 0.7;
  }
  .details { padding: 0 12px 12px; }
  .meta { color: #334155; font-size: 0.9rem; margin-top: 6px; }
  .body { margin-top: 6px; color: #111827; }
  .body ul { margin: 6px 0 0 18px; }
  .body p { margin: 6px 0 0 0; }
`;

const Attach = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  .file {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #0f172a;
    font-size: 0.85rem;
  }
  .type {
    color: #6b7280;
    font-weight: 600;
  }
  .name {
    font-weight: 600;
  }
`;
