# Implementation status

## Nội dung và phản hồi cục bộ — 1.7.0 (8), 2026-10-25

- Tổng 30 bộ/360 từ biên tập, 226 câu song ngữ, 35 bản thu người thật, 22 bài đọc, 60 bài ngữ pháp, 20 đề viết và 18 tình huống nói. Lọc trình độ/chủ đề theo thư viện; mỗi bài đọc mới có ba đoạn song ngữ và hai câu hỏi.
- Writing: 84.921 mục chính tả, quy tắc ngữ pháp phổ biến, bốn tiêu chí đo được, vị trí lỗi/gợi ý, áp dụng từng sửa đổi, chấm lại và xuất phản hồi. Bản nháp/trạng thái đã chấm bền vững; chỉnh bài vô hiệu kết quả cũ. Chưa chấm nội dung lập luận hay band IELTS.
- Android: ONNX Runtime + Wav2Vec2 Q4 + CMU căn âm vị cho bản ghi 0,4–15 giây, phản hồi từng từ/âm và lịch sử luyện. Có hủy/timeout/bỏ callback cũ, kiểm tra im lặng/vỡ tiếng/ngoài từ điển và giải phóng mô hình khi xuống nền. Chỉ số thực nghiệm chưa hiệu chuẩn, không chấm ngữ điệu hoặc diễn đạt tự do; trình duyệt hiển thị rõ tính năng cần APK.
- Giữ dữ liệu/backup phiên bản 1, ID cũ, lịch ôn và luồng Back/nháp bộ từ. Mô hình có nguồn/license/hash, không cần API key hay mạng khi học. APK lớn hơn (~308 MB) do mô hình và runtime đóng gói.
- Kiểm thử thực chạy và bằng chứng phát hành: [TEST_RESULTS.md](TEST_RESULTS.md). Các mục sau là lịch sử, không mô tả số lượng/tính năng hiện tại.

## Thư viện mở và luồng học — 1.6.0 (7), 2026-10-25

- Đã tích hợp 86 câu Tatoeba, 15 audio CC BY 4.0, 6 bài đọc mới NASA/Wikimedia; 10 bộ chủ đề/120 từ biên tập từ dữ liệu Skypedia có sẵn. Tổng thư viện đọc 10 bài, media 18 bài. Credit theo bài và trang Nguồn/giấy phép, xuất catalog/manifest qua document picker.
- Thay giáo trình APK bằng 40 bài ngữ pháp cấu trúc trong 10 nhóm. Tài sản APK chuyển vào `docs/evidence/reference-legacy`, không nằm trong public/APK mới. Logo, hình minh họa và nhân vật mới tự vẽ; font chính thức có OFL.
- Hoàn thiện 8 đề viết với bản nháp bền vững, bộ đếm, nộp/checklist/bài tham khảo/xuất; 6 tình huống nói × 4 lượt, dùng engine ghi âm thật; kế hoạch ngày dùng sự kiện thật. Hai người nối từ tại máy; bỏ nút mạng giả.
- Giữ sửa Back và bộ từ nháp 1.5.0. ID `lib-word-*` không trùng custom dictionary `sky-*`; Writing là trường tùy chọn của backup phiên bản 1. Bản chuẩn Android là SharedPreferences, không phải cache localStorage.
- Web mobile có service worker, precache media/font/nội dung và phản hồi Range 206/416 để tua audio ngoại tuyến. Android đã đóng gói sẵn, không có quyền Internet.
- Theo lựa chọn người dùng: ưu tiên lõi ngoại tuyến; AI sinh nội dung/cloud/thi đấu mạng cần dịch vụ sau, không mô phỏng hoặc ghi band tự động.

Các mục dưới đây là lịch sử các bản trước; số lượng và tài sản APK được nêu ở đó không mô tả bản 1.6.0.

## Draft vocabulary and Back fix — 1.5.0 (6), 2026-10-24

- Collection/learning Back returns to the parent without a navigation loop; saving/appending skips the completed editor. Home Back exits Android even after a cold deep-link reload.
- Explicit lookup → review/edit/remove/restore → final “Thêm từ”; drafts survive reload, raw input changes require lookup again, and only kept words are committed. Editing draft terms/definitions/IPA/POS/examples preserves already saved words and schedules.
- Unknown dictionary prefixes now use the packaged inventory instead of fetching nonexistent JSON. Forms hide the floating dictionary to keep edit/delete controls clear.
- Installed APK tested on Android 16 / API 36 emulator, including Android Back and soft keyboard. Six focused groups also pass in Chrome at 320/393/600 px; existing domain, dictionary, vocabulary and mobile regression suites pass. User requested emulator preview before another phone connection. [Evidence](TEST_RESULTS.md), [preview](../releases/Vocabulary-draft-preview-1.5.0.jpg).

