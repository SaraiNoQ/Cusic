'use client';

import { useEffect, useRef } from 'react';
import { AtmosphereCanvas } from '../../atmosphere/components/AtmosphereCanvas';
import { AuthPanel } from '../../auth/components/AuthPanel';
import { ChatOverlay } from '../../chat/components/ChatOverlay';
import { ChatPanel } from '../../chat/components/ChatPanel';
import { useChatController } from '../../chat/hooks/useChatController';
import { ImportOverlay } from '../../imports/components/ImportOverlay';
import { useImportsController } from '../../imports/hooks/useImportsController';
import { SearchOverlay } from '../../search/components/SearchOverlay';
import { useSearchController } from '../../search/hooks/useSearchController';
import { useAuthStore } from '../../../store/auth-store';
import { useUiStore } from '../../../store/ui-store';
import styles from '../PlayerScreen.module.css';
import { usePlayerController } from '../hooks/usePlayerController';
import { ControlStrip } from './ControlStrip';
import { DeviceHeader } from './DeviceHeader';
import { FlipClock } from './FlipClock';
import { QueueStrip } from './QueueStrip';
import { RecommendationOverlay } from './RecommendationOverlay';

const promptSuggestions = [
  '来一组深夜写作的粤语歌',
  '把当前曲目扩展成一条太空夜航歌单',
  '讲讲这首歌背后的专辑故事',
  '切到更冷一点的电子氛围',
];

