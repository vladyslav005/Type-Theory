const MAX_FILES = 8;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const MAX_DESCRIPTION = 4000;

interface IncomingFile {
  name: string;
  type?: string;
  base64: string;
}

interface IncomingReport {
  description?: string;
  contact?: string;
  website?: string;
  context?: Record<string, unknown>;
  files?: IncomingFile[];
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file";

export async function POST(request: Request): Promise<Response> {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return json(500, {error: "not_configured"});

  let report: IncomingReport;
  try {
    report = await request.json();
  } catch {
    return json(400, {error: "bad_json"});
  }

  if (report.website) return json(200, {ok: true});

  const description = report.description?.trim();
  if (!description) return json(400, {error: "description_required"});

  const files = (report.files ?? []).slice(0, MAX_FILES);
  const decoded = files.map((f) => ({name: safeName(f.name), type: f.type, bytes: Buffer.from(f.base64 ?? "", "base64")}));
  if (decoded.reduce((sum, f) => sum + f.bytes.length, 0) > MAX_TOTAL_BYTES) {
    return json(413, {error: "too_large"});
  }

  const context = report.context ?? {};
  const now = new Date();
  const unix = Math.floor(now.getTime() / 1000);
  const firstLine = description.split("\n")[0].trim();
  const summary = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
  const theories = context.enabledTheories && typeof context.enabledTheories === "object"
    ? Object.entries(context.enabledTheories as Record<string, boolean>).filter(([, on]) => on).map(([id]) => id)
    : [];
  const errors = Array.isArray(context.errors) ? context.errors.map(String) : [];
  const field = (name: string, value: unknown, inline = true) =>
    value ? [{name, value: String(value).slice(0, 1000), inline}] : [];

  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    username: "Bug Reporter",
    allowed_mentions: {parse: []},
    embeds: [{
      title: `🐞 ${summary}`,
      description: `>>> ${description.slice(0, MAX_DESCRIPTION)}`,
      color: 0xe5484d,
      thumbnail: {url: "https://twemoji.maxcdn.com/v/latest/72x72/1f41b.png"},
      fields: [
        ...field("🕒 Time", `<t:${unix}:F> (<t:${unix}:R>)`, false),
        ...field("✉️ Contact", report.contact?.trim().slice(0, 200)),
        ...field("🌐 Page", context.url),
        ...field("🈯 Language", context.language),
        ...field("🧪 Theories", theories.length ? theories.join(", ") : "STLC"),
        ...field("⚙️ Strategy", context.evaluationStrategy),
        ...field("🖥️ Viewport", context.viewport),
        ...field("❗ Errors", errors.length ? "```\n" + errors.join("\n").slice(0, 900) + "\n```" : "", false),
      ],
      footer: {text: `📎 ${decoded.map((f) => f.name).join(", ") || "no attachments"}`},
      timestamp: now.toISOString(),
    }],
  }));
  decoded.forEach((f, i) => {
    form.append(`files[${i}]`, new Blob([new Uint8Array(f.bytes)], {type: f.type || "application/octet-stream"}), f.name);
  });

  const res = await fetch(webhook, {method: "POST", body: form});
  if (!res.ok) return json(502, {error: "discord_failed"});
  return json(200, {ok: true});
}
