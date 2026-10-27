import { expect, it } from 'vitest';
import { blankLongformDraft } from './longform-session';
import { isStoryText, parseStoryText, storyToText } from './story-text';

const profiles = [
  { id: 'p-rafom', name: 'Rafom' },
  { id: 'p-lula', name: 'Lula' },
];

it('round-trips cast, line voices, speeds, tags and inline voices by name', () => {
  let n = 0;
  const draft = {
    ...blankLongformDraft(),
    title: 'Minha história',
    globalSpeed: 1.05,
    cast: [
      { id: 'narrator', name: 'Narrator', profileId: 'p-lula' },
      { id: 'adrian', name: 'Adrian', profileId: null },
    ],
    lines: [
      { id: 'a', character: 'narrator', text: '# Capítulo 1', profileId: null },
      {
        id: 'b',
        character: 'adrian',
        text: 'Olá [laughter]\nsegunda [voice:p-rafom]linha[voice:default] [pause 0.5s]',
        profileId: 'p-rafom',
        speed: 1.2,
      },
      { id: 'c', text: 'Sem personagem', profileId: null },
    ],
  };
  const text = storyToText(draft, profiles);
  expect(text).toContain('cast: Narrator = Lula');
  expect(text).toContain('=== Adrian | voice: Rafom | speed: 1.2');
  expect(text).toContain('[voice:Rafom]linha');
  expect(isStoryText(text)).toBe(true);

  const { patch, unknownVoices } = parseStoryText(text, profiles, () => `id${n++}`);
  expect(unknownVoices).toEqual([]);
  expect(patch.title).toBe('Minha história');
  expect(patch.globalSpeed).toBe(1.05);
  expect(patch.cast).toEqual(draft.cast);
  expect(patch.lines.map((line) => ({ ...line, id: undefined }))).toEqual(
    draft.lines.map((line) => ({ ...line, id: undefined })),
  );
});

it('accepts AI-authored files: case-insensitive voices, new characters, unknown voices reported', () => {
  const { patch, unknownVoices } = parseStoryText(
    '\uFEFFVoiceStudio Story v1\r\n; comment\r\ncast: Mara = rafom\r\n\r\n=== Mara | speed: 9\r\nOi!\r\n=== Cole | voice: Nobody\r\nE aí?\r\n',
    profiles,
  );
  expect(patch.cast).toEqual([
    { id: 'mara', name: 'Mara', profileId: 'p-rafom' },
    { id: 'cole', name: 'Cole', profileId: null },
  ]);
  expect(patch.lines.map((l) => [l.character, l.text, l.speed, l.profileId])).toEqual([
    ['mara', 'Oi!', null, null],
    ['cole', 'E aí?', undefined, null],
  ]);
  expect(unknownVoices).toEqual(['Nobody']);
  expect(isStoryText('Just a plain story')).toBe(false);
});
