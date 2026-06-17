import { BadRequestException, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthedRequest } from "./session.guard";

/**
 * Injects the caller's active organization id (from the better-auth session).
 * Throws 400 if no organization is active — every org-scoped route needs one,
 * and this is the single choke point that enforces tenant scoping.
 */
export const ActiveOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  const orgId = req.session?.activeOrganizationId;
  if (!orgId) {
    throw new BadRequestException("No active organization. Select one first.");
  }
  return orgId;
});
