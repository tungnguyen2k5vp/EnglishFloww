# Vocabulary reconstruction — updated through 1.4.0, 2026-10-23

1.4.0 adapts the English data, morphology, spelling and UK/US voice policies from `HocTiengTrungApp`; see [DICTIONARY_INTEGRATION.md](DICTIONARY_INTEGRATION.md). APK observations below retain their original evidence boundaries.

Target: supplied 4English 10.4.16 base APK, SHA-256 `88beb5bd9570e634fef1142dedac05a99c0398b6dbab0abf6a4448c8a8801766`; original Play-installed app observed on the connected realme RMX3085 / Android 13. No original answers were submitted, collection limits bypassed, or private account databases copied.

## Evidence and implementation

| Question | Evidence | Result / boundary |
| --- | --- | --- |
| New-word entry | REA phone capture `vocab2-new-learning`; `c7.g3` | Observed selector with Skip / Learn / Already known and a 0/5 counter. Implemented selector, configurable batch size, skip and known actions. The local known policy places a word at level 6 / eight days; the original button's exact write was not executed. |
| Session selection | Static `c7.g3`, `i4.a.a/b` | Original partitions downgraded, due, preselected-new, fresh and not-yet-due words; snapshots restore cloned words. Own app implements separate fresh/due queues, collection scope and a persistent session. Original preferred-word priorities and early-review fallback are not duplicated. |
| Question settings | REA `vocab2-options` and `vocab2-options-bottom` | Observed separate fresh/review limits, Write/Listen/Choose word/Choose meaning counts, first-writing, context, random and auto-pronunciation. Implemented these controls, all four exercise families, first-writing and exact-term context gaps. Settings apply to the next session. |
| Answers and completion | Static `c7.L0`, `Word.commitSrs`, `c7.N2/y3`, decoded result layout | Original uses correct/incorrect information dialogs and pending SRS writes committed at results, with a five-failure threshold. Own app shows feedback, queues mistakes, stops repeated failures, guards stale/double actions and commits once when each word finishes. Partial completed words remain committed on exit; this is a deliberate difference from the original deferred result transaction. |
| Memory intervals | Static `SpacedRepetition.getNextMemoLevel`, `t0.<clinit>/<init>` | Confirmed level 1 = two hours, then 1/2/3/5/8/13/21/34/55/89 days; correct advances to a maximum of 11, incorrect learned words step down and return after two hours. Mobile now uses these intervals, retaining existing due dates until answered. The separate desktop flashcard screen retains SM-2. |
| Collection creation | User-supplied creation screenshots; decoded `dialog_fragment_new_folder` | Two-option Add sheet; name and newline word list, 100-line limit, duplicate handling, local lookup and manual meanings for unknown terms. No claim that the original server automatically resolved definitions or pictures in this build. |
| Sharing / folders | Original sheet/supplied screenshot; decoded folder/share layouts | Own app supports rename, append words, delete with confirmation, JSON export and validated friend JSON import. Original service share-ID codes are not connected. |
| Offline/restart | Browser workflows and final physical APK | Typed answers, checked feedback, queue/retries and schedule survive reopening. A real force-stop exposed WebView write-behind; Android now commits app-private SharedPreferences before publishing state, with localStorage as a cache. Web still uses localStorage with quota/corruption handling. |

## Retained sources

[vocabulary-rea-index.json](evidence/vocabulary-rea-index.json) contains exact selectors, full Evidence IDs and provider limitations. Raw records/layout dumps remain under `D:/ReactJS/.cache/4english/vocab-analysis`; screenshots under `.cache/4english/deep/vocab2-*` remain local because background fragments can contain personal folder labels.

- Queue partition: `ev_6f49d73fc0f42517802880f62015e5d16bfc2847f943beaf95f703aecdf73a9f`.
- Pending commit: `ev_e8f6667f75bfef7391fd30006bb84b25d26b9efb31d19777a43304b4cb86c277`.
- Word commit/failure gate: `ev_689f78eec2493870bf8b69238734c930129230efd3f3b847d0b1b9b59b2c3a45`.
- Interval transitions: `ev_9d9e96b06299c9def850caa2713e2aac0570ccab1c707ccbd21d6f4e3a25b8c5`.
- Interval constants (smali fallback): `ev_958789fc7abdfe9e5842d7335c140b908337624f702ac78eacc754a07199d5c4`.
- Result entry: `ev_b31ae10fb44c08c299ff5f41e7b1602e89a051f20732d810ad87f14f601c706b`.

Static bodies are decompiler evidence, not observed execution. Five relevant binary XML layouts were decoded with Android aapt2 and resource IDs mapped through the same APK's resource table. No original success/result screenshot was obtained by changing the user's schedule.

## Remaining differences

The original encrypted dictionary and online images remain unavailable. The separate Skypedia corpus now resolves 104,703 normalized headwords automatically, replacing the former 38-entry limitation; only unresolved terms need a personal meaning. No original account sync, cloud share codes, push reminders or AI-generated conversation at results. Legacy true/false, multichoice and listening-writing layouts were not established as active runtime paths. UK/US local Android engines were observed starting; acoustic quality/TalkBack/rotation/API 28 were not certified.

The vocabulary core is usable offline, with tested learning/review/results and collection creation. This report does not claim pixel or service parity with all original vocabulary screens.
