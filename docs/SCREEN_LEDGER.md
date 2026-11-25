# Phone screen coverage — 1.3.0

## Bản hiện tại 1.6.0

Giữ bố cục quen thuộc nhưng thay nội dung/hình không được cấp quyền phân phối. Ngữ pháp hiện là 40 bài tự biên soạn; hình, logo, tên app và nhân vật thuộc EnglishFlow. Trang luyện viết, câu song ngữ, nguồn/giấy phép, kế hoạch ngày và hội thoại theo tình huống có luồng thực. Các bảng đối chiếu gốc bên dưới là lịch sử kiểm tra giao diện, không phải danh sách nội dung được đóng gói hiện tại.

Reference: original 4English 10.4.16 (410) on realme RMX3085 / Android 13. The 29 selected REA captures are indexed in [deep-screen-index.json](evidence/deep-screen-index.json); earlier captures are in [physical-reference-index.json](evidence/physical-reference-index.json). Screenshots remain in the local cache because some contain personal profile/folder information. That information is not included in the reconstruction.

| Screen family | Directly observed | Implemented in this build | Remaining difference |
| --- | --- | --- | --- |
| Home, full scroll | Top tiles, shortcuts, popular-word carousel, five recommendation rows, end of page | Same section order, scrollable large word cards, save/pronounce, recommendation destinations, restored scroll | Promotion, recommendations and counts use available local content |
| Vocabulary, full scroll | SRS chart/due card, pack shelf, personal folders | Real local counts, pack shelf, folder list, two-option Add sheet, bulk creation, append/rename/delete/export/import, sort | Original personal folders are deliberately not copied |
| Pack catalog | Banner/search, downloaded/daily shelves, TOEIC/category section | Local downloaded/daily shelves, working search/category filters and no-result state | Seven seed packs rather than the online catalog |
| Pack detail | Collection SRS, learn-new/flashcards, search/sort, lower word cards | Collection-scoped SRS, real cards/search/sort, pronunciation/save/options/notes lookup, flashcards | Local vocabulary rather than downloaded original pack content |
| Due review | Word/IPA/image, four meanings, disabled Check | Separate new/due sessions, six task modes, settings, feedback/retry, persisted session and one APK-interval schedule update per completed word | Original illustrations, deferred session commit and legacy exercise selection differ; see vocabulary analysis |
| Grammar | Ten expandable groups, nested lesson buttons, long rich-text lesson | All ten groups and **55 actual bundled Vietnamese lessons**, sanitized HTML/tables, expansion and scroll restoration | Unsafe/remote markup and embedded images removed |
| Exercises | Topic grid, lesson timeline, Easy/Hard sheet, inline-gap lesson, fixed player | Same route family using three actual local media lessons, two difficulty densities, answer checking/retry/transcript | Three local lessons rather than the original 500 exercises; illustration differs |
| Explore, full scroll | Article carousel/chips, Shorts, Video/channel card, books | Article/short/video/audio/book sections with destinations | Local illustrative media; original channel/feed not connected |
| Reader | Toolbar, cover, content, paragraph translation, settings, player | Bookmark, translation/lookup, share/text export, offline status, size/line/spacing/theme sheet, reading position, comprehension | Original photo/news/audio unavailable; local article and paragraph TTS used |
| Audio/video detail | Earlier reader/media observations and shipped resource layouts | Actual local playback, seek/speed/loop, timed transcript, translation, quiz, exercise/shadowing destinations | Generic native video controls; not every original media setting observed |
| Books | Explore shelf and full-screen library | Three full Gutenberg books, library search/category shelf, text sizing, pagination and persisted position | Typeset covers; no EPUB import, original downloads or bilingual translation |
| Tutor | Landing shortcuts, free-speaking introduction, scenario topic form | Landing, introduction and topic picker; local Shadowing records/plays voice | No generated conversation, AI assessment or original persona service |
| IELTS | Four skill tabs, test list and expandable content preview | Skill tabs, actual local preview/start, honest Writing/Speaking fallback destinations | No original exam papers, arena or band grading |
| Profile/settings | Profile, streak chart, lower settings rows | Local profile/streak, theme, level/goal/name editing, real backup/restore | No account, extension sync, server reminders or payment |
| Floating dictionary | Centered search dialog | Search dialog → actual local entry → save/notes, dismiss with Android Back | **38** local entries; encrypted original dictionary not recovered |
| Notifications / PRO | Home entry controls; service bodies not exhaustively observed | Dedicated explicit local/unavailable states | Original push/purchases not connected |
| Word Chain | Existing offline picker/game observations | Offline picker, validation, turn history, bot response | Online/competitive modes unavailable |

Full-screen detail pages hide the main tab bar. Hardware Back dismisses lookup/sheets first, then follows the actual navigation history. Home and long grammar lists restore their prior scroll positions.

## Vocabulary follow-up

[New vocabulary analysis](VOCABULARY_ANALYSIS.md) records the added live selector/settings/exit observations, static scheduler/result traces, creation inference and remaining gaps. Original online images, share-ID service and encrypted word database remain unresolved. The full core was checked on the physical phone; legacy layout presence alone is not runtime coverage.

## Data boundary

- `assets/grammar_vi.json`: 10 groups / 55 lessons, plaintext in supplied APK. `scripts/extract-reference.py` extracts it through an HTML tag/style allowlist and records hashes in [deep-resources.json](evidence/deep-resources.json). It includes a runnable malicious-markup assertion.
- `assets/grammar_en.json`: 27 lessons observed, not duplicated in the Vietnamese interface.
- `assets/word_entry_encrypted.db`: 11,915,264 bytes, encrypted; no table or row contents recovered. Original account/private app databases were not extracted.
- `dict.json`, `videos.json`, `games.json`, `flashcards.json`, `spaced_repetition.json` are animation objects, not content databases.
- Selected Inter Tight fonts and five category images came from the supplied APK, with member hashes. Three full public-domain book texts came from Project Gutenberg; source URLs/hashes are in [books.json](evidence/books.json), and the original license/source text remains in each packaged file.

This is a substantial local reconstruction, not complete visual or service parity. Unobserved server-backed screens and the original online library remain unresolved; no percentage of fidelity is claimed.


## 1.4.0 vocabulary update

Creation now resolves from 104,703 offline headwords, with optional sense selection and IPA/examples. Dictionary search, learning and flashcards share this data and explicit UK/US TTS. See [integration and current tests](DICTIONARY_INTEGRATION.md); earlier source/database limitations in this ledger describe previous builds.
