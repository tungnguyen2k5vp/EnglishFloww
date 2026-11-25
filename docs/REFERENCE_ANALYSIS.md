## Additional full-scroll investigation — 2026-10-22

29 selected physical REA captures now cover lower home/Explore, grammar, exercise topic/difficulty/detail, vocabulary catalog/pack/review, reader settings, IELTS preview, profile and tutor scenario form. See [SCREEN_LEDGER.md](SCREEN_LEDGER.md) and [deep-screen-index.json](evidence/deep-screen-index.json).

The supplied APK contains a plaintext Vietnamese grammar JSON (10 groups, 55 lessons); it is now extracted with HTML sanitization and resource hashes. The 11,915,264-byte dictionary is encrypted; no rows were recovered. Several JSON files named after content features are Lottie animations, so they were not treated as databases. No personal/account database was extracted.

# Reference analysis and REA evidence

## Physical phone observation — 2026-10-22

The user connected an authorized realme RMX3085 running Android 13. REA inspected the device and original package: 4English 10.4.16 (410), installer `com.android.vending`. Original launches normally here; the earlier emulator installer redirect is no longer the observation blocker. No check was bypassed.

Confirmed by screenshots: Home has vocabulary/reading/IELTS tiles, secondary feature shortcuts and five tabs; center tab is **Gia sư AI**, not Nói. Vocabulary starts with a Spaced Repetition explainer, six-level chart and due-review card; catalog follows on the same page. Explore uses horizontal large reading cards and a Shorts section. Tutor opens a full-page character greeting/tool menu. Entertainment is Word Chain, with online/offline/competition modes and an offline character selector. Reader has cover, translation/word actions and an audio footer.

The reconstruction now follows the confirmed Home/Vocabulary navigation, uses selected packaged UI illustrations, opens tutor study actions and implements an independent bounded offline Word Chain. Article/media content remains independently authored. AI conversation, actual IELTS exam/scoring, multiplayer, account sync and exact detail-page equivalence remain unresolved. Six characters currently share one bot algorithm; original difficulty behavior was not observed. No original saved vocabulary was copied or reviewed.

Full evidence files and IDs: `evidence/physical-reference-index.json`. APK image provenance: `evidence/reference-assets.json`. One early capture named `explore` still showed the previous vocabulary tab due to transition timing; only `explore-confirmed` is used. AI UI hierarchy timed out and is excluded; screenshot is the evidence. Original screen files stay in local task cache because they can show profile thumbnails or personal learning totals.

Observed on **2026-10-22**. EnglishFlow is an independent reconstruction. After the user explicitly requested APK analysis and supplied the binaries, REA inspected their static code and an unmodified APK set was installed on a disposable emulator. Reference code, dictionary databases, branding, articles and recordings are not bundled into EnglishFlow.

## Supplied Android artifacts and actual REA analysis

