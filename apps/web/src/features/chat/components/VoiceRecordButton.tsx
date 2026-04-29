'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './VoiceRecordButton.module.css';

interface VoiceRecordButtonProps {
  onTranscription: (text: string) => void;
}

export function VoiceRecordButton({
  onTranscription,
}: Readonly<VoiceRecordButtonProps>) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof MediaRecorder === 'undefined') {
      alert('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4',
      });

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        setIsRecording(false);

        if (audioBlob.size === 0) return;

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
          }
        } catch {
          alert('Failed to transcribe audio. Please try again.');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      alert(
        'Microphone access was denied. Please allow microphone access in your browser settings.',
      );
    }
  }, [onTranscription]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      void startRecording();
    },
    [startRecording],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      stopRecording();
    },
    [stopRecording],
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
      void startRecording();
    },
    [startRecording],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      event.preventDefault();
      stopRecording();
    },
    [stopRecording],
  );

  return (
    <button
      type="button"
      className={`${styles.voiceButton} ${isRecording ? styles.recording : ''}`}
      aria-label={isRecording ? 'Recording...' : 'Voice input'}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <span className={styles.recordingIcon} aria-hidden="true">
        {isRecording ? '\u25CF' : '\uD83C\uDFA4'}
      </span>
    </button>
  );
}
