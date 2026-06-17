import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ActiveOrg } from "../auth/active-org.decorator";
import { SessionGuard } from "../auth/session.guard";
import { EggsService } from "./eggs.service";
import { ServersService, type PowerAction } from "./servers.service";

const POWER_ACTIONS: PowerAction[] = ["start", "stop", "restart", "kill"];

@Controller("api")
@UseGuards(SessionGuard)
export class ServersController {
  constructor(
    private readonly servers: ServersService,
    private readonly eggs: EggsService,
  ) {}

  @Get("eggs")
  listEggs(@ActiveOrg() orgId: string) {
    return this.eggs.list(orgId);
  }

  @Get("servers")
  list(@ActiveOrg() orgId: string) {
    return this.servers.list(orgId);
  }

  @Get("servers/:id")
  get(@ActiveOrg() orgId: string, @Param("id") id: string) {
    return this.servers.get(orgId, id);
  }

  @Post("servers")
  create(
    @ActiveOrg() orgId: string,
    @Body()
    body: {
      nodeId?: string;
      eggId?: string;
      name?: string;
      memoryMiB?: number;
      cpuPercent?: number;
      diskMiB?: number;
      environment?: Record<string, string>;
    },
  ) {
    const name = body?.name?.trim();
    if (!name || !body.nodeId || !body.eggId) {
      throw new BadRequestException("name, nodeId and eggId are required");
    }
    return this.servers.create(orgId, {
      nodeId: body.nodeId,
      eggId: body.eggId,
      name,
      memoryMiB: body.memoryMiB,
      cpuPercent: body.cpuPercent,
      diskMiB: body.diskMiB,
      environment: body.environment,
    });
  }

  @Post("servers/:id/power")
  power(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body() body: { action?: string },
  ) {
    const action = body?.action as PowerAction;
    if (!POWER_ACTIONS.includes(action)) {
      throw new BadRequestException(`action must be one of ${POWER_ACTIONS.join(", ")}`);
    }
    return this.servers.power(orgId, id, action);
  }

  @Post("servers/:id/command")
  command(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body() body: { command?: string },
  ) {
    const command = body?.command?.trim();
    if (!command) throw new BadRequestException("command is required");
    return this.servers.sendCommand(orgId, id, command);
  }

  @Delete("servers/:id")
  @HttpCode(204)
  async remove(@ActiveOrg() orgId: string, @Param("id") id: string) {
    await this.servers.remove(orgId, id);
  }
}
