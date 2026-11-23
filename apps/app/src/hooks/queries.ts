/**
 * Every screen reads data through these hooks; they call @tehqeqat/core, never SQL.
 * Content keys include the snapshot generation so a swap refetches everything.
 */
import {
  chapterNames,
  getChapterBySlug,
  getContentInfo,
  getHadith,
  getNarrator,
  isBookmarked,
  listAnnouncements,
  listBookmarks,
  listBooks,
  listChapters,
  listFiles,
  listHadithBySlugs,
  listHadithForDisplay,
  listHistory,
  listNarrators,
  listRecentSearches,
  parseRichText,
  richTextToPlain,
  searchHadith,
  searchNarrators,
  type DisplayListOptions,
  type SearchOptions,
} from '@tehqeqat/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import { useDb } from '@/providers/app-providers';

export function useContentQuery<T>(key: readonly unknown[], fn: () => Promise<T>, enabled = true) {
  const { generation } = useDb();
  return useQuery({ queryKey: ['content', generation, ...key], queryFn: fn, enabled });
}

export function useSearch(query: string, opts: SearchOptions) {
  const { content, generation } = useDb();
  const q = query.trim();
  return useQuery({
    queryKey: ['content', generation, 'search', q, opts.book ?? null, opts.chapter ?? null],
    queryFn: async () => {
      const result = await searchHadith(content, q, { ...opts, limit: 200 });
      const titles = await listHadithBySlugs(
        content,
        result.hits.map((h) => h.slug),
      );
      const titleBySlug = new Map(titles.map((t) => [t.slug, t.title]));
      return {
        ...result,
        hits: result.hits.map((h) => ({ ...h, title: titleBySlug.get(h.slug) ?? h.title_text })),
      };
    },
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useNarratorSearch(query: string) {
  const { content } = useDb();
  const q = query.trim();
  return useContentQuery(['narrator-search', q], () => searchNarrators(content, q, 5), q.length > 1);
}

export function useHadithList(opts: DisplayListOptions = {}) {
  const { content } = useDb();
  return useContentQuery(['list', opts.book ?? null, opts.chapter ?? null, opts.narrator ?? null], () =>
    listHadithForDisplay(content, opts),
  );
}

export function useHadith(slug: string, enabled = true) {
  const { content } = useDb();
  return useContentQuery(['hadith', slug], async () => {
    const h = await getHadith(content, slug);
    if (!h) return null;
    // Parse the Word HTML once per narration, off the render path.
    return {
      ...h,
      title: richTextToPlain(h.title_html),
      titleBlocks: parseRichText(h.title_html),
      hukmBlocks: parseRichText(h.hukm_html),
      sectionBlocks: h.sections.map((s) => ({
        heading: richTextToPlain(s.heading),
        blocks: parseRichText(s.content),
      })),
      referenceBlocks: parseRichText(h.references_html, 'arabic'),
      relatedTitles: await listHadithBySlugs(
        content,
        h.related.map((r) => r.slug),
      ),
    };
  }, enabled);
}

export function useBooks() {
  const { content } = useDb();
  return useContentQuery(['books'], () => listBooks(content));
}

export function useChapters() {
  const { content } = useDb();
  return useContentQuery(['chapters'], () => listChapters(content));
}

export function useChapter(slug: string) {
  const { content } = useDb();
  return useContentQuery(['chapter', slug], () => getChapterBySlug(content, slug));
}

export function useChapterNames() {
  const { content } = useDb();
  return useContentQuery(['chapter-names'], () => chapterNames(content));
}

export function useNarrators() {
  const { content } = useDb();
  return useContentQuery(['narrators'], () => listNarrators(content));
}

export function useNarrator(slug: string, enabled = true) {
  const { content } = useDb();
  return useContentQuery(['narrator', slug], async () => {
    const n = await getNarrator(content, slug);
    if (!n) return null;
    return {
      ...n,
      studyBlocks: (n.study?.sections ?? []).map((s) => ({
        heading: richTextToPlain(s.heading),
        blocks: parseRichText(s.content),
      })),
      referenceBlocks: parseRichText(n.study?.references_html, 'arabic'),
      relatedNarrators: (await listNarrators(content)).filter((x) => n.related.includes(x.slug)),
    };
  }, enabled);
}

export function useAnnouncements() {
  const { content } = useDb();
  return useContentQuery(['announcements'], () => listAnnouncements(content));
}

export function useFiles() {
  const { content } = useDb();
  return useContentQuery(['files'], () => listFiles(content));
}

export function useContentInfo() {
  const { content } = useDb();
  return useContentQuery(['info'], () => getContentInfo(content));
}

// ── user data ────────────────────────────────────────────────────────────────

export function useBookmarks() {
  const { user, content, generation } = useDb();
  return useQuery({
    queryKey: ['user', 'bookmarks', generation],
    queryFn: async () => {
      const marks = await listBookmarks(user);
      return listHadithBySlugs(
        content,
        marks.map((m) => m.slug),
      );
    },
  });
}

export function useHistory() {
  const { user, content, generation } = useDb();
  return useQuery({
    queryKey: ['user', 'history', generation],
    queryFn: async () => {
      const rows = await listHistory(user);
      return listHadithBySlugs(
        content,
        rows.map((m) => m.slug),
      );
    },
  });
}

export function useIsBookmarked(slug: string) {
  const { user } = useDb();
  return useQuery({ queryKey: ['user', 'bookmarked', slug], queryFn: () => isBookmarked(user, slug) });
}

export function useRecentSearches() {
  const { user } = useDb();
  return useQuery({ queryKey: ['user', 'recent-searches'], queryFn: () => listRecentSearches(user) });
}

/** Refetch user-data queries after a write. */
export function useInvalidateUser() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['user'] });
}
