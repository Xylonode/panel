import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentSession, CurrentUser } from "../auth/current-user.decorator";
import { SessionGuard } from "../auth/session.guard";
import { auth } from "../auth/auth";

/** Example protected route — proves our own API consumes the better-auth session. */
@Controller("me")
@UseGuards(SessionGuard)
export class MeController {
  @Get()
  me(
    @CurrentUser() user: typeof auth.$Infer.Session.user,
    @CurrentSession() session: typeof auth.$Infer.Session.session,
  ) {
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      activeOrganizationId: session.activeOrganizationId ?? null,
    };
  }
}
