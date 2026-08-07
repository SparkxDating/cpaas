import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHash } from "crypto";
import { hashApiKey, loadAuthConfig, verifyAccessToken } from "@cpaas/auth";
import { PrismaService } from "../../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

export interface AuthContext {
  type: "jwt" | "api_key" | "device";
  userId?: string;
  email?: string;
  apiKeyId?: string;
  projectId?: string;
  organizationId?: string;
  environment?: "TEST" | "LIVE";
  scopes?: string[];
  deviceId?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      auth?: AuthContext;
    }>();

    const apiKeyHeader = req.headers["x-api-key"];
    const authHeader = req.headers.authorization;
    const deviceToken = req.headers["x-device-token"];

    if (deviceToken) {
      const hash = createHash("sha256").update(deviceToken).digest("hex");
      const device = await this.prisma.device.findUnique({ where: { deviceTokenHash: hash } });
      if (!device || device.status === "DISABLED") {
        throw new UnauthorizedException("Invalid device token");
      }
      req.auth = {
        type: "device",
        deviceId: device.id,
        projectId: device.projectId,
      };
      return true;
    }

    if (apiKeyHeader) {
      const cfg = loadAuthConfig();
      const keyHash = hashApiKey(apiKeyHeader, cfg.apiKeyPepper);
      const key = await this.prisma.apiKey.findUnique({
        where: { keyHash },
        include: { project: true },
      });
      if (!key || key.status !== "ACTIVE") {
        throw new UnauthorizedException("Invalid API key");
      }
      if (key.expiresAt && key.expiresAt < new Date()) {
        throw new UnauthorizedException("API key expired");
      }
      await this.prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });
      req.auth = {
        type: "api_key",
        apiKeyId: key.id,
        projectId: key.projectId,
        organizationId: key.project.organizationId,
        environment: key.environment,
        scopes: key.scopes,
      };
      return true;
    }

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const cfg = loadAuthConfig();
        const payload = verifyAccessToken(cfg, token);
        req.auth = {
          type: "jwt",
          userId: payload.sub,
          email: payload.email,
          organizationId: payload.orgId,
        };
        return true;
      } catch {
        throw new UnauthorizedException("Invalid access token");
      }
    }

    throw new UnauthorizedException("Authentication required");
  }
}
