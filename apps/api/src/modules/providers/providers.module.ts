import { Global, Module } from "@nestjs/common";
import { ProviderRouterService } from "./router.service";
import { ProvidersController } from "./providers.controller";

@Global()
@Module({
  providers: [ProviderRouterService],
  controllers: [ProvidersController],
  exports: [ProviderRouterService],
})
export class ProvidersModule {}
