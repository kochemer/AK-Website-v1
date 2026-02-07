import { DateTime } from 'luxon';
import * as cheerio from 'cheerio';

export type DateSource = 'html' | 'tavily' | 'none' | 'time_text';
export type DateSourceDetail = 'jsonld' | 'meta' | 'time' | 'time_text' | 'tavily' | 'none';
export type DateConfidence = 'high' | 'medium' | 'low';

export type ExtractPublishedAtOptions = {
  weekStart?: Date | string;
  weekEnd?: Date | string;
  domainRule?: {
    dateSelectors?: {
      meta?: string[];
      jsonld?: boolean;
      cssTime?: string[];
    };
  };
};

export type ExtractPublishedAtResult = {
  publishedAt: string | null;
  rawValue?: string;
  source: DateSource;
  sourceDetail: DateSourceDetail;
  confidence: DateConfidence;
};

const TZ_ABBREVIATION_MAP: Record<string, string> = {
  ET: 'America/New_York',
  EST: 'America/New_York',
  EDT: 'America/New_York',
  PT: 'America/Los_Angeles',
  PST: 'America/Los_Angeles',
  PDT: 'America/Los_Angeles',
  GMT: 'UTC',
  UTC: 'UTC'
};

function normalizeTimezone(raw: string): { value: string; tzExplicit: boolean } {
  let value = raw;
  let tzExplicit = false;

  for (const [abbr, zone] of Object.entries(TZ_ABBREVIATION_MAP)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'g');
    if (regex.test(value)) {
      value = value.replace(regex, zone);
      tzExplicit = true;
    }
  }

  // ISO with Z or offset counts as explicit
  if (/[Zz]|[+-]\\d{2}:?\\d{2}$/.test(value)) {
    tzExplicit = true;
  }

  return { value, tzExplicit };
}

function getAllowedRange(options?: ExtractPublishedAtOptions): { min: DateTime; max: DateTime } {
  const now = DateTime.utc();
  let min = now.minus({ years: 2 });
  let max = now.plus({ days: 1 });

  if (options?.weekStart && options?.weekEnd) {
    const weekStart = typeof options.weekStart === 'string'
      ? DateTime.fromISO(options.weekStart, { zone: 'utc' })
      : DateTime.fromJSDate(options.weekStart).toUTC();
    const weekEnd = typeof options.weekEnd === 'string'
      ? DateTime.fromISO(options.weekEnd, { zone: 'utc' })
      : DateTime.fromJSDate(options.weekEnd).toUTC();

    if (weekStart.isValid && weekEnd.isValid && weekStart < min) {
      min = weekStart.startOf('day');
      max = weekEnd.endOf('day');
    }
  }

  return { min, max };
}

function isWithinRange(dt: DateTime, options?: ExtractPublishedAtOptions): boolean {
  const { min, max } = getAllowedRange(options);
  return dt >= min && dt <= max;
}

function degradeConfidence(confidence: DateConfidence): DateConfidence {
  if (confidence === 'high') return 'medium';
  if (confidence === 'medium') return 'low';
  return 'low';
}

