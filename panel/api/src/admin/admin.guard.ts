import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthedRequest } from "../auth/session.guard";

/**
 * Gates a route to platform staff. Use AFTER SessionGuard (which resolves the
 * user). Unlike org-scoped routes, admin routes are global — they intentionally
 * do NOT go through @ActiveOrg, so staff see across every tenant.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Platform admin only");
    }
    return true;
  }
}
