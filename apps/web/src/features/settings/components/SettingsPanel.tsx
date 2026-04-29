'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useUiStore } from '../../../store/ui-store';
import { useAuthStore } from '../../../store/auth-store';
import { getAvailableVoices } from '../../../lib/api/voice-api';
import type { VoiceInfo } from '../../../lib/api/voice-api';
import styles from './SettingsPanel.module.css';

function getLlmEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('llm_enabled');
  if (stored === null) return true;
  return stored === 'true';
}

function setLlmEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('llm_enabled', String(enabled));
}

function getStoredVoice(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('preferred_voice') ?? '';
}

function setStoredVoice(voice: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('preferred_voice', voice);
}

export function SettingsPanel() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const authUser = useAuthStore((state) => state.user);
  const hydrateAuth = useAuthStore((state) => state.hydrate);

  const [llmEnabled, setLlmEnabledState] = useState(true);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [provider, setProvider] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voicesLoading, setVoicesLoading] = useState(true);

  useEffect(() => {
    setLlmEnabledState(getLlmEnabled());
    setSelectedVoice(getStoredVoice());
    void hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    void getAvailableVoices()
      .then((res) => {
        setVoices(res.data.voices);
        setProvider(res.data.provider);
        if (!getStoredVoice() && res.data.voices.length > 0) {
          setSelectedVoice(res.data.voices[0].id);
          setStoredVoice(res.data.voices[0].id);
        }
      })
      .catch(() => {
        // Voices endpoint may not be available
      })
      .finally(() => {
        setVoicesLoading(false);
      });
  }, []);

  const handleLlmToggle = useCallback(() => {
    setLlmEnabledState((prev) => {
      const next = !prev;
      setLlmEnabled(next);
      return next;
    });
  }, []);

  const handleVoiceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const voice = e.target.value;
      setSelectedVoice(voice);
      setStoredVoice(voice);
    },
    [],
  );

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link
            href="/"
            className={styles.backLink}
            aria-label="Back to player"
          >
            &#x2190;
          </Link>
          <h1>Settings</h1>
        </div>
      </header>

      <div className={styles.content}>
        {/* Theme Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Theme</h2>
          <div className={styles.sectionLabel}>
            <span className={styles.sectionLabelText}>Display Mode</span>
            <div className={styles.themeToggle} aria-label="Display mode">
              <button
                type="button"
                className={theme === 'dark' ? styles.themeToggleActive : ''}
                onClick={() => setTheme('dark')}
              >
                DARK
              </button>
              <button
                type="button"
                className={theme === 'light' ? styles.themeToggleActive : ''}
                onClick={() => setTheme('light')}
              >
                LIGHT
              </button>
            </div>
          </div>
        </section>

        {/* LLM Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>LLM</h2>
          <div className={styles.sectionLabel}>
            <span className={styles.sectionLabelText}>LLM Enabled</span>
            <div className={styles.toggleSwitch}>
              <input
                type="checkbox"
                id="llm-toggle"
                checked={llmEnabled}
                onChange={handleLlmToggle}
              />
              <label htmlFor="llm-toggle" />
            </div>
          </div>
        </section>

        {/* Voice Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Voice</h2>
          <div className={styles.sectionLabel}>
            <span className={styles.sectionLabelText}>Voice Provider</span>
            <span className={styles.sectionValue}>{provider || 'stub'}</span>
          </div>
          {voices.length > 0 && (
            <div className={styles.sectionLabel}>
              <label
                htmlFor="voice-selector"
                className={styles.sectionLabelText}
              >
                Preferred Voice
              </label>
              <select
                id="voice-selector"
                className={styles.voiceSelect}
                value={selectedVoice}
                onChange={handleVoiceChange}
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.language.toUpperCase()} ({v.gender})
                  </option>
                ))}
              </select>
            </div>
          )}
          {!voicesLoading && voices.length === 0 && (
            <div className={styles.sectionLabel}>
              <span className={styles.sectionLabelText}>
                No voices available
              </span>
            </div>
          )}
        </section>

        {/* Account Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Account</h2>
          {authUser ? (
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>
                {authUser.avatarUrl ? (
                  <img src={authUser.avatarUrl} alt="" />
                ) : (
                  (authUser.displayName || authUser.email || '?').charAt(0)
                )}
              </div>
              <div className={styles.userDetails}>
                {authUser.displayName ? (
                  <span className={styles.userName}>
                    {authUser.displayName}
                  </span>
                ) : null}
                <span className={styles.userEmail}>{authUser.email}</span>
              </div>
            </div>
          ) : (
            <p className={styles.notLoggedIn}>Not logged in</p>
          )}
        </section>
      </div>
    </div>
  );
}
