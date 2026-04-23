import { IsString } from 'class-validator';

export class FavoriteDto {
  @IsString()
  contentId!: string;

  @IsString()
  favoriteType!: string;
}
