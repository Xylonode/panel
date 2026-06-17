// Server Activity Logger — a sample Xylonode addon.
//
// Runs sandboxed as WASM in the panel (no ambient authority). It's a pure
// function: the host calls on_event(input) and the addon returns effects, which
// the host applies after checking the granted capability scopes.
//
//   input  = { event: HookEvent, config: {...}, kv: {...current addon KV...} }
//   output = { effects: { log?: string[], kvSet?: {...}, webhooks?: [{url, body}] } }

function on_event() {
  const input = JSON.parse(Host.inputString());
  const ev = input.event || {};
  const payload = ev.payload || {};
  const kv = input.kv || {};
  const config = input.config || {};

  const started = (parseInt(kv.startedCount || "0", 10) || 0) + (ev.name === "server.started" ? 1 : 0);

  const effects = {
    log: [`[${ev.name}] server ${payload.serverId || "?"} — total starts: ${started}`],
    kvSet: {
      startedCount: String(started),
      lastEvent: String(ev.name || ""),
      lastServer: String(payload.serverId || ""),
    },
  };

  // Optional outbound notification (requires net:fetch + host on the allowlist).
  if (config.webhookUrl) {
    effects.webhooks = [
      {
        url: config.webhookUrl,
        body: JSON.stringify({ content: `Server ${payload.serverId} → ${ev.name}` }),
      },
    ];
  }

  Host.outputString(JSON.stringify({ effects }));
  return 0;
}

module.exports = { on_event };
