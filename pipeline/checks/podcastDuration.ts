/**
 * Check: Podcast duration (word count)
 * Warns if word count < 1500 or > 3500
 */

function wordCount(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  // Simple word count: split on whitespace and filter empty strings
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

export function checkPodcastDuration(podcastScriptText?: string): string[] {
  const warnings: string[] = [];

  if (!podcastScriptText) {
    // Optional check - no warning if script is not available
    return warnings;
  }

  const count = wordCount(podcastScriptText);
  const MIN_WORDS = 1500;
  const MAX_WORDS = 3500;

  if (count < MIN_WORDS) {
    warnings.push(
      `Podcast script word count: ${count} words (minimum: ${MIN_WORDS})`
    );
  } else if (count > MAX_WORDS) {
    warnings.push(
      `Podcast script word count: ${count} words (maximum: ${MAX_WORDS})`
    );
  }

  return warnings;
}
