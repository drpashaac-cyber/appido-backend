import { Module } from "@nestjs/common";
import { ChannelsController } from "./channels.controller";
import { AuthModule } from "../auth/auth.module";

@Module({ imports: [AuthModule], controllers: [ChannelsController] })
export class ChannelsModule {}
