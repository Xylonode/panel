import { Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface EggVariable {
  name: string;
  envVariable: string;
  defaultValue: string;
  userEditable: boolean;
}

/** Built-in eggs seeded for every org (organizationId = null = global). */
const BUILTIN_EGGS = [
  {
    id: "egg_minecraft_paper",
    name: "Minecraft: Java (Paper)",
    description: "Paper Minecraft server via the itzg/minecraft-server image.",
    dockerImage: "itzg/minecraft-server:latest",
    startup: "",
    stopCommand: "stop",
    variables: [
      { name: "Server type", envVariable: "TYPE", defaultValue: "PAPER", userEditable: true },
      { name: "Version", envVariable: "VERSION", defaultValue: "LATEST", userEditable: true },
      { name: "Accept EULA", envVariable: "EULA", defaultValue: "TRUE", userEditable: false },
    ] satisfies EggVariable[],
  },
];

@Injectable()
export class EggsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EggsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const egg of BUILTIN_EGGS) {
      await this.prisma.egg.upsert({
        where: { id: egg.id },
        create: { ...egg, organizationId: null },
        update: {
          name: egg.name,
          description: egg.description,
          dockerImage: egg.dockerImage,
          startup: egg.startup,
          stopCommand: egg.stopCommand,
          variables: egg.variables,
        },
      });
    }
    this.logger.log(`Seeded ${BUILTIN_EGGS.length} built-in egg(s)`);
  }

  /** Eggs visible to an org: its own plus the global built-ins. */
  list(orgId: string) {
    return this.prisma.egg.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }] },
      orderBy: { name: "asc" },
    });
  }

  async getAccessible(orgId: string, eggId: string) {
    const egg = await this.prisma.egg.findFirst({
      where: { id: eggId, OR: [{ organizationId: orgId }, { organizationId: null }] },
    });
    if (!egg) throw new NotFoundException("Egg not found");
    return egg;
  }
}
