import { setCors, handleOptions } from "./utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  return res.status(200).send("Welcome to Zagg Register API");
}
