# Page 1 Chart Features Reference

## Chart Overview

The enhanced "Umsatz & EBIT Trend (12M)" chart displays financial data across 12 months with interactive elements, multiple data series, and comprehensive tooltips.

---

## Data Series

### 1. Revenue Bars (Umsatz) - Left Y-Axis
- **Color**: Dark blue gradient (#1D3557)
- **Gradient**: 3-stop (0.7 → 0.45 → 0.08 opacity)
- **Display**: Stacked bars with rounded corners
- **Width**: 50% of column width, centered
- **Interaction**: Highlight on hover with subtle shadow

### 2. EBIT Line (Profit) - Right Y-Axis
- **Color**: Professional copper (#B08A6A)
- **Style**: Smooth curve with Catmull-Rom bezier interpolation
- **Fill**: Gradient area below line (opacity 0.01-0.15)
- **Line Weight**: 2.5px
- **Points**: 3.5px circles (6px on hover)
- **Interaction**: Drop shadow and scaling on hover

### 3. Margin % Line - Right Y-Axis (Secondary)
- **Color**: Warning yellow (#E8A838)
- **Style**: Dashed pattern (4px dash, 3px gap)
- **Implementation**: Catmull-Rom bezier curve
- **Scale**: Capped at 30% for visibility
- **Opacity**: 60% default, 30% on hover

---

## Axes & Labels

### Left Y-Axis (Revenue)
- **Scale**: Auto-scaled to max revenue in dataset
- **Gridlines**: 5 horizontal lines (0%, 25%, 50%, 75%, 100%)
- **Labels**: Currency format (EUR) using `fmtEurK()`
- **Position**: x=55 (left side)
- **Color**: Theme variable `var(--text-secondary)`

### Right Y-Axis (EBIT)
- **Scale**: Auto-scaled to max EBIT in dataset
- **Gridlines**: 3 horizontal lines (0%, 50%, 100%)
- **Labels**: Currency format (EUR) using `fmtEurK()`
- **Position**: x=745 (right side)
- **Color**: Theme variable `var(--text-secondary)`

### Secondary Y-Axis (Margin %)
- **Scale**: 0% to 100%
- **Labels**: 3 points (0%, 50%, 100%)
- **Position**: x=755 (far right, offset from EBIT)
- **Color**: Warning yellow #E8A838
- **Opacity**: 0.7 for secondary prominence

### X-Axis (Months)
- **Labels**: German month abbreviations (Jan, Feb, Mär, etc.)
- **Source**: `month_label_short` from data
- **Position**: Below baseline
- **Font Size**: 9px
- **Weight**: 500 (normal), 600 (on hover)

---

## Legend

### Position
- Below chart title, centered
- Flex layout with flex-wrap for responsiveness

### Items
1. **Umsatz (Revenue)**
   - Visual: Gradient box (16×12px)
   - Border: 1px rgba(29,53,87,0.3)
   - Label: "Umsatz (links)"

2. **EBIT (Profit)**
   - Visual: Solid line (22×2.5px)
   - Color: #B08A6A
   - Label: "EBIT (rechts)"

3. **Marge % (Margin)**
   - Visual: Dashed line (22×1.5px)
   - Color: #E8A838
   - Pattern: 2px dashed top border
   - Label: "Marge %"

---

## Tooltips

### Appearance
- **Background**: Dark navy (`var(--navy)`)
- **Opacity**: 0.95 for slight transparency
- **Border**: 1px #B08A6A (copper)
- **Corners**: 6px border-radius
- **Shadow**: 0 4px 12px rgba(0,0,0,0.25)

### Dimensions
- **Width**: 140px (fixed)
- **Height**: 72px (when visible)
- **Position**: Smart bounds checking to stay visible

### Contents

```
┌──────────────────────┐
│    Month (COPPER)    │  ← Month label in #B08A6A
├──────────────────────┤
│ Umsatz:    XXX,XX € │  ← White text
│ EBIT:      XXX,XX € │  ← Green/Red based on value
│ Marge:        X,X % │  ← Yellow text
└──────────────────────┘
```

### Data Format
- **Month**: Color #B08A6A, fontWeight 700, fontSize 10px
- **Revenue**: fontWeight 600, fontSize 9px
- **EBIT**: Conditional color (Green if ≥0, Red if <0)
- **Margin**: Color #E8A838, fontWeight 600, fontSize 9px

---

## Summary Statistics Grid

### Layout
- **Mobile** (<640px): 2 columns
  - Row 1: Ø Umsatz 3M | Ø EBIT 3M
  - Row 2: Ø Marge 3M | EBIT Range

- **Desktop** (≥640px): 4 columns (all items in one row)

### Metrics

1. **Ø Umsatz 3M** (Average Revenue, 3-month)
   - Calculation: Sum of last 3 months ÷ 3
   - Color: Primary text color
   - Format: EUR with fmtEur()

2. **Ø EBIT 3M** (Average Profit, 3-month)
   - Calculation: Sum of last 3 months ÷ 3
   - Color: Green (#2E8B57) if ≥0, Red (#C43830) if <0
   - Format: EUR with fmtEur()

3. **Ø Marge 3M** (Average Margin %, 3-month)
   - Calculation: Average EBIT ÷ Average Revenue
   - Color: Warning yellow (#E8A838)
   - Format: Percentage with fmtPct()

4. **EBIT Range** (Min to Max)
   - Calculation: MIN(all EBIT) to MAX(all EBIT)
   - Color: Primary text color
   - Format: "XXX € bis XXX €"

---

## Interactive Behavior

### Hover States

**On Bar Hover**:
- Opacity of non-selected bars: 50%
- Drop shadow on selected bar
- Month label bold and primary color
- Margin line opacity reduces to 30%
- EBIT line opacity slightly reduces

**On Data Point Hover**:
- Circle radius: 3.5px → 6px
- Circle stroke: 1.5px → 2px
- Drop shadow appears
- Tooltip displays (140px card)
- Area fill opacity: 100% → 70%
- Line opacity: 100% → 80%

### Transitions
- Duration: 0.2s
- Properties: opacity, filter, r (radius), stroke-width
- Easing: Default (ease)

---

## Responsive Behavior

### Breakpoints
- **Mobile**: < 640px
- **Desktop**: ≥ 640px

### Chart Scaling
- Always 100% container width
- Height auto-scales maintaining viewBox aspect
- ViewBox: 750×280 (maintains 2.68:1 ratio)

### Legend
- Flexbox with flex-wrap
- Wraps items on smaller screens
- Gap: 6 units between items

### Summary Grid
- 2 columns on mobile (gap: 12px)
- 4 columns on desktop (gap: 12px)
- Responsive via Tailwind classes

---

## Color Usage Reference

| Element | Color | Purpose |
|---------|-------|---------|
| Revenue Bar | #1D3557 | Primary data visualization |
| EBIT Line | #B08A6A | Key metric highlighting |
| Margin Line | #E8A838 | Secondary metric alert |
| Data Points | #B08A6A | Visual anchors on line |
| Positive EBIT | #2E8B57 | Success indicator |
| Negative EBIT | #C43830 | Alert indicator |
| Text Primary | var(--text-primary) | Main labels |
| Text Secondary | var(--text-secondary) | Axis labels |
| Grid Lines | var(--border-color) | Chart structure |

---

## Performance Characteristics

- **Rendering**: Pure SVG (no canvas, no external libraries)
- **Animations**: CSS transitions (GPU accelerated)
- **Gradients**: 4 reusable gradient definitions
- **Data Points**: Calculated on component render
- **Memory**: Minimal overhead, ~50KB SVG at full data

---

## Accessibility Features

- ✓ Semantic HTML structure
- ✓ Proper text labels on all axes
- ✓ High contrast colors (meets WCAG AA)
- ✓ Keyboard accessible (hover via CSS)
- ✓ German language labels for German users
- ✓ Currency and percentage formatting

---

## Browser Compatibility

- ✓ SVG support (all modern browsers)
- ✓ CSS transitions (all modern browsers)
- ✓ flexbox and grid (all modern browsers)
- ✓ CSS custom properties/variables
- ✓ Fallback for older browsers (graceful degradation)

