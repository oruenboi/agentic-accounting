import { IsUUID } from 'class-validator';

export class GetApprovalRequestInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  approval_request_id!: string;
}
