import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, WS_ORIGIN } from "../lib/api";
import { STATE_CLASS } from "./ServersPage";

interface Server {
  id: string;
  name: string;
  state: string;
  primaryPort: number;
  memoryMiB: number;
}
interface Stats {
  cpuPercent: number;
  memoryMiB: number;
}

const MAX_LINES = 500;
const POWER: { action: string; label: string }[] = [
  { action: "start", label: "Start" },
  { action: "restart", label: "Restart" },
  { action: "stop", label: "Stop" },
  { action: "kill", label: "Kill" },
];

export function ConsolePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [state, setState] = useState<string>("offline");
  const [lines, setLines] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [command, setCommand] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void api<Server>(`/api/servers/${id}`).then((s) => {
      setServer(s);
      setState(s.state);
    });

    const ws = new WebSocket(`${WS_ORIGIN}/api/console?server=${id}`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { type: string; payload: Record<string, unknown> };
        if (msg.type === "event.console.line") {
          setLines((prev) => [...prev.slice(-MAX_LINES + 1), String(msg.payload.line)]);
        } else if (msg.type === "event.server.state") {
          setState(String(msg.payload.state));
        } else if (msg.type === "event.server.stats") {
          setStats(msg.payload.stats as unknown as Stats);
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [id]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  async function power(action: string) {
    try {
      await api(`/api/servers/${id}/power`, { method: "POST", body: JSON.stringify({ action }) });
    } catch (e) {
      setLines((prev) => [...prev, `[panel] ${(e as Error).message}`]);
    }
  }

  function sendCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    wsRef.current?.send(JSON.stringify({ command }));
    setLines((prev) => [...prev, `> ${command}`]);
    setCommand("");
  }

  async function remove() {
    if (!confirm("Delete this server and its data?")) return;
    await api(`/api/servers/${id}`, { method: "DELETE" });
    navigate("/servers");
  }

  return (
    <>
      <section className="card">
        <div className="row">
          <div>
            <h2>
              <Link to="/servers" className="btnlink">
                ← Servers
              </Link>{" "}
              · {server?.name ?? "…"}
            </h2>
            <p className="tagline">
              <strong className={`status ${STATE_CLASS[state] ?? ""}`}>{state}</strong>
              {server ? ` · port ${server.primaryPort}` : ""}
              {stats ? ` · CPU ${stats.cpuPercent.toFixed(1)}% · ${Math.round(stats.memoryMiB)} MB` : ""}
            </p>
          </div>
          <div className="actions">
            {POWER.map((p) => (
              <button key={p.action} onClick={() => power(p.action)}>
                {p.label}
              </button>
            ))}
            <Link className="btnlink" to={`/servers/${id}/files`}>
              Files
            </Link>
            <button onClick={remove}>Delete</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="console" ref={logRef}>
          {lines.length === 0 && <div className="dim">Waiting for output… (start the server)</div>}
          {lines.map((l, i) => (
            <div key={i} className="line">
              {l}
            </div>
          ))}
        </div>
        <form onSubmit={sendCommand} className="inline-form">
          <input
            placeholder="Type a command and press Enter…"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
          <button type="submit" className="primary">
            Send
          </button>
        </form>
      </section>
    </>
  );
}
