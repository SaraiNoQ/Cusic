'use client';

import type { TasteProfileDto, TasteTagDto } from '@music-ai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  fetchTasteReport,
  updateProfileTags,
} from '../../../lib/api/profile-api';
import { queryKeys } from '../../../lib/query/query-keys';
import { useAuthStore } from '../../../store/auth-store';
import styles from './TasteProfile.module.css';

/* ─── Tag type grouping ─── */

type TagAction = 'increase' | 'decrease' | 'remove';

const TAG_TYPE_LABELS: Record<string, string> = {
  artist: 'Artists / 艺人偏好',
  language: 'Languages / 语言偏好',
  genre: 'Genres / 流派偏好',
  mood: 'Moods / 情绪偏好',
  era: 'Eras / 时代偏好',
  type: 'Types / 类型偏好',
  album: 'Albums / 专辑偏好',
};

type PendingUpdate = {
  tag: TasteTagDto;
  action: TagAction;
};

function groupTags(
  tags: TasteTagDto[],
  pending: Map<string, PendingUpdate>,
): Map<string, { tag: TasteTagDto; pendingAction?: TagAction }[]> {
  const map = new Map<
    string,
    { tag: TasteTagDto; pendingAction?: TagAction }[]
  >();

  for (const tag of tags) {
    const t = tag.type || 'unknown';
    if (!map.has(t)) {
      map.set(t, []);
    }
    const key = `${tag.type}:${tag.value}`;
    const pendingEntry = pending.get(key);
    map.get(t)!.push({
      tag,
      pendingAction: pendingEntry?.action,
    });
  }

  return map;
}

function nextTagAction(current: TagAction | undefined): TagAction | undefined {
  if (!current) return 'increase';
  if (current === 'increase') return 'decrease';
  if (current === 'decrease') return 'remove';
  return undefined;
}

function actionLabel(action: TagAction | undefined): string {
  if (!action) return '';
  if (action === 'increase') return 'will increase';
  if (action === 'decrease') return 'will decrease';
  return 'will remove';
}

function levelBarClass(level: string): string {
  const v = level?.toLowerCase();
  if (v === 'high') return styles.levelBarFillHigh;
  if (v === 'medium') return styles.levelBarFillMedium;
  return styles.levelBarFillLow;
}

/* ─── Component ─── */

