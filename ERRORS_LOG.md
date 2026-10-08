# Reusable risks

- Production dependency audit reports 13 transitive vulnerabilities (1 high, 10 moderate, 2 low) in Colyseus 0.15's optional auth/Redis tree. The earlier Express/proxy and WebSocket critical/high issues are patched. Do not run `npm audit fix --force`; removing the remainder requires a tested Colyseus major migration.
- Headless Chromium cannot launch in this macOS sandbox because Mach port registration is denied. Keep physical-phone visual QA in the release checklist even when source/build checks pass.
- `https://decadenceinc.com/` currently presents a certificate that does not cover `decadenceinc.com`; fix the custom-domain DNS/GitHub Pages certificate before treating the homesite launch path as production-ready.
