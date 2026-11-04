# Caption Clash — Prompt Chain Tool

A superadmin-only tool for building and running the LLM prompt chains behind Caption Clash (Next.js + Supabase + Vercel + Gemini).

## What it does

- **Chains**: create, rename, describe, activate/deactivate and delete prompt chains. New chains can start from a 3-step template (describe image → find the funny → five captions).
- **Steps**: create, edit and delete steps. Each step has an input (image or text), an output (text or a caption list), a model, a temperature and a prompt.
- **Reorder**: move a step up or down, jump it to any position, or insert a new step at a chosen position. Deleting a step renumbers the rest.
- **Generate media**: upload a photo and run it through every step of a chain. The photo and captions are saved to Caption Clash. Every run is logged to `generation_requests`, and every model call to `llm_responses`.
- **View media by chain**: each chain has a gallery of what it generated (photo, captions, status). Each run has a step-by-step view of the prompts and outputs.
- **Theme**: light, dark or system default. The choice is remembered per browser and system mode follows the OS live.

### Prompt placeholders

| Placeholder | Filled with |
| --- | --- |
| `{{previous}}` | output of the step right before |
| `{{step1}}`, `{{step2}}`, … | output of any earlier step |
| `{{description}}` | output of the first text step |
| `{{terms}}` / `{{examples}}` | active rows from the `terms` / `ai_generation_examples` tables |

The **last** step's output becomes the captions: a JSON list if its output is "caption list", otherwise one caption per line.

## Security

1. `proxy.ts` sends everyone except signed-in users with `profiles.is_superadmin = true` to `/login`.
2. Every page and server action calls `requireAdmin()` again.
3. Supabase row level security: the chain tables only allow superadmins. The reorder functions are `SECURITY INVOKER`, so row level security still applies to them.

## Setup

1. Run `supabase/admin.sql` and `supabase/admin_v2.sql` from caption-clash-admin, then `supabase/prompt_chain_tool.sql` from this repo.
2. In Vercel, set the `GEMINI_API_KEY` environment variable. The Supabase URL and publishable key fall back to the values in `lib/env.ts`.
3. In Supabase → Authentication → URL Configuration, add this app's URL to the Redirect URLs list.
