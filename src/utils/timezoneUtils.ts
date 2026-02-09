export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export const getZonedParts = (date: Date, timeZone: string): ZonedParts => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
};

export const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const zoned = getZonedParts(date, timeZone);
  const zonedAsUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  return (zonedAsUtc - date.getTime()) / 60000;
};

export const getZonedMidnightUtc = (date: Date, timeZone: string) => {
  const zoned = getZonedParts(date, timeZone);
  const utcGuess = Date.UTC(zoned.year, zoned.month - 1, zoned.day, 0, 0, 0);
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
  return utcGuess - offsetMinutes * 60 * 1000;
};

export const formatZonedDateLabel = (parts: ZonedParts) =>
  `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

export const isWithinZonedMidnightWindow = (
  date: Date,
  timeZone: string,
  windowMinutes = 10
) => {
  const parts = getZonedParts(date, timeZone);
  return parts.hour === 0 && parts.minute < windowMinutes;
};
