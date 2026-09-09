export function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

export function clampMultiplier(v: unknown, min = 1.01, max = 1000): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

export function parseBetBody(body: any): { amount: number; autoCashoutAt: number | null } | null {
  if (!body || typeof body !== "object") return null;
  const amount = Number(body.amount);
  if (!isPositiveInt(amount)) return null;
  let autoCashoutAt: number | null = null;
  if (body.autoCashoutAt !== undefined && body.autoCashoutAt !== null) {
    autoCashoutAt = clampMultiplier(body.autoCashoutAt);
    if (autoCashoutAt === null) return null;
  }
  return { amount, autoCashoutAt };
}
