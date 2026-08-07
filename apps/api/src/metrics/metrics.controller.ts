import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { MetricsService } from "./metrics.service";

@ApiExcludeController()
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4")
  async getMetrics() {
    return this.metrics.metrics();
  }
}
