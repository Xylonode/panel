import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ActiveOrg } from "../auth/active-org.decorator";
import { SessionGuard } from "../auth/session.guard";
import { FilesService } from "./files.service";

@Controller("api/servers/:id/files")
@UseGuards(SessionGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  list(@ActiveOrg() orgId: string, @Param("id") id: string, @Query("path") path = "/") {
    return this.files.list(orgId, id, path);
  }

  @Get("content")
  async read(@ActiveOrg() orgId: string, @Param("id") id: string, @Query("path") path?: string) {
    if (!path) throw new BadRequestException("path is required");
    return { content: await this.files.read(orgId, id, path) };
  }

  @Put("content")
  async write(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body() body: { path?: string; content?: string },
  ) {
    if (!body?.path) throw new BadRequestException("path is required");
    await this.files.write(orgId, id, body.path, body.content ?? "");
    return { ok: true };
  }

  @Post("rename")
  async rename(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body() body: { from?: string; to?: string },
  ) {
    if (!body?.from || !body?.to) throw new BadRequestException("from and to are required");
    await this.files.rename(orgId, id, body.from, body.to);
    return { ok: true };
  }

  @Post("mkdir")
  async mkdir(
    @ActiveOrg() orgId: string,
    @Param("id") id: string,
    @Body() body: { path?: string },
  ) {
    if (!body?.path) throw new BadRequestException("path is required");
    await this.files.mkdir(orgId, id, body.path);
    return { ok: true };
  }

  @Delete()
  @HttpCode(204)
  async remove(@ActiveOrg() orgId: string, @Param("id") id: string, @Query("path") path?: string) {
    if (!path) throw new BadRequestException("path is required");
    await this.files.remove(orgId, id, path);
  }
}
