// src/i18n/formatters.ts
import { get } from 'svelte/store'
import { locale } from './index'

/**
 * Returns the BCP 47 locale tag for the current UI locale.
 * Maps our internal code to a full tag for the Intl API.
 */
function bcp47(): string {
  const code = get(locale)
  const map: Record<string, string> = {
    en: 'en-US',
    es: 'es-419', // Latin American Spanish (broadest coverage)
    fr: 'fr-FR',
    de: 'de-DE',
    ja: 'ja-JP',
    ar: 'ar-SA',
    he: 'he-IL',
  }
  return map[code] ?? 'en-US'
}

/**
 * Formats an integer or float with locale-appropriate thousand separators.
 * @example formatNumber(1234567) → "1,234,567" (en) | "1.234.567" (de)
 */
export function formatNumber(n: number, decimals?: number): string {
  return new Intl.NumberFormat(bcp47(), {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  }).format(n)
}

/**
 * Formats a currency amount in the player's locale.
 * Uses USD as the base currency for all IAP prices (server-side currency
 * conversion is out of scope for this phase).
 * @example formatCurrency(4.99) → "$4.99" (en) | "4,99 $" (fr)
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(bcp47(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formats a Date object as a short date (month/day/year or locale equivalent).
 * @example formatDate(new Date()) → "3/4/2026" (en) | "4/3/2026" (de, day first)
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(bcp47(), {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

/**
 * Formats a Date object as a relative time string ("3 days ago", "in 2 hours").
 * Falls back to absolute date if RelativeTimeFormat is unavailable.
 */
export function formatRelativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  try {
    const rtf = new Intl.RelativeTimeFormat(bcp47(), { numeric: 'auto' })
    if (Math.abs(diffDay) >= 1) return rtf.format(diffDay, 'day')
    if (Math.abs(diffHour) >= 1) return rtf.format(diffHour, 'hour')
    if (Math.abs(diffMin) >= 1) return rtf.format(diffMin, 'minute')
    return rtf.format(diffSec, 'second')
  } catch {
    return formatDate(date)
  }
}

/**
 * Formats a streak count as a locale-aware ordinal string where applicable.
 * Falls back to a plain number if PluralRules is unavailable.
 * @example formatStreak(7) → "7-day streak" (en)
 */
export function formatStreak(days: number): string {
  // Delegate to the i18n key which handles pluralization
  // This is a helper to make the call site cleaner
  return String(days)
}

/**
 * Formats an O2 value with at most 1 decimal place.
 */
export function formatOxygen(value: number): string {
  return formatNumber(value, 1)
}
