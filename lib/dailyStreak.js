export const DAILY_TIX_REWARDS = [100, 200, 300, 400, 500, 750, 1000];

export function rewardForStreak(streakDay) {
  const day = Math.min(Math.max(Number(streakDay) || 1, 1), 7);
  return DAILY_TIX_REWARDS[day - 1];
}

export function centralDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const out = {};
  for (const part of parts) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return `${out.year}-${out.month}-${out.day}`;
}

export function dateKeyDiff(laterKey, earlierKey) {
  const later = Date.parse(laterKey + "T00:00:00Z");
  const earlier = Date.parse(earlierKey + "T00:00:00Z");
  return Math.round((later - earlier) / 86400000);
}
