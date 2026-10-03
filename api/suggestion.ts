import {clientIp, isAllowedOrigin, json, requestOrigin, verifyTurnstile} from "./_shared.js";

const MAX_MESSAGE = 4000;

interface IncomingSuggestion {
  message?: string;
  contact?: string;
  website?: string;
  page?: string;
  language?: string;
  turnstileToken?: string;
}

export async function POST(request: Request): Promise<Response> {
  const webhook = process.env.DISCORD_WEBHOOK_URL_2;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!webhook || !turnstileSecret) return json(500, {error: "not_configured"});

  if (!isAllowedOrigin(requestOrigin(request))) return json(403, {error: "forbidden"});

  let suggestion: IncomingSuggestion;
  try {
    suggestion = await request.json();
  } catch {
    return json(400, {error: "bad_json"});
  }

  if (suggestion.website) return json(200, {ok: true});

  if (!(await verifyTurnstile(suggestion.turnstileToken, turnstileSecret, clientIp(request)))) {
    return json(401, {error: "verification_failed"});
  }

  const message = suggestion.message?.trim();
  if (!message) return json(400, {error: "message_required"});

  const now = new Date();
  const unix = Math.floor(now.getTime() / 1000);
  const firstLine = message.split("\n")[0].trim();
  const summary = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
  const field = (name: string, value: unknown, inline = true) =>
    value ? [{name, value: String(value).slice(0, 1000), inline}] : [];

  const res = await fetch(webhook, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      username: "Suggestions",
      allowed_mentions: {parse: []},
      embeds: [{
        title: `💡 ${summary}`,
        description: `>>> ${message.slice(0, MAX_MESSAGE)}`,
        color: 0xf5b301,
        fields: [
          ...field("🕒 Time", `<t:${unix}:F> (<t:${unix}:R>)`, false),
          ...field("✉️ Contact", suggestion.contact?.trim().slice(0, 200)),
          ...field("🌐 Page", suggestion.page),
          ...field("🈯 Language", suggestion.language),
        ],
        timestamp: now.toISOString(),
      }],
    }),
  });
  if (!res.ok) return json(502, {error: "discord_failed"});
  return json(200, {ok: true});
}
