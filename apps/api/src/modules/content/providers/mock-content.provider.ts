import { Injectable } from '@nestjs/common';
import type { ContentCatalogItem } from '../types/content-catalog-item.type';

const demoAudioUrl =
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

@Injectable()
export class MockContentProvider {
  private readonly catalog: ContentCatalogItem[] = [
    {
      id: 'cnt_editorial_dusk',
      type: 'track',
      title: 'Editorial Dusk',
      artists: ['The Paper Lamps'],
      album: 'Workbench Hours',
      durationMs: 224000,
      language: 'en',
      coverUrl: null,
      audioUrl: demoAudioUrl,
      playable: true,
    },
    {
      id: 'cnt_canton_midnight',
      type: 'track',
      title: 'Midnight Tramlines',
      artists: ['南岛女声'],
      album: '霓虹慢车',
      durationMs: 198000,
      language: 'zh',
      coverUrl: null,
      audioUrl: demoAudioUrl,
      playable: true,
    },
    {
      id: 'cnt_focus_fm',
      type: 'track',
      title: 'Focus FM',
      artists: ['Analog Weather'],
      album: 'Late Draft',
      durationMs: 246000,
      language: 'instrumental',
      coverUrl: null,
      audioUrl: demoAudioUrl,
      playable: true,
    },
    {
      id: 'cnt_city_rain',
      type: 'track',
      title: 'City Rain Index',
      artists: ['Soft Voltage'],
      album: 'Rain Glass',
      durationMs: 232000,
      language: 'en',
      coverUrl: null,
      audioUrl: demoAudioUrl,
      playable: true,
    },
    {
      id: 'cnt_canto_neon',
      type: 'track',
      title: 'Neon Ferry',
      artists: ['港夜编辑部'],
      album: '湾岸文稿',
      durationMs: 214000,
      language: 'zh',
      coverUrl: null,
      audioUrl: demoAudioUrl,
      playable: true,
    },
    {
      id: 'cnt_morning_wire',
      type: 'track',
      title: 'Morning Wireframe',
      artists: ['Atlas Choir'],
      album: 'Open Tabs',
      durationMs: 205000,
      language: 'en',
      coverUrl: null,
      audioUrl: demoAudioUrl,
      playable: true,
    },
    {
      id: 'cnt_afterhours_loop',
      type: 'track',
      title: 'Afterhours Loop',
      artists: ['Quiet District'],
      album: 'Grey Desk Blue Light',
      durationMs: 259000,
      language: 'instrumental',
      coverUrl: null,
      audioUrl: demoAudioUrl,
      playable: true,
    },
    {
      id: 'cnt_podcast_brief',
      type: 'podcast',
      title: 'Signal Briefing',
      artists: ['Cusic Radio Desk'],
      album: 'Episode 08',
      durationMs: 1280000,
      language: 'en',
      coverUrl: null,
      audioUrl: demoAudioUrl,
      playable: true,
    },
  ];

  listCatalog() {
    return this.catalog;
  }
}
