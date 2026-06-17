import { Global, Module } from "@nestjs/common";
import { HookBus } from "./hook-bus.service";

@Global()
@Module({
  providers: [HookBus],
  exports: [HookBus],
})
export class HooksModule {}
