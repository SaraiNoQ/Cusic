import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

class CreatePlaylistDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;
}

class AddPlaylistItemsDto {
  @IsArray()
  contentIds!: string[];
}

class FavoriteDto {
  @IsString()
  contentId!: string;

  @IsString()
  favoriteType!: string;
}

@ApiTags('library')
@ApiBearerAuth()
@Controller('library')
export class LibraryController {
  @Get('playlists')
  @ApiOperation({ summary: 'List user playlists' })
  @ApiResponse({ status: 200, description: 'Playlist list' })
  listPlaylists() {
    return {
      success: true,
      data: {
        items: [],
      },
      meta: {
        total: 0,
      },
    };
  }

  @Post('playlists')
  @ApiOperation({ summary: 'Create a playlist' })
  @ApiResponse({ status: 200, description: 'Playlist created' })
  createPlaylist(@Body() body: CreatePlaylistDto) {
    return {
      success: true,
      data: {
        id: 'pl_stub',
        title: body.title,
        description: body.description,
      },
      meta: {},
    };
  }

  @Post('playlists/:id/items')
  @ApiOperation({ summary: 'Append content items to a playlist' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Playlist items added' })
  addPlaylistItems(@Param('id') id: string, @Body() body: AddPlaylistItemsDto) {
    return {
      success: true,
      data: {
        playlistId: id,
        addedCount: body.contentIds.length,
      },
      meta: {},
    };
  }

  @Post('favorites')
  @ApiOperation({ summary: 'Create a favorite item' })
  @ApiResponse({ status: 200, description: 'Favorite created' })
  createFavorite(@Body() body: FavoriteDto) {
    return {
      success: true,
      data: body,
      meta: {},
    };
  }

  @Delete('favorites/:contentId')
  @ApiOperation({ summary: 'Delete a favorite item' })
  @ApiParam({ name: 'contentId', type: String })
  @ApiResponse({ status: 200, description: 'Favorite removed' })
  removeFavorite(@Param('contentId') contentId: string) {
    return {
      success: true,
      data: {
        contentId,
        removed: true,
      },
      meta: {},
    };
  }
}

