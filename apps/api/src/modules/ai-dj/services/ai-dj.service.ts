import { Injectable } from '@nestjs/common';
import { ContentService } from '../../content/services/content.service';

@Injectable()
export class AiDjService {
  constructor(private readonly contentService: ContentService) {}

  reply(input: { sessionId?: string; message: string }) {
    const message = input.message.trim().toLowerCase();

    let replyText =
      '我已经接管当前听感轨道。你可以让我点歌、切风格、解释推荐，或者直接让我整理一组新的播放队列。';
    let contentIds = [
      'cnt_editorial_dusk',
      'cnt_focus_fm',
      'cnt_afterhours_loop',
    ];

    if (message.includes('粤语') || message.includes('cantopop')) {
      replyText =
        '这轮我会把播放器切到带霓虹感的粤语夜航线上，先给你一组更贴近城市夜色和港风编辑感的曲目。';
      contentIds = ['cnt_canton_midnight', 'cnt_canto_neon', 'cnt_city_rain'];
    } else if (
      message.includes('focus') ||
      message.includes('工作') ||
      message.includes('写') ||
      message.includes('code')
    ) {
      replyText =
        '收到。我会优先给你低干扰、节奏稳定、适合专注写作或编码的轨道，让播放器保持流动而不打断。';
      contentIds = [
        'cnt_focus_fm',
        'cnt_afterhours_loop',
        'cnt_editorial_dusk',
      ];
    } else if (
      message.includes('morning') ||
      message.includes('早') ||
      message.includes('通勤')
    ) {
      replyText =
        '这轮我把气压抬高一点，给你一组更轻、更有起步感的内容，适合早晨通勤和开工预热。';
      contentIds = ['cnt_morning_wire', 'cnt_editorial_dusk', 'cnt_city_rain'];
    } else if (message.includes('podcast') || message.includes('播客')) {
      replyText =
        '想切到信息流模式的话，我先给你一条短时长的编辑部播客，再保留一首过渡曲，方便你随时回到音乐。';
      contentIds = ['cnt_podcast_brief', 'cnt_editorial_dusk', 'cnt_focus_fm'];
    }

    const validContentIds = this.contentService
      .getByIds(contentIds)
      .map((item) => item.id);

    return {
      sessionId: input.sessionId ?? 'chat_stub',
      messageId: 'msg_stub',
      replyText,
      actions: [
        {
          type: 'queue_replace',
          payload: {
            contentIds: validContentIds,
          },
        },
      ],
    };
  }
}
