import { IsArray, IsString } from 'class-validator';

export class AddPlaylistItemsDto {
  @IsArray()
  @IsString({ each: true })
  contentIds!: string[];
}
