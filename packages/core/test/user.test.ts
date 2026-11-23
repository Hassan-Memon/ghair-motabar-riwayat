import { beforeEach, describe, expect, it } from 'vitest';

import { NodeDb } from '../src/adapters/node';
import { failureState, shouldCheck, STATE_KEYS, successState, toHex } from '../src/sync';
import {
  addRecentSearch,
  clearHistory,
  getSettings,
  getState,
  initUserDb,
  isBookmarked,
  listBookmarks,
  listHistory,
  listRecentSearches,
  parseSettings,
  recordOpened,
  RECENT_SEARCH_LIMIT,
  setSetting,
  setState,
  toggleBookmark,
} from '../src/user';

let db: NodeDb;
beforeEach(async () => {
  db = new NodeDb(':memory:');
  await initUserDb(db);
});

describe('user db', () => {
  it('toggles bookmarks and lists newest first', async () => {
    expect(await toggleBookmark(db, 'a', '2026-01-01')).toBe(true);
    expect(await toggleBookmark(db, 'b', '2026-01-02')).toBe(true);
    expect(await isBookmarked(db, 'a')).toBe(true);
    expect((await listBookmarks(db)).map((b) => b.slug)).toEqual(['b', 'a']);
    expect(await toggleBookmark(db, 'a')).toBe(false);
    expect(await isBookmarked(db, 'a')).toBe(false);
  });

  it('records history once per narration, latest first', async () => {
    await recordOpened(db, 'a', '2026-01-01');
    await recordOpened(db, 'b', '2026-01-02');
    await recordOpened(db, 'a', '2026-01-03');
    expect((await listHistory(db)).map((h) => h.slug)).toEqual(['a', 'b']);
    await clearHistory(db);
    expect(await listHistory(db)).toEqual([]);
  });

  it('keeps the latest recent searches, trimmed and de-duplicated', async () => {
    for (let i = 0; i < RECENT_SEARCH_LIMIT + 3; i++) {
      await addRecentSearch(db, `q${i}`, `2026-01-${String(i + 1).padStart(2, '0')}`);
    }
    await addRecentSearch(db, '  q12  ', '2026-02-01');
    await addRecentSearch(db, '   ');
    const r = await listRecentSearches(db);
    expect(r).toHaveLength(RECENT_SEARCH_LIMIT);
    expect(r[0]).toBe('q12');
  });

  it('stores settings and falls back to defaults on bad values', async () => {
    await setSetting(db, 'theme', 'dark');
    await setSetting(db, 'allowCellular', true);
    await setSetting(db, 'textScale', 1.2);
    await setSetting(db, 'language', 'en');
    let s = await getSettings(db);
    expect(s).toMatchObject({ theme: 'dark', allowCellular: true, textScale: 1.2, language: 'en' });
    await setSetting(db, 'language', null);
    s = await getSettings(db);
    expect(s.language).toBeNull();
    expect(
      parseSettings([
        { key: 'theme', value: 'purple' },
        { key: 'textScale', value: '9' },
      ]),
    ).toMatchObject({ theme: 'system', textScale: 1.6 });
  });

  it('stores and clears content state', async () => {
    await setState(db, { a: '1', b: '2' });
    await setState(db, { a: null });
    expect(await getState(db)).toEqual({ b: '2' });
  });
});

describe('refresh rules', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');

  it('checks on first launch and after 24 hours, always when asked', () => {
    expect(shouldCheck({}, 'launch', now)).toBe(true);
    const recent = { [STATE_KEYS.lastCheck]: '2026-11-20T00:00:00Z' };
    expect(shouldCheck(recent, 'launch', now)).toBe(false);
    expect(shouldCheck(recent, 'manual', now)).toBe(true);
    expect(shouldCheck({ [STATE_KEYS.lastCheck]: '2026-11-19T11:00:00Z' }, 'background', now)).toBe(true);
  });

  it('backs off 1 h, 6 h, then 24 h after failures', () => {
    let state: Record<string, string> = {};
    const waits: number[] = [];
    for (let i = 0; i < 4; i++) {
      state = { ...state, ...failureState(state, 'offline', now) };
      waits.push((Date.parse(state[STATE_KEYS.nextRetry]!) - now) / 3_600_000);
    }
    expect(waits).toEqual([1, 6, 24, 24]);
    expect(shouldCheck(state, 'launch', now)).toBe(false);
    expect(shouldCheck(state, 'manual', now)).toBe(true);
    expect(successState(now)[STATE_KEYS.failures]).toBeNull();
  });

  it('retries a download that waited for Wi-Fi', () => {
    const s = { [STATE_KEYS.lastCheck]: '2026-11-20T11:00:00Z', [STATE_KEYS.waitingForWifi]: '1' };
    expect(shouldCheck(s, 'launch', now)).toBe(true);
  });

  it('hex-encodes digests', () => {
    expect(toHex(new Uint8Array([0, 15, 255]))).toBe('000fff');
  });
});
