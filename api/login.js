import { setCors, handleOptions, getSessCookiesFromBody } from "./utils.js";

export default async function handler(req, res) {
  console.log("hi");
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const { isLoggedIn } = await getSessCookiesFromBody(req.body);
    if (!isLoggedIn) return res.status(401).json({ isLoggedIn: false });
    return res.status(200).json({ isLoggedIn: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ isLoggedIn: false });
  }
}
