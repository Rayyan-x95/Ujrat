# 🎨 UX & Design System Guidelines

Ujrat's design system adheres to the **StyleSeed** and **`ui-ux-pro-max`** design standards: high-contrast Swiss typography, accessible color tokens, subtle micro-animations, and zero layout shift.

---

## 1. Design Tokens & Color Palette

Ujrat uses HSL semantic color variables defined in `src/app/styles/index.css`:

```css
:root {
  /* Canvas & Surfaces */
  --background: 0 0% 100%;           /* Pure White */
  --surface: 220 14% 97%;            /* Subtle Gray / Sidebar canvas */
  --card: 0 0% 100%;                 /* Clean Card background */
  
  /* Brand Accent */
  --primary: 221 83% 53%;            /* Electric Sapphire Blue (#2563EB) */
  --primary-foreground: 210 40% 98%; /* High contrast text on primary */
  
  /* Borders & Dividers */
  --border: 220 13% 91%;             /* Crisp Card Borders */
  --border-subtle: 220 13% 95%;      /* Light Table/Row dividers */
  
  /* Status Colors */
  --success: 142 71% 45%;            /* Emerald Green (#10B981) */
  --warning: 38 92% 50%;             /* Amber (#F59E0B) */
  --destructive: 0 84% 60%;          /* Rose Red (#EF4444) */
}
```

---

## 2. Typography Scale

* **Primary Body & Tabular**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`
* **Headings & Display**: `Outfit`, `Inter`, `sans-serif`
* **Numbers & Invoices**: `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace` with `font-variant-numeric: tabular-nums`

| Role | Class / Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | `text-4xl sm:text-5xl` | `700` (Bold) | `1.05` | Landing Page Hero |
| **Section Title** | `text-2xl sm:text-3xl` | `700` (Bold) | `1.2` | Workspace Greetings, Page Headers |
| **Card Metric** | `text-2xl sm:text-3xl font-mono` | `700` (Bold) | `1.1` | KPI Amounts, Currency totals |
| **Card Subtitle**| `text-xs text-muted-foreground` | `500` (Medium) | `1.4` | Metadata, Descriptions |
| **Badge Label** | `text-[10px] font-bold` | `700` (Bold) | `1.0` | Status Pills, Tags |

---

## 3. Empty State ("Day 0") UX Rules

1. **Never Show Deceptive Mock Data**: Never fill an empty account with fake figures (e.g. ₹1,84,000) that could confuse or deceive the freelancer.
2. **Predictable Scaling**: Charts with ₹0 revenue must use baseline benchmark intervals (`₹0` → `₹13k` → `₹25k` → `₹38k` → `₹50k`) to avoid broken decimal axis labels (`₹1, ₹1, ₹1`).
3. **Action-Oriented Setup Guide**: When all metrics are zero, render a 3-step setup guide with direct CTA links to create a client, project, or invoice.

---

## 4. Accessibility & Micro-Interactions

* **Contrast Ratios**: All text must meet WCAG 2.1 AA (`>= 4.5:1` for normal text, `>= 3:1` for large headers and icons).
* **Keyboard Navigation**: All interactive items must have visible focus rings (`focus-visible:ring-2 focus-visible:ring-primary`).
* **Motion Duration**: Transitions are bounded between `120ms` and `200ms` with `ease-out` curves to feel instantaneous and snappy.
