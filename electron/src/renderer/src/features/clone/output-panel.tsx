import { AudioLinesIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SaveAudioButton } from '@/components/save-audio-button';
import { WaveformPlayer } from '@/components/waveform-player';
import { audioUrl } from '@/lib/api/client';
import { useDeleteHistoryItem } from '@/hooks/use-history';
import { clearLatestOutput, useLatestOutput } from '@/lib/store/output';
import { activePlaybackSource, stopActivePlayback } from '@/lib/audio/playback';
import { formatSeconds } from './format';
import { AudioQuality } from './audio-quality';
import { AudioFileDetails } from './audio-file-details';
import { SectionLabel } from './section-label';

export function OutputPanel() {
  const { t } = useTranslation();
  const { result, objectUrl, text } = useLatestOutput();
  const deleteTake = useDeleteHistoryItem();
  if (!result || !objectUrl) return null;

  const dismiss = () => {
    if (activePlaybackSource() === 'output') stopActivePlayback();
    clearLatestOutput();
  };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  return (
    <section
      aria-label={t('clone.output_title')}
      className="w-full shrink-0 border-t border-border/60 bg-muted/15 px-6 py-3"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>
            <AudioLinesIcon aria-hidden="true" />
            {t('clone.output_title')}
          </SectionLabel>
          <div className="flex items-center gap-1">
            <SaveAudioButton
              url={result.audioPath ? audioUrl(result.audioPath) : undefined}
              suggestedName={`voicestudio-${result.id ?? stamp}.wav`}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              aria-label={t('clone.history_delete')}
              title={t('clone.history_delete')}
              disabled={deleteTake.isPending}
              onClick={() => {
                if (!result.id) return dismiss();
                deleteTake.mutate(result.id, { onSuccess: dismiss });
              }}
            >
              <Trash2Icon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.close')}
              title={t('common.close')}
              onClick={dismiss}
            >
              <XIcon />
            </Button>
          </div>
        </div>
        {result && objectUrl ? (
          <>
            <WaveformPlayer key={objectUrl} src={objectUrl} source="output" height={36} />
            <AudioFileDetails blob={result.blob} />
            {result.audioPath && <AudioQuality key={objectUrl} audioPath={result.audioPath} />}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p
                className="line-clamp-2 min-w-40 flex-1 text-sm text-muted-foreground"
                title={text}
              >
                {text}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {t('clone.output_meta', {
                  duration: formatSeconds(result.durationSeconds),
                  gen: formatSeconds(result.genTimeSeconds),
                })}
              </span>
            </div>
          </>
        ) : (
          <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed text-[length:var(--text-label)] text-muted-foreground">
            {t('clone.output_empty')}
          </div>
        )}
      </div>
    </section>
  );
}
