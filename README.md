# NGOBIA

National Government-Owned Buildings Inventory Application is a responsive academic demonstration built with Next.js 16, TypeScript, Supabase, Tailwind CSS, shadcn/ui, and Recharts.

## Features

- Live government-building dashboard and condition charts
- Asset search and filtering
- Asset registration with image upload
- Asset details, editing, and permanent deletion
- Good, Minor Repair, Major Repair, and Condemned classifications
- Responsive desktop table and mobile asset cards
- Philippine peso formatting and inspection-date support

## Local setup

Requirements: Node.js 20.9 or newer and a Supabase project.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and supply the browser-safe project values:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
   ```

3. Link Supabase and apply the migrations:

   ```bash
   npx supabase login
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the GitHub repository.
3. Keep the detected **Next.js** framework and default build settings.
4. Add these environment variables under **Project Settings → Environment Variables**:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

5. Deploy. No service-role key or administrator credential is required by the application.

Run the database migrations before using the deployed registration, edit, or delete actions. The production build command is:

```bash
npm run build
```

## Demonstration security warning

NGOBIA intentionally has no authentication. Its demonstration policies permit public visitors to create, edit, and permanently delete fictional asset records and manage photographs in the `asset-photos` bucket. This can be abused and may incur Storage usage. Do not use these policies for real government, confidential, or production data.
