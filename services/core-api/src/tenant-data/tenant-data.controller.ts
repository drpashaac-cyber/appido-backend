import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { PageQueryDto } from "../common/dto/page-query.dto";
import { AuditService } from "../audit/audit.service";
import { TenantDataService } from "./tenant-data.service";

class ReplyDto {
  @IsString() @MinLength(1) @MaxLength(4000) text!: string;
}

class ConsentDto {
  @IsIn(["marketing", "ai", "analytics"]) purpose!: string;
  @IsBoolean() granted!: boolean;
  @IsOptional() @IsString() @MaxLength(32) source?: string;
}

@ApiTags("tenant")
@ApiCookieAuth()
@Controller("v1")
@UseGuards(AuthGuard)
export class TenantDataController {
  constructor(private readonly data: TenantDataService, private readonly audit: AuditService) {}

  @Get("customers")
  customers(@Req() req: AuthedRequest, @Query() q: PageQueryDto) {
    return this.data.customers(req.rls, q.limit, q.cursor);
  }

  @Get("customers/:id")
  customer(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.data.customerDetail(req.rls, id);
  }

  @Get("customers/:id/messages")
  messages(@Req() req: AuthedRequest, @Param("id") id: string, @Query() q: PageQueryDto) {
    return this.data.messages(req.rls, id, q.limit);
  }

  @Post("customers/:id/reply")
  reply(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: ReplyDto) {
    return this.data.sendReply(req.rls, id, body.text);
  }

  @Post("customers/:id/read")
  read(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.data.markRead(req.rls, id);
  }

  @Get("customers/:id/consent")
  listConsent(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.data.listConsent(req.rls, id);
  }

  @Post("customers/:id/consent")
  setConsent(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: ConsentDto) {
    return this.data.setConsent(req.rls, id, body);
  }

  @Get("customers/:id/export")
  exportCustomer(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.data.exportCustomer(req.rls, id);
  }

  @Delete("customers/:id")
  async deleteCustomer(@Req() req: AuthedRequest, @Param("id") id: string) {
    const res = await this.data.deleteCustomer(req.rls, id);
    await this.audit.record({ actorUserId: req.user?.id, tenantId: req.user?.tenantId ?? null, action: "customer.delete", target: id });
    return res;
  }

  @Get("products")
  products(@Req() req: AuthedRequest) {
    return this.data.products(req.rls);
  }

  @Get("transactions")
  transactions(@Req() req: AuthedRequest, @Query() q: PageQueryDto) {
    return this.data.transactions(req.rls, q.limit, q.cursor);
  }

  @Get("inbox")
  inbox(@Req() req: AuthedRequest, @Query() q: PageQueryDto) {
    return this.data.inbox(req.rls, q.limit);
  }

  @Get("usage")
  usage(@Req() req: AuthedRequest) {
    return this.data.usage(req.rls);
  }

  @Get("dashboard/summary")
  summary(@Req() req: AuthedRequest) {
    return this.data.dashboardSummary(req.rls);
  }
}
