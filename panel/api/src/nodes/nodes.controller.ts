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
import { NodesService } from "./nodes.service";

@Controller("api/nodes")
@UseGuards(SessionGuard)
export class NodesController {
  constructor(private readonly nodes: NodesService) {}

  @Get()
  list(@ActiveOrg() orgId: string) {
    return this.nodes.list(orgId);
  }

  @Post()
  create(
    @ActiveOrg() orgId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    const name = body?.name?.trim();
    if (!name) throw new BadRequestException("Name is required");
    return this.nodes.create(orgId, { name, description: body.description?.trim() });
  }

  @Post(":id/rotate-token")
  rotate(@ActiveOrg() orgId: string, @Param("id") id: string) {
    return this.nodes.rotateToken(orgId, id);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@ActiveOrg() orgId: string, @Param("id") id: string) {
    await this.nodes.remove(orgId, id);
  }
}
