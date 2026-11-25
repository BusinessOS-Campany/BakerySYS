export type ZonedParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

/** Wall-clock parts of an instant in a specific timezone. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

export function zonedDateKey(date: Date, timeZone: string) {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

/** `datetime-local` value (YYYY-MM-DDTHH:mm:ss) in the tenant timezone. */
export function dateTimeLocalValue(date: Date, timeZone: string) {
  const { year, month, day, hour, minute, second } = zonedParts(date, timeZone);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function zoneOffset(date: Date, timeZone: string) {
  const value = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === "-" ? -minutes : minutes) * 60_000;
}

/** Convert a tenant wall-clock `datetime-local` value to an absolute ISO instant. */
export function dateTimeLocalToIso(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return new Date().toISOString();
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (Number.isNaN(wallClock.getTime())) return new Date().toISOString();
  const estimate = new Date(wallClock.getTime() - zoneOffset(wallClock, timeZone));
  return new Date(wallClock.getTime() - zoneOffset(estimate, timeZone)).toISOString();
}
