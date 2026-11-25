import { ContentCredits } from "./ContentCredits";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Headphones, Languages, Search, Volume2 } from "lucide-react";
import { mediaLessons } from "./data";
import { allWords, BookmarkButton, Empty, Quiz, Scene, speak, TextLookup } from "./components";
import { AudioDock, useLocalMedia } from "./MobileDetails";
import { useStore } from "./store";
import type { Navigate } from "./MobileApp";
import { dictionaryService, searchDictionary, DICTIONARY_HEADWORDS } from "./dictionary-service";

export function PhoneDictionary({ onLookup }: { onLookup: (term: string) => void }) {
  const { state, update } = useStore();
  const [query, setQuery] = useState("");
  const dictionary = allWords(state.customWords);
  const [remote, setRemote] = useState<import("./model").Word[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setRemote([]); setError("");
    if (query.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => { searchDictionary(query).then(rows => { if (active) setRemote(rows); }).catch(() => { if (active) setError("Không mở được từ điển ngoại tuyến."); }).finally(() => { if (active) setLoading(false); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, retry]);
  const local = query.trim() ? dictionaryService.search(dictionary, query) : dictionary.slice(0, 12);
  const results = [...new Map([...local, ...remote].map(w => [w.term.toLowerCase(), w])).values()];
  return <><form className="phone-search" onSubmit={e => { e.preventDefault(); if (query.trim()) onLookup(query.trim()); }}><Search /><input autoComplete="off" aria-label="Tìm từ điển" maxLength={100} placeholder="Nhập từ hoặc cụm tiếng Anh" value={query} onChange={e => setQuery(e.target.value)} /><button type="submit" aria-label="Tra cứu từ điển"><ArrowRight /></button></form>{state.searches.length > 0 && <><div className="row between"><h3>Gần đây</h3><button className="text-button" onClick={() => update(s => ({ ...s, searches: [] }))}>Xóa lịch sử</button></div><div className="phone-chips">{state.searches.map(term => <button key={term} onClick={() => onLookup(term)}>{term}</button>)}</div></>}<p className="phone-intro">{DICTIONARY_HEADWORDS.toLocaleString("vi-VN")} mục từ Anh–Việt ngoại tuyến</p><p className="phone-footnote">Từ điển Skypedia · CC BY-SA 4.0. <a href="/dictionary/attribution.html" target="_blank" rel="noreferrer">Nguồn và giấy phép</a></p>{loading && <p role="status">Đang tra từ…</p>}{error && <p role="alert">{error}<button className="text-button" onClick={() => setRetry(retry + 1)}>Thử lại</button></p>}<div className="phone-dictionary-results">{results.map(w => <button key={w.id} onClick={() => onLookup(w.term)}><span><strong>{w.term}</strong><small>{w.ipa} · {w.pos}</small><p>{w.meaning}</p></span><ChevronRight size={20} /></button>)}</div>{!loading && !error && !results.length && <Empty title="Chưa tìm thấy từ">Kiểm tra chính tả hoặc thêm từ và nghĩa vào bộ từ cá nhân.</Empty>}</>;
}

const books = [
  { id: "pinocchio", title: "Pinocchio", author: "Carlo Collodi", category: "Adventure", color: "#1b6680", symbol: "P" },
  { id: "david-copperfield", title: "David Copperfield", author: "Charles Dickens", category: "Classic", color: "#a84d38", symbol: "D" },
  { id: "alice", title: "Alice’s Adventures in Wonderland", author: "Lewis Carroll", category: "Adventure", color: "#4f6540", symbol: "A" },
];
export function BookShelf({ navigate, filter = "" }: { navigate: Navigate; filter?: string }) {
  return <div className="book-shelf">{books.filter(b => (b.title + " " + b.author + " " + b.category).toLowerCase().includes(filter.toLowerCase())).map(b => <button key={b.id} onClick={() => navigate("books", b.id)}><div className="book-jacket" style={{ background: b.color }}><small>CLASSIC LITERATURE</small><span>{b.symbol}</span><strong>{b.title}</strong><small>{b.author}</small></div><strong>{b.title}</strong><small>{b.author}</small></button>)}</div>;
}

export function Books({ id, navigate, onLookup }: { id: string | null; navigate: Navigate; onLookup: (term: string) => void }) {
  const { state, update, notice } = useStore();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(id ? state.reading["book-" + id] ?? 0 : 0);
  const [size, setSize] = useState(18);
  const book = books.find(b => b.id === id);
  useEffect(() => {
    if (!book) return;
    const controller = new AbortController();
    setError(""); setText("");
    fetch("/books/" + book.id + ".txt", { signal: controller.signal }).then(r => { if (!r.ok) throw Error(); return r.text(); }).then(s => { if (s.length < 1000) throw Error(); setText(s.replace(/\r/g, "")); }).catch(() => { if (!controller.signal.aborted) setError("Không mở được sách ngoại tuyến."); });
    return () => controller.abort();
  }, [book, attempt]);
  if (!id) return <><div className="catalog-banner"><h2>Đọc 3 đầu sách có sẵn</h2><p>VĂN HỌC KINH ĐIỂN · BẢN TIẾNG ANH</p><BookOpen size={64} /></div><label className="phone-search"><Search /><input aria-label="Tìm sách" placeholder="Tên sách, tác giả hoặc thể loại" value={query} onChange={e => setQuery(e.target.value)} /></label><h2 className="shelf-title">Sách đã tải</h2><BookShelf navigate={navigate} filter={query} />{![...books].some(b => (b.title + " " + b.author + " " + b.category).toLowerCase().includes(query.toLowerCase())) && <Empty title="Không tìm thấy sách">Thử tên sách hoặc tác giả khác.</Empty>}<h2 className="shelf-title">Adventure</h2><BookShelf navigate={navigate} filter="Adventure" /><p className="phone-footnote">Văn bản từ Project Gutenberg, kèm thông tin nguồn trong từng sách. Sách tiếng Anh chưa có bản dịch song ngữ.</p></>;
  if (!book) return <Empty title="Không tìm thấy sách"><button className="button" onClick={() => navigate("books")}>Về kho sách</button></Empty>;
  if (error) return <Empty title={error}><button className="button" onClick={() => setAttempt(attempt + 1)}>Thử lại</button></Empty>;
  if (!text) return <p role="status">Đang mở sách…</p>;
  const body = text.replace(/^[\s\S]*?\*\*\* START OF[^\n]*\n/, "").replace(/\*\*\* END OF[\s\S]*$/, "");
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  const count = Math.ceil(paragraphs.length / 20);
  const current = Math.min(page, count - 1);
  const jump = (n: number) => { if (update(s => ({ ...s, reading: { ...s.reading, ["book-" + id]: n } }))) { setPage(n); window.scrollTo(0, 0); } };
  return <div className="book-reader"><div className="row between"><BookmarkButton id={"book-" + id} /><label>Cỡ chữ <select aria-label="Cỡ chữ sách" value={size} onChange={e => setSize(Number(e.target.value))}>{[16, 18, 20, 24].map(n => <option key={n}>{n}</option>)}</select></label><label>Trang <select aria-label="Trang sách" value={current} onChange={e => jump(Number(e.target.value))}>{Array.from({ length: count }, (_, i) => <option key={i} value={i}>{i + 1}/{count}</option>)}</select></label></div><h1>{book.title}</h1><p>{book.author}</p><div style={{ fontSize: size }}>{paragraphs.slice(current * 20, current * 20 + 20).map((p, i) => <p key={i}><TextLookup text={p.replace(/\n/g, " ")} onLookup={onLookup} /></p>)}</div><div className="row between"><button className="text-button" disabled={!current} onClick={() => jump(current - 1)}><ArrowLeft />Trang trước</button><button className="text-button" disabled={current >= count - 1} onClick={() => { jump(current + 1); notice("Đã lưu vị trí đọc."); }}>Trang tiếp<ArrowRight /></button></div></div>;
}

export function PhoneMedia({ id, shorts = false, navigate, onLookup }: { id: string | null; shorts?: boolean; navigate: Navigate; onLookup: (term: string) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState(shorts ? "video" : id === "video" ? "video" : "all");
  const [level, setLevel] = useState(""), [topic, setTopic] = useState("");
  const lesson = mediaLessons.find(m => m.id === id);
  if (lesson) return <MediaDetail key={id} id={lesson.id} navigate={navigate} onLookup={onLookup} />;
  const list = mediaLessons.filter(m => (!level || m.level === level) && (!topic || m.topic === topic) && (type === "all" || m.type === type) && (m.title + " " + m.topic).toLowerCase().includes(query.toLowerCase()));
  return <><label className="phone-search"><Search /><input aria-label="Tìm bài nghe và video" placeholder="Tìm kiếm" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="library-filters"><label className="field">Trình độ<select aria-label="Trình độ bài nghe" value={level} onChange={e => setLevel(e.target.value)}><option value="">Tất cả</option>{["A2", "B1", "B2"].map(l => <option key={l}>{l}</option>)}</select></label><label className="field">Chủ đề<select aria-label="Chủ đề bài nghe" value={topic} onChange={e => setTopic(e.target.value)}><option value="">Tất cả</option>{[...new Set(mediaLessons.map(m => m.topic))].map(t => <option key={t}>{t}</option>)}</select></label></div><div className="phone-chips">{[["all", "Tất cả"], ["audio", "Bài nghe"], ["video", "Video"]].map(([value, name]) => <button key={value} className={type === value ? "active" : ""} onClick={() => setType(value)}>{name}</button>)}</div><div className="media-catalog">{list.map(m => <button key={m.id} onClick={() => navigate(shorts ? "shorts" : "listening", m.id)}><Scene kind={m.scene} /><span><small>{m.type === "video" ? "VIDEO" : "BÀI NGHE"} · {m.level}</small><strong>{m.title}</strong><p>{m.description}</p><small>{m.duration} · {m.topic}</small></span><ChevronRight size={18} /></button>)}</div>{!list.length && <Empty title="Chưa tìm thấy nội dung">Thử từ khóa hoặc bộ lọc khác.</Empty>}</>;
}
function MediaDetail({ id, navigate, onLookup }: { id: string; navigate: Navigate; onLookup: (term: string) => void }) {
  const lesson = mediaLessons.find(m => m.id === id)!;
  const { state, update, notice } = useStore();
  const { source, error, setError } = useLocalMedia(lesson.src);
  const [time, setTime] = useState(state.media[id] ?? 0);
  const [translation, setTranslation] = useState(true);
  const [quiz, setQuiz] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { const el = video.current; const visibility = () => { if (document.hidden) el?.pause(); }; document.addEventListener("visibilitychange", visibility); return () => { el?.pause(); document.removeEventListener("visibilitychange", visibility); }; }, []);
  const active = lesson.segments.findIndex(s => time >= s.start && time < s.end);
  return <div className={"phone-media-detail " + (lesson.type === "audio" ? "with-audio-dock" : "")}><div className="row between"><span>{lesson.topic} · {lesson.level}</span><BookmarkButton id={id} /></div><h2>{lesson.title}</h2>{lesson.type === "video" ? <video controls playsInline ref={video} src={source} onLoadedMetadata={() => { video.current!.currentTime = Math.min(state.media[id] ?? 0, Math.max(0, video.current!.duration - 0.1)); }} onTimeUpdate={() => setTime(video.current?.currentTime ?? 0)} onPause={() => update(s => ({ ...s, media: { ...s.media, [id]: video.current?.currentTime ?? 0 } }))} onError={() => setError("Không phát được video. Bạn vẫn có thể học bản chép lời.")} /> : <div className="media-audio-cover"><Headphones size={70} /><h3>{lesson.title}</h3><p>{lesson.duration}</p></div>}{error && <p role="alert">{error}</p>}<p className="phone-intro">{lesson.description}</p><div className="row between"><h3>Bản chép lời</h3><button className="icon-button" aria-label={translation ? "Ẩn dịch transcript" : "Hiện dịch transcript"} aria-pressed={translation} onClick={() => setTranslation(!translation)}><Languages /></button></div><div className="phone-transcript">{lesson.segments.map((s, i) => <section className={active === i ? "active" : ""} key={i}><small>{Math.floor(s.start)}s</small><p><TextLookup text={s.en} onLookup={onLookup} /></p>{translation && <p className="translation">{s.vi}</p>}<button className="text-button" onClick={() => { if (video.current) { video.current.currentTime = s.start; video.current.play().catch(() => notice("Chạm nút phát để nghe.")); } else speak(s.en, notice); }}><Volume2 size={17} />Nghe câu</button></section>)}</div><button className="pack-action" onClick={() => navigate("exercises", id + ":easy")}><Check />Nghe và điền từ<ChevronRight /></button><button className="pack-action" onClick={() => navigate("speaking", id)}><Headphones />Shadowing<ChevronRight /></button><button className="button full" onClick={() => setQuiz(!quiz)}>{quiz ? "Đóng câu hỏi" : "Kiểm tra nghe hiểu"}</button>{quiz && <Quiz questions={lesson.questions} target={id} kind="listening" />}<ContentCredits ids={lesson.credits} />{lesson.type === "audio" && <AudioDock src={lesson.src} lessonId={id} onTime={setTime} />}</div>;
}
