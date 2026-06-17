import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

/** Platform-staff routes. Global (no org scoping); admin role required. */
@Controller("api/admin")
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("orgs")
  orgs() {
    return this.admin.listOrgs();
  }

  @Post("orgs/:id/suspend")
  suspend(@Param("id") id: string, @Body() body: { suspended?: boolean; reason?: string }) {
    return this.admin.suspendOrg(id, body?.suspended ?? true, body?.reason);
  }

  @Get("nodes")
  nodes() {
    return this.admin.listNodes();
  }

  @Get("servers")
  servers() {
    return this.admin.listServers();
  }

  @Get("users")
  users() {
    return this.admin.listUsers();
  }

  @Get("addons")
  addons() {
    return this.admin.listAddons();
  }

  @Post("addons/:id/publish")
  publish(@Param("id") id: string, @Body() body: { published?: boolean }) {
    return this.admin.setAddonPublished(id, body?.published ?? true);
  }
}
