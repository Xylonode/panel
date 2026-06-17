import {
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
import { AddonsService } from "./addons.service";

@Controller("api/addons")
@UseGuards(SessionGuard)
export class AddonsController {
  constructor(private readonly addons: AddonsService) {}

  @Get("registry")
  registry() {
    return this.addons.registry();
  }

  @Get()
  installs(@ActiveOrg() orgId: string) {
    return this.addons.listInstalls(orgId);
  }

  @Post(":addonId/install")
  install(
    @ActiveOrg() orgId: string,
    @Param("addonId") addonId: string,
    @Body() body: { config?: Record<string, unknown> },
  ) {
    return this.addons.install(orgId, addonId, body?.config);
  }

  @Post("installs/:id/toggle")
  toggle(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body() body: { enabled?: boolean },
  ) {
    return this.addons.setEnabled(orgId, id, body?.enabled ?? true);
  }

  @Post("installs/:id/config")
  config(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body() body: { config?: Record<string, unknown> },
  ) {
    return this.addons.setConfig(orgId, id, body?.config ?? {});
  }

  @Get("installs/:id/logs")
  logs(@ActiveOrg() orgId: string, @Param("id") id: string) {
    return this.addons.logs(orgId, id);
  }

  @Get("installs/:id/kv")
  kv(@ActiveOrg() orgId: string, @Param("id") id: string) {
    return this.addons.kv(orgId, id);
  }

  @Delete("installs/:id")
  @HttpCode(204)
  async uninstall(@ActiveOrg() orgId: string, @Param("id") id: string) {
    await this.addons.uninstall(orgId, id);
  }
}
