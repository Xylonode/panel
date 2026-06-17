import { BadRequestException, Injectable } from "@nestjs/common";
import type { FileEntry, FilesResult, PanelToDaemon } from "@game-panel/protocol";
import { DaemonGateway } from "../nodes/daemon.gateway";
import { ServersService } from "./servers.service";

/** File operations for a server, proxied to its node's daemon over the control
 * channel (request/response). Every call first verifies org ownership. */
@Injectable()
export class FilesService {
  constructor(
    private readonly servers: ServersService,
    private readonly gateway: DaemonGateway,
  ) {}

  async list(orgId: string, serverId: string, path: string): Promise<FileEntry[]> {
    const res = await this.run(orgId, serverId, { type: "files.list", payload: { serverId, path } });
    return res.entries ?? [];
  }

  async read(orgId: string, serverId: string, path: string): Promise<string> {
    const res = await this.run(orgId, serverId, { type: "files.read", payload: { serverId, path } });
    return res.content ?? "";
  }

  async write(orgId: string, serverId: string, path: string, content: string): Promise<void> {
    await this.run(orgId, serverId, { type: "files.write", payload: { serverId, path, content } });
  }

  async remove(orgId: string, serverId: string, path: string): Promise<void> {
    await this.run(orgId, serverId, { type: "files.delete", payload: { serverId, path } });
  }

  async rename(orgId: string, serverId: string, from: string, to: string): Promise<void> {
    await this.run(orgId, serverId, { type: "files.rename", payload: { serverId, from, to } });
  }

  async mkdir(orgId: string, serverId: string, path: string): Promise<void> {
    await this.run(orgId, serverId, { type: "files.mkdir", payload: { serverId, path } });
  }

  /** Verifies ownership, dispatches to the daemon, unwraps the result. */
  private async run(
    orgId: string,
    serverId: string,
    message: PanelToDaemon,
  ): Promise<Extract<FilesResult, { ok: true }>> {
    const server = await this.servers.get(orgId, serverId); // throws 404 if not owned
    const result = await this.gateway.request(server.nodeId, message);
    if (!result.ok) throw new BadRequestException(result.error);
    return result;
  }
}