## Automatic dictionary — 1.4.0 (5), 2026-10-23

104,703 headwords / 175,735 senses from the user-designated reference app now provide automatic bulk lookup, optional sense choice, IPA/examples, morphology and UK/US local voices. Android bundles the dictionary separately from learner progress. [Integration and verification](DICTIONARY_INTEGRATION.md). Version entries below describe historical scope.

## Vocabulary core — 1.3.0 (4), 2026-10-23

- Added the original-style new-word selector; separate learning and due review, per-group settings, first writing, meaning/word/listening/writing/context tasks, feedback, retry, results and resumable sessions. Mobile uses the APK-confirmed two-hour/Fibonacci memory intervals; desktop retains SM-2.
- Added the two-option Add sheet, 100-word bulk form, local lookup/manual meaning resolution, draft retention, collection append/rename/delete and validated JSON sharing. Counts include unlearned collection words. Global learning preserves originating collection membership.
- Android now commits private durable storage before publishing state after a force-stop test exposed WebView write-behind. Existing data migrates on the next write; web quota/corruption protection remains.
- Evidence, deliberate differences and unresolved original services: [VOCABULARY_ANALYSIS.md](VOCABULARY_ANALYSIS.md). Original encrypted dictionary/images and server share codes remain unavailable; no full-fidelity claim.

## Full-scroll/detail update — 1.2.0 (3), 2026-10-22

- Added the missing home carousel/recommendations and lower Explore bookshelf/Shorts/video/audio routes; detail pages hide tabs, follow actual Back history and restore scroll after asynchronous grammar loading.
- Dedicated catalog/pack/folder/review/flashcard/exercise/reader/profile/tutor-scenario/IELTS-preview screens now open real local content. Dictionary results open immediately in a modal, and learning a new word preserves the originating collection.
- Extracted all 55 Vietnamese grammar lessons from the supplied APK through an HTML allowlist; added Inter Tight fonts, selected category images and three full Gutenberg books. Local dictionary has 38 entries. Encrypted dictionary and personal original database were not extracted.
- Complete route/evidence/remaining-gap ledger: [SCREEN_LEDGER.md](SCREEN_LEDGER.md). This is still a local hybrid reconstruction; original online content, full exam papers, AI, payments, account sync and multiplayer remain unavailable. No full-fidelity claim.

## Physical reference update — 1.1.0 (2), 2026-10-22

- Observed original 4English 10.4.16 (410), Play-installed on realme RMX3085 / Android 13. REA screenshots confirm home vocabulary/reading/IELTS tiles, vocabulary chart, AI tutor entry, horizontal Explore cards, reader tools and Word Chain character picker. See `evidence/physical-reference-index.json`.
- Updated home artwork/layout, five-tab labels, vocabulary chart/catalog placement, Explore carousel and tutor tool entry. Fifteen selected APK UI images have provenance in `evidence/reference-assets.json`.
- Added offline Word Chain with dictionary validation, no repeats, last-letter matching and bot responses. Six character choices share one bounded local algorithm. Online/competitive play report unavailable. IELTS entry provides foundation sample reading/listening, not IELTS papers or band scoring.
- APK installed alongside original on physical phone. Six physical groups, nine browser groups and ten emulator groups passed on this version. Original app data and permissions were preserved.
- Still partial: exact typography/artwork and detail screens differ; no connected AI conversation, original backend/account sync, multiplayer, expanded content library or IELTS scoring. Near-identical completeness is not an acceptance claim.

## Earlier Android reconstruction — 1.0.0

- Installable **hybrid Android APK**, package `com.englishflow.mobile`, min SDK 28, target SDK 36; native Java WebView host with bundled React phone entry. Signed with a debug key for sideload testing, not published to a store.
- Five reference-style phone tabs, home learning tiles, a vocabulary bank with actual SRS counts, two-column collection catalog, Explore reading/video/podcast cards and four quiz modes. The web dashboard remains available separately.
- Offline packaged dictionary, readings, quizzes, audio and video. Android TextToSpeech uses installed voice data. Native microphone recording/playback stays local, handles denial and stops in background; it is self-assessment, not recognition or pronunciation grading.
- Android Back, safe-area insets, native document export and file import hooks; app-private persisted vocabulary/progress survive process restart.
- Actual static REA analysis of user APK/XAPK and emulator installation/launch evidence, with the original app's Play licensing redirect recorded. Detailed Android runtime visual comparison remains blocked; near-identical appearance/behavior is **not an acceptance claim**.
- Delivery verification: 9 phone browser groups, 10 native emulator groups, the existing 19 web workflow groups and 5 reliability groups passed. APK and checks are linked in `TEST_RESULTS.md`; no physical-phone equivalence is claimed.

