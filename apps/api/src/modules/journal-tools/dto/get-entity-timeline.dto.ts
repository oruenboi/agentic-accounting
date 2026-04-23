import { IsString, IsUUID, MinLength } from 'class-validator';

export class GetEntityTimelineInputDto {
  @IsUUID()
  organization_id!: string;

  @IsString()
  @MinLength(1)
  entity_type!: string;

  @IsString()
  @MinLength(1)
  entity_id!: string;
}
