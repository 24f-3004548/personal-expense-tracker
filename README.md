# kharcha ₹
> A minimal, fast expense tracker. No bloat. No AI. Just your money.

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Supabase (Auth + PostgreSQL + RLS — zero server to maintain)
- **Charts**: Recharts (donut + bar — see chart justification below)
- **Fonts**: DM Sans + DM Mono

---

## Quick Start

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com) → New project → note your **Project URL** and **anon public key**.

### 2. Run the schema
In your Supabase dashboard → SQL Editor → paste and run `supabase-schema.sql`.  
This creates the `expenses`, `income`, and `budgets` tables with Row Level Security enabled.

### 3. Enable Email Auth
Supabase dashboard → Authentication → Providers → Email → Enable.

### 4. Clone and configure
```bash
git clone <your-repo>
cd expense-tracker
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 5. Install and run
```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
expense-tracker/
├── src/
│   ├── components/
│   │   ├── expenses/
│   │   │   └── QuickAdd.jsx        # Core UX — add expense in <5s
│   │   ├── income/
│   │   │   └── AddIncomeModal.jsx
│   │   └── layout/
│   │       └── AppLayout.jsx       # Sidebar + mobile nav
│   ├── context/
│   │   └── AuthContext.jsx         # Supabase auth state
│   ├── lib/
│   │   └── supabase.js             # DB helpers + formatting utils
│   ├── pages/
│   │   ├── AuthPage.jsx            # Login + signup
│   │   ├── Dashboard.jsx           # Home — stats, charts, recent
│   │   ├── Transactions.jsx        # Full list, filter, edit, delete
│   │   ├── Budget.jsx              # Monthly budget + progress
│   │   └── Review.jsx              # Monthly summary + comparisons
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css                   # Design tokens (CSS variables)
├── supabase-schema.sql
├── .env.example
└── README.md
```

---

## Chart Justification — 3-member panel

**End User (Priya, 27, pays rent + eats out a lot):**  
*"I want to know where my money went without doing math."*  
→ **Donut chart**: immediately answers "which category ate my budget" with visual proportions. Percentages scannable in 2 seconds. Colour-coded by category with a clean legend alongside — no clicking required.  
→ **6-month bar chart**: answers "am I getting better?" — the one question that drives habit change. Paired income/expense bars create a savings gap that's viscerally motivating.

**Investor (Series A lens, DAU/retention focus):**  
*"What makes users come back daily, not monthly?"*  
→ The donut creates a "beat my top category" loop — users return to watch Food or Transport shrink. The trend bars create a "beat last month" narrative — both are retention mechanics baked into the data visualisation itself. Recharts is lightweight (~45kb gzipped), keeping LCP fast, which matters for mobile-first markets like India where 4G is the norm.

**Developer (maintaining this in 6 months):**  
*"Can I extend this without touching charting internals?"*  
→ Recharts is fully declarative, composable React components. Swapping a `<Bar>` for a `<Line>` is one word. Custom tooltips are plain JSX. No Canvas API, no D3 selection chains, no imperative lifecycle. Data flows straight from Supabase → state → Recharts props. Zero abstraction layers to debug.

**What was ruled out and why:**
- Line chart: implies continuity/trend — wrong mental model for categorical spending
- Stacked bar: too much cognitive load for a glanceable dashboard
- Treemap: impressive, wrong — requires deliberate study, not a 2-second read
- Pie (without donut): donut's inner space is used for future total-amount display

---

## Security

- **Row Level Security (RLS)** on all tables — users can only read/write their own rows, enforced at the database level
- **Supabase Auth** handles password hashing (bcrypt internally), session management, and token refresh
- **HTTP-only cookies** used by Supabase Auth SDK by default for session persistence
- **No sensitive data in localStorage** — all auth state managed by Supabase client
- **Environment variables** prefixed with `VITE_` are build-time only — anon key is safe to expose (RLS protects data)

---

## Adding your currency

In `src/lib/supabase.js`, change the default currency symbol:

```js
export const formatCurrency = (amount, currency = '₹') => { ... }
```

Replace `₹` with `$`, `€`, `£`, etc.

---

## Deployment

### Vercel (recommended)
```bash
npm run build
# drag dist/ to vercel.com, or:
npx vercel --prod
```
Set environment variables in Vercel dashboard (same as .env).

### Netlify
```bash
npm run build
# drag dist/ to netlify drop, or connect repo
```

---

## Design decisions

- **DM Sans + DM Mono**: humanist sans for readability, monospace for numbers (critical for financial data alignment). Not Inter. Not Space Grotesk.
- **CSS variables for all colours**: theming in one place, consistent across every component
- **Staggered animations**: `animation-delay` on each section creates a natural reveal without overwhelming the user
- **`−` vs `-`**: proper minus sign (U+2212) used for expense amounts — a detail that signals craft
- **`formatCurrency` shorthand**: ₹1,20,000 → ₹1.2L (Indian number system), keeps stats scannable
- **Auto-focus on amount**: QuickAdd mounts with cursor in amount field — zero clicks to start logging

---

## Roadmap (not built, not bloat)

- [ ] Recurring expense flag
- [ ] Currency selection at signup
- [ ] Export to CSV
- [ ] Shared expenses (split with partner)
- [ ] PWA / install to home screen
