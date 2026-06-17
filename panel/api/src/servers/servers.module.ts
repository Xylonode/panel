import { Module } from "@nestjs/common";
import { NodesModule } from "../nodes/nodes.module";
import { ServersController } from "./servers.controller";
import { ServersService } from "./servers.service";
import { EggsService } from "./eggs.service";

@Module({
  imports: [NodesModule], // for DaemonGateway
  controllers: [ServersController],
  providers: [ServersService, EggsService],
})
export class ServersModule {}
