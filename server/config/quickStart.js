const DEFAULT_QUICK_START_DAY_NUMBER = 900001;
const MIN_SAFE_QUICK_START_DAY_NUMBER = 900000;

function parseQuickStartDayNumber(rawValue) {
  const value = String(rawValue ?? "").trim();

  if (!/^\d+$/.test(value)) {
    throw new Error("QUICK_START_DAY_NUMBER must be a positive integer");
  }

  const dayNumber = Number(value);
  if (
    !Number.isSafeInteger(dayNumber) ||
    dayNumber < MIN_SAFE_QUICK_START_DAY_NUMBER
  ) {
    throw new Error(
      `QUICK_START_DAY_NUMBER must be a safe integer greater than or equal to ${MIN_SAFE_QUICK_START_DAY_NUMBER}`,
    );
  }

  return dayNumber;
}

export const QUICK_START_DAY_NUMBER = parseQuickStartDayNumber(
  process.env.QUICK_START_DAY_NUMBER ?? DEFAULT_QUICK_START_DAY_NUMBER,
);

