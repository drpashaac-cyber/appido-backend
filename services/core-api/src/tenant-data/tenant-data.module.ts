import { Module } from "@nestjs/common";
import { TenantDataController } from "./tenant-data.controller";
import { TenantDataService } from "./tenant-data.service";
import { AuthModule } from "../auth/auth.module";

@Module({ imports: [AuthModule], controllers: [TenantDataController], providers: [TenantDataService] })
export class TenantDataModule {}
