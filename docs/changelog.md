# Changelog

> 🚧 A full changelog is still being assembled. The list below is a feature snapshot of the current Luker release.

## Current version

### 2026-05-28 live hotfixes

#### Email auth restoration

- Restored the production `lorestage-auth` email/password login path at `/auth/*` and `/api/auth/*`; `/login` now redirects to `/auth/login` instead of showing the local Luker login page.
- Re-enabled Luker's trusted `X-Authentik-Username` SSO auto-login behind Caddy, guarded by localhost trusted proxies and the shared SSO secret.
- Restored the live `sso.authentikAuth`/`sso.sharedSecret` configuration and enabled Cloudflare real-IP forwarding for login rate limiting.
- Verified unauthenticated users are sent to `/auth/login`, authenticated forward-auth sessions reach the app, forged public `X-Authentik-Username` requests do not bypass auth, and `/auth/logout` clears both auth and Luker cookies.
- Re-added the `authentikAuth` and `sharedSecret` default config keys so the production auth bridge is documented instead of treated as dead code.

#### Character card import visibility

- Fixed a case where character card import succeeded on the backend but looked like “nothing happened” in the UI because the current character list filters hid the new card.
- After import/create, the character list now falls back to the unfiltered entity list, clears search/favorite/group/folder/tag filters that hide the new card, re-renders the list, and highlights the imported card.
- If the imported card is hidden by an assigned closed-folder tag, the frontend selects that folder so the new card is visible immediately.
- Bumped the frontend build ID again so mobile browsers fetch the import visibility fix.

#### Smoothness and recovery improvements

- Fixed duplicate welcome shortcut buttons and made drawer shortcut clicks idempotent so refreshed/mobile sessions do not lose the API, character management, or extensions button actions. The welcome screen module is consistently versioned for this hotfix so mobile browsers do not keep the stale duplicate-button code.
- Reduced forced cache clearing: empty `cacheBuster.userAgentPattern` no longer clears every user's browser cache, and live cache-busting is disabled.
- Changed frontend static asset headers from no-store to short public caching, while keeping the HTML shell non-stale.
- Added version query strings to the HTML shell's regular CSS/JS entrypoints while keeping shared ES module imports unqueried to avoid duplicate module instances.
- Deferred Stable Diffusion option discovery when production is pointed at default local endpoints such as `localhost:7860`, preventing startup-time 500s when no SD backend is configured.
- Added a one-time CSRF token refresh and retry for same-origin mutating fetches, with a clear session-expired toast if retry still fails.
- Improved character import errors so unsupported/invalid/oversized files return structured HTTP errors and the UI shows the actual reason instead of a generic corruption message.
- Hardened local account recovery responses so the first recovery step no longer reveals whether a username exists.
- Fixed `/login` for an already-authenticated Luker request to redirect into the app instead of returning a 403.
- Marked first-run onboarding as a distinct startup stage and adjusted mobile onboarding layout so small screens keep the Save action reachable without false startup timeout overlays.

### 2026-05-27 live hotfixes

#### Authentication, logout, and privacy isolation

- Removed the remaining production Authentik dependency from Lorestage.
  - Removed the backend Authentik header-login path from `src/users.js`; `X-Authentik-Username` is no longer an accepted SSO login header.
  - Removed the old `authentikAuth` config migration and removed `sso.authentikAuth` from the default config template.
  - Removed `sso.authentikAuth` and the SSO shared secret from live `config.yaml`.
  - Disabled the `luker.service` SSO secret drop-in so Luker no longer starts with `SILLYTAVERN_SSO_SHAREDSECRET`.
  - Removed the `www.lorestage.com` Caddy forward-auth checks to the old auth service (`127.0.0.1:18106`) for app traffic.
  - Removed Caddy interception of `/login`, `/api/users/list`, `/auth/*`, and `/api/auth/*` on `www.lorestage.com`; local Luker account login now owns those routes.
  - Caddy now strips `Remote-User`, `X-Authentik-*`, and `X-Lorestage-SSO-Secret` before proxying to Luker.
