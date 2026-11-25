import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, AudioLines, Bell, BookA, BookOpen, Check, ChevronRight, CirclePlay, Gamepad2, Headphones, House, Mic, Newspaper, Pause, Play, Plus, Search, Settings2, Square, UserRound, Volume2, GraduationCap, Languages, Globe, Gem, MessageCircle, Compass } from "lucide-react";
import { articles, mediaLessons, words, grammarLessons } from "./data";
import { LookupDialog, Scene, speak } from "./components";
import { Vocabulary } from "./Vocabulary";
import { Reading } from "./Reading";
import { Practice } from "./Practice";
import { Settings } from "./Settings";
import { Progress } from "./Dashboard";
import { event, statistics } from "./domain";
import { useStore } from "./store";
import { device } from "./native";
import { chainTurn, chainWords } from "./word-chain";
import { Catalog, Exercises, Grammar, IeltsHub, PackDetail, PackShelf, PhoneProfile, PhoneReader, Sheet, WordStats } from "./MobileDetails";
import { CollectionEditor, VocabularyFolders as Folders, VocabularyStudy, WordFlashcards } from "./MobileVocabulary";
import { Books, BookShelf, PhoneDictionary, PhoneMedia } from "./MobileLibrary";
import { newSaved } from "./domain";
import { Sources } from "./ContentCredits";
import { PronunciationFeedback } from "./LearningAssessment";
import { LearningPlan, PlanCard, Sentences, Writing } from "./MobileLearning";
import { scenarioLessons, speakingScenarios, writingPrompts } from "./learning-content";
import { libraryPacks, openContent } from "./open-content-data";

