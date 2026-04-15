# spendly

Minimal expense tracking with clean UX, fast load times, and Supabase-backed auth/data.

## Live App

Production deployment: [https://spendly-expensetracker.vercel.app](https://spendly-expensetracker.vercel.app)

## What It Does

- Email/password authentication with confirmation flow
- Quick expense logging with category and date
- Income logging and monthly savings overview
- Budget tracking with usage progress
- Dashboard insights with category donut and trend chart
- Transactions view with grouped daily entries
- Monthly review with custom comparison month

## Tech Stack

- React 18
- Vite 5
- Tailwind CSS
- Supabase (Auth + Postgres + RLS)
- Recharts

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url>
cd expense-tracker
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Set these values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Create Supabase schema

In Supabase SQL Editor, run the SQL from `supabase-schema.sql`.

This creates:

- `expenses`
- `income`
- `budgets`

All with row-level security policies.

### 4. Enable Email auth

In Supabase dashboard:

- Authentication
- Providers
- Enable `Email`

### 5. Run locally

```bash
npm run dev
```

Local app URL: [http://localhost:5173](http://localhost:5173)

## Scripts

```bash
npm run dev      # Start local dev server
npm run build    # Create production build
npm run preview  # Preview production build locally
```

## Project Structure

```text
src/
	components/
		expenses/
		income/
		layout/
	context/
	hooks/
	lib/
	pages/
```

## Deployment

### Vercel

1. Import the repository in Vercel.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Project Settings.
3. Deploy.

Build settings (default for Vite):

- Build command: `npm run build`
- Output directory: `dist`


## Monthly Report Email

The manual export and the monthly report should use the same HTML and XLSX payload. The only difference is the date range:

- manual export uses the range selected in the UI
- monthly report uses the previous calendar month
- schedule it for the 1st day of every month at 8:00 AM in your chosen timezone

Setup:

1. Run the updated SQL from `supabase-schema.sql` so the `user_email_preferences` table exists.
2. Deploy the Supabase Edge Function at `supabase/functions/monthly-report/index.ts`.
3. Query only users with `monthly_report_enabled = true`.
4. Schedule that function for `0 8 1 * *` in the timezone you want.
5. Set the function secrets `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `REPORT_FROM_EMAIL` in Supabase; add `CRON_SECRET` if you want to require a signed cron request.

If your Supabase schedule runs in UTC, convert 8:00 AM local time to UTC before saving the cron expression.

## Notes

- The anonymous Supabase key is safe for frontend usage when RLS is configured correctly.
- Date inputs are limited to today or earlier to avoid future-dated entries.
- Currency helpers use INR-style formatting by default and can be customized in `src/lib/supabase.js`.