function normalizeRawDate(
  raw: string,
  options?: ExtractPublishedAtOptions
): { iso: string | null; confidence: DateConfidence; raw: string } {
  const trimmed = raw.trim();

  if (/^\\d{10}$/.test(trimmed)) {
    const dt = DateTime.fromSeconds(Number(trimmed), { zone: 'utc' });
    return dt.isValid && isWithinRange(dt, options)
      ? { iso: dt.toUTC().toISO(), confidence: 'medium', raw: trimmed }
      : { iso: null, confidence: 'low', raw: trimmed };
  }

  if (/^\\d{13}$/.test(trimmed)) {
    const dt = DateTime.fromMillis(Number(trimmed), { zone: 'utc' });
    return dt.isValid && isWithinRange(dt, options)
      ? { iso: dt.toUTC().toISO(), confidence: 'medium', raw: trimmed }
      : { iso: null, confidence: 'low', raw: trimmed };
  }

  const isoAttempt = DateTime.fromISO(trimmed, { setZone: true });
  if (isoAttempt.isValid && isWithinRange(isoAttempt, options)) {
    return { iso: isoAttempt.toUTC().toISO(), confidence: 'high', raw: trimmed };
  }

  const rfcAttempt = DateTime.fromRFC2822(trimmed, { setZone: true });
  if (rfcAttempt.isValid && isWithinRange(rfcAttempt, options)) {
    return { iso: rfcAttempt.toUTC().toISO(), confidence: 'high', raw: trimmed };
  }

  const tzNormalized = normalizeTimezone(trimmed);
  const normalized = tzNormalized.value;

  const formatsWithZone = [
    "LLLL d, yyyy 'at' h:mm a z",
    "LLLL d, yyyy h:mm a z",
    "LLL d, yyyy h:mm a z",
    "yyyy-MM-dd HH:mm z"
  ];

  for (const format of formatsWithZone) {
    const dt = DateTime.fromFormat(normalized, format, { setZone: true });
    if (dt.isValid && isWithinRange(dt, options)) {
      const confidence = tzNormalized.tzExplicit ? 'high' : 'medium';
      return { iso: dt.toUTC().toISO(), confidence, raw: trimmed };
    }
  }

  const formatsNoZone = [
    "LLLL d, yyyy 'at' h:mm a",
    "LLLL d, yyyy h:mm a",
    "LLL d, yyyy h:mm a",
    "LLLL d, yyyy",
    "LLL d, yyyy",
    'yyyy-MM-dd',
    'yyyy/MM/dd',
    'MM/dd/yyyy',
    'dd/MM/yyyy'
  ];

  for (const format of formatsNoZone) {
    const dt = DateTime.fromFormat(normalized, format, { zone: 'utc' });
    if (dt.isValid && isWithinRange(dt, options)) {
      return { iso: dt.toUTC().toISO(), confidence: 'low', raw: trimmed };
    }
  }

  // If string ends with an unknown timezone token, try stripping it
  const stripped = normalized.replace(/\\s+[A-Z]{2,4}$/, '');
  if (stripped !== normalized) {
    for (const format of formatsNoZone) {
      const dt = DateTime.fromFormat(stripped, format, { zone: 'utc' });
      if (dt.isValid && isWithinRange(dt, options)) {
        return { iso: dt.toUTC().toISO(), confidence: 'low', raw: trimmed };
      }
    }
  }

  return { iso: null, confidence: 'low', raw: trimmed };
}

function extractJsonLdDates($: cheerio.Root): string[] {
  const dates: string[] = [];
  const scripts = $('script[type="application/ld+json"]');
  if (scripts.length === 0) return dates;

  const extractFromObject = (obj: unknown): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    const asRecord = obj as Record<string, unknown>;
    const type = asRecord['@type'];
    const validTypes = ['Article', 'NewsArticle', 'BlogPosting'];
    if (typeof type === 'string' && !validTypes.includes(type)) {
      return null;
    }
    const datePublished = asRecord['datePublished'];
    if (typeof datePublished === 'string' && datePublished.trim().length > 0) {
      return datePublished.trim();
    }
    return null;
  };

  for (const el of scripts.toArray()) {
    const raw = $(el).text();
    if (!raw || raw.trim().length === 0) continue;
    try {
      const parsed = JSON.parse(raw);
      const candidates: unknown[] = Array.isArray(parsed)
        ? parsed
        : (parsed && typeof parsed === 'object' && (parsed as any)['@graph'])
          ? (parsed as any)['@graph']
          : [parsed];

      for (const item of candidates) {
        const date = extractFromObject(item);
        if (date) dates.push(date);
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  return dates;
}

function extractMetaDates($: cheerio.Root, metaKeys?: string[]): string[] {
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[property="og:published_time"]',
    'meta[name="article:published_time"]',
    'meta[name="parsely-pub-date"]',
    'meta[itemprop="datePublished"]',
    'meta[name="publish-date"]',
    'meta[name="date"]',
    'meta[name="dc.date"]',
    'meta[name="dc.date.issued"]',
    'meta[name="dcterms.date"]',
    'meta[name="dcterms.created"]',
    'meta[name="sailthru.date"]'
  ];

  const dates: string[] = [];
  if (metaKeys && metaKeys.length > 0) {
    for (const key of metaKeys) {
      selectors.unshift(`meta[name="${key}"]`);
      selectors.unshift(`meta[property="${key}"]`);
    }
  }
  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length > 0) {
      const content = el.attr('content');
      if (content && content.trim().length > 0) {
        dates.push(content.trim());
      }
    }
  }
  return dates;
}

