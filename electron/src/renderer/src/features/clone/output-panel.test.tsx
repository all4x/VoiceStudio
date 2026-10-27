import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('@/components/save-audio-button', () => ({ SaveAudioButton: () => <div>save</div> }));
vi.mock('@/components/waveform-player', () => ({ WaveformPlayer: () => <div>player</div> }));
vi.mock('@/lib/api/client', () => ({ audioUrl: (path: string) => `/audio/${path}` }));
vi.mock('@/hooks/use-history', () => ({
  useDeleteHistoryItem: () => ({ mutate: mock.mutate, isPending: false }),
}));
vi.mock('./audio-quality', () => ({ AudioQuality: () => null }));
vi.mock('./audio-file-details', () => ({ AudioFileDetails: () => null }));

import { outputStore, setLatestOutput } from '@/lib/store/output';
import { OutputPanel } from './output-panel';

const take = (id: string | null) =>
  ({
    blob: new Blob(['wav']),
    id,
    audioPath: id ? `${id}.wav` : null,
    durationSeconds: 1,
    genTimeSeconds: 1,
  }) as never;

beforeEach(() => {
  mock.mutate.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
});

it('deletes the take from history, then clears the preview', () => {
  setLatestOutput(take('take-1'), 'hello');
  mock.mutate.mockImplementation((_id: string, opts: { onSuccess: () => void }) =>
    opts.onSuccess(),
  );
  render(<OutputPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'clone.history_delete' }));
  expect(mock.mutate).toHaveBeenCalledWith('take-1', expect.anything());
  expect(outputStore.state.result).toBeNull();
});

it('only clears the preview when the take was never saved', () => {
  setLatestOutput(take(null), 'hello');
  render(<OutputPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'clone.history_delete' }));
  expect(mock.mutate).not.toHaveBeenCalled();
  expect(outputStore.state.result).toBeNull();
});
