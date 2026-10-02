import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const BLOCK_SOURCES = ['UserBlock', 'AutoBlock'] as const;
export type BlockSource = (typeof BLOCK_SOURCES)[number];

export class BlockNumberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sender: string;

  // The phone's own automatic blocks (high-confidence scam catch-up) report
  // themselves as AutoBlock so the server can tell them from a user's tap.
  // Omitted by older clients, which keeps the previous UserBlock default.
  @IsOptional()
  @IsIn(BLOCK_SOURCES)
  source?: BlockSource;
}
