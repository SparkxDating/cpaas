import "./load-env";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { createLogger } from "@cpaas/logger";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { RequestLoggingInterceptor } from "./common/interceptors/request-logging.interceptor";

async function bootstrap() {
  const logger = createLogger("api");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());
  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // Single /v1 prefix (do not also enable URI versioning or paths become /v1/v1/...)
  app.setGlobalPrefix("v1", { exclude: ["health", "metrics", "docs", "docs-json"] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  const swagger = new DocumentBuilder()
    .setTitle("CPaaS API")
    .setDescription("Open-source Communications Platform as a Service API")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "X-Api-Key", in: "header" }, "api-key")
    .addServer(process.env.API_URL ?? "http://localhost:3001")
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.info(`CPaaS API listening on :${port}`);
  logger.info(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
