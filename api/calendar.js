import {
  setCors,
  handleOptions,
  getSessCookiesFromBody,
  cookieHeader,
} from "./_utils";
import { startOfWeek, format } from "date-fns";

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const { url } = req.body || {};
    const startDate =
      (req.body?.startDate && String(req.body.startDate).trim()) ||
      format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const { isLoggedIn, cookies } = await getSessCookiesFromBody(req.body);
    if (!isLoggedIn) return res.status(401).json({ isLoggedIn: false });
    const resp = await fetch(url + "/api/calendar/student", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(cookies),
        "Content-Type": "application/json;charset=UTF-8",
        Accept: "application/json, text/plain, */*",
        Origin: url,
        Referer: url + "/v2/",
      },
      body: JSON.stringify({ startDate }),
    });
    const data = await resp.json();
    return res.status(200).json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).send(String(e));
  }
}
