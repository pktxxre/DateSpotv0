## Environment setup

Every new workspace needs a `.env.local` file in the project root — it is gitignored and never committed. Without it, `lib/supabase.ts` returns null and the app shows "Configuration Error" on every auth/data action.

Copy `.env.example` to `.env.local` and fill in the anon key:

```
EXPO_PUBLIC_SUPABASE_URL=https://qlqcuuxhzdozjfboxeud.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
```

After adding or changing `.env.local`, restart the Expo server to pick up the new values.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
