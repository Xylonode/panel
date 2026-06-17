import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AddonsModule } from "./addons/addons.module";
import { HealthModule } from "./health/health.module";
import { HooksModule } from "./hooks/hooks.module";
import { MeModule } from "./me/me.module";
import { NodesModule } from "./nodes/nodes.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ServersModule } from "./servers/servers.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HooksModule,
    HealthModule,
    MeModule,
    NodesModule,
    ServersModule,
    AddonsModule,
  ],
})
export class AppModule {}
