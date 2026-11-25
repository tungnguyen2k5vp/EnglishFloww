# Automatic vocabulary — 1.5.0 (6)

Reference: `D:/ReactJS/HocTiengTrungApp` (unchanged). Adapted its dictionary matching, POS-aware morphology, spelling, batch distractors and local UK/US voice selection for EnglishFlow's WebView architecture.

**104,703 normalized headwords / 175,735 senses** replace the former 38-entry limit. Definitions, examples and IPA come from the pinned Skypedia corpus. Source examples and some IPA are generated upstream; IPA is attached to headwords, not individual senses. Source entries are not assigned a verified CEFR badge.

- Source commit: `388adc0826300912e5b0311c089e0e70494b065f`.
- SQLite SHA-256: `2b65bea9577c2a4149caa90940c806f321d1c6cfac503ed8bbd9f93e43a0033a`.
- `scripts/import-reference-dictionary.py` checks source hash/integrity and converts SQLite to normalized JSON prefix shards. Original definitions/examples/IPA and LICENSE/ATTRIBUTION/README are retained. Unsupported headwords over 100 characters are excluded; normalization merges keys.
- Data stays CC BY-SA 4.0 with upstream notices and an in-app source page. The reference project's historical importer/release gate was not modified.
- Android bundles the dictionary with no new runtime dependency, server, key or network permission. Web caches opened shards; unopened web shards require a connection. Four concurrent lookups and 12 cached shards bound loading. Only selected words enter mutable learner state/backups.

Creating/appending a collection follows an explicit draft workflow: enter words → “Tra nghĩa tự động” → review/edit/delete/restore → “Thêm từ”. Lookup never commits learner vocabulary. Each draft word supports term, meaning, IPA, part of speech and example edits; only kept words are committed together at the final step. Edited source/seed words receive independent IDs, preserving existing collections and schedules. Draft edits and deletions survive reload; changing the raw list requires another lookup. Empty/undefined meanings and duplicate terms block commit. Imported friend collections use the same review step.

Case/spacing/apostrophes/duplicates are normalized. Unresolved terms require spelling correction, a personal definition or deletion. The bundled manifest distinguishes absent prefixes from failed reads, avoiding HTML fallback errors for unknown words on web hosts. Read failures remain retryable. UK/US and alternate sense controls remain available in the draft. The floating dictionary is hidden on these forms so it cannot overlap their edit/delete buttons.

Study exit and collection-save navigation return to an existing parent or replace the current entry. They do not push another copy of a parent onto the Back stack. Native Back at Home exits instead of reopening old WebView history after reload.

Inflection-only entries can use a source lemma's meaning, visibly labelled “Dạng của …”; lemma IPA is not assigned to the surface word. Spelling accepts case/spacing/typographic apostrophes, and rejects guessed inflections or arbitrary punctuation. Distractors prefer real cards in the batch. Existing mobile memory levels, retries and durable native commits remain.

UK/US selects installed local voices for the requested accent. This is Android/browser TTS, not copied audio files or pronunciation scoring. Missing voices are reported. Playback stops on navigation/background; native start/completion events are observable.

1.5.0 tests: `npm test`, `test:dictionary`, `test:vocabulary`, `test:mobile`, and `test:collection-editor` against port 4178. The focused collection-editor suite also runs against the installed APK with `ANDROID_TEST_SERIAL=emulator-5556 npm run test:collection-editor` (PowerShell: set `$env:ANDROID_TEST_SERIAL` first). It covers actual Android Back and keyboard visibility, draft isolation/recovery, edit/cancel/duplicate validation, remove/restore, all-removed/stale-list guards, final/append commits, repeated Back cycles, session picker/settings/exit/results, cold deep links and Home exit/relaunch. Emulator learner state and pre-existing drafts are restored afterward. Physical testing was deferred at the user's request; 1.4.0 physical evidence below is historical.

Current draft evidence: `test-results/collection-editor/{browser,emulator}/results.json`, PNGs and `releases/Vocabulary-draft-preview-1.5.0.jpg`. Historical dictionary evidence: `test-results/dictionary/physical/results.json` from 1.4.0. Coverage includes High school / Dog / Transition / Row / Baby, phrase/case deduplication, alternate senses + draft recovery, native UK/US engine starts, learning → due review, checked-answer force-stop recovery, once-only scheduling, full dictionary lookup and 100 distinct words across shards. Native start events do not certify acoustic quality. TalkBack, rotation, API 28 and iOS remain untested.
