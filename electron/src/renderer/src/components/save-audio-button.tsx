import { DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getBridge } from './bridge';
import { Button } from './ui/button';
import { saveExport } from '@/lib/export-history';

/** Plain-browser fallback (no Electron bridge): fetch the file and trigger a download. */
async function downloadInBrowser(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function SaveAudioButton({
  url,
  suggestedName,
  disabled = false,
  iconOnly = false,
}: {
  url?: string;
  suggestedName: string;
  disabled?: boolean;
  /** A compact secondary action: the label becomes the tooltip. */
  iconOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const bridge = getBridge();

  const save = async () => {
    if (!url) return;
    setSaving(true);
    try {
      if (!bridge) {
        await downloadInBrowser(url, suggestedName);
        return;
      }
      const saved = await saveExport(url, suggestedName);
      if (!saved) return;
      if (!saved.canceled && saved.path) {
        const path = saved.path;
        toast.success(t('clone.saved_to', { path }), {
          action: {
            label: t('clone.reveal'),
            onClick: () =>
              void bridge.files.revealPath(path).catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                toast.error(t('clone.download_failed', { message }));
              }),
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t('clone.download_failed', { message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size={iconOnly ? 'icon-sm' : 'sm'}
      aria-label={iconOnly ? t('clone.download') : undefined}
      title={iconOnly ? t('clone.download') : undefined}
      onClick={() => void save()}
      disabled={disabled || saving || !url}
    >
      <DownloadIcon />
      {iconOnly ? null : t('clone.download')}
    </Button>
  );
}
