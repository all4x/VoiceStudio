import type { Character, Draft, Line } from './longform-session';

/**
 * Plain-text round trip for a Stories script: cast, per-line character, voice
 * and speed, plus the inline tags the editor inserts. Voices are written by
 * profile *name* so a person (or an AI asked to draft a story) can author the
 * file without knowing profile ids; import maps names back to ids.
 */
export const STORY_TEXT_HEADER = 'VoiceStudio Story v1';

type Profile = { id: string; name: string };

const STORY_TAGS =
  '[laughter] [sigh] [question-en] [surprise-wa] [confirmation-en] [dissatisfaction-hnn] [pause 0.5s]';

const formatSpeed = (speed: number) => String(Math.round(speed * 100) / 100);

function voiceName(id: string | null | undefined, profiles: Profile[]) {
  if (!id) return '';
  return profiles.find((p) => p.id === id)?.name ?? id;
}

function resolveVoice(value: string, profiles: Profile[]) {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  return (
    profiles.find((p) => p.name.trim().toLowerCase() === key)?.id ??
    profiles.find((p) => p.id === value.trim())?.id
  );
}

const mapInlineVoices = (text: string, map: (value: string) => string) =>
  text.replace(/\[voice:([^\]]+)\]/g, (_, value: string) =>
    value === 'default' ? '[voice:default]' : `[voice:${map(value)}]`,
  );

const clean = (value: string) => value.replace(/[|\r\n]+/g, ' ').trim();

export function isStoryText(text: string) {
  return text.replace(/^﻿/, '').trimStart().startsWith(STORY_TEXT_HEADER);
}

export function storyToText(draft: Draft, profiles: Profile[]) {
  const castName = new Map(draft.cast.map((c) => [c.id, clean(c.name)]));
  const out = [
    STORY_TEXT_HEADER,
    '; Lines starting with ";" before the first "===" are comments.',
    '; Each line of the story starts with "=== Character" (blank = default voice),',
    ';   optionally "| voice: <voice name>" and "| speed: <0.5-2>", then its text below.',
    `; Voices available: ${profiles.map((p) => clean(p.name)).join(', ') || '(none)'}`,
    `; Tags inside text: ${STORY_TAGS}`,
    ';   Inline voice switch: [voice:<voice name>]text[voice:default]',
    ';   A text starting with "# " is a chapter heading.',
    `title: ${clean(draft.title)}`,
    `speed: ${formatSpeed(draft.globalSpeed)}`,
    ...draft.cast.map(
      (c) => `cast: ${castName.get(c.id)} = ${clean(voiceName(c.profileId, profiles))}`,
    ),
    '',
  ];
  for (const line of draft.lines) {
    const head = [`=== ${(line.character && castName.get(line.character)) || ''}`.trimEnd()];
    if (line.profileId) head.push(`voice: ${clean(voiceName(line.profileId, profiles))}`);
    if (line.speed != null) head.push(`speed: ${formatSpeed(line.speed)}`);
    out.push(head.join(' | '));
    out.push(mapInlineVoices(line.text, (id) => voiceName(id, profiles)));
  }
  return out.join('\n') + '\n';
}

export interface ParsedStory {
  patch: Pick<Draft, 'title' | 'globalSpeed' | 'cast' | 'lines'>;
  /** Voice names that matched no installed profile (left unassigned). */
  unknownVoices: string[];
}

const parseSpeed = (value: string) => {
  const speed = Number(value.replace(',', '.'));
  return Number.isFinite(speed) && speed >= 0.5 && speed <= 2 ? speed : null;
};

export function parseStoryText(
  text: string,
  profiles: Profile[],
  makeId: () => string = () => crypto.randomUUID(),
): ParsedStory {
  const rows = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const unknown = new Set<string>();
  const voice = (value: string) => {
    const id = resolveVoice(value, profiles);
    if (id === undefined) unknown.add(value.trim());
    return id ?? null;
  };
  const cast: Character[] = [];
  const character = (name: string) => {
    const existing = cast.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const base =
      name.toLowerCase() === 'narrator'
        ? 'narrator'
        : name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'char';
    let id = base;
    for (let n = 2; cast.some((c) => c.id === id); n++) id = `${base}-${n}`;
    const created = { id, name, profileId: null };
    cast.push(created);
    return created;
  };
  let title = '';
  let globalSpeed = 1;
  const lines: Line[] = [];
  let current: { line: Line; body: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const body = current.body.join('\n').replace(/^\n+|\s+$/g, '');
    current.line.text = mapInlineVoices(body, (value) => voice(value) ?? value);
    lines.push(current.line);
    current = null;
  };
  for (const row of rows.slice(rows.findIndex((r) => r.trim() === STORY_TEXT_HEADER) + 1)) {
    if (/^===(\s|$)/.test(row)) {
      flush();
      const [name, ...fields] = row.slice(3).split('|');
      const line: Line = { id: makeId(), text: '', profileId: null };
      if (name.trim()) line.character = character(name.trim()).id;
      for (const field of fields) {
        const [key, ...rest] = field.split(':');
        const value = rest.join(':').trim();
        if (/^\s*voice\s*$/i.test(key)) line.profileId = voice(value);
        else if (/^\s*speed\s*$/i.test(key)) line.speed = parseSpeed(value);
      }
      current = { line, body: [] };
    } else if (current) current.body.push(row);
    else if (/^\s*title\s*:/i.test(row)) title = row.slice(row.indexOf(':') + 1).trim();
    else if (/^\s*speed\s*:/i.test(row))
      globalSpeed = parseSpeed(row.slice(row.indexOf(':') + 1).trim()) ?? 1;
    else if (/^\s*cast\s*:/i.test(row)) {
      const [name, value = ''] = row.slice(row.indexOf(':') + 1).split('=');
      if (name.trim()) character(name.trim()).profileId = voice(value);
    }
  }
  flush();
  return {
    patch: { title, globalSpeed, cast, lines },
    unknownVoices: [...unknown].filter(Boolean),
  };
}
