import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { AddPlaylistItemsDto } from '../dto/add-playlist-items.dto';
import { CreatePlaylistDto } from '../dto/create-playlist.dto';
import { FavoriteDto } from '../dto/favorite.dto';
import { LibraryService } from '../services/library.service';

@ApiTags('library')
@Controller('library')
@UseGuards(OptionalJwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('playlists')
  @ApiOperation({ summary: 'List user playlists' })
  @ApiResponse({ status: 200, description: 'Playlist list' })
  async listPlaylists(@Req() request: RequestWithUser) {
    const items = await this.libraryService.listPlaylists(request.user?.id);

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
  async createPlaylist(
    @Body() body: CreatePlaylistDto,
    @Req() request: RequestWithUser,
  ) {
    const playlist = await this.libraryService.createPlaylist(
      body.title,
      body.description,
      request.user?.id,
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
  async addPlaylistItems(
    @Param('id') id: string,
    @Body() body: AddPlaylistItemsDto,
    @Req() request: RequestWithUser,
  ) {
    const result = await this.libraryService.addItems(
      id,
      body.contentIds,
      request.user?.id,
    );

    return {
      success: true,
      data: result ?? { playlistId: id, addedCount: 0, itemCount: 0 },
      meta: {},
    };
  }

  @Get('favorites')
  @ApiOperation({ summary: 'List favorite items' })
  @ApiResponse({ status: 200, description: 'Favorite list' })
  async listFavorites(@Req() request: RequestWithUser) {
    const items = await this.libraryService.listFavorites(request.user?.id);

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

  @Post('favorites')
  @ApiOperation({ summary: 'Create a favorite item' })
  @ApiResponse({ status: 200, description: 'Favorite created' })
  async createFavorite(
    @Body() body: FavoriteDto,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.libraryService.createFavorite(
        {
          contentId: body.contentId,
          favoriteType: body.favoriteType as
            | 'track'
            | 'podcast'
            | 'radio'
            | 'album',
        },
        request.user?.id,
      ),
      meta: {},
    };
  }

  @Delete('favorites/:contentId')
  @ApiOperation({ summary: 'Delete a favorite item' })
  @ApiParam({ name: 'contentId', type: String })
  @ApiResponse({ status: 200, description: 'Favorite removed' })
  async removeFavorite(
    @Param('contentId') contentId: string,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.libraryService.removeFavorite(
        contentId,
        request.user?.id,
      ),
      meta: {},
    };
  }
}
