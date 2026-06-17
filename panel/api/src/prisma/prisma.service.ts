import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/** Thin wrapper so Nest manages the Prisma connection lifecycle. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    // Connect eagerly, but don't take the whole app down if the DB is briefly
    // unreachable at boot — the health endpoint surfaces DB status, and Prisma
    // reconnects lazily on the next query.
    try {
      await this.$connect();
    } catch (err) {
      this.logger.error(
        `Database unreachable at startup; continuing in degraded mode: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