export function PlayerScreen() {
  const player = usePlayerController();
  const chat = useChatController(player);
  const imports = useImportsController();
  const search = useSearchController();
  const isRecommendationOpen = useUiStore(
    (state) => state.isRecommendationOpen,
  );
  const isChatOverlayOpen = useUiStore((state) => state.isChatOverlayOpen);
  const isImportsOpen = useUiStore((state) => state.isImportsOpen);
  const setRecommendationOpen = useUiStore(
    (state) => state.setRecommendationOpen,
  );
  const setChatOverlayOpen = useUiStore((state) => state.setChatOverlayOpen);
  const setImportsOpen = useUiStore((state) => state.setImportsOpen);
  const authUser = useAuthStore((state) => state.user);
  const isAuthOpen = useAuthStore((state) => state.isAuthOpen);
  const isAuthPending = useAuthStore((state) => state.isPending);
  const authError = useAuthStore((state) => state.error);
  const authCooldownSeconds = useAuthStore((state) => state.cooldownSeconds);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const openAuth = useAuthStore((state) => state.openAuth);
  const closeAuth = useAuthStore((state) => state.closeAuth);
  const requestAuthCode = useAuthStore((state) => state.requestCode);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (
      !search.isSearchOpen &&
      !isRecommendationOpen &&
      !isChatOverlayOpen &&
      !isImportsOpen &&
      !isAuthOpen
    ) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [
    isAuthOpen,
    isChatOverlayOpen,
    isImportsOpen,
    isRecommendationOpen,
    search.isSearchOpen,
  ]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const handleMove = (event: MouseEvent) => {
      const rect = shell.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      shell.style.setProperty('--mouse-x', `${px * 100}%`);
      shell.style.setProperty('--mouse-y', `${py * 100}%`);
    };

    const handleLeave = () => {
      shell.style.setProperty('--mouse-x', '50%');
      shell.style.setProperty('--mouse-y', '36%');
    };

    window.addEventListener('mousemove', handleMove);
    shell.addEventListener('mouseleave', handleLeave);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      shell.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  const openRecommendation = () => {
    search.closeSearch();
    closeAuth();
    setChatOverlayOpen(false);
    setImportsOpen(false);
    setRecommendationOpen(true);
  };

  const closeRecommendation = () => {
    setRecommendationOpen(false);
  };

  const openSearch = () => {
    closeRecommendation();
    setChatOverlayOpen(false);
    setImportsOpen(false);
    search.openSearch();
  };

  const openAuthPanel = () => {
    closeRecommendation();
    setChatOverlayOpen(false);
    setImportsOpen(false);
    openAuth();
  };

  const openChatOverlay = () => {
    search.closeSearch();
    closeRecommendation();
    closeAuth();
    setImportsOpen(false);
    setChatOverlayOpen(true);
    if (!chat.hasHydratedSession) {
      void chat.hydrateConversation();
    }
  };

  const closeChatOverlay = () => {
    setChatOverlayOpen(false);
  };

  const openImports = () => {
    search.closeSearch();
    closeRecommendation();
    closeAuth();
    setChatOverlayOpen(false);
    setImportsOpen(true);
  };

  const closeImports = () => {
    setImportsOpen(false);
  };

  return (
    <main className={styles.screen}>
      <AtmosphereCanvas
        className={styles.canvas}
        isPlaying={player.isPlaying}
      />
      <div className={styles.backgroundBloom} />
      <div className={styles.noise} />
      <div className={styles.scanlines} />

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
        <div className={styles.deviceFrame}>
          <div
            ref={shellRef}
            className={`${styles.deviceShell} ${player.isPlaying ? styles.deviceShellLive : ''}`}
          >
            <DeviceHeader
              onOpenSearch={openSearch}
              onOpenAuth={openAuthPanel}
              onLogout={() => void logout()}
              userLabel={authUser?.displayName ?? authUser?.email ?? null}
              isPlaying={player.isPlaying}
              statusText={player.statusText}
            />

            <section className={styles.heroPanel}>
              <div className={styles.heroGlow} />
              <div className={styles.heroSun} />
              <div className={styles.heroEarth}>
                <span />
                <span />
              </div>
              <FlipClock />
            </section>

            <ControlStrip
              track={player.currentTrack}
              isPlaying={player.isPlaying}
              isFavorite={
                player.currentTrack
                  ? player.favoriteIds.includes(player.currentTrack.id)
                  : false
              }
              progressSeconds={player.progressSeconds}
              durationSeconds={player.durationSeconds}
              statusText={player.statusText}
              queueDepth={player.queue.length}
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
            />

            <QueueStrip
              queue={player.queue}
              activeIndex={player.activeIndex}
              canOpenImports={Boolean(authUser)}
              onSelectIndex={(index) => void player.playQueueIndex(index)}
              onOpenImports={openImports}
              onOpenRecommendation={openRecommendation}
            />

            <ChatPanel
              messages={chat.messages}
              input={chat.input}
              isPending={chat.isPending}
              prompts={promptSuggestions}
              statusText={player.statusText}
              currentTrackTitle={
                player.currentTrack
                  ? `${player.currentTrack.title} - ${player.currentTrack.artists[0] ?? 'Cusic'}`
                  : null
              }
              onInputChange={chat.setInput}
              onPromptSelect={(prompt) => void chat.sendMessage(prompt)}
              onSubmit={() => chat.sendMessage()}
              onOpenConversation={openChatOverlay}
            />

            <footer className={styles.deviceFooter}>
              <span>CUSIC FM</span>
              <div aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <span>
                CONNECTED
                <i />
              </span>
            </footer>
          </div>
        </div>
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
            `围绕《${track.title}》继续扩展一组更有太空电台感的曲目`,
          );
          search.closeSearch();
        }}
      />

      <RecommendationOverlay
        isOpen={isRecommendationOpen}
        nowRecommendation={player.nowRecommendation}
        dailyPlaylist={player.dailyPlaylist}
        onClose={closeRecommendation}
        onPlay={(track) => {
          void player.playTrack(track);
          closeRecommendation();
        }}
        onQueue={(track) => void player.addToQueue(track)}
        onLoadDaily={() => {
          void player.loadDailyPlaylist();
          closeRecommendation();
        }}
      />

      <ChatOverlay
        isOpen={isChatOverlayOpen}
        messages={chat.messages}
        input={chat.input}
        isPending={chat.isPending}
        prompts={promptSuggestions}
        canSaveGeneratedPlaylists={chat.canSaveGeneratedPlaylists}
        savingPlaylistMessageId={chat.savingPlaylistMessageId}
        onClose={closeChatOverlay}
        onInputChange={chat.setInput}
        onPromptSelect={(prompt) => void chat.sendMessage(prompt)}
        onSavePlaylist={(messageId) =>
          void chat.savePlaylistFromMessage(messageId)
        }
        onSubmit={() => void chat.sendMessage()}
      />

      <ImportOverlay
        isOpen={isImportsOpen}
        providerName={imports.providerName}
        importType={imports.importType}
        payloadText={imports.payloadText}
        jobs={imports.jobs}
        formError={imports.formError}
        isPending={imports.isPending}
        statusLabel={imports.statusLabel}
        onClose={closeImports}
        onProviderNameChange={imports.setProviderName}
        onImportTypeChange={imports.setImportType}
        onPayloadTextChange={imports.setPayloadText}
        onSubmit={() => void imports.submitImport()}
      />

      <AuthPanel
        isOpen={isAuthOpen}
        isPending={isAuthPending}
        error={authError}
        cooldownSeconds={authCooldownSeconds}
        onClose={closeAuth}
        onRequestCode={requestAuthCode}
        onLogin={login}
      />
    </main>
  );
}
