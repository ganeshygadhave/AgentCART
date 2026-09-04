---
name: AgentCART
colors:
  surface: '#fff9ee'
  surface-dim: '#dfd9cd'
  surface-bright: '#fff9ee'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#faf3e6'
  surface-container: '#f4ede1'
  surface-container-high: '#eee7db'
  surface-container-highest: '#e8e2d6'
  on-surface: '#1e1b14'
  on-surface-variant: '#44474c'
  inverse-surface: '#333028'
  inverse-on-surface: '#f7f0e4'
  outline: '#75777c'
  outline-variant: '#c5c6cc'
  surface-tint: '#565f6d'
  primary: '#050e1a'
  on-primary: '#ffffff'
  primary-container: '#1b2430'
  on-primary-container: '#828b9a'
  inverse-primary: '#bec7d7'
  secondary: '#5e5e5c'
  on-secondary: '#ffffff'
  secondary-container: '#e1dfdc'
  on-secondary-container: '#636360'
  tertiary: '#00120b'
  on-tertiary: '#ffffff'
  tertiary-container: '#002a1d'
  on-tertiary-container: '#659580'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae3f4'
  primary-fixed-dim: '#bec7d7'
  on-primary-fixed: '#131c28'
  on-primary-fixed-variant: '#3e4755'
  secondary-fixed: '#e4e2de'
  secondary-fixed-dim: '#c8c6c3'
  on-secondary-fixed: '#1b1c1a'
  on-secondary-fixed-variant: '#474744'
  tertiary-fixed: '#bbeed6'
  tertiary-fixed-dim: '#9fd1ba'
  on-tertiary-fixed: '#002116'
  on-tertiary-fixed-variant: '#1f4f3e'
  background: '#fff9ee'
  on-background: '#1e1b14'
  surface-variant: '#e8e2d6'
  signal: '#3F6E5B'
  flag: '#C4622D'
  ink: '#1B2430'
  paper: '#FAF8F4'
  line: '#D9D3C7'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  truth-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.03em
  truth-md:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 20px
  truth-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  receipt-width: 480px
---

## Brand & Style

The design system embodies the **Storefront + Ledger** narrative, a sophisticated blend of traditional retail physicalness and modern computational precision. It is designed for an audience that values the tactile reliability of a physical receipt and the streamlined efficiency of an automated agent. The brand personality is **Methodical, Transparent, and Authoritative**, evoking the feeling of a well-organized ledger where every transaction is verified and every line item is accounted for.

The design style is a hybrid of **Modern Minimalism and Brutalist precision**. It rejects decorative fluff in favor of structural clarity and high-utility layouts.
- **Ledger Aesthetics:** Elements are organized with strict vertical and horizontal alignments, reminiscent of accounting sheets and formal invoices.
- **Physical Metaphor:** The UI mimics the "Paper and Ink" relationship, using subtle textures and high-contrast rules to create a sense of permanence and trust.
- **Tactile Utility:** Information density is high but meticulously organized, using "hairline" rules to define boundaries without adding visual bulk.
- **Verified Confidence:** Systems-sourced data is treated with special status, using specific iconography and monospaced typography to denote "Truth."

## Colors

The color palette is inspired by the archival quality of a physical ledger and the high-contrast clarity of a printed receipt.

- **Primary (Ink):** `#1B2430` is used for all primary text, headers, and structural definitions. It provides a deep, authoritative weight that mimics fresh ink on paper.
- **App Background (Paper):** `#FAF8F4` is the primary canvas. This off-white, warm-toned neutral reduces eye strain and provides a premium, "stationery" feel.
- **Action/Success (Signal):** `#3F6E5B` (Deep Green) is reserved for primary calls to action, confirmed checkout states, and "Verified" status indicators.
- **Warning/Failure (Flag):** `#C4622D` (Burnt Orange) is used for rejected discounts, payment failures, or urgent notifications, providing a distinct but harmonious contrast to the Signal green.
- **Dividers (Line):** `#D9D3C7` is the critical structural color, used for all hairline borders, dividers, and rule lines to maintain the ledger grid.

