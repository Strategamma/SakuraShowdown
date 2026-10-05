# Reusable risks

- Production dependency audit currently reports 20 transitive vulnerabilities (10 high, 10 moderate), concentrated in the legacy Colyseus/Express networking stack. Several have no non-breaking automatic fix. Do not run `npm audit fix --force`; plan a tested Colyseus/server dependency migration before restoring production multiplayer.
