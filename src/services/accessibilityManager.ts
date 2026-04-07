import { highContrastMode, reduceMotionMode, textSize, colorBlindMode, type TextSize, type ColorBlindMode } from './cardPreferences'

const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.85,
  medium: 1,
  large: 1.2,
}

let initialized = false

function applyTextScale(size: TextSize): void {
  if (typeof document === 'undefined') return
  const scale = TEXT_SCALE[size]
  document.documentElement.style.setProperty('--text-scale', String(scale))
}

function applyClass(flag: boolean, className: string): void {
  if (typeof document === 'undefined') return
  document.body.classList.toggle(className, flag)
}

/**
 * Injects hidden SVG color-blind filter definitions into the document body.
 * Filters are referenced by CSS rules using url(#cb-<mode>).
 *
 * Color matrix values (LMS-based, industry standard):
 * - deuteranopia: most common red-green deficiency (~8% of males)
 * - protanopia: red-green variant (missing L cones)
 * - tritanopia: blue-yellow deficiency (missing S cones)
 */
function injectColorBlindFilters(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('cb-svg-filters')) return

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('id', 'cb-svg-filters')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'

  svg.innerHTML = `
    <defs>
      <filter id="cb-deuteranopia" color-interpolation-filters="linearRGB">
        <feColorMatrix type="matrix" values="
          0.625 0.375 0     0 0
          0.7   0.3   0     0 0
          0     0.3   0.7   0 0
          0     0     0     1 0
        "/>
      </filter>
      <filter id="cb-protanopia" color-interpolation-filters="linearRGB">
        <feColorMatrix type="matrix" values="
          0.567 0.433 0     0 0
          0.558 0.442 0     0 0
          0     0.242 0.758 0 0
          0     0     0     1 0
        "/>
      </filter>
      <filter id="cb-tritanopia" color-interpolation-filters="linearRGB">
        <feColorMatrix type="matrix" values="
          0.95  0.05  0     0 0
          0     0.433 0.567 0 0
          0     0.475 0.525 0 0
          0     0     0     1 0
        "/>
      </filter>
    </defs>
  `

  document.body.prepend(svg)
}

/**
 * Applies or removes the color-blind data attribute on the root element.
 * CSS rules in accessibility.css use [data-colorblind="<mode>"] selectors
 * to attach the corresponding SVG filter.
 */
function applyColorBlindMode(mode: ColorBlindMode): void {
  if (typeof document === 'undefined') return
  if (mode === 'off') {
    document.documentElement.removeAttribute('data-colorblind')
  } else {
    document.documentElement.setAttribute('data-colorblind', mode)
  }
}

/**
 * Initializes global accessibility UI state.
 * - `textSize` -> `--text-scale`
 * - `highContrastMode` -> `body.high-contrast`
 * - `reduceMotionMode` -> `body.reduced-motion`
 * - `colorBlindMode` -> `html[data-colorblind]` + SVG filter injection
 */
export function initAccessibilityManager(): void {
  if (initialized) return
  initialized = true

  textSize.subscribe((value) => applyTextScale(value))
  highContrastMode.subscribe((value) => applyClass(value, 'high-contrast'))
  reduceMotionMode.subscribe((value) => applyClass(value, 'reduced-motion'))
  colorBlindMode.subscribe((value) => {
    if (value !== 'off') injectColorBlindFilters()
    applyColorBlindMode(value)
  })
}
