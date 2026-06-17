import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { json } from "express";
import { toNodeHandler } from "better-auth/node";
import { AppModule } from "./app.module";
import { auth } from "./auth/auth";

async function bootstrap() {
  // Disable the global body parser: better-auth must read the raw request body
  // on its routes. We re-enable JSON parsing for every other route below.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.enableCors({
    origin: process.env.PANEL_WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });

  // Mount better-auth first, with the full path preserved so its router matches
  // against basePath ("/api/auth"). Must come before express.json().
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.all("/api/auth/*", toNodeHandler(auth));

  // JSON body parsing for the rest of the API (Nest controllers).
  app.use(json());

  const port = Number(process.env.PANEL_API_PORT ?? 3000);
  await app.listen(port);
  Logger.log(`Panel API listening on http://localhost:${port}`, "Bootstrap");
}

void bootstrap();
