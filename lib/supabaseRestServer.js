function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export async function supabaseRest(path, options = {}) {
  const config = getConfig();
  if (!config) {
    const err = new Error("MoonTicket database connection is not configured.");
    err.code = "SUPABASE_ENV_MISSING";
    throw err;
  }

  const response = await fetch(config.url + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: "Bearer " + config.key,
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }

  if (!response.ok) {
    const err = new Error(
      (body && typeof body === "object" && (body.message || body.error || body.hint)) ||
        "Database request failed"
    );
    err.status = response.status;
    err.details = body;
    throw err;
  }

  return body;
}

export async function ensureWeeklyDraw({ drawKey, drawDate }) {
  const q = new URLSearchParams({ draw_key: "eq." + drawKey, select: "*" });
  const existing = await supabaseRest("draws?" + q.toString());
  if (Array.isArray(existing) && existing.length) return existing[0];

  try {
    const created = await supabaseRest("draws", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify([{
        draw_type: "weekly_free",
        draw_key: drawKey,
        draw_date: drawDate,
        status: "open",
        prize_bundle: [],
        payout_status: "pending",
      }]),
    });
    return created?.[0] || null;
  } catch (err) {
    if (err.status === 409) {
      const retry = await supabaseRest("draws?" + q.toString());
      return retry?.[0] || null;
    }
    throw err;
  }
}
