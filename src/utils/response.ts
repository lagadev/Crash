export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function ok<T extends object>(data: T, status = 200) {
  return json({ success: true, ...data }, status);
}

export function fail(message: string, status = 400, code?: string) {
  return json({ success: false, error: message, code }, status);
}