- Added a local `/auth/logout` compatibility endpoint that clears the Luker session and redirects to `/login?noauto=true`, so old Sign out links still work without the central auth service.
- Updated the Account & Email button to open the in-app account profile instead of linking to the removed central auth settings page.
- Removed the WebSocket internal request injection of `x-authentik-username`; WS proxy identity now remains bounded by the one-time ticket, session cookie, CSRF token, and current Luker user context.
- Hardened per-user chat and character path resolution:
  - Chat save/append/patch/meta/get/get-delta/rename/delete/export/search/import now resolve character chat directories and files under the current user's chat root before filesystem access.
  - Character rename/edit/avatar/edit-attribute/delete/get/snapshot/state/chats/duplicate/export now resolve avatar and chat paths under the current user's directories before filesystem access.
  - `clientRelativePath()` now uses resolved parent-path checks instead of string prefix checks, while preserving the previous leading-slash URL shape.
- Multi-agent audit result: no ordinary-user route was found that directly reads another user's chats, character cards, thumbnails, or per-user files. The remaining deliberate privacy surfaces are admin-only tooling and same-account request-inspector history.

#### Startup, mobile, and browser cache fixes

- Added a frontend startup recovery overlay that records startup stage/error and offers Reload / Sign out actions when initialization stalls.
- Bumped frontend build IDs and no-store cache headers to prevent mobile Chrome/Brave from running stale `init.js`, `script.js`, or user-control modules after deploy.
- Removed cache-busting query strings from ES module imports of shared modules (`script.js`, `scripts/user.js`) after finding that Chrome treated queried and unqueried imports as separate module instances. The duplicate main-script instance bound drawer click handlers twice, so one tap opened a top drawer and the second duplicate handler immediately closed it.
- Updated Caddy cache behavior for Lorestage JS/CSS/static routes to avoid Cloudflare/browser stale-cache loops during hotfixes.
- Verified the Chrome/Brave black-screen reports shifted from blank-page startup failures to normal page render after cache and startup changes.

#### Character card import fixes

- Fixed character import paths with long or punctuation-heavy filenames by truncating the internal PNG filename to the filesystem byte limit while preserving the displayed character name.
- Added frontend import format detection from MIME type as well as extension, and added a toast for unsupported files instead of silently doing nothing.
- Verified the `djjasondavid` import of `辛红棉.png` landed in the correct per-user character directory and parsed as a valid `chara_card_v3` PNG card.

#### Deployment and verification notes

- Live services were reloaded/restarted only when needed:
  - Caddy reloads applied routing/cache/auth-header changes.
  - Luker restarts applied backend code/config changes.
- Validation performed:
  - `node --check` on changed backend/frontend modules.
  - `git diff --check`.
  - Public header-spoof tests confirmed external requests cannot become another user by sending `X-Authentik-Username`.
  - Post-Authentik-removal checks confirmed `/login` is served by Luker directly and no new `Received X-Authentik-Username...` warnings appear after restart.

### Core features

- **Memory Graph** — Knowledge-graph long-term memory, 9-layer hybrid recall pipeline
- **Multi-Agent Orchestrator** — Three execution modes (Spec workflow, Single agent, Agenda planner)
- **Card Editor Assistant** — AI-driven conversational character-card editing with 7 tools
- **Search Tools** — Three-engine support: DuckDuckGo, SearXNG, Brave Search
- **Preset Assistant** — AI-assisted preset editing with IDE-style drift handling and per-message rollback; new fine-grained tools (str_replace / str_insert / list_insert / list_move) save tokens on long fields
- **Edits library** (`public/scripts/lib/edits/`) — shared op-typed structured-edit primitives with drift-aware apply + interactive conflict UI, exposed to third-party extensions (ESM / lukerContext / ctx). See `docs/development/extension-api/edits-lib.md`.
- **CardApp** — Interactive applications embedded in character cards

### Architecture improvements

