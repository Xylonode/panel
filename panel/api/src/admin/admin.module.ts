import { Module } from "@nestjs/common";
import { NodesModule } from "../nodes/nodes.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { SuperadminBootstrap } from "./superadmin.bootstrap";

@Module({
  imports: [NodesModule], // for DaemonGateway (online status)
  controllers: [AdminController],
  providers: [AdminService, SuperadminBootstrap],
})
export class AdminModule {}
