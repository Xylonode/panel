import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { auth } from "./auth";

/** What a successful session resolution attaches to the request. */
export interface AuthedRequest extends Request {
  user?: typeof auth.$Infer.Session.user;
  session?: typeof auth.$Infer.Session.session;
}

/**
 * Guards a route by resolving the better-auth session from the request cookies.
 * On success it attaches `user` and `session` to the request (read via the
 * @CurrentUser / @CurrentSession decorators). The session also carries
 * `activeOrganizationId`, which org-scoped controllers use for tenant isolation.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result) {
      throw new UnauthorizedException("Not authenticated");
    }
    req.user = result.user;
    req.session = result.session;
    return true;
  }
}
