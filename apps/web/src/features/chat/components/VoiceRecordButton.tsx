'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './VoiceRecordButton.module.css';

type ProcessingState = 'idle' | 'recording' | 'transcribing' | 'generating';

interface VoiceRecordButtonProps {
  onTranscription: (text: string) => void;
}

export function VoiceRecordButton({
  onTranscription,
}: Readonly<VoiceRecordButtonProps>) {
  const [processingState, setProcessingState] =
    useState<ProcessingState>('idle');
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRecording = processingState === 'recording';
  const isProcessing =
    processingState === 'transcribing' || processingState === 'generating';

  // Duration timer
  useEffect(() => {
    if (isRecording) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof MediaRecorder === 'undefined') {
      alert(
        '您的浏览器不支持录音功能，请使用 Chrome、Edge 或 Firefox 浏览器。',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick best supported MIME type (webm is widely supported, mp4 for Safari)
      let mimeType: string;
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        mimeType = 'audio/webm';
      }

      const recorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType,
        });

        if (audioBlob.size === 0) {
          setProcessingState('idle');
          return;
        }

        setProcessingState('transcribing');
        try {
          const { transcribeAudio } =
            await import('../../../lib/api/voice-api');
          const result = (await transcribeAudio(audioBlob)) as {
            text?: string;
            transcription?: string;
          };
          const text = result?.text ?? result?.transcription ?? '';
          if (text) {
            onTranscription(text);
          } else {
            alert('语音识别未返回结果，请重试或检查语音服务配置。');
          }
        } catch {
          alert('语音识别失败，请检查网络连接后重试。');
        } finally {
          setProcessingState('idle');
        }
      };

      recorder.onerror = () => {
        setProcessingState('idle');
        alert('录音过程中出现错误，请重试。');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setProcessingState('recording');
    } catch {
      alert('无法访问麦克风，请在浏览器设置中允许麦克风权限后重试。');
    }
  }, [onTranscription]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (isProcessing) return;
      void startRecording();
    },
    [startRecording, isProcessing],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (isRecording) stopRecording();
    },
    [stopRecording, isRecording],
  );

  const handleMouseLeave = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  // Touch event support
  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      event.preventDefault();
      if (isProcessing) return;
      void startRecording();
    },
    [startRecording, isProcessing],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      event.preventDefault();
      if (isRecording) stopRecording();
    },
    [stopRecording, isRecording],
  );

  const statusLabel = isProcessing
    ? processingState === 'transcribing'
      ? '转写中...'
      : '生成语音中...'
    : isRecording
      ? `录制中 ${formatDuration(duration)}`
      : undefined;

  const buttonTitle = isProcessing ? '正在处理音频...' : '按住录音，松开发送';

  return (
    <div className={styles.voiceButtonWrapper}>
      {isRecording && (
        <span className={styles.durationLabel}>{formatDuration(duration)}</span>
      )}
      <button
        type="button"
        className={`${styles.voiceButton} ${isRecording ? styles.recording : ''} ${isProcessing ? styles.processing : ''}`}
        aria-label={statusLabel ?? '语音输入'}
        disabled={isProcessing}
        title={buttonTitle}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <span className={styles.recordingIcon} aria-hidden="true">
          {isProcessing ? (
            <span className={styles.statusText}>{statusLabel}</span>
          ) : isRecording ? (
            '\u25CF'
          ) : (
            '\uD83C\uDFA4'
          )}
        </span>
      </button>
      {isProcessing && (
        <span className={styles.transcribingLabel}>
          {processingState === 'transcribing' ? '识别中...' : '生成语音中...'}
        </span>
      )}
    </div>
  );
}