## Typography

Typography is used as a functional tool to distinguish between human-centric content and machine-sourced data.

- **Humanist Sans (Inter):** Used for the primary narrative of the UI—product names, descriptions, and general interface instructions. It provides an approachable and legible foundation.
- **Truth/Mono (JetBrains Mono):** This is the "Ledger" voice. It is used exclusively for prices, totals, IDs, timestamps, and status codes. Its monospaced nature ensures that columns of numbers align perfectly, reinforcing the theme of precision.

**Style Note:** Headlines should remain compact and purposeful. For "Truth" levels, use tabular lining figures to ensure financial data remains perfectly vertical across different rows.

## Layout & Spacing

The layout philosophy follows a **Fixed-Width Receipt** model combined with a fluid browsing experience.

- **Browsing Area:** A fluid grid with generous whitespace (48px margins on desktop) to allow products to breathe.
- **The Receipt Column:** A signature layout feature where the cart and checkout experience is confined to a fixed-width column (max 480px). On desktop, this is pinned to the right; on mobile, it occupies the full viewport.
- **Rhythm:** An 8px base grid system. Use tight spacing (8px) between related data points within a ledger row, and larger gaps (32px+) between distinct sections of the storefront.
- **Dividers:** Use 1px `line` (#D9D3C7) borders to separate rows in lists. Avoid using background color shifts for separation; rely on these "hairline" rules to maintain the paper-ledger aesthetic.

## Elevation & Depth

This design system is intentionally **Flat and Layered**, eschewing traditional shadows for structural depth.

- **Tonal Tiers:** Depth is conveyed through the stacking of `paper` and `ink`. The primary background is the base layer.
- **Hairline Outlines:** All containers, cards, and input fields use a 1px solid border in `#D9D3C7`. This creates "compartments" of information rather than elevated surfaces.
- **Zero Shadow Policy:** Do not use box-shadows or blurs. Hierarchy is established through the thickness of rules (hairline vs. double-rule) and the strategic use of whitespace.
- **Sticky Rules:** Header and Footer elements should be separated from scrolling content by a persistent 1px `line` rule, maintaining the feeling of a continuous scroll of paper.

## Shapes

The shape language is **Sharp and Architectural**. 

Consistent with the "Ledger" and "Receipt" metaphor, UI elements feature **0px roundedness**. This creates a crisp, professional, and technical aesthetic. Square corners on buttons, inputs, and cards reinforce the grid-based nature of the interface and maximize the alignment efficiency of the hairline borders.

## Components

### Buttons
- **Primary:** Background `ink` (#1B2430) with `paper` (#FAF8F4) text. 0px radius.
- **Signal (Action):** Background `signal` (#3F6E5B) with `paper` text for confirmed states.
- **Ghost:** No background, 1px `line` border, `ink` text.

### Inputs & Fields
- **Default:** 1px `line` border, `paper` background, `ink` text.
- **Focus:** 1px `ink` border. No glow effects.
- **Labels:** Use `label-caps` (JetBrains Mono) above the field for a technical feel.

### Cards & Rows
- **Product Card:** Defined by a 1px `line` border. No padding on image containers; text content is separated by a horizontal 1px rule.
- **Ledger Row:** Used in the cart and lists. High-density rows with `truth-md` for prices aligned to the right and `body-sm` for titles aligned to the left.

### "Verified" Badge
- A signature component using the `lucide check-circle` icon in `signal` green. Always accompanied by `truth-sm` text for backend-sourced data points.

### The Receipt (Cart)
- A vertical stack using a 1px `line` border on the left side (desktop). Use dashed 1px rules for sub-totals and solid 1px rules for final totals to mimic thermal printer aesthetics.