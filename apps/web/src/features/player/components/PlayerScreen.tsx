'use client';

import { useEffect } from 'react';
import { AtmosphereCanvas } from '../../atmosphere/components/AtmosphereCanvas';
import { ChatPanel } from '../../chat/components/ChatPanel';
import { useChatController } from '../../chat/hooks/useChatController';
import { SearchOverlay } from '../../search/components/SearchOverlay';
import { useSearchController } from '../../search/hooks/useSearchController';
import styles from '../PlayerScreen.module.css';
import { usePlayerController } from '../hooks/usePlayerController';
import { PlayerHero } from './PlayerHero';

const promptSuggestions = [
  '来点适合深夜写方案的粤语歌',
  '给我一组适合编码的曲目',
  '切到早晨通勤模式',
  '推荐一个短播客',
];

export function PlayerScreen() {
  const player = usePlayerController();
  const chat = useChatController(player);
  const search = useSearchController();

  useEffect(() => {
    if (!search.isSearchOpen) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [search.isSearchOpen]);

  return (
    <main className={styles.screen}>
      <AtmosphereCanvas className={styles.canvas} />
      <div className={styles.noise} />

      <audio
        ref={player.audioRef}
        src={player.currentTrack?.audioUrl ?? undefined}
        preload="metadata"
        onLoadedMetadata={player.audioHandlers.onLoadedMetadata}
        onTimeUpdate={player.audioHandlers.onTimeUpdate}
        onPlay={player.audioHandlers.onPlay}
        onPause={player.audioHandlers.onPause}
        onEnded={player.audioHandlers.onEnded}
      />

      <div className={styles.viewport}>
        <PlayerHero
          currentTrack={player.currentTrack}
          queue={player.queue}
          activeIndex={player.activeIndex}
          statusText={player.statusText}
          isPlaying={player.isPlaying}
          progressSeconds={player.progressSeconds}
          durationSeconds={player.durationSeconds}
          isFavorite={
            player.currentTrack
              ? player.favoriteIds.includes(player.currentTrack.id)
              : false
          }
          onOpenSearch={search.openSearch}
          onPrevious={() => void player.playPrevious()}
          onTogglePlayPause={() => void player.togglePlayPause()}
          onNext={() => void player.playNext()}
          onToggleFavorite={() => {
            if (player.currentTrack) {
              void player.toggleFavorite(player.currentTrack);
            }
          }}
          onAddToPlaylist={() => {
            if (player.currentTrack) {
              void player.addCurrentTrackToPlaylist(player.currentTrack);
            }
          }}
          onSelectQueueIndex={(index) => void player.playQueueIndex(index)}
        />

        <ChatPanel
          messages={chat.messages}
          input={chat.input}
          isPending={chat.isPending}
          prompts={promptSuggestions}
          onInputChange={chat.setInput}
          onPromptSelect={(prompt) => void chat.sendMessage(prompt)}
          onSubmit={() => chat.sendMessage()}
        />
      </div>

      <SearchOverlay
        isOpen={search.isSearchOpen}
        query={search.searchQuery}
        isSearching={search.isSearching}
        total={search.total}
        items={search.searchResults}
        onClose={search.closeSearch}
        onQueryChange={search.setSearchQuery}
        onPlay={(track) => {
          void player.playTrack(track);
          search.closeSearch();
        }}
        onQueue={(track) => void player.addToQueue(track)}
        onAssist={(track) => {
          void chat.sendMessage(
            `围绕《${track.title}》给我推荐一组延展曲目，并解释理由`,
          );
          search.closeSearch();
        }}
      />
    </main>
  );
}
