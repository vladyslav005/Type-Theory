const MAX_FILES = 5;
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

  const contextJson = JSON.stringify(report.context ?? {}, null, 2);
  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    allowed_mentions: {parse: []},
    embeds: [{
      title: "Bug report",
      description: description.slice(0, MAX_DESCRIPTION),
      color: 0xe5484d,
      fields: report.contact?.trim()
        ? [{name: "Contact", value: report.contact.trim().slice(0, 200)}]
        : [],
      timestamp: new Date().toISOString(),
    }],
  }));
  form.append("files[0]", new Blob([contextJson], {type: "application/json"}), "context.json");
  decoded.forEach((f, i) => {
    form.append(`files[${i + 1}]`, new Blob([new Uint8Array(f.bytes)], {type: f.type || "application/octet-stream"}), f.name);
  });

  const res = await fetch(webhook, {method: "POST", body: form});
  if (!res.ok) return json(502, {error: "discord_failed"});
  return json(200, {ok: true});
}
