import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('@/components/bridge', () => ({ getBridge: () => null }));

import { SaveAudioButton } from './save-audio-button';

afterEach(() => vi.unstubAllGlobals());

it('downloads through the browser when there is no Electron bridge', async () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['wav'])) }),
  );
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  render(<SaveAudioButton url="/audio/take.wav" suggestedName="take.wav" />);
  const button = screen.getByRole('button');
  expect(button).toBeEnabled();
  fireEvent.click(button);

  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(fetchMock).toHaveBeenCalledWith('/audio/take.wav');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:take');
});