function TasteProfileContent() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Map<string, PendingUpdate>>(new Map());

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.tasteReport(),
    queryFn: fetchTasteReport,
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: PendingUpdate[]) =>
      updateProfileTags(
        updates.map((u) => ({
          type: u.tag.type,
          value: u.tag.value,
          action: u.action,
        })),
      ),
    onSuccess: (result) => {
      queryClient.setQueryData<TasteProfileDto>(
        queryKeys.tasteReport(),
        () => result.profile,
      );
      setPending(new Map());
    },
  });

  const handleTagClick = useCallback((tag: TasteTagDto) => {
    const key = `${tag.type}:${tag.value}`;
    setPending((prev) => {
      const current = prev.get(key);
      const next = nextTagAction(current?.action);
      const nextMap = new Map(prev);
      if (next) {
        nextMap.set(key, { tag, action: next });
      } else {
        nextMap.delete(key);
      }
      return nextMap;
    });
  }, []);

  const handleApply = useCallback(() => {
    if (pending.size === 0) return;
    updateMutation.mutate(Array.from(pending.values()));
  }, [pending, updateMutation]);

  const handleUndo = useCallback(() => {
    setPending(new Map());
  }, []);

  const groupedTags = useMemo(
    () => groupTags(profile?.tags ?? [], pending),
    [profile?.tags, pending],
  );

  const maxWeight = 2.0;

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className={styles.screen}>
        <div className={styles.container}>
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <span>TASTING YOUR PALETTE</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (isError) {
    return (
      <div className={styles.screen}>
        <div className={styles.container}>
          <div className={styles.errorWrap}>
            <div className={styles.errorIcon}>!</div>
            <strong>Unable to Load Taste Profile</strong>
            <p>
              {error instanceof Error
                ? error.message
                : 'Something went wrong while fetching your taste profile.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Empty state ── */
  if (!profile) {
    return (
      <div className={styles.screen}>
        <div className={styles.container}>
          <div className={styles.errorWrap}>
            <strong>No Taste Profile Yet</strong>
            <p>Listen to more music and your taste profile will appear here.</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main content ── */
  const sectionTypes = Array.from(groupedTags.keys()).sort();

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        {/* Title */}
        <div className={styles.title}>
          <span className={styles.titleEyebrow}>Profile</span>
          <h1>My Taste Profile / 我的听歌品味</h1>
        </div>

        {/* Summary */}
        {profile.summary && (
          <div className={styles.summaryCard}>
            <p>{profile.summary}</p>
          </div>
        )}

        {/* Exploration & Familiarity levels */}
        <div className={styles.levelRow}>
          <div className={styles.levelBadge}>
            <span className={styles.levelLabel}>Exploration</span>
            <span className={styles.levelValue}>
              {profile.explorationLevel ?? 'low'}
            </span>
            <div className={styles.levelBar}>
              <div
                className={`${styles.levelBarFill} ${levelBarClass(
                  profile.explorationLevel ?? 'low',
                )}`}
              />
            </div>
          </div>
          <div className={styles.levelBadge}>
            <span className={styles.levelLabel}>Familiarity</span>
            <span className={styles.levelValue}>
              {((profile as unknown as Record<string, unknown>)
                .familiarityLevel as string) ?? 'unknown'}
            </span>
            <div className={styles.levelBar}>
              <div
                className={`${styles.levelBarFill} ${levelBarClass(
                  ((profile as unknown as Record<string, unknown>)
                    .familiarityLevel as string) ?? 'low',
                )}`}
              />
            </div>
          </div>
        </div>

        {/* Pending action bar */}
        {pending.size > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 20,
              padding: '12px 16px',
              border: '1px solid rgba(246, 158, 63, 0.42)',
              borderRadius: 14,
              background: 'rgba(255, 146, 47, 0.08)',
            }}
          >
            <span
              style={{
                color: '#ffaf68',
                fontSize: 12,
                letterSpacing: '0.1em',
              }}
            >
              {pending.size} change{pending.size !== 1 ? 's' : ''} pending
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleUndo}
                disabled={updateMutation.isPending}
                style={{
                  height: 34,
                  padding: '0 14px',
                  border: '1px solid rgba(184, 139, 101, 0.42)',
                  borderRadius: 999,
                  background: 'rgba(8, 15, 23, 0.88)',
                  color: 'rgba(235, 224, 208, 0.78)',
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: updateMutation.isPending ? 0.5 : 1,
                }}
              >
                Undo
              </button>
              <button
                onClick={handleApply}
                disabled={updateMutation.isPending}
                style={{
                  height: 34,
                  padding: '0 14px',
                  border: '1px solid rgba(246, 158, 63, 0.72)',
                  borderRadius: 999,
                  background: 'rgba(255, 146, 47, 0.14)',
                  color: '#ffe1b9',
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: updateMutation.isPending ? 0.5 : 1,
                }}
              >
                {updateMutation.isPending ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>
        )}

        {/* Tag cloud by type */}
        {sectionTypes.length === 0 && (
          <div
            style={{
              color: 'rgba(190, 198, 201, 0.56)',
              fontSize: 14,
              textAlign: 'center',
              padding: '32px 16px',
            }}
          >
            No taste tags have been collected yet. Keep listening and they will
            appear here.
          </div>
        )}

        {sectionTypes.map((sectionType) => {
          const items = groupedTags.get(sectionType)!;
          return (
            <div key={sectionType} className={styles.tagSection}>
              <span className={styles.tagSectionHeading}>
                {TAG_TYPE_LABELS[sectionType] ?? sectionType.toUpperCase()}
              </span>
              <div className={styles.tagCloud}>
                {items.map(({ tag, pendingAction }) => {
                  const weightRatio = Math.min(tag.weight / maxWeight, 1);
                  const isNeg = tag.isNegative;

                  let chipMod = '';
                  if (pendingAction === 'increase')
                    chipMod = styles.tagChipIncrease;
                  else if (pendingAction === 'decrease')
                    chipMod = styles.tagChipDecrease;
                  else if (pendingAction === 'remove')
                    chipMod = styles.tagChipRemove;

                  let actionMod = '';
                  if (pendingAction === 'increase')
                    actionMod = styles.tagActionIncrease;
                  else if (pendingAction === 'decrease')
                    actionMod = styles.tagActionDecrease;
                  else if (pendingAction === 'remove')
                    actionMod = styles.tagActionRemove;

                  return (
                    <button
                      key={`${tag.type}:${tag.value}`}
                      type="button"
                      className={`${styles.tagChip} ${isNeg ? styles.tagChipNegative : ''} ${chipMod}`}
                      onClick={() => handleTagClick(tag)}
                    >
                      <span className={styles.tagValue}>{tag.value}</span>
                      <div className={styles.tagWeightBar}>
                        <div
                          className={`${styles.tagWeightFill} ${
                            isNeg
                              ? styles.tagWeightFillNegative
                              : styles.tagWeightFillPositive
                          }`}
                          style={{ width: `${weightRatio * 100}%` }}
                        />
                      </div>
                      {pendingAction && (
                        <span className={`${styles.tagAction} ${actionMod}`}>
                          {actionLabel(pendingAction)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Auth-gated wrapper ─── */

export default function TasteProfilePage() {
  const authUser = useAuthStore((state) => state.user);
  const isAuthPending = useAuthStore((state) => state.isPending);
  const openAuth = useAuthStore((state) => state.openAuth);

  /* Hydration still in progress */
  if (!authUser && isAuthPending) {
    return (
      <div className={styles.screen}>
        <div className={styles.container}>
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <span>LOADING</span>
          </div>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className={styles.screen}>
        <div className={styles.container}>
          <div className={styles.loginPrompt}>
            <p>Sign in to explore your taste profile.</p>
            <button type="button" onClick={openAuth}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <TasteProfileContent />;
}
