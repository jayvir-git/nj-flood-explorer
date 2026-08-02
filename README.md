# NJ Flood Exposure Explorer

Work in progress.

One question: how flood-exposed is my New Jersey town, and who bears it?
An interactive map of FEMA flood hazard zones over NJDEP's overburdened
communities (NJ Environmental Justice Law), where clicking a municipality
gives a plain-language exposure summary with a chart and a table.

<!--
TODO(jayvir): write this README yourself before the repo goes public-public.
Sections to write in your own words:
- What it shows and who it's for
- The data: three sources, what each is, link each (see src/config/sources.ts
  and DECISIONS.md D2), and the honest limitations
- Why these choices (pull from DECISIONS.md, don't duplicate it)
- How it was built (stack, and your AI-tooling disclosure in your own voice)
- Run locally: npm install && npm run dev
- What's next (point at FUTURE.md)
-->

## Run locally

```
npm install
npm run dev
```

## Repo guide

- `docs/PLAN.md` — build plan in vertical slices
- `DECISIONS.md` — why each non-obvious choice was made
- `FUTURE.md` — ideas deliberately out of scope
- `src/config/sources.ts` — the three data sources, verified by hand
