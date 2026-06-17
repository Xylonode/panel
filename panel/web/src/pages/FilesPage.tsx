import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

interface FileEntry {
  name: string;
  type: "file" | "dir";
  size: number;
  modified: string;
}

function joinPath(dir: string, name: string): string {
  return `${dir.replace(/\/+$/, "")}/${name}`;
}
function parentPath(dir: string): string {
  const trimmed = dir.replace(/\/+$/, "");
  const i = trimmed.lastIndexOf("/");
  return i <= 0 ? "/" : trimmed.slice(0, i);
}

export function FilesPage() {
  const { id = "" } = useParams();
  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);

  const load = useCallback(
    async (path: string) => {
      setError(null);
      try {
        setEntries(await api<FileEntry[]>(`/api/servers/${id}/files?path=${encodeURIComponent(path)}`));
        setCwd(path);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id],
  );

  useEffect(() => {
    void load("/");
  }, [load]);

  async function open(entry: FileEntry) {
    const path = joinPath(cwd, entry.name);
    if (entry.type === "dir") return load(path);
    try {
      const { content } = await api<{ content: string }>(
        `/api/servers/${id}/files/content?path=${encodeURIComponent(path)}`,
      );
      setEditing({ path, content });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    if (!editing) return;
    try {
      await api(`/api/servers/${id}/files/content`, {
        method: "PUT",
        body: JSON.stringify(editing),
      });
      setEditing(null);
      await load(cwd);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(entry: FileEntry) {
    if (!confirm(`Delete ${entry.name}?`)) return;
    await api(`/api/servers/${id}/files?path=${encodeURIComponent(joinPath(cwd, entry.name))}`, {
      method: "DELETE",
    });
    await load(cwd);
  }

  async function newFolder() {
    const name = prompt("New folder name");
    if (!name) return;
    await api(`/api/servers/${id}/files/mkdir`, {
      method: "POST",
      body: JSON.stringify({ path: joinPath(cwd, name) }),
    });
    await load(cwd);
  }

  if (editing) {
    return (
      <section className="card">
        <div className="row">
          <h2>{editing.path}</h2>
          <div className="actions">
            <button className="primary" onClick={save}>
              Save
            </button>
            <button onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
        <textarea
          className="editor"
          value={editing.content}
          onChange={(e) => setEditing({ ...editing, content: e.target.value })}
          spellCheck={false}
        />
      </section>
    );
  }

  return (
    <section className="card">
      <div className="row">
        <h2>
          <Link to={`/servers/${id}`} className="btnlink">
            ← Console
          </Link>{" "}
          · Files <code>{cwd}</code>
        </h2>
        <div className="actions">
          <button onClick={newFolder}>New folder</button>
          <button onClick={() => load(cwd)}>Refresh</button>
        </div>
      </div>

      <ul className="filelist">
        {cwd !== "/" && (
          <li onClick={() => load(parentPath(cwd))} className="clickable">
            <span>📁 ..</span>
          </li>
        )}
        {entries.map((e) => (
          <li key={e.name}>
            <span className="clickable" onClick={() => open(e)}>
              {e.type === "dir" ? "📁" : "📄"} {e.name}
            </span>
            <span className="meta">
              {e.type === "file" ? `${e.size} B` : ""}
              <button onClick={() => remove(e)}>✕</button>
            </span>
          </li>
        ))}
        {!entries.length && cwd === "/" && <li className="dim">Empty (start the server to generate files)</li>}
      </ul>
      {error && <p className="status down">{error}</p>}
    </section>
  );
}
