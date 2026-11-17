/** Shapes of tehqeqatehadees.com's public JSON, as observed on 17 Nov 2026. Only fields we read. */

export interface ListRow {
  id: string;
  slug: string;
  title: string;
  book: string;
  chapter?: string;
  authored_at?: string;
  updated_at: string;
}

export interface ListPage {
  total_records: number;
  data: ListRow[];
}

export interface HadithRef {
  id: string;
  slug: string;
  title: string;
  book: string;
  chapter?: string;
}

export interface HadithDetail {
  id: string;
  slug: string;
  title: string;
  hukm?: string;
  html_content: string;
  references?: string;
  book: string;
  chapter?: string;
  type?: string;
  authored_at?: string;
  updated_at: string;
  related?: HadithRef[];
  narrators?: { slug: string; name: string; arabic_name?: string; start: number; end: number }[];
}

export interface Book {
  id: string;
  name: string;
  aliases?: string[];
  is_series?: boolean;
  volume_no?: number | null;
  published_at?: string | null;
  sort_order?: number | null;
  description?: string | null;
  pdf_file_id?: string | null;
  count?: number;
  updated_at?: string;
}

export interface Chapter {
  id: string;
  slug: string;
  name: string;
  parent?: string | null;
  order?: number | null;
  description?: string | null;
  count?: number;
  updated_at?: string;
}

export interface NarratorListRow {
  slug: string;
  name: string;
  [key: string]: unknown;
}

export interface NarratorDetail {
  id: string;
  slug: string;
  name: string;
  arabic_name?: string;
  aliases?: string[];
  death_note?: string;
  death_year?: number | null;
  century?: number | null;
  study_count?: number;
  hadith_count?: number;
  excerpt?: string;
  book?: string;
  study?: {
    hadith: HadithRef;
    sections?: { heading: string; content: string }[];
    references?: string;
  } | null;
  other_studies?: { hadith: HadithRef; start: number; end: number }[];
  related?: { slug: string }[];
}

export interface Announcement {
  id: string;
  type: string;
  content: string;
  createdAt?: { _seconds: number };
}

export interface FileRow {
  id: string;
  file?: { name: string; url: string };
  image?: { url: string };
  createdAt?: { _seconds: number };
}