The following original web inventory still applies to shared study features. Platform-specific exceptions are stated below.

## Complete in the local prototype

- Responsive desktop sidebar, tablet/mobile menu and bottom navigation; hash deep links.
- Useful zero-state dashboard, goal, due words, foreground study-time samples, seven-day activity, continue reading, bookmarks and recent activity.
- Shared local EN–VI dictionary, 36 real entries/phrases, search/recent searches, pronunciation with explicit unsupported/error fallback, meanings/examples and save/remove.
- Seven level/topic vocabulary sets, personal collection create/edit, membership add/remove, notes, saved words, search/level filtering, sorting, pagination, validated JSON import/export.
- Due flashcard sessions, reveal/rate, SM-2 next scheduling, accuracy and session summary. Lapse sort helps identify repeatedly forgotten words.
- Choice, gap, typed and spelling practice with scoring, immediate explanation, saved mistakes and retry.
- Four original bilingual readings, topic/type/level/search/bookmark filters, supported-token lookup, explicit paragraph save/restore and comprehension quiz.
- Two actual WAV audio lessons and one narrated WebM original video, native play/pause/seek/duration, speed, timed transcript/translation visibility, per-sentence replay, saved position, dictation/gap/comprehension and self-guided shadowing.
- Eight structured grammar topics with original explanations/examples and quizzes.
- Statistics and recent history calculated from persisted events, no fake seeded achievements.
- Local profile/preferences/theme, full export and validated restore with explicit replacement confirmation, explicit local data deletion, corrupted-data recovery and quota error reporting.
- Install manifest; production service worker for offline app shell, reading/dictionary/grammar after initial online installation.
- Real REA local browser Evidence; domain assertions, browser workflow and reliability checks; production build/typecheck.

## Partial by design

- Dictionary lookup is asynchronous and local on Android, with bounded prefix shards. Authored reading/media providers remain small and synchronous. This is not universal translation or an external content service.
- Reading position is a manually chosen paragraph. Progress in the card means position reached, not proven comprehension. The score is stored when the exercise finishes.
- Narration is synthesized and video is an original illustration, not a third-party podcast/video catalog. Caption timing is based on generated 8-second slots; repeat pause follows media timeupdate granularity.
- Desktop shadowing in the media player plays/repeats content. The phone Gia sư AI → Shadowing path additionally records/replays audio; no platform provides speech recognition or pronunciation scoring.
- Web service-worker offline excludes media and Google fonts. Android bundles the media and uses system fonts, so these are available without network. Player errors retain transcript study. No background media downloading or push notifications.
- Study time measures foreground tab presence in 15-second samples, not attention. Partial final samples can be lost. Local clock/timezone changes affect schedules and streaks.
- Web persistence is localStorage, with quota limits and last-write-wins tab synchronization; Android 1.3.0 uses a synchronous private SharedPreferences commit with a WebView cache; no transactional multi-device guarantee. Backup is JSON, not CSV. Re-imported existing vocabulary IDs preserve their existing content.
- Accessibility uses native dialogs/media controls, labels, keyboard focus/escape, visible focus, contrast refinement and reduced-motion support. No claim of a full WCAG audit or real screen-reader/device certification.

## Not implemented

- Spring Boot/PostgreSQL, remote registration/sign-in/sign-out, password handling, user isolation on server and cloud sync.
- External dictionary/news/translation/media feeds, automated content ingestion, copyrighted reference content.
- AI tutor/provider, live conversation, pronunciation grading, iOS builds and word-chain multiplayer. Android is hybrid rather than a full native fragment UI.
- Web offline media caching, CSV import and arbitrary user-uploaded media alignment.
- Database migrations/auth/API integration tests: no backend/endpoints exist in this release.

## Next three valuable improvements

1. Spring Boot/PostgreSQL with secure account sessions/ownership, transactional reviews and validated local-data migration.
2. Licensed dictionary/content adapters and a substantially expanded editorially reviewed bilingual library.
3. Server-side optional AI tutor, plus real mobile/screen-reader accessibility testing and optional offline media packs.
