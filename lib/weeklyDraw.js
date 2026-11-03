const TIME_ZONE = "America/Chicago";

function zonedParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const out = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    weekday: out.weekday,
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
  };
}

function timeZoneOffsetMs(date) {
  const p = zonedParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

function centralToUtc(year, month, day, hour, minute) {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = new Date(wallClock);
  for (let i = 0; i < 3; i += 1) {
    guess = new Date(wallClock - timeZoneOffsetMs(guess));
  }
  return guess;
}

function addDays(year, month, day, amount) {
  const d = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function getDrawWindow(now = new Date()) {
  const p = zonedParts(now);
  const weekdayIndex = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  let daysBack = weekdayIndex[p.weekday] ?? 0;
  if (p.weekday === "Mon" && p.hour < 22) daysBack += 7;

  const startDate = addDays(p.year, p.month, p.day, -daysBack);
  const endDate = addDays(startDate.year, startDate.month, startDate.day, 7);
  const start = centralToUtc(startDate.year, startDate.month, startDate.day, 22, 0);
  const end = centralToUtc(endDate.year, endDate.month, endDate.day, 22, 0);
  const drawKey = `${endDate.year}-${String(endDate.month).padStart(2, "0")}-${String(endDate.day).padStart(2, "0")}`;

  return { start, end, drawKey };
}

export function isDrawClosed(now = new Date(), end) {
  return now.getTime() >= end.getTime();
}
