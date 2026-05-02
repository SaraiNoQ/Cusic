import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthPanel } from '../features/auth/components/AuthPanel';
import { ChatComposer } from '../features/chat/components/ChatComposer';
import { SearchInput } from '../features/search/components/SearchInput';

describe('Web interaction smoke tests', () => {
  it('submits email verification login fields', async () => {
    const requestCode = jest.fn().mockResolvedValue(undefined);
    const login = jest.fn().mockResolvedValue(undefined);

    render(
      <AuthPanel
        isOpen
        isPending={false}
        error={null}
        cooldownSeconds={0}
        onClose={jest.fn()}
        onRequestCode={requestCode}
        onLogin={login}
      />,
    );

    fireEvent.change(screen.getByLabelText('EMAIL'), {
      target: { value: 'sara@example.com' },
    });
    fireEvent.click(screen.getByText('SEND CODE'));
    await waitFor(() =>
      expect(requestCode).toHaveBeenCalledWith('sara@example.com'),
    );

    fireEvent.change(screen.getByLabelText('CODE'), {
      target: { value: '123456' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'LOGIN' }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith('sara@example.com', '123456'),
    );
  });

  it('updates search query text', () => {
    const onChange = jest.fn();

    render(<SearchInput value="" isSearching={false} onChange={onChange} />);

    fireEvent.change(
      screen.getByPlaceholderText('Search by title, artist, album, mood'),
      { target: { value: 'rainy canton pop' } },
    );

    expect(onChange).toHaveBeenCalledWith('rainy canton pop');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('submits AI DJ text from the composer', () => {
    const onSubmit = jest.fn();

    render(
      <ChatComposer
        value="play something focused"
        isPending={false}
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
