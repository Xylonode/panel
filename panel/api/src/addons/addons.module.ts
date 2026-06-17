import { Module } from "@nestjs/common";
import { AddonsController } from "./addons.controller";
import { AddonsService } from "./addons.service";
import { AddonRuntime } from "./addon-runtime.service";
import { AddonDispatcher } from "./addon-dispatcher.service";

@Module({
  controllers: [AddonsController],
  providers: [AddonsService, AddonRuntime, AddonDispatcher],
})
export class AddonsModule {}
