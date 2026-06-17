import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthedRequest } from "./session.guard";

/** Injects the authenticated user (requires SessionGuard on the route). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

/** Injects the active session, incl. `activeOrganizationId` for tenant scoping. */
export const CurrentSession = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().session;
});
