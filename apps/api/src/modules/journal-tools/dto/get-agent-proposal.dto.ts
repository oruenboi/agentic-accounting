import { IsUUID } from 'class-validator';

export class GetAgentProposalInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  proposal_id!: string;
}