const pages = ["home", "vocabulary", "speaking", "explore", "games", "dictionary", "saved", "collection", "review", "reading", "listening", "practice", "ielts", "progress", "settings", "grammar", "exercises", "catalog", "flashcards", "profile", "notifications", "about", "books", "shorts", "pro", "learn", "create-collection", "import-collection", "writing", "sentences", "sources", "plan"] as const;
type Page = typeof pages[number];
export type Navigate = (page: Page, id?: string, options?: { returnTo?: boolean }) => void;
const tabs = [
  { page: "home", label: "Trang chủ", Icon: House },
  { page: "vocabulary", label: "Từ vựng", Icon: BookA },
  { page: "speaking", label: "Luyện nói", Icon: AudioLines },
  { page: "explore", label: "Khám phá", Icon: Headphones },
  { page: "games", label: "Giải trí", Icon: Gamepad2 },
] as const;
const titles: Record<Page, string> = { learn: "Học từ mới", "create-collection": "Tạo bộ từ cá nhân", "import-collection": "Thêm bộ từ của bạn bè", writing: "Luyện viết", sentences: "Câu song ngữ", sources: "Nguồn và giấy phép", plan: "Kế hoạch hôm nay", home: "EnglishFlow", vocabulary: "Từ vựng", speaking: "Luyện nói", explore: "Khám phá", games: "Giải trí", dictionary: "Từ điển", saved: "Từ đã lưu", collection: "Bộ từ vựng", review: "Chọn nghĩa chính xác", reading: "Bài đọc", listening: "Nghe & Video", practice: "Luyện tập", ielts: "Luyện thi IELTS", progress: "Tiến độ học tập", settings: "Cài đặt", grammar: "Ngữ pháp", exercises: "Bài tập", catalog: "Các bộ từ vựng", flashcards: "Flashcards", profile: "EnglishFlow", notifications: "Thông báo", about: "Thông tin ứng dụng", books: "Kho sách", shorts: "Shorts", pro: "Lộ trình học" };
function route() {
  const [page, rawId] = location.hash.slice(1).split("/");
  let id: string | null = null;
  try { id = rawId ? decodeURIComponent(rawId) : null; } catch { /* A malformed link opens the library. */ }
  return { page: pages.includes(page as Page) ? page as Page : "home" as Page, id };
}
export default function MobileApp() {
  const { state, update } = useStore();
  const [current, setCurrent] = useState(route);
  const [lookup, setLookup] = useState<string | null>(null);
  const [dictionaryPrompt, setDictionaryPrompt] = useState(false);
  const [dictionaryTerm, setDictionaryTerm] = useState("");
  const frames = useRef<{ hash: string; y: number }[]>([{ hash: location.hash, y: 0 }]);
  const cursor = useRef(0);
  const restoring = useRef(false);
  const navigate: Navigate = (page, id, options) => {
    const hash = "#" + page + (id ? "/" + encodeURIComponent(id) : "");
    if (hash === location.hash) return;
    frames.current[cursor.current].y = window.scrollY;
    if (options?.returnTo) {
      for (let i = cursor.current - 1; i >= 0; i--) if (frames.current[i].hash === hash) { history.go(i - cursor.current); return; }
      frames.current[cursor.current] = { hash, y: 0 };
      history.replaceState({ efIndex: cursor.current }, "", hash);
      setCurrent(route());
    } else location.hash = hash;
  };
  const lookupWord = (term: string) => {
    setLookup(term.slice(0, 100));
    update(s => ({ ...s, searches: [term, ...s.searches.filter(w => w !== term)].slice(0, 8) }));
  };
  const primary = tabs.some(t => t.page === current.page) && !current.id && current.page !== "speaking";
  const title = current.page === "collection" ? [...state.collections, ...libraryPacks].find(c => c.id === current.id)?.name ?? titles.collection : titles[current.page];
  function back() {
    if (lookup) { setLookup(null); return true; }
    if (dictionaryPrompt) { setDictionaryPrompt(false); return true; }
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
    if (dialog) { dialog.dispatchEvent(new Event("cancel", { cancelable: true })); return true; }
    if (["learn", "review"].includes(current.page)) { window.dispatchEvent(new Event("englishflow-study-back")); return true; }
    if (cursor.current > 0) { history.back(); return true; }
    if (current.page === "home") return false;
    if (current.page === "speaking" && current.id && current.id !== "topics") navigate("speaking", "topics", { returnTo: true });
    else if (primary) navigate(current.id ? current.page : "home", undefined, { returnTo: true });
    else if (["collection", "saved", "catalog", "flashcards"].includes(current.page)) navigate("vocabulary", undefined, { returnTo: true });
    else if (current.page === "reading" || current.page === "listening") navigate(current.id ? current.page : "explore", undefined, { returnTo: true });
    else if (current.page === "practice") navigate(current.id && !["choice", "gap", "typed", "spelling"].includes(current.id) ? "practice" : "games", undefined, { returnTo: true });
    else navigate("home", undefined, { returnTo: true });
    return true;
  }
  useEffect(() => {
    history.scrollRestoration = "manual";
    history.replaceState({ efIndex: 0 }, "");
    const scroll = () => { if (!restoring.current && frames.current[cursor.current]) frames.current[cursor.current].y = window.scrollY; };
    const changed = () => {
      const index = history.state?.efIndex;
      if (typeof index === "number" && frames.current[index]?.hash === location.hash) cursor.current = index;
      else {
        cursor.current++;
        frames.current = frames.current.slice(0, cursor.current);
        frames.current.push({ hash: location.hash, y: 0 });
        history.replaceState({ efIndex: cursor.current }, "");
      }
      setCurrent(route());
    };
    window.addEventListener("hashchange", changed);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => { window.removeEventListener("hashchange", changed); window.removeEventListener("scroll", scroll); };
  }, []);
  useLayoutEffect(() => {
    const target = frames.current[cursor.current]?.y ?? 0;
    restoring.current = true;
    const restore = () => { window.scrollTo(0, target); if (Math.abs(window.scrollY - target) < 2) restoring.current = false; };
    restore();
    const observer = new ResizeObserver(() => { if (restoring.current) restore(); });
    const main = document.getElementById("main");
    if (main) observer.observe(main);
    const stop = () => { restoring.current = false; observer.disconnect(); };
    const limit = setTimeout(stop, 2000);
    window.addEventListener("pointerdown", stop, { once: true });
    window.addEventListener("wheel", stop, { once: true, passive: true });
    return () => { clearTimeout(limit); stop(); window.removeEventListener("pointerdown", stop); window.removeEventListener("wheel", stop); };
  }, [current]);
  useEffect(() => {
    window.englishFlowBack = back;
    document.title = titles[current.page] + " · EnglishFlow";
    return () => { delete window.englishFlowBack; };
  });
  const activeTab = ["reading", "listening"].includes(current.page) ? "explore" : ["saved", "collection", "review"].includes(current.page) ? "vocabulary" : current.page === "practice" ? "games" : current.page;
  return <div className={"phone-app " + (primary ? "phone-primary" : "phone-detail")} data-page={current.page} data-id={current.id ?? ""}>
    <header className="phone-header">
      {current.page === "home" ? <a className="phone-brand" href="#home"><img className="phone-logo" src="/art/logo.svg" alt="" />EnglishFlow</a> : <div className="phone-title">{(!primary || current.id && ["speaking", "games"].includes(current.page)) && <button className="icon-button" aria-label="Quay lại" onClick={back}><ArrowLeft /></button>}<h1>{title}</h1></div>}
      <div className="row">{current.page === "home" && <button className="icon-button pro-icon" aria-label="Lộ trình học" onClick={() => navigate("pro")}><Gem size={23} /></button>}{["home", "vocabulary"].includes(current.page) ? <button className="icon-button" aria-label="Thông báo" onClick={() => navigate("notifications")}><Bell size={25} /></button> : current.page === "explore" ? <button className="icon-button" aria-label="Thư viện bài đọc" onClick={() => navigate("reading")}><Globe size={25} /></button> : null}{current.page === "home" && <button className="icon-button" aria-label="Cá nhân và cài đặt" onClick={() => navigate("profile")}><UserRound size={25} /></button>}</div>
    </header>
    <main className="phone-main" id="main" key={current.page + "/" + (current.id ?? "")}>
      {current.page === "home" && <Home navigate={navigate} onLookup={lookupWord} />}
      {current.page === "writing" && <Writing id={current.id} navigate={navigate} />}
      {current.page === "sentences" && <Sentences onLookup={lookupWord} />}
      {current.page === "sources" && <Sources />}
      {current.page === "plan" && <LearningPlan navigate={navigate} />}
      {current.page === "vocabulary" && (current.id === "sets" ? <Catalog navigate={navigate} /> : <WordBank navigate={navigate} onLookup={lookupWord} initialTab={current.id} />)}
      {current.page === "explore" && <Explore navigate={navigate} />}
      {current.page === "games" && <Games navigate={navigate} activeId={current.id} onLookup={lookupWord} />}
      {current.page === "speaking" && (["free", "scenario"].includes(current.id ?? "") ? <TutorScenario navigate={navigate} activeId={current.id} /> : current.id ? <Speaking onLookup={lookupWord} activeId={current.id} onOpen={id => navigate("speaking", id ?? "topics")} /> : <Tutor navigate={navigate} />)}
      {current.page === "dictionary" && <PhoneDictionary onLookup={lookupWord} />}
      {current.page === "saved" && <Vocabulary onLookup={lookupWord} onReview={() => navigate("review")} />}
      {current.page === "collection" && <PackDetail id={current.id} navigate={navigate} onLookup={lookupWord} />}
      {(current.page === "review" || current.page === "learn") && <VocabularyStudy id={current.id} navigate={navigate} kind={current.page === "learn" ? "learn" : "review"} />}
      {current.page === "flashcards" && <WordFlashcards id={current.id} navigate={navigate} />}
      {["create-collection", "import-collection"].includes(current.page) && <CollectionEditor id={current.id} navigate={navigate} importing={current.page === "import-collection"} />}
      {current.page === "reading" && (current.id ? <PhoneReader id={current.id} navigate={navigate} onLookup={lookupWord} /> : <Reading activeId={null} onOpen={id => navigate("reading", id ?? undefined)} onLookup={lookupWord} />)}
      {(current.page === "listening" || current.page === "shorts") && <PhoneMedia id={current.id} shorts={current.page === "shorts"} navigate={navigate} onLookup={lookupWord} />}
      {current.page === "practice" && <Practice activeId={current.id} initialMode={["choice", "gap", "typed", "spelling"].includes(current.id ?? "") ? current.id as "choice" | "gap" | "typed" | "spelling" : undefined} onOpen={id => navigate("practice", id ?? undefined)} onLookup={lookupWord} />}
      {current.page === "progress" && <Progress navigate={(page, id) => navigate(page, id)} />}
      {current.page === "settings" && <Settings />}
      {current.page === "ielts" && <IeltsHub navigate={navigate} />}
      {current.page === "grammar" && <Grammar id={current.id} navigate={navigate} />}
      {current.page === "exercises" && <Exercises id={current.id} navigate={navigate} />}
      {current.page === "catalog" && <Catalog navigate={navigate} />}
      {current.page === "profile" && <PhoneProfile navigate={navigate} />}
      {current.page === "books" && <Books id={current.id} navigate={navigate} onLookup={lookupWord} />}
      {current.page === "notifications" && <div className="phone-empty"><Bell size={45} /><h2>Chưa có thông báo mới</h2><p>{statistics(state).due} từ đang đến hạn ôn tập trên thiết bị.</p><button className="button" onClick={() => navigate("review")}>Ôn tập ngay</button></div>}
      {current.page === "pro" && <LearningPlan navigate={navigate} />}
      {current.page === "about" && <div className="panel"><h2>EnglishFlow 1.7.0</h2><p>Học từ vựng, đọc, nghe, nói và viết ngoại tuyến. Nội dung mở có tác giả, nguồn và giấy phép trong từng bài.</p><p>{grammarLessons.length} bài ngữ pháp · {libraryPacks.length} bộ từ biên tập · {openContent.sentences.length} câu song ngữ · {writingPrompts.length} đề viết · {speakingScenarios.length} tình huống giao tiếp.</p><button className="button" onClick={() => navigate("sources")}>Nguồn và giấy phép</button><p>Dữ liệu học lưu trên thiết bị; xuất bản sao lưu trong Cài đặt để chuyển máy.</p></div>}
    </main>
    {!["dictionary", "review", "learn", "flashcards", "exercises", "create-collection", "import-collection", "writing", "sentences"].includes(current.page) && <button className="floating-dictionary" aria-label="Mở từ điển" onClick={() => { setDictionaryTerm(""); setDictionaryPrompt(true); }}><BookA size={24} /></button>}
    {primary && current.page !== "speaking" && <button className="floating-tutor" aria-label="Mở gia sư" onClick={() => navigate("speaking")}><img src="/art/guide.svg" alt="" /><i /></button>}
    {primary && <nav className="phone-tabs" aria-label="Điều hướng chính">{tabs.map(({ page, label, Icon }) => <a key={page} href={"#" + page} aria-current={activeTab === page ? "page" : undefined} className={activeTab === page ? "active" : ""}><Icon size={26} /><span>{label}</span></a>)}</nav>}
    {lookup && <LookupDialog term={lookup} onLookup={lookupWord} onClose={() => setLookup(null)} initialCollectionId={["dictionary", "collection"].includes(current.page) ? current.id ?? undefined : undefined} />}
    {dictionaryPrompt && <Sheet title="Từ điển" onClose={() => setDictionaryPrompt(false)}><form className="dictionary-prompt" onSubmit={e => { e.preventDefault(); if (dictionaryTerm.trim()) { setDictionaryPrompt(false); lookupWord(dictionaryTerm.trim()); } }}><label className="field"><span className="sr-only">Tra từ điển</span><input autoFocus aria-label="Tra từ điển" maxLength={100} placeholder="Tra từ điển" value={dictionaryTerm} onChange={e => setDictionaryTerm(e.target.value)} /></label><button className="button" disabled={!dictionaryTerm.trim()}>TRA TỪ</button></form></Sheet>}
  </div>;
}
function Section({ title, onMore, children }: { title: string; onMore?: () => void; children: ReactNode }) {
  return <section className="phone-section"><div className="phone-section-heading"><h2>{title}</h2>{onMore && <button className="icon-button" aria-label={"Xem tất cả " + title.toLowerCase()} onClick={onMore}><ChevronRight size={21} /></button>}</div>{children}</section>;
}
function Home({ navigate, onLookup }: { navigate: Navigate; onLookup: (term: string) => void }) {
  const [query, setQuery] = useState("");
  const { state, update, notice } = useStore();
  const popular = words.filter(w => ["love", "study", "habit"].includes(w.term));
  return <>
    <PlanCard navigate={navigate} />
    <form className="phone-search" onSubmit={e => { e.preventDefault(); if (query.trim()) onLookup(query.trim()); }}><Search size={26} /><input aria-label="Tra từ" placeholder="Tra cứu từ điển" maxLength={100} value={query} onChange={e => setQuery(e.target.value)} /><button type="submit" aria-label="Tra cứu"><ArrowRight size={20} /></button></form>
    <Section title="Hôm nay bạn muốn học gì?">
      <div className="learning-tools">
        <button className="tool tool-content" onClick={() => navigate("vocabulary")}><span>Học từ vựng</span><img className="tool-art" src="/art/vocabulary.svg" alt="" /></button>
        <button className="tool tool-speak" onClick={() => navigate("explore")}><span>Luyện<br />đọc</span><img className="tool-art" src="/art/reading.svg" alt="" /></button>
        <button className="tool tool-words" onClick={() => navigate("ielts")}><span>Luyện thi<br />IELTS</span><img className="tool-art" src="/art/writing.svg" alt="" /></button>
      </div>
    </Section>
    <button className="phone-banner" onClick={() => navigate("ielts")}><span className="banner-tag">LUYỆN KỸ NĂNG MỖI NGÀY</span><strong>Luyện thi IELTS</strong><span>Đọc · Nghe · Nói · Viết</span><span className="banner-action">LUYỆN NGAY <ArrowRight size={14} /></span><GraduationCap className="banner-art" size={86} /></button>
    <div className="banner-dots" aria-hidden="true"><i /></div>
    <Section title="Tính năng khác"><div className="feature-shortcuts">{[
      { title: "Ngữ pháp", Icon: BookOpen, page: "grammar" as Page }, { title: "Bài tập", Icon: GraduationCap, page: "exercises" as Page }, { title: "Song ngữ", Icon: Languages, page: "sentences" as Page }, { title: "Luyện viết", Icon: Newspaper, page: "writing" as Page }, { title: "Bài nghe", Icon: Headphones, page: "listening" as Page }, { title: "Đọc sách", Icon: BookA, page: "books" as Page },
    ].map(({ title, Icon, page }) => <button key={title} onClick={() => navigate(page)}><span><Icon size={28} /></span>{title}</button>)}</div></Section>
    <Section title="Từ được lưu nhiều nhất"><div className="popular-words">{popular.map(w => <article className="popular-word" key={w.id}><span className="pos-pill">{w.pos}</span><button className="text-button" onClick={() => onLookup(w.term)}><strong>{w.term}</strong></button>{["US", "UK"].map(accent => <div className="row" key={accent}><small>{accent}</small><span>{w.ipa}</span><button className="icon-button" aria-label={"Phát âm " + w.term + " " + accent} onClick={() => speak(w.term, notice, accent === "UK" ? "en-GB" : "en-US")}><Volume2 size={20} /></button></div>)}<p>{w.meaning}</p><button className="button full" disabled={!!state.saved[w.id]} onClick={() => update(s => ({ ...s, saved: { ...s.saved, [w.id]: newSaved(w.id, s.collections[0].id) } }))}>{state.saved[w.id] ? <><Check size={16} />Đã lưu</> : "Lưu từ"}</button></article>)}</div></Section>
    <Section title="Dành cho bạn"><div className="recommendations">{articles.slice(0, 1).map(a => <button key={a.id} onClick={() => navigate("reading", a.id)}><Scene kind={a.scene} /><span><small>Luyện đọc</small><strong>{a.title}</strong><p>{a.subtitle}</p></span></button>)}{mediaLessons.slice(0, 1).map(m => <button key={m.id} onClick={() => navigate("listening", m.id)}><Scene kind={m.scene} /><span><small>{m.type === "video" ? "Video" : "Bài nghe"}</small><strong>{m.title}</strong><p>{m.description}</p></span></button>)}<button onClick={() => navigate("speaking", "topics")}><span className="recommend-speaking"><Mic size={34} /></span><span><small>Nói</small><strong>Luyện nói tiếng Anh mỗi ngày</strong><p>Nghe, nhắc lại và ghi âm giọng nói</p></span></button>{state.collections.slice(0, 2).map((c, i) => <button key={c.id} onClick={() => navigate("collection", c.id)}><img src={"/art/" + (i ? "writing" : "vocabulary") + ".svg"} alt="" /><span><small>Từ vựng</small><strong>{c.name}</strong><p>{c.wordIds.length} từ · {c.topic}</p></span></button>)}</div></Section>
  </>;
}
function WordBank({ navigate }: { navigate: Navigate; onLookup: (term: string) => void; initialTab: string | null }) {
  const { state } = useStore();
  const [chip, setChip] = useState("Trending");
  return <>
    <div className="spaced-info"><div><strong>Spaced Repetition</strong><p>Học ít - Nhớ sâu từ vựng với phương pháp khoa học Spaced Repetition</p></div><BookOpen size={22} /></div>
    <WordStats saved={Object.values(state.saved)} navigate={navigate} total={new Set([...state.collections.flatMap(c => c.wordIds), ...Object.keys(state.saved)]).size} />
    <button className="pack-action" onClick={() => navigate("learn")}><Plus />Học thêm từ mới<ChevronRight /></button>
    <Section title="Khám phá bộ từ vựng" onMore={() => navigate("catalog")}><p className="muted">Các bộ từ theo chủ đề được biên soạn</p><button className="catalog-more text-button" onClick={() => navigate("catalog")}>Xem tất cả <ChevronRight size={16} /></button><div className="phone-chips">{["Trending", "TOEIC"].map(t => <button key={t} className={chip === t ? "active" : ""} onClick={() => setChip(t)}>{t}</button>)}</div><PackShelf navigate={navigate} filter={chip === "TOEIC" ? "TOEIC" : ""} /></Section>
    <Folders navigate={navigate} />
    <button className="phone-row-link" onClick={() => navigate("saved")}><Settings2 size={21} /> Quản lý từ đã lưu, nhập và xuất dữ liệu <ChevronRight size={18} /></button>
  </>;
}
function ArticleCards({ navigate, items }: { navigate: Navigate; items: typeof articles }) {
  return <div className="phone-card-grid">{items.map(a => <button className="phone-article" key={a.id} onClick={() => navigate("reading", a.id)}><div className="article-cover"><Scene kind={a.scene} /><span>{a.topic}</span></div><h3>{a.title}</h3><div className="article-meta"><b>{a.level}</b><span>{a.minutes} phút đọc</span><BookOpen size={14} /></div></button>)}</div>;
}
function Explore({ navigate }: { navigate: Navigate }) {
  const [topic, setTopic] = useState("Dành cho bạn");
  const topics = ["Dành cho bạn", "Mới nhất", ...new Set(articles.map(a => a.topic))];
  return <>
    <Section title="Bài đọc" onMore={() => navigate("reading")}><div className="phone-chips">{topics.map(t => <button key={t} className={topic === t ? "active" : ""} onClick={() => setTopic(t)}>{t}</button>)}</div><ArticleCards navigate={navigate} items={(topic === "Mới nhất" ? [...articles].reverse() : articles).filter(a => ["Dành cho bạn", "Mới nhất"].includes(topic) || a.topic === topic)} /></Section>
    <Section title="Shorts" onMore={() => navigate("shorts")}><div className="shorts-shelf">{mediaLessons.filter(m => m.type === "video").map(m => <button key={m.id} onClick={() => navigate("shorts", m.id)}><div><Scene kind={m.scene} /><CirclePlay size={35} /></div><strong>{m.title}</strong></button>)}</div></Section>
    <Section title="Video" onMore={() => navigate("listening", "video")}><div className="phone-card-grid">{mediaLessons.filter(m => m.type === "video").map(m => <button className="phone-article" key={m.id} onClick={() => navigate("listening", m.id)}><div className="article-cover"><Scene kind={m.scene} /><CirclePlay className="play-cover" size={43} /></div><h3>{m.title}</h3><div className="article-meta"><b>{m.level}</b><span>{m.duration}</span></div></button>)}</div></Section>
    <Section title="Bài nghe" onMore={() => navigate("listening")}><div className="phone-list">{mediaLessons.filter(m => m.type === "audio").map(m => <button key={m.id} onClick={() => navigate("listening", m.id)}><span className="podcast-cover"><Headphones size={26} /></span><span><strong>{m.title}</strong><small>{m.level} · {m.duration} · Có bản chép lời</small></span><Play size={18} /></button>)}</div></Section>
    <Section title="Đọc sách" onMore={() => navigate("books")}><BookShelf navigate={navigate} /></Section>
    <p className="phone-footnote">Nội dung gốc và nguồn mở được ghi giấy phép · Sẵn sàng ngoại tuyến</p>
  </>;
}
const opponents = [
  ["Linh", "Mỗi từ là một khám phá.", "guide.svg"], ["An", "Cùng luyện thêm một lượt nhé!", "reading.svg"], ["Minh", "Bạn đã sẵn sàng chưa?", "vocabulary.svg"], ["Mai", "Chậm mà chắc.", "writing.svg"], ["Nam", "Học qua mỗi lần chơi.", "guide.svg"], ["Vy", "Bắt đầu hành trình từ vựng.", "reading.svg"],
];
function Games({ navigate, activeId, onLookup }: { navigate: Navigate; activeId: string | null; onLookup: (term: string) => void }) {
  const [history, setHistory] = useState<string[]>(["apple"]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [won, setWon] = useState(false);
  const local = activeId === "friends";
  const opponent = opponents.find(o => o[0] === activeId) ?? (local ? ["Hai người", "Chuyền điện thoại sau mỗi lượt", "guide.svg"] : undefined);
  const candidates = chainWords.filter(w => w[0] === history.at(-1)!.at(-1) && !history.includes(w));
  if (opponent) return <div className="chain-board"><div className="chain-opponent"><img src={"/art/" + opponent[2]} alt="" /><strong>{opponent[0]}</strong><span>{Math.floor((history.length - 1) / 2)} lượt</span></div><p className="phone-intro">Nối chữ cuối của từ trước thành chữ đầu của từ sau. Mỗi từ chỉ dùng một lần.</p><div className="chain-history" aria-live="polite">{history.map((w, i) => <button key={w} className={i % 2 ? "your-word" : "bot-word"} onClick={() => onLookup(w)}><small>{local ? i === 0 ? "Khởi đầu" : "Người " + (i % 2 ? 1 : 2) : i % 2 ? "Bạn" : opponent[0]}</small>{w}</button>)}</div>{won || !candidates.length ? <div role="status"><h2>{won ? local ? `Người ${history.length % 2 ? 2 : 1} thắng!` : "Bạn đã thắng!" : "Hết từ trong bộ ngoại tuyến."}</h2><button className="button" onClick={() => { setHistory(["apple"]); setWon(false); setError(""); setInput(""); }}>Chơi lại</button></div> : <form onSubmit={e => { e.preventDefault(); const result = chainTurn(history, input, chainWords, !local); setError(result.error ?? ""); if (!result.error) { setHistory(result.history); setInput(""); setWon(!!result.won); } }}><label htmlFor="chain-word">{local && <strong>Người {history.length % 2 ? 1 : 2} · </strong>}Từ bắt đầu bằng <b>{history.at(-1)!.at(-1)!.toUpperCase()}</b></label><div className="phone-search"><input id="chain-word" aria-label="Từ nối tiếp" autoComplete="off" autoCapitalize="none" maxLength={30} value={input} onChange={e => setInput(e.target.value)} /><button type="submit" aria-label="Gửi từ"><ArrowRight /></button></div><button type="button" className="text-button" onClick={() => setInput(candidates[0])}>Gợi ý</button><p role="alert">{error}</p></form>}<button className="text-button" onClick={() => navigate("games", "offline")}><ArrowLeft size={18} /> Chọn nhân vật khác</button><p className="phone-footnote">Bộ ngoại tuyến: {chainWords.length} từ thông dụng.</p></div>;
  if (activeId === "offline") return <div className="opponent-list"><h2>CHỌN NHÂN VẬT</h2>{opponents.map(([name, quote, art]) => <button key={name} onClick={() => navigate("games", name)}><img src={"/art/" + art} alt="" /><span><strong>{name}</strong><small>{quote}</small></span><CirclePlay size={37} /></button>)}</div>;
  return <div className="chain-home"><div className="chain-title"><Gamepad2 size={56} /><h2>WORD CHAIN</h2><p>Nối từ · Ghi nhớ · Khám phá</p></div><div className="chain-modes"><h2>CHỌN CHẾ ĐỘ CHƠI</h2><button className="chain-online" onClick={() => navigate("practice", "choice")}><Globe /><span><strong>THỬ SỨC</strong><small>Trắc nghiệm từ vựng</small></span></button><button className="chain-offline" onClick={() => navigate("games", "offline")}><Gamepad2 /><span><strong>OFFLINE</strong><small>Chơi cùng máy</small></span></button><button className="chain-friends" onClick={() => navigate("games", "friends")}><UserRound /><span><strong>HAI NGƯỜI</strong><small>Chuyền điện thoại, luân phiên nối từ</small></span></button><Section title="Luyện tập thêm"><div className="game-grid">{[["choice", "Trắc nghiệm"], ["gap", "Điền từ"], ["typed", "Viết từ"], ["spelling", "Chính tả"]].map(([mode, title]) => <button key={mode} onClick={() => navigate("practice", mode)}>{title}<ArrowRight size={17} /></button>)}</div></Section></div></div>;
}

function Tutor({ navigate }: { navigate: Navigate }) {
  return <div className="tutor-home"><img className="tutor-portrait" src="/art/guide.svg" alt="Hướng dẫn luyện nói EnglishFlow" /><h2>Chào mừng bạn quay lại! Chọn nội dung bạn muốn luyện bên dưới nhé.</h2><div className="tutor-actions"><button onClick={() => navigate("speaking", "topics")}><Headphones /> Shadowing</button><button onClick={() => navigate("speaking", "scenario")}><MessageCircle /> Hội thoại tình huống</button><button onClick={() => navigate("dictionary")}><Search /> Tra & học từ vựng</button><button onClick={() => navigate("grammar")}><Check /> Kiểm tra ngữ pháp</button><button onClick={() => navigate("explore")}><Compass /> Tìm nội dung để học</button></div><p className="phone-footnote">Shadowing và tra từ dùng được ngoại tuyến. Tình huống có hướng dẫn, giọng đọc hệ thống và ghi âm tự đối chiếu.</p></div>;
}

function TutorScenario({ navigate }: { navigate: Navigate; activeId: string | null }) {
  return <div className="tutor-scenario"><h2>Chọn một tình huống thực tế</h2><p className="phone-intro">Nghe câu hỏi, tự trả lời, xem gợi ý và ghi âm để tự đối chiếu. Mỗi tình huống có bốn lượt trao đổi riêng; có ghi âm và chấm âm vị cục bộ trên Android.</p><div className="learning-list">{speakingScenarios.map(s => <button key={s.id} onClick={() => navigate("speaking", "scenario-" + s.id)}><MessageCircle /><span><strong>{s.title}</strong><small>{s.topic} · 4 lượt · B1</small></span><ChevronRight /></button>)}</div><p className="phone-footnote">Kịch bản do EnglishFlow biên soạn. Chấm âm vị so với câu gợi ý khi đọc theo; câu trả lời tự do cần tự nghe lại và đối chiếu.</p></div>;
}

function Speaking({ onLookup, activeId, onOpen }: { onLookup: (term: string) => void; activeId: string | null; onOpen: (id: string | null) => void }) {
  const { state, update, notice } = useStore();
  const [index, setIndex] = useState(0);
  const [audioState, setAudioState] = useState("idle");
  const [audioMessage, setAudioMessage] = useState("");
  const [recorded, setRecorded] = useState(false);
  const [clip, setClip] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [translation, setTranslation] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const localAudio = useRef<HTMLAudioElement | null>(null);
  const recordingUrl = useRef("");
  const recordingRequest = useRef(0);
  const lesson = [...mediaLessons, ...scenarioLessons].find(m => m.id === activeId);
  const segment = lesson?.segments[index];
  function stopAudio() {
    recordingRequest.current++;
    device()?.stopAudio();
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(t => t.stop());
    localAudio.current?.pause();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ state: string; message?: string }>).detail;
      if (!detail || typeof detail.state !== "string") return;
      setAudioState(detail.state);
      if (detail.state === "recording") { setElapsed(0); setRecorded(false); }
      if (detail.state === "ready") setRecorded(true);
      if (detail.state === "error" && detail.message) setAudioMessage(detail.message);
      if (detail.message) notice(detail.message);
    };
    window.addEventListener("ef-audio", listener);
    const visibility = () => { if (!device() && document.hidden) { stopAudio(); setAudioState("stopped"); } };
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("ef-audio", listener); document.removeEventListener("visibilitychange", visibility); stopAudio(); if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current); };
  }, []);
  useEffect(() => {
    if (audioState !== "recording") return;
    const tick = setInterval(() => setElapsed(t => t + 1), 1000);
    const limit = setTimeout(() => { device()?.stopRecording(); if (recorder.current?.state === "recording") recorder.current.stop(); }, 30000);
    return () => { clearInterval(tick); clearTimeout(limit); };
  }, [audioState]);
  async function record() {
    if (audioState === "recording") { device()?.stopRecording(); if (recorder.current?.state === "recording") recorder.current.stop(); return; }
    setAudioMessage(""); setClip(c => c + 1);
    stopAudio();
    const request = recordingRequest.current;
    if (device()) { device()!.record(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { notice("Trình duyệt chưa hỗ trợ ghi âm. Hãy dùng bản Android hoặc trình duyệt hỗ trợ microphone."); return; }
    setAudioState("requesting");
    try {
      const captured = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (request !== recordingRequest.current) { captured.getTracks().forEach(t => t.stop()); return; }
      stream.current = captured;
      const chunks: BlobPart[] = [];
      const recording = new MediaRecorder(stream.current);
      recorder.current = recording;
      recording.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recording.onstop = () => {
        stream.current?.getTracks().forEach(t => t.stop());
        if (request !== recordingRequest.current) return;
        if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);
        recordingUrl.current = URL.createObjectURL(new Blob(chunks, { type: recording.mimeType }));
        setRecorded(chunks.length > 0); setAudioState("ready");
      };
      recording.onerror = () => { stream.current?.getTracks().forEach(t => t.stop()); setAudioState("error"); notice("Không ghi âm được. Kiểm tra microphone và thử lại."); };
      recording.start(); setAudioState("recording"); setRecorded(false); setElapsed(0);
    } catch { setAudioState("error"); notice("Chưa được phép dùng microphone. Bạn có thể cấp quyền trong cài đặt thiết bị."); }
  }
  function playRecording() {
    stopAudio();
    if (device()) { device()!.playRecording(); return; }
    localAudio.current = new Audio(recordingUrl.current);
    localAudio.current.onended = () => setAudioState("ready");
    localAudio.current.onerror = () => { setAudioState("error"); notice("Không phát được bản ghi. Hãy ghi âm lại."); };
    localAudio.current.play().then(() => setAudioState("playing")).catch(() => notice("Không phát được bản ghi."));
  }
  if (!lesson || !segment) return <>
    <div className="speaking-banner"><Mic size={40} /><h2>Tự tin nói tiếng Anh</h2><p>Nghe mẫu · Nói theo · Nghe lại chính mình</p></div>
    <Section title="Hội thoại theo chủ đề"><div className="phone-list">{mediaLessons.map(l => <button key={l.id} onClick={() => onOpen(l.id)}><span className="speak-cover"><AudioLines size={25} /></span><span><strong>{l.title}</strong><small>{l.level} · {l.segments.length} câu luyện nói</small></span><ChevronRight size={20} /></button>)}</div></Section>
    <p className="phone-footnote">Ghi âm để tự đối chiếu với giọng mẫu. Bản ghi gần nhất nằm tạm trên thiết bị, không được tải lên máy chủ.</p>
  </>;
  return <div className="shadowing"><button className="text-button" onClick={() => onOpen(null)}><ArrowLeft size={18} /> Chủ đề luyện nói</button><h2>{lesson.title}</h2><div className="row between"><span>Câu {index + 1}/{lesson.segments.length}</span><button className="text-button" onClick={() => setTranslation(!translation)}>{translation ? "Ẩn" : "Hiện"} bản dịch</button></div><progress value={index + 1} max={lesson.segments.length} />
    {segment.prompt && <div className="scenario-question"><span className="eyebrow">NGƯỜI ĐỐI THOẠI</span><p>{segment.prompt}</p>{translation && <p className="translation">{segment.promptVi}</p>}<button className="text-button" onClick={() => { stopAudio(); speak(segment.prompt!, notice); }}><Volume2 size={18} />Nghe câu hỏi</button><p>{segment.hint}</p></div>}<div className="speech-bubble"><span className="speech-speaker">{segment.prompt ? "Gợi ý trả lời · Bạn có thể nói theo cách của mình" : "Nghe và nói theo"}</span><p>{segment.en.split(/(\b[a-zA-Z]+\b)/).map((text, i) => /^[a-zA-Z]+$/.test(text) ? <button key={i} onClick={() => onLookup(text)}>{text}</button> : text)}</p>{translation && <p className="speech-translation">{segment.vi}</p>}<button className="icon-button" aria-label="Nghe giọng hệ thống" onClick={() => { stopAudio(); speak(segment.en, notice); }}><Volume2 size={24} /></button></div>
    <div className="record-controls">{audioMessage && <p className="audio-error" role="alert">{audioMessage}</p>}<button className={"record-button " + (audioState === "recording" ? "recording" : "")} disabled={audioState === "requesting"} aria-label={audioState === "recording" ? "Dừng ghi âm" : "Ghi âm giọng nói"} onClick={record}>{audioState === "recording" ? <Square size={29} /> : <Mic size={32} />}</button><strong>{audioState === "recording" ? `Đang ghi · ${elapsed}s / 30s` : audioState === "requesting" ? "Đang chờ quyền microphone…" : "Chạm để nói"}</strong><span>Cho phép microphone để ghi âm tối đa 30 giây.</span>{recorded && <button className="button secondary" onClick={audioState === "playing" ? () => { stopAudio(); setAudioState("ready"); } : playRecording}>{audioState === "playing" ? <Pause size={18} /> : <Play size={18} />}{audioState === "playing" ? "Dừng nghe" : "Nghe bản ghi của bạn"}</button>}</div>
    <PronunciationFeedback reference={segment.en} target={lesson.id + "/" + index} clip={clip} ready={recorded && !["recording", "requesting", "playing"].includes(audioState)} />
    <div className="row between"><button className="button secondary" disabled={index === 0} onClick={() => { stopAudio(); setRecorded(false); setAudioState("idle"); setIndex(index - 1); }}>Câu trước</button><button className="button" onClick={() => { stopAudio(); setRecorded(false); setAudioState("idle"); if (index + 1 < lesson.segments.length) setIndex(index + 1); else { if (!state.events.some(e => e.target === "shadowing:" + lesson.id)) update(s => ({ ...s, events: [...s.events, event("practice", "shadowing:" + lesson.id)] })); notice("Đã hoàn thành bài luyện nói."); onOpen(null); } }}>{index + 1 < lesson.segments.length ? <>Câu tiếp <ArrowRight size={16} /></> : <>Hoàn thành <Check size={16} /></>}</button></div>
  </div>;
}
