import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { auth } from "../auth/auth";

/**
 * Seeds the platform super-admin from the environment on startup:
 *   SUPERADMIN_EMAIL     (required to do anything)
 *   SUPERADMIN_PASSWORD  (optional — used to create the account if missing)
 *
 * If the user exists it is promoted to role "admin"; if it doesn't and a
 * password is provided, it is created then promoted. Idempotent.
 */
@Injectable()
export class SuperadminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperadminBootstrap.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    if (!email) return;

    let user = await this.prisma.user.findFirst({ where: { email } });

    if (!user) {
      const password = process.env.SUPERADMIN_PASSWORD;
      if (!password) {
        this.logger.warn(`SUPERADMIN_EMAIL set but no such user and no SUPERADMIN_PASSWORD to create one`);
        return;
      }
      try {
        await auth.api.signUpEmail({ body: { email, password, name: "Super Admin" } });
        user = await this.prisma.user.findFirst({ where: { email } });
      } catch (err) {
        this.logger.error(`Failed to create super-admin: ${(err as Error).message}`);
        return;
      }
    }

    if (user && user.role !== "admin") {
      await this.prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
      this.logger.log(`Promoted ${email} to platform admin`);
    } else if (user) {
      this.logger.log(`Super-admin ${email} present`);
    }
  }
}
