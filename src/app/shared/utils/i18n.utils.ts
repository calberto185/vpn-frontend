/**
 * i18n utilities for multilanguage field objects.
 *
 * A multilanguage object stores the same content in multiple languages:
 * { es: 'Hola', en: 'Hello', ru: 'Привет' }
 *
 * Use these helpers when creating/editing entities that have translatable fields.
 */

export type I18nObject = Record<string, string>;

/**
 * Creates an empty multilanguage object for a given set of language codes.
 *
 * @example
 * createI18nObject(['es', 'en', 'ru']) // → { es: '', en: '', ru: '' }
 */
export function createI18nObject(languages: string[]): I18nObject {
  return Object.fromEntries(languages.map(code => [code, '']));
}

/**
 * Fills a multilanguage object with initial values, preserving existing keys.
 * Useful when editing an entity: keeps existing translations, adds empty slots
 * for any new language codes.
 *
 * @example
 * fillI18nObject({ es: 'Hola' }, ['es', 'en', 'ru'])
 * // → { es: 'Hola', en: '', ru: '' }
 */
export function fillI18nObject(existing: I18nObject | null | undefined, languages: string[]): I18nObject {
  const base = existing ?? {};
  return Object.fromEntries(languages.map(code => [code, base[code] ?? '']));
}

/**
 * Returns the display value for a multilanguage object, falling back through
 * currentLang → defaultLang → 'es' → first non-empty value → fallbackKey.
 */
export function displayI18n(
  obj: I18nObject | null | undefined,
  currentLang: string,
  defaultLang = 'es',
  fallbackKey = '',
): string {
  if (!obj) return fallbackKey;
  return (
    obj[currentLang] ||
    obj[defaultLang] ||
    obj['es'] ||
    Object.values(obj).find(v => !!v) ||
    fallbackKey
  );
}

/**
 * Returns true if at least one language has a non-empty value.
 */
export function hasI18nContent(obj: I18nObject | null | undefined): boolean {
  if (!obj) return false;
  return Object.values(obj).some(v => !!v?.trim());
}
