import { Module } from "@nestjs/common";
import { OwnerController } from "./owner.controller";
import { OwnerService } from "./owner.service";
import { AuthModule } from "../auth/auth.module";

@Module({ imports: [AuthModule], controllers: [OwnerController], providers: [OwnerService] })
export class OwnerModule {}