function extractTimeDates($: cheerio.Root, cssSelectors?: string[]): string[] {
  const dates: string[] = [];
  const timeEl = $('time[datetime]').first();
  if (timeEl.length > 0) {
    const dt = timeEl.attr('datetime');
    if (dt && dt.trim().length > 0) {
      dates.push(dt.trim());
    }
  }
  if (cssSelectors) {
    for (const selector of cssSelectors) {
      const el = $(selector).first();
      if (el.length > 0) {
        const dt = el.attr('datetime') || el.text();
        if (dt && dt.trim().length > 0) {
          dates.push(dt.trim());
        }
      }
    }
  }
  return dates;
}

function pickEarliestValid(
  rawDates: string[],
  baseConfidence: DateConfidence,
  options?: ExtractPublishedAtOptions
): { iso: string; raw: string; confidence: DateConfidence } | null {
  const normalized = rawDates
    .map(raw => normalizeRawDate(raw, options))
    .filter(item => item.iso !== null) as Array<{ iso: string; confidence: DateConfidence; raw: string }>;

  if (normalized.length === 0) return null;

  normalized.sort((a, b) => {
    const aDt = DateTime.fromISO(a.iso);
    const bDt = DateTime.fromISO(b.iso);
    return aDt.toMillis() - bDt.toMillis();
  });

  const earliest = normalized[0];
  let confidence = baseConfidence;
  if (earliest.confidence === 'low') {
    confidence = degradeConfidence(confidence);
  }

  return { iso: earliest.iso, raw: earliest.raw, confidence };
}

export function extractPublishedAtFromHtml(
  html: string,
  options?: ExtractPublishedAtOptions
): ExtractPublishedAtResult {
  const $ = cheerio.load(html);

  const useJsonLd = options?.domainRule?.dateSelectors?.jsonld !== false;
  const jsonLdDates = useJsonLd ? extractJsonLdDates($) : [];
  const metaDates = extractMetaDates($, options?.domainRule?.dateSelectors?.meta);
  const timeDates = extractTimeDates($, options?.domainRule?.dateSelectors?.cssTime);

  const jsonLdPick = pickEarliestValid(jsonLdDates, 'high', options);
  if (jsonLdPick) {
    return {
      publishedAt: jsonLdPick.iso,
      rawValue: jsonLdPick.raw,
      source: 'html',
      sourceDetail: 'jsonld',
      confidence: jsonLdPick.confidence
    };
  }

  const metaPick = pickEarliestValid(metaDates, 'medium', options);
  if (metaPick) {
    return {
      publishedAt: metaPick.iso,
      rawValue: metaPick.raw,
      source: 'html',
      sourceDetail: 'meta',
      confidence: metaPick.confidence
    };
  }

  const timePick = pickEarliestValid(timeDates, 'low', options);
  if (timePick) {
    const isTextSelector = Boolean(options?.domainRule?.dateSelectors?.cssTime);
    return {
      publishedAt: timePick.iso,
      rawValue: timePick.raw,
      source: isTextSelector ? 'time_text' : 'html',
      sourceDetail: isTextSelector ? 'time_text' : 'time',
      confidence: timePick.confidence === 'low' ? 'medium' : timePick.confidence
    };
  }

  return {
    publishedAt: null,
    source: 'none',
    sourceDetail: 'none',
    confidence: 'low'
  };
}

export function normalizePublishedAt(
  raw: string,
  options?: ExtractPublishedAtOptions
): ExtractPublishedAtResult {
  const normalized = normalizeRawDate(raw, options);
  if (!normalized.iso) {
    return {
      publishedAt: null,
      rawValue: raw,
      source: 'none',
      sourceDetail: 'none',
      confidence: 'low'
    };
  }

  return {
    publishedAt: normalized.iso,
    rawValue: raw,
    source: 'tavily',
    sourceDetail: 'tavily',
    confidence: normalized.confidence === 'high' ? 'medium' : 'low'
  };
}
