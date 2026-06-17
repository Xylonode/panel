import { Module } from "@nestjs/common";
import { NodesModule } from "../nodes/nodes.module";
import { ServersController } from "./servers.controller";
import { ServersService } from "./servers.service";
import { EggsService } from "./eggs.service";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";

@Module({
  imports: [NodesModule], // for DaemonGateway
  controllers: [ServersController, FilesController],
  providers: [ServersService, EggsService, FilesService],
})
export class ServersModule {}
