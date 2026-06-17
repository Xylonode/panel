import { Module } from "@nestjs/common";
import { NodesController } from "./nodes.controller";
import { NodesService } from "./nodes.service";
import { DaemonGateway } from "./daemon.gateway";

@Module({
  controllers: [NodesController],
  providers: [NodesService, DaemonGateway],
  exports: [DaemonGateway],
})
export class NodesModule {}
