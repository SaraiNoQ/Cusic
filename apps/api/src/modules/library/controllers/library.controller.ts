import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AddPlaylistItemsDto } from '../dto/add-playlist-items.dto';
import { CreatePlaylistDto } from '../dto/create-playlist.dto';
import { FavoriteDto } from '../dto/favorite.dto';
import { LibraryService } from '../services/library.service';

@ApiTags('library')
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('playlists')
  @ApiOperation({ summary: 'List user playlists' })
  @ApiResponse({ status: 200, description: 'Playlist list' })
  listPlaylists() {
    const items = this.libraryService.listPlaylists();

    return {
      success: true,
      data: {
        items,
      },
      meta: {
        total: items.length,
      },
    };
  }

  @Post('playlists')
  @ApiOperation({ summary: 'Create a playlist' })
  @ApiResponse({ status: 200, description: 'Playlist created' })
  createPlaylist(@Body() body: CreatePlaylistDto) {
    const playlist = this.libraryService.createPlaylist(
      body.title,
      body.description,
    );

    return {
      success: true,
      data: playlist,
      meta: {},
    };
  }

  @Post('playlists/:id/items')
  @ApiOperation({ summary: 'Append content items to a playlist' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Playlist items added' })
  addPlaylistItems(@Param('id') id: string, @Body() body: AddPlaylistItemsDto) {
    const result = this.libraryService.addItems(id, body.contentIds);

    return {
      success: true,
      data: result ?? { playlistId: id, addedCount: 0, itemCount: 0 },
      meta: {},
    };
  }

  @Post('favorites')
  @ApiOperation({ summary: 'Create a favorite item' })
  @ApiResponse({ status: 200, description: 'Favorite created' })
  createFavorite(@Body() body: FavoriteDto) {
    return {
      success: true,
      data: this.libraryService.createFavorite({
        contentId: body.contentId,
        favoriteType: body.favoriteType as
          | 'track'
          | 'podcast'
          | 'radio'
          | 'album',
      }),
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
      data: this.libraryService.removeFavorite(contentId),
      meta: {},
    };
  }
}
