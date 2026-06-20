import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TrackDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) anonId?: string;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() props?: Record<string, unknown>;
}
