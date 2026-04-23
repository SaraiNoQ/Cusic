import { IsOptional, IsString } from 'class-validator';

export class ChatTurnDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  message!: string;

  @IsString()
  responseMode!: string;
}
