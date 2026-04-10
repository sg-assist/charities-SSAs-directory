/**
 * System prompt builder — selects and constructs the appropriate system prompt
 * based on the user's selected mode, country, and language.
 *
 * Mode → vertical mapping:
 *   clinical    → CLINICAL, FORMULARY, MISP, MOH_<country>
 *   community   → CHW, MISP, MOH_<country>
 *   partnership → UNFPA
 */

import { PARTNERSHIP_SYSTEM_PROMPT } from './partnership';
import { buildClinicalPrompt } from './clinical';
import { buildCommunityPrompt } from './community';

export type AppMode = 'clinical' | 'community' | 'partnership';

export interface PromptConfig {
  mode: AppMode;
  country?: string;   // ISO 3166-1 alpha-3 or common name, e.g. "MMR" / "Myanmar"
  language?: string;  // BCP 47, e.g. "en", "my", "km", "id"
}

/**
 * Returns the verticals to search in the knowledge base for a given mode + country.
 * Passed to searchKnowledge() as the `vertical` filter.
 */
export function getSearchVerticals(mode: AppMode, country?: string): string[] {
  const countryVertical = country ? [`MOH_${country.toUpperCase().slice(0, 3)}`] : [];
  switch (mode) {
    case 'clinical':
      return ['CLINICAL', 'FORMULARY', 'MISP', ...countryVertical];
    case 'community':
      return ['CHW', 'MISP', ...countryVertical];
    case 'partnership':
    default:
      return ['UNFPA'];
  }
}

/**
 * Builds the full system prompt string for a given mode + context.
 * Appends today's date to all prompts.
 */
export function buildSystemPrompt(
  config: PromptConfig,
  todayDate: string
): string {
  const { mode, country = '', language = 'en' } = config;

  let base: string;
  switch (mode) {
    case 'clinical':
      base = buildClinicalPrompt(country, language);
      break;
    case 'community':
      base = buildCommunityPrompt(country, language);
      break;
    case 'partnership':
    default:
      base = PARTNERSHIP_SYSTEM_PROMPT;
      break;
  }

  return `${base}\n\nToday's date is ${todayDate}.`;
}
