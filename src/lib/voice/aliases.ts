/**
 * Browsers often mishear the brand name ("Finova" -> "Innova", "Phenova", ...).
 * Pure module (no React) so both the wake-word listener and the assistant can share it.
 */
export const WAKE_ALIASES = ['finova', 'finnova', 'fenova', 'finowa', 'phinova', 'phenova', 'finoba', 'innova', 'inova', 'inowa', 'pinova', 'vinova', 'venova', 'finovo', 'fynova', 'feenova', 'finoa', 'phinoa'];
export const WAKE_ALIASES_HI = ['फिनोवा', 'फिनॉवा', 'फीनोवा', 'इनोवा', 'इनोवो', 'फिनोव'];
const latin = WAKE_ALIASES.join('|');
const hindi = WAKE_ALIASES_HI.join('|');
export const isWakeAlias = (word: string) => WAKE_ALIASES.includes(word.toLowerCase());
export const hasHindiAlias = (text: string) => WAKE_ALIASES_HI.some((a) => text.includes(a));
/** Everything after the (optional "hi/hey/ok") wake word; capture group 1 is the spoken command. */
export const wakeCommandPattern = () => new RegExp(`(?:(?:hi|hey|hai|ok|okay)\\s+)?(?:${latin})\\b\\s*(.*)$`, 'g');
export const wakeCommandPatternHi = () => new RegExp(`(?:(?:हाय|हे)\\s+)?(?:${hindi})\\s*(.*)$`, 'gu');
/** Remove a leading "Hi Finova," / "Innova," from an utterance. */
export function stripWakePrefix(text: string) {
  return text
    .replace(new RegExp(`^(?:(?:hi|hey|hai|ok|okay)\\s+)?(?:${latin})\\b[,\\s]*`, 'i'), '')
    .replace(new RegExp(`^(?:(?:हाय|हे)\\s+)?(?:${hindi})[,\\s]*`, 'u'), '')
    .trim();
}
