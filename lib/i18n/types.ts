/**
 * Locale and i18n types for the application.
 */

export type Locale = 'en' | 'da' | 'es';

/**
 * Localized text fields for article translations.
 * Stored per-article in the digest JSON.
 */
export type LocalizedText = {
  title?: string;
  summary?: string;
};

/**
 * Article translations stored per-article in the digest.
 */
export type ArticleTranslations = {
  da?: LocalizedText;
  es?: LocalizedText;
};
