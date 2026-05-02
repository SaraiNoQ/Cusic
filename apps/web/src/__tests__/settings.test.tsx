import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../lib/api/voice-api', () => ({
  getAvailableVoices: jest.fn(async () => ({
    success: true,
    data: {
      provider: 'mimo',
      voices: [
        {
          id: 'bingtang',
          name: '冰糖',
          language: 'zh',
          gender: 'female',
        },
      ],
    },
  })),
}));

jest.mock('../lib/api/system-api', () => ({
  fetchSystemHealth: jest.fn(async () => ({
    success: true,
    data: {
      status: 'ok',
      service: 'api',
      version: '0.1.0',
      providers: {
        content: 'jamendo',
        llm: 'ok',
        voice: 'mimo',
        db: 'ok',
        redis: 'ok',
      },
    },
  })),
}));

import { SettingsPanel } from '../features/settings/components/SettingsPanel';

describe('SettingsPanel', () => {
  it('shows provider status from system health and voice endpoints', async () => {
    render(<SettingsPanel />);

    expect(await screen.findByText('jamendo')).toBeInTheDocument();
    expect(screen.getAllByText('mimo')).toHaveLength(2);
    expect(screen.getAllByText('ok')).toHaveLength(3);
    expect(screen.getByLabelText('Preferred Voice')).toHaveValue('bingtang');
  });
});
