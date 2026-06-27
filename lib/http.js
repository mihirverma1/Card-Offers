// Small shared helpers for the API functions (CORS + JSON responses).

export function getAllowedOrigin(origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origin || allowed.length === 0) return "*";
  // Native app WebViews (Android/iOS load from file://) send "Origin: null".
  if (origin === "null") return "null";
  return allowed.includes(origin) ? origin : allowed[0];
}

export function jsonResponse(res, status, body, origin) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(origin));
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(body));
}
