import dotenv from "dotenv";

dotenv.config();

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-target");
}

export function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.status(204).end();
    return true;
  }
  return false;
}

export function extractSessionCookies(cookieString) {
  const result = {};
  if (!cookieString) return result;
  const regex = /(PHPSESSID|registerSession)=([^;,:\s]+)/g;
  let match;
  while ((match = regex.exec(cookieString)) !== null) {
    const [, key, value] = match;
    result[key] = value;
  }
  return result;
}

export async function getSessCookiesFromBody(body) {
  const { username, password, url } = body || {};
  if (!url || !username || !password) {
    return { isLoggedIn: false, cookies: null };
  }
  const response = await fetch(url + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const setCookieHeader = response.headers.get("set-cookie") || "";
  const cookies = extractSessionCookies(setCookieHeader);
  const ok = Boolean(cookies && cookies.PHPSESSID && cookies.registerSession);
  return { isLoggedIn: ok, cookies };
}

export function cookieHeader(cookies) {
  return `PHPSESSID=${cookies.PHPSESSID}; registerSession=${cookies.registerSession}`;
}
