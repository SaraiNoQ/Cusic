import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the PlayerScreen component to avoid the deep dependency chain
// (zustand stores, API clients, custom hooks, etc.)
jest.mock('../../features/player/components/PlayerScreen', () => ({
  PlayerScreen: () => {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'player-screen-mock' },
      'PlayerScreen Mock',
    );
  },
}));

describe('Home page', () => {
  it('renders without crashing', () => {
    const Page = require('../app/page').default;
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });

  it('module can be imported', () => {
    expect(() => {
      require('../app/page');
    }).not.toThrow();
  });
});
