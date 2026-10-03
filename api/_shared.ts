export const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});

const ALLOWED_ORIGINS = new Set(["https://type-theory.dev", "https://tt-woad.vercel.app"]);

// Also allow the current Vercel deployment's own URL, so preview deployments work untouched.
export const isAllowedOrigin = (origin: string | null) => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) return true;
  return /^http:\/\/localhost(:\d+)?$/.test(origin);
};

export const requestOrigin = (request: Request): string | null => {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

export const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

export const verifyTurnstile = async (token: string | undefined, secret: string, ip: string | null): Promise<boolean> => {
  if (!token) return false;
  const body = new URLSearchParams({secret, response: token});
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {method: "POST", body});
    const data = (await res.json()) as {success: boolean};
    return data.success === true;
  } catch {
    return false;
  }
};