- **Preset Decoupling** — Connection parameters and presets managed independently
- **Incremental Sync** — RFC 6902 incremental data transfer
- **Backend Storage** — Data changes persisted in real time
- **Function Call Runtime** — Native + plain-text dual modes
- **Unified Generation Layer** — Single envelope for multiple backends
- **Request Inspector** — Full-lifecycle generation-request tracing
- **Auth & Quotas** — GitHub / Discord OAuth + storage quota management

### User experience

- Card-bound presets and personas
- Prompt groups & preset groups
- Hook execution order
- World Info activation trace
- Chat-persona lock
- Undo-toast system
- Dynamic model lists
- Image generation enhancements
- Mobile UX refinements
- Startup performance optimization

## Recent breaking changes

- **CardApp Studio reverted to its standalone fullscreen UI** (the iteration-studio shell version shipped in May 2026 was a brief detour that lost viewport ownership and noticeably degraded UX). The studio now takes over the viewport again via two `position:fixed` panels with mobile tab support, file tree, CodeMirror 6 editor, and inline approval cards — the pre-SP-2 UX users were used to. File operations still benefit from edits-lib's drift detection + per-op inverse — new capabilities the original standalone version didn't have. The brief-era session bucket (`cardapp_studio_sessions_v2`) is wiped on first open; CardApp files on disk are untouched.

- **edits-lib now supports two integration patterns**: wrapping it in the iteration-studio shell for popup-friendly surfaces, or using the library primitives directly for fullscreen / custom-UI. CardApp Studio is the in-tree reference for direct usage.

- **CPA rebuilt on the iteration-studio shell** (SP-4 of the adapter migration, closes Plan 2). The 309-line `dialog-ui.js` is deleted; CPA's existing IDE-style business helpers (`handleApplyDraft`, `handleRollbackToMessage`, `handleMessageDiff`) are unchanged and now run inside the shared shell. With SP-4 landed, all five AI-driven editing surfaces in Luker (orchestrator, memory-graph, CEA CardApp Studio, CEA Character Editor, CPA) share one shell, one storage model, one edits-lib, and one conflict-resolution UI.
- **CEA CardApp Studio rebuilt on the iteration-studio shell** (SP-2 of the adapter migration). The standalone session / popup / diff infrastructure has been replaced with the SP-1 v2 adapter contract: `live()` is the single authority, the 4 file-write tools route through `normalizeToolCallToEdit`, the 2 file-read tools through `executeControlToolCall`, and `commit()` diffs against the previous snapshot before fanning out to the existing `saveFileContent / deleteFile` helpers. The old `cardapp_studio_sessions` character-sidecar bucket is wiped once on first open after upgrade; CardApp files on disk are untouched.
- **CEA Character Editor rebuilt on the iteration-studio shell** (SP-3 of the adapter migration). The lorebook-sync analysis popup is replaced with a multi-turn iteration session. Edits a character card and its lorebook in one adapter; introduces 3 CEA-owned custom edits-lib ops (`lorebook_entry_add / update / remove`) keyed by entry uid. The shell now invokes `adapter.registerCustomOps(registry)` once per open. Old `lorebookSyncHistory` settings entry is wiped on first open; character cards + lorebooks on disk are untouched.
- **Iteration Studio adapter contract v2 (IDE-style).** The shell no longer carries a `workingProfile` snapshot; the adapter's `live()` is the single authority. In-tree orchestrator + memory-graph adapters migrated. Out-of-tree adapters require updates (see `docs/development/extension-api/iteration-studio.md`). Old iteration-studio session data is wiped once per adapter on first open after upgrade; live artifacts (preset files, character cards, settings) are untouched. CEA and CPA adapters arrive in subsequent releases.
- **CPA conversation rollback resets on upgrade.** The journal-based session model was replaced with IDE-style live=authority + per-message `appliedEdits`. Preset files themselves are unchanged; only CPA's conversation rollback history from prior sessions is lost. New conversations rollback normally via the new mechanism.

---

Detailed per-version notes will be added later. For deeper information about a specific feature, see the corresponding documentation page.
