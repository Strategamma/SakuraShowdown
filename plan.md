# Goal
Make LAN presence immediate and simplify Home into the fastest path to a preferred match.

# Scope
- Show available players on Home when devices use the same local Sakura host.
- Support direct player-to-player LAN challenges and invitation joining.
- Reduce first-view choices to Solo, LAN party, and a few compact alternatives.
- Preserve pass-and-play, invite-code, Internet, install, settings, and offline behavior.

# Approach
- Add an in-memory, expiring presence registry to the LAN server only.
- Heartbeat while Home is open, render nearby people as Decadence live cards, and create a private room when challenging someone.
- Keep manual Host/Join inside the LAN detail screen as a fallback, not first-view clutter.

# Risks
- Presence must expire quickly, avoid public deployment exposure, and never require an account.
- Invitations must target one local device and tolerate stale peers/rooms.
- Polling must stop outside Home and avoid blocking offline play.
- Browser screenshot verification remains dependent on the unavailable Chromium runtime.

# Verification
- Test presence registration, peer expiry, targeted challenge payloads, and direct private-room joining.
- Verify Home/LAN/Internet/Rules navigation and responsive layout.
- Run the required Playwright flow when launch succeeds, plus tests, typechecks, server checks, and production build.
