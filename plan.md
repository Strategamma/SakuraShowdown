# Goal
Make multiplayer entry and recovery reliable: a refreshed private-room guest can resume, Internet play is obvious, and LAN-hosted games appear as name-based joinable lobbies.

# Scope
- Persist and expose private-session recovery in the client.
- Reuse reconnect credentials before requesting a new private-room seat.
- Add a visible Internet entry from app home.
- Add same-network lobby discovery when the app is served by a LAN host.
- Keep private code joining and existing public rooms intact.

# Approach
- Track reconnect context (token, room type/code/name) locally and add a Resume action.
- Add a LAN-only lobby endpoint backed by existing Colyseus room metadata.
- Render nearby waiting rooms with explicit Join buttons using the entered player name.
- Add focused server/client tests plus responsive browser QA.

# Risks
- Reconnect windows remain bounded by server memory and timeouts.
- LAN discovery must not expose private rooms from the public Render gateway.
- Colyseus metadata must stay current through disconnect/reconnect transitions.

# Verification
- Automated reconnect integration test reproducing guest refresh.
- Endpoint tests proving LAN-only room visibility.
- Typecheck, gameplay tests, production build, and phone/desktop UI screenshots.