- Initial standalone base APK: 4English 10.4.13 (405), SHA-256 `5beb48fc1642b2e231314cf229f9134bf3a88d2d6c871f736b3e3f2ed9feafc3`. Installation failed with `INSTALL_FAILED_MISSING_SPLIT`.
- Complete user XAPK: 4English 10.4.16 (410), four APKs, SHA-256 `2a9f32c1755b6b7c519a75fe1ea339364ec09bb1d4f211b79a114322195b9fa8`. Base APK SHA-256 `88beb5bd9570e634fef1142dedac05a99c0398b6dbab0abf6a4448c8a8801766`.
- REA CLI 6.7.0 / JADX MCP 0.7.1, pinned JAR SHA-256 `6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75`. It parsed 27,345 classes; min SDK 28, target SDK 36. No native libraries were present in the first base APK inventory. Static DEX classes use Android activities/fragments; that does not prove every subsystem's implementation.
- `HostActivity.onCreate` restores `state_current_bottom_menu_id`. `HostActivity.d6` switches, caches and hides/shows fragments. `HostActivity.A4` maps home → `dp.x1`, vocabulary → `er.w0`, explore → `ap.v`, entertainment → `cp.i`, AI/speaking slot → `dr.e`. Decompiled names can be aliases; they are not original source names.
- `dp.x1.onViewCreated` logs `HomeFragmentNew` and obtains a vocabulary ViewModel. No claim is made that the reference uses our SM-2 implementation or localStorage.
- `adb install-multiple` succeeded on a fresh API 36 emulator. REA `start-adb-app` resolved the correct HostActivity, but observed Google Play's unauthenticated activity after launch. Logcat reports `Local install check failed due to wrong installer.` No licensing/authentication modification was attempted. Internal runtime screens remain unobserved.
- The five bottom tab labels, three home learning tiles, vocabulary bank chart, collection grid and Explore cards are based on the current official [Play screenshots](https://play.google.com/store/apps/details?id=com.new4english.learnenglish&hl=vi). These marketing images include an iOS-style device and do not prove pixel equivalence to Android 10.4.16.

Full REA records and original reference images are retained in `D:/ReactJS/.cache/4english/v10.4.16` and its parent. The portable [evidence index](evidence/android-reference-index.json) identifies operations, digests and limitations. EnglishFlow's Android navigation/layout were reconstructed independently; the previous desktop dashboard is retained as a separate entry.

**Unresolved:** pixel-by-pixel Android equivalence, authenticated/premium screens, reference backend behavior, complete content catalog and dictionary internals. A valid Play-installed reference device/session is needed to observe the remaining screens. Public screenshots and static code cannot establish these as complete.

## Public feature map

| Feature                                   | Source / evidence                                                                                                                                                                                                                 | Confirmed versus unknown                                                        | Independent implementation                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Dictionary lookup and saved vocabulary    | [Official public site](https://www.4englishapp.com/en) displays search, IPA, definitions and save actions; [Play listing](https://play.google.com/store/apps/details?id=com.new4english.learnenglish) describes contextual lookup | Public UI/listing confirmed; internal provider, storage and algorithm unknown   | Shared 36-entry EN–VI provider, examples, IPA, save/remove and browser TTS                                                 |
| Reading and translations                  | Play description describes news, translation and word saving; official site has article recommendations                                                                                                                           | Category confirmed; article rights and translation implementation unknown       | Four original multi-paragraph readings with separately stored Vietnamese translations, lookup, bookmarks and comprehension |
| Subtitled videos / missing words          | Play description describes video subtitles, gap exercises and subtitle lookup                                                                                                                                                     | Feature advertised; native playback timing/control implementation not inspected | Original canvas video with synthesized narration, timed transcript and native HTML player                                  |
| Podcasts                                  | Play description advertises transcripts, word lookup and difficulty levels                                                                                                                                                        | Category confirmed; actual podcast inventory and licensing not investigated     | Two original narrated audio lessons with timed bilingual transcript, seek/rate/replay/dictation                            |
| Saved flashcards / exercises              | Play description describes flashcards, gap exercises and themed vocabulary                                                                                                                                                        | Feature category confirmed; reference SRS algorithm not established             | Seven original collections; documented SM-2, four exercise modes and real attempt history                                  |
| Word chain game                           | Play description advertises game                                                                                                                                                                                                  | Advertised only                                                                 | Not implemented; core study workflows prioritized                                                                          |
| AI tutor                                  | Play listing release notes describe AI practice                                                                                                                                                                                   | Advertised; provider/auth/voice implementation unknown                          | Explicit unconfigured message; no simulated AI or microphone                                                               |
| Grammar, goals, statistics, local profile | Requested task scope                                                                                                                                                                                                              | Product requirements; not asserted as findings about the reference              | Original grammar lessons, real event-derived statistics and local preferences                                              |

Public product descriptions establish advertised categories, not independent validation of every feature in the native app. Reference screenshots/assets were not imported. Research used the official [REA README](https://github.com/morluto/rea/blob/main/README.md) and the local checkout's corresponding CLI/workflow guides.

## REA installation and actual usage

- Local checkout: `D:/ReactJS/Rea-HSK-Reference`, CLI **6.7.0**, skill identity **44**, Node 24.11.1. CLI `--help` exposes `analyze-javascript-application` and `capture-browser-scenario`.
- `doctor --client codex --json` reported missing Codex MCP registration and missing installed REA skill. No REA MCP tools were present in the active session. Native analysis engines were unavailable and unnecessary.
- Read the checkout's `reverse-engineer-anything/SKILL.md` and runtime/connection guides. They permit the existing CLI fallback. No setup writes, agent configuration changes, engine installations or reconnect were performed; a setup dry run alone did not configure anything. Optional manual setup: `npx rea-agents@latest setup --client codex`, review changes, then restart/reconnect Codex.
- A bounded static inspection of the existing `HocTuVung/dist` artifact returned incomplete graph coverage after its vendor-containing bundle exhausted the 1024 MiB worker heap. This run is **not evidence of successful feature reconstruction or runtime behavior**. Source inspection of that separate demo used ordinary filesystem reads. It remains unchanged.

## Successful runtime investigation on EnglishFlow

Question: does a dictionary result produce a saved word visible in the vocabulary screen?

```powershell
node ../Rea-HSK-Reference/scripts/rea.mjs capture-browser-scenario scripts/rea-scenario.json --json
```

REA launched an owned, temporary headless Chrome against our app at `http://127.0.0.1:5178/#dictionary`, waited for the results, filled “habit”, opened the entry, clicked save, opened vocabulary and waited for the saved word. This was an actual REA controlled scenario, not ordinary browser testing relabeled as REA.

Full returned Evidence: [rea-vocabulary.json](evidence/rea-vocabulary.json).

- Evidence ID: `ev_550ed3af94911c80c515340a24819f1feca80dd1868b623aeb74dfdabb282d23`.
- Provider: `rea-playwright-browser-scenario` v1; predicate `rea.browser-scenario-capture`.
- Recorded steps completed; final URL is `/#vocabulary`. Final DOM/accessibility contains `habit`, `/ˈhæbɪt/`, `thói quen` and a `Bỏ lưu` action.
- Storage capture identifies `englishflow.v1` with a hashed value, not raw contents. It establishes a persisted key during this scenario; reload persistence is separately verified by Playwright tests.
- Requested capture completeness is `complete`. No page-error event was retained. Browser cleanup outcome is retained in the raw evidence.
- Limits: no reference app runtime was inspected; no source identity for the browser artifact was established; event receipt ordering does not establish causality; storage values are fingerprints; requested network payloads/initiators were not inspected. These limits are also present in the full evidence.

The successful REA result confirms this one local workflow at the captured revision. Other behavior claims rely on the executed domain/browser checks in [TEST_RESULTS.md](TEST_RESULTS.md), not this single scenario.
