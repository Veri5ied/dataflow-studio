export function isValidIdentifier(value: string) {
  return /^[A-Za-z0-9_$-]+$/.test(value);
}

export function assertIdentifier(value: string, label: string) {
  if (!isValidIdentifier(value)) {
    throw new Error(`Invalid ${label} identifier.`);
  }

  return value;
}

export function inferSqlCommand(sql: string) {
  const first = sql.trim().split(/\s+/)[0] ?? "";
  return first.toUpperCase() || "UNKNOWN";
}
