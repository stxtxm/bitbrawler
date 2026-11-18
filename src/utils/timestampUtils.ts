export const toFiniteTimestamp = (value: unknown): number => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.length > 0
        ? Date.parse(value)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
