import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookA, Check, ChevronRight, Folder, MoreVertical, Pencil, Plus, Settings2, Share2, Trash2, Trophy, Volume2, X } from "lucide-react";
import { Empty, speak, WordPronunciation, stopSpeech } from "./components";
import { DAY, newSaved, normalize, validateWord } from "./domain";
import { download, useStore } from "./store";
import { Sheet } from "./MobileDetails";
import { advanceStudy, checkStudy, collectionWords, contextPrompt, defaultVocabSettings, eligibleWords, expectedAnswer, parseWordLines, startStudy, studyChoices, vocabWords } from "./vocabulary-study";
import type { Navigate } from "./MobileApp";
import type { VocabTask, Word } from "./model";
import "./vocabulary.css";
import { resolveDictionary } from "./dictionary-service";

const modeNames: Record<VocabTask["mode"], string> = { intro: "Học từ mới", copy: "Học viết từ lần đầu", meaning: "Chọn nghĩa chính xác", word: "Chọn từ chính xác", listening: "Nghe và chọn từ", writing: "Viết từ chính xác", context: "Điền từ theo ngữ cảnh" };

function NewWordPicker({ id, onStart, onClose, onSettings }: { id: string | null; onStart: (ids: string[]) => void; onClose: () => void; onSettings: () => void }) {
  const { state, update } = useStore();
  const [pool] = useState(() => { const words = eligibleWords(state, id, "learn"); if (state.vocabulary?.settings.random) { for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; } } return words; });
  const [index, setIndex] = useState(0), [chosen, setChosen] = useState<string[]>([]);
  const limit = state.vocabulary?.settings.fresh.limit ?? 5;
  const word = pool[index];
  function next(learn: boolean) { const ids = learn && word ? [...chosen, word.id] : chosen; setChosen(ids); if (ids.length >= limit || index + 1 >= pool.length && ids.length) onStart(ids); else setIndex(index + 1); }
  return <div className="new-word-picker"><div className="study-toolbar"><button className="icon-button" aria-label="Quay lại phần học từ" onClick={onClose}><ArrowLeft /></button><h2>Chọn từ để bắt đầu học ({chosen.length}/{limit})</h2><button className="icon-button" aria-label="Cài đặt học từ vựng" onClick={onSettings}><Settings2 /></button></div>{word ? <><article className="picker-card"><h2>{word.term}</h2><WordPronunciation word={word} /><h3><span>VI</span>{word.meaning}</h3><p>{word.example}</p></article><div className="picker-actions"><button onClick={() => next(false)}><X size={20} />Bỏ qua</button><button className="learn" onClick={() => next(true)}><BookA size={20} />Học</button><button className="known" onClick={() => { if (update(s => { const card = s.saved[word.id] ?? newSaved(word.id, id ?? s.collections.find(c => c.wordIds.includes(word.id))?.id ?? s.collections[0].id); return { ...s, saved: { ...s.saved, [word.id]: { ...card, repetitions: 6, interval: 8, due: Date.now() + 8 * DAY } } }; })) next(false); }}><Check size={20} />Đã biết</button></div></> : <Empty title="Đã xem hết từ mới"><button className="button" onClick={onClose}>Về phần học từ</button></Empty>}{chosen.length > 0 && <button className="text-button full" onClick={() => onStart(chosen)}>Bắt đầu học {chosen.length} từ đã chọn</button>}</div>;
}

export function VocabSettingsScreen({ onClose }: { onClose: () => void }) {
  const { state, update, notice } = useStore();
  const [settings, setSettings] = useState(() => structuredClone(state.vocabulary?.settings ?? defaultVocabSettings()));
  function save() {
    if ([settings.fresh, settings.review].some(c => c.meaning + c.word + c.listening + c.writing === 0)) { notice("Hãy chọn ít nhất một dạng bài cho mỗi nhóm từ."); return; }
    if (update(s => ({ ...s, vocabulary: { ...s.vocabulary, settings } }))) onClose();
  }
  return <div className="vocab-settings"><div className="study-toolbar"><button className="icon-button" aria-label="Đóng cài đặt" onClick={onClose}><ArrowLeft /></button><h2>Cài đặt</h2><button className="text-button" onClick={save}>Lưu</button></div>{(["fresh", "review"] as const).map(group => <section key={group}><h3>{group === "fresh" ? "TỪ MỚI" : "TỪ ÔN LẠI"}</h3><p>{group === "fresh" ? "Cài đặt cách học cho các từ mới, chưa lên level 1" : "Cài đặt cách học cho từ được nhắc ôn lại, các từ có level 1 trở lên"}</p>{([['limit', 'Số từ tối đa một lần học'], ['writing', 'Viết'], ['listening', 'Nghe'], ['word', 'Chọn từ'], ['meaning', 'Chọn nghĩa']] as const).map(([key, label]) => <label className="vocab-setting" key={key}>{label}<select aria-label={(group === "fresh" ? "Từ mới: " : "Từ ôn lại: ") + label} value={settings[group][key]} onChange={e => setSettings({ ...settings, [group]: { ...settings[group], [key]: Number(e.target.value) } })}>{(key === "limit" ? [1, 3, 5, 10, 15, 20] : [0, 1, 2, 3, 4, 5]).map(n => <option key={n}>{n}</option>)}</select></label>)}{group === "fresh" && <label className="vocab-setting">Học viết từ lần đầu<input type="checkbox" checked={settings.firstWriting} onChange={e => setSettings({ ...settings, firstWriting: e.target.checked })} /></label>}</section>)}<section><h3>CHUNG</h3>{([['context', 'Điền từ theo ngữ cảnh'], ['random', 'Chọn các từ mới ngẫu nhiên'], ['autoAudio', 'Tự động phát âm']] as const).map(([key, label]) => <label className="vocab-setting" key={key}>{label}<input type="checkbox" checked={settings[key]} onChange={e => setSettings({ ...settings, [key]: e.target.checked })} /></label>)}<button className="text-button" onClick={() => setSettings(defaultVocabSettings())}>Khôi phục cài đặt mặc định</button></section><p className="phone-footnote">Cài đặt áp dụng từ lượt học tiếp theo. Lịch ôn theo cấp độ ghi nhớ và được lưu trên thiết bị.</p><button className="button full" onClick={save}>Lưu cài đặt</button></div>;
}

export function VocabularyStudy({ id, navigate, kind }: { id: string | null; navigate: Navigate; kind: "learn" | "review" }) {
  const { state, update, notice } = useStore();
  const [settings, setSettings] = useState(false), [exit, setExit] = useState(false), [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState("");
  const [picking, setPicking] = useState(false);
  const [active, setActive] = useState(() => { const x = state.vocabulary?.session; return !!x && x.collectionId === (id ?? "") && x.kind === kind; });
  const session = active ? state.vocabulary?.session : undefined;
  const task = session?.tasks[session.index], word = vocabWords(state).find(w => w.id === task?.wordId);
  const complete = !!session && session.index >= session.tasks.length;
  const index = session?.index;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  useEffect(() => { setAnswer(session?.answer ?? ""); setHint(false); window.scrollTo(0, 0); return stopSpeech; }, [session?.id, index]);
  useEffect(() => {
    if (!session?.checked) return;
    const frame = requestAnimationFrame(() => document.querySelector(".study-feedback")?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [session?.id, session?.checked, index]);
  useEffect(() => {
    const back = (e: Event) => { e.preventDefault(); if (settingsRef.current) setSettings(false); else if (picking) setPicking(false); else if (session && !complete) setExit(true); else leave(); };
    window.addEventListener("englishflow-study-back", back);
    return () => window.removeEventListener("englishflow-study-back", back);
  }, [session, complete, id, navigate, picking]);
  useEffect(() => { if (state.vocabulary?.settings.autoAudio && word && task && !["writing", "context"].includes(task.mode) && !session?.checked) speak(word.term, notice); }, [session?.id, index]);
  function leave() { navigate(id ? "collection" : "vocabulary", id ?? undefined, { returnTo: true }); }
  function begin(selected?: string[]) {
    if (kind === "learn" && !selected) { setPicking(true); return; }
    if (update(s => ({ ...s, vocabulary: { settings: s.vocabulary?.settings ?? defaultVocabSettings(), session: startStudy(s, id, kind, Date.now(), selected) } }))) { setActive(true); setPicking(false); }
  }
  if (settings) return <VocabSettingsScreen onClose={() => setSettings(false)} />;
  if (picking) return <NewWordPicker id={id} onStart={begin} onClose={() => setPicking(false)} onSettings={() => setSettings(true)} />;
  const pending = state.vocabulary?.session;
  if (!session) return <div className="study-start"><div className="study-toolbar"><button className="icon-button" aria-label="Quay lại" onClick={leave}><ArrowLeft /></button><h2>{kind === "learn" ? "Học từ mới" : "Ôn tập từ vựng"}</h2></div><div className="row between"><BookA size={38} /><button className="icon-button" aria-label="Cài đặt học từ vựng" onClick={() => setSettings(true)}><Settings2 /></button></div><h2>{kind === "learn" ? "Học thêm từ mới" : "Ôn tập từ vựng"}</h2><p>{eligibleWords(state, id, kind).length} từ {kind === "learn" ? "chưa học" : "đến hạn"} trong {id ? state.collections.find(c => c.id === id)?.name ?? "bộ từ" : "các bộ từ đã lưu"}.</p><p>Chọn nghĩa · Chọn từ · Nghe · Viết</p>{pending && pending.index < pending.tasks.length && <section className="study-pending"><h3>Bạn còn một lượt học dở</h3><p>Đã hoàn thành {pending.committed.length}/{pending.wordIds.length} từ. Bắt đầu lượt mới sẽ thay lượt đang lưu.</p><button className="button full" onClick={() => navigate(pending.kind === "learn" ? "learn" : "review", pending.collectionId || undefined)}>Tiếp tục lượt đang học</button></section>}<button className="button full" disabled={!eligibleWords(state, id, kind).length || !!id && !state.collections.some(c => c.id === id)} onClick={() => begin()}>Bắt đầu học</button><button className="pack-action" onClick={() => navigate("dictionary", id ?? undefined)}><Plus />Tra và thêm từ<ChevronRight /></button></div>;
  const title = task ? modeNames[task.mode] : "Kết quả học tập";
  const toolbar = <div className="study-toolbar"><button className="icon-button" aria-label="Thoát bài học" onClick={() => complete ? leave() : setExit(true)}><X /></button><h2>{title}</h2><button className="icon-button" aria-label="Cài đặt học từ vựng" onClick={() => setSettings(true)}><Settings2 /></button></div>;
  const exitDialog = exit && <Sheet title="Thoát bài học" onClose={() => setExit(false)}><p>Tiến trình đã được lưu. Bạn có thể tiếp tục đúng câu đang học khi quay lại.</p><button className="button full" onClick={leave}>Lưu và thoát</button><button className="text-button full" onClick={() => setExit(false)}>Học tiếp</button></Sheet>;
  if (complete) return <div className="study-results">{toolbar}<Trophy size={74} /><h2>Thêm một bước tiến!</h2><p>Đã hoàn thành {session.wordIds.length} từ</p><div className="study-score"><strong>{session.hits}/{session.attempts}<small>Câu trả lời đúng</small></strong><strong>{session.mistakes.length}<small>Từ cần luyện lại</small></strong></div><p>Lịch ôn tiếp theo đã được lưu.</p>{session.wordIds.map(wordId => { const w = vocabWords(state).find(w => w.id === wordId); return w && <div className="result-word" key={wordId}><span><b>{w.term}</b><small>{w.meaning}</small><small>{session.skipped.includes(wordId) ? "Cần ôn lại · nhắc lại sau 2 giờ" : "Ôn tiếp: " + new Date(state.saved[wordId]?.due ?? Date.now()).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</small></span><button className="icon-button" aria-label={"Nghe " + w.term} onClick={() => speak(w.term, notice)}><Volume2 /></button></div>; })}<button className="button full" onClick={() => { if (update(s => ({ ...s, vocabulary: { settings: s.vocabulary?.settings ?? defaultVocabSettings() } }))) { setActive(false); } }}>Học lượt tiếp theo</button><button className="text-button full" onClick={leave}>Về bộ từ vựng</button></div>;
  if (!task || !word) return <Empty title="Từ trong lượt học đã thay đổi"><button className="button" onClick={leave}>Về bộ từ vựng</button></Empty>;
  const intro = task.mode === "intro", copy = task.mode === "copy", typed = ["writing", "context", "copy"].includes(task.mode), listening = task.mode === "listening";
  const hidden = ["word", "writing", "context", "listening"].includes(task.mode);
  const checked = session.checked;
  function submit() {
    if (!session || !task) return;
    if (checked) { if (update(s => advanceStudy(s, session.id, session.index))) setAnswer(""); }
    else update(s => checkStudy(s, session.id, session.index, intro ? word!.term : answer));
    (document.activeElement as HTMLElement)?.blur();
  }
  return <div className="phone-review study-session" data-mode={task.mode}>{toolbar}<progress aria-label="Tiến trình lượt học" value={session.committed.length} max={session.wordIds.length || 1} /><div className="study-position"><span>{task.retry ? "Luyện lại câu sai" : kind === "learn" ? "Từ mới" : "Ôn tập"}</span><span>{session.committed.length}/{session.wordIds.length} từ · Bước {session.index + 1}</span></div><div className={"review-word study-word " + (hidden ? "hidden-term" : "")}><span className="pos-pill">{word.pos || "Từ vựng"}</span>{listening ? <button className="study-listen" aria-label="Nghe từ cần chọn" onClick={() => speak(word.term, notice)}><Volume2 size={48} /></button> : <>{!hidden && <><h2>{word.term}</h2><WordPronunciation word={word} /></>}{(intro || copy || hidden) && <h3>{word.meaning}</h3>}{intro && <p>{word.example}</p>}{task.mode === "context" && <p className="context-gap">{contextPrompt(word)}</p>}</>}{listening && <small>Chạm loa để nghe, rồi chọn từ bên dưới</small>}</div><form onSubmit={e => { e.preventDefault(); submit(); }}>{!intro && (typed ? <label className="field study-answer">{copy ? "Viết lại từ ở trên" : "Nhập từ tiếng Anh"}<input aria-label="Câu trả lời" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} maxLength={100} value={checked ? session.answer : answer} disabled={checked} onChange={e => { setAnswer(e.target.value); update(s => { const x = s.vocabulary?.session; return x?.id === session.id && x.index === session.index && !x.checked ? { ...s, vocabulary: { ...s.vocabulary!, session: { ...x, answer: e.target.value } } } : s; }); }} />{!checked && !copy && <button className="text-button" type="button" onClick={() => setHint(true)}>Gợi ý</button>}{hint && <small>{word.term[0]}{' _'.repeat(Math.max(0, word.term.length - 1))} ({word.term.length} ký tự)</small>}</label> : <div className="review-choices">{studyChoices(state, task, session.index).map(option => <button key={option} type="button" disabled={checked} aria-pressed={answer === option} className={(answer === option ? "selected " : "") + (checked && option === expectedAnswer(task, word) ? "correct" : checked && answer === option ? "incorrect" : "")} onClick={() => { setAnswer(option); update(s => { const x = s.vocabulary?.session; return x?.id === session.id && x.index === session.index && !x.checked ? { ...s, vocabulary: { ...s.vocabulary!, session: { ...x, answer: option } } } : s; }); }}>{option}</button>)}</div>)}{checked && <div className={"study-feedback " + (session.correct ? "success" : "failure")} role="status"><strong>{session.correct ? "Chính xác!" : "Chưa chính xác"}</strong>{!intro && <p>{word.term} — {word.meaning}</p>}{word.example && <small>{word.example}</small>}{!session.correct && <small>Từ này sẽ xuất hiện lại cuối lượt.</small>}</div>}<div className="study-footer"><button className="button full" disabled={!intro && !checked && !answer.trim()}>{checked ? "Tiếp tục" : intro ? "Đã xem · Tiếp tục" : "Kiểm tra"}</button>{!checked && <button className="text-button full" type="button" onClick={() => update(s => advanceStudy(s, session.id, session.index, true))}>Bỏ qua từ này</button>}</div></form>{exitDialog}</div>;
}

export function WordFlashcards({ id, navigate }: { id: string | null; navigate: Navigate }) {
  const { state } = useStore();
  const [queue, setQueue] = useState(() => collectionWords(state, id).map(w => w.id));
  const [index, setIndex] = useState(0), [flipped, flip] = useState(false);
  const word = vocabWords(state).find(w => w.id === queue[index]);
  if (!word) return <Empty title="Chưa có thẻ từ"><button className="button" onClick={() => navigate(id ? "collection" : "vocabulary", id ?? undefined)}>Về bộ từ vựng</button></Empty>;
  return <div className="word-flashcards"><div className="row between"><span>{index + 1}/{queue.length}</span><button className="text-button" onClick={() => { const copy = [...queue]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } setQueue(copy); setIndex(0); flip(false); }}>Trộn thẻ</button></div><button className={"flashcard-face " + (flipped ? "flipped" : "")} aria-label="Lật thẻ" aria-pressed={flipped} onClick={() => flip(!flipped)}><span>{word.pos}</span><h2>{flipped ? word.meaning : word.term}</h2><p>{flipped ? word.example : word.ipa}</p><small>Chạm để lật thẻ</small></button><WordPronunciation word={word} /><div className="row between"><button className="text-button" disabled={index === 0} onClick={() => { setIndex(index - 1); flip(false); }}><ArrowLeft />Trước</button><button className="text-button" disabled={index === queue.length - 1} onClick={() => { setIndex(index + 1); flip(false); }}>Tiếp<ArrowRight /></button></div><p className="phone-footnote">Xem thẻ không thay đổi lịch ôn.</p><button className="button full" onClick={() => navigate("learn", id ?? undefined)}>Học từ trong bộ này</button></div>;
}

export function VocabularyFolders({ navigate }: { navigate: Navigate }) {
  const { state, update, notice } = useStore();
  const [adding, setAdding] = useState(false), [menu, setMenu] = useState<string | null>(null), [rename, setRename] = useState(false), [deleting, setDeleting] = useState(false), [name, setName] = useState("");
  const [sort, setSort] = useState("new");
  const selected = state.collections.find(c => c.id === menu);
  const list = sort === "az" ? [...state.collections].sort((a, b) => a.name.localeCompare(b.name, "vi")) : [...state.collections].reverse();
  return <section className="phone-section folders"><div className="phone-section-heading"><h2>Bộ từ của bạn</h2><button className="text-button" onClick={() => setAdding(true)}>Thêm mới <Plus size={17} /></button></div><select aria-label="Sắp xếp bộ từ" value={sort} onChange={e => setSort(e.target.value)}><option value="new">Mới thêm gần đây</option><option value="az">Tên A → Z</option></select>{list.map(c => <div className="folder-row" key={c.id}><button onClick={() => navigate("collection", c.id)}><Folder size={27} /><span>{c.name}<small>{collectionWords(state, c.id).length} từ</small></span></button><button className="icon-button" aria-label={"Tùy chọn bộ từ " + c.name} onClick={() => { setMenu(c.id); setName(c.name); setRename(false); setDeleting(false); }}><MoreVertical size={20} /></button></div>)}{adding && <Sheet title="Thêm mới" onClose={() => setAdding(false)}><button className="add-folder-option" onClick={() => navigate("create-collection")}><span>Tạo bộ từ cá nhân</span><ChevronRight /></button><button className="add-folder-option" onClick={() => navigate("import-collection")}><span>Thêm bộ từ của bạn bè</span><ChevronRight /></button></Sheet>}{selected && <Sheet title={selected.name} onClose={() => setMenu(null)}>{deleting ? <><p>Xóa bộ từ và lịch ôn của các từ nằm trong bộ này? Các bộ từ khác được giữ nguyên.</p><button className="button full danger" onClick={() => { if (state.collections.length === 1) { notice("Cần giữ lại ít nhất một bộ từ."); return; } if (update(s => ({ ...s, collections: s.collections.filter(c => c.id !== selected.id), saved: Object.fromEntries(Object.entries(s.saved).filter(([, w]) => w.collectionId !== selected.id)), vocabulary: { settings: s.vocabulary?.settings ?? defaultVocabSettings() } }))) setMenu(null); }}>Xóa bộ từ</button><button className="text-button full" onClick={() => setDeleting(false)}>Hủy</button></> : rename ? <form onSubmit={e => { e.preventDefault(); const trimmed = name.trim(); if (!trimmed || trimmed.length > 80 || state.collections.some(c => c.id !== selected.id && normalize(c.name) === normalize(trimmed))) { notice("Tên cần từ 1–80 ký tự và chưa được sử dụng."); return; } if (update(s => ({ ...s, collections: s.collections.map(c => c.id === selected.id ? { ...c, name: trimmed } : c) }))) setMenu(null); }}><label className="field">Tên bộ từ<input autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} /></label><button className="button full">Lưu</button></form> : <><button className="pack-action" onClick={() => setRename(true)}><Pencil />Đổi tên bộ từ</button><button className="pack-action" onClick={() => navigate("create-collection", selected.id)}><Plus />Thêm danh sách từ</button><button className="pack-action" onClick={() => { try { download("englishflow-collection.json", JSON.stringify({ format: "englishflow-collection-1", name: selected.name, words: collectionWords(state, selected.id) }, null, 2)); notice("Đã xuất bộ từ để chia sẻ."); } catch (e) { notice(String(e)); } }}><Share2 />Xuất bộ từ để chia sẻ</button><button className="pack-action" onClick={() => setDeleting(true)}><Trash2 />Xóa bộ từ</button></>}</Sheet>}</section>;
}

type DraftWord = { key: string; input: string; word: Word; removed: boolean; edited: boolean; unresolved?: boolean };
function validDraftWord(value: unknown): value is DraftWord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<DraftWord>;
  return typeof row.key === "string" && row.key.length <= 100 && typeof row.input === "string" && row.input.length <= 100 && validateWord(row.word) && typeof row.removed === "boolean" && typeof row.edited === "boolean" && (row.unresolved === undefined || typeof row.unresolved === "boolean");
}

export function CollectionEditor({ id, navigate, importing = false }: { id: string | null; navigate: Navigate; importing?: boolean }) {
  const { state, update } = useStore();
  const existing = state.collections.find(c => c.id === id);
  const draftKey = "englishflow.collection-draft." + (id ?? (importing ? "import" : "new"));
  const [draft] = useState<Record<string, unknown>>(() => { try { const value = JSON.parse(localStorage.getItem(draftKey) ?? "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; } });
  const [name, setName] = useState(typeof draft.name === "string" ? draft.name.slice(0, 80) : existing?.name ?? "");
  const [text, setText] = useState(typeof draft.text === "string" ? draft.text.slice(0, importing ? 500000 : 11000) : "");
  const [rows, setRows] = useState<DraftWord[] | null>(() => Array.isArray(draft.rows) && draft.rows.length <= 100 && draft.rows.every(validDraftWord) ? draft.rows : null);
  const [reviewedText, setReviewedText] = useState(typeof draft.reviewedText === "string" ? draft.reviewedText : "");
  const [matches, setMatches] = useState<Map<string, Word[]>>(new Map());
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ key: string; word: Word } | null>(null), [editError, setEditError] = useState("");
  const alive = useRef(true), inFlight = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify({ name, text, rows, reviewedText })); } catch { /* Main store reports persistence failures on final commit. */ } }, [name, text, rows, reviewedText, draftKey]);
  const ready = rows !== null && reviewedText === text;
  const kept = ready ? rows.filter(row => !row.removed) : [];
  const known = vocabWords(state);
  let lineCount = 0; try { lineCount = parseWordLines(text).length; } catch { /* Preview reports detailed validation. */ }
  async function preview() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const terms = parseWordLines(text);
      if (!terms.length) throw Error("Hãy nhập ít nhất một từ.");
      const unknown = terms.filter(term => !known.some(w => normalize(w.term) === normalize(term)));
      const found = await resolveDictionary(unknown);
      if (!alive.current) return;
      const options = new Map(unknown.map((term, i) => [normalize(term), found[i]]));
      const next = terms.map(input => {
        const key = normalize(input), old = rows?.find(row => row.key === key);
        if (old) return old;
        const choices = options.get(key) ?? [];
        const legacy = draft.selected && typeof draft.selected === "object" ? (draft.selected as Record<string, unknown>)[key] : undefined;
        const manual = draft.manual && typeof draft.manual === "object" ? (draft.manual as Record<string, unknown>)[key] : undefined;
        const word = known.find(w => normalize(w.term) === key) ?? choices.find(w => w.id === legacy) ?? choices[0] ?? { id: "custom-" + crypto.randomUUID(), term: input, meaning: typeof manual === "string" ? manual.slice(0, 1000) : "", ipa: "", pos: "", example: "", level: state.profile.level, topic: "Cá nhân" };
        return { key, input, word, removed: false, edited: false, unresolved: !choices.length && !known.some(w => w.id === word.id) };
      });
      setMatches(options); setRows(next); setReviewedText(text);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Không tra được từ. Hãy thử lại."); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  function changeRow(key: string, change: Partial<DraftWord>) { setRows(current => current?.map(row => row.key === key ? { ...row, ...change } : row) ?? null); }
  function saveEdit() {
    if (!editing) return;
    const original = rows?.find(row => row.key === editing.key)?.word;
    const word = { ...editing.word, term: editing.word.term.trim(), meaning: editing.word.meaning.trim(), ipa: editing.word.ipa.trim(), pos: editing.word.pos.trim(), example: editing.word.example.trim() };
    if (!validateWord(word) || !word.meaning) { setEditError("Hãy nhập từ và nghĩa hợp lệ."); return; }
    if (kept.some(row => row.key !== editing.key && normalize(row.word.term) === normalize(word.term))) { setEditError("Từ này đã có trong danh sách. Hãy sửa từ hoặc xóa dòng trùng."); return; }
    if (original && ["term", "meaning", "ipa", "pos", "example"].some(field => word[field as keyof Word] !== original[field as keyof Word])) {
      if (normalize(word.term) !== normalize(original.term) && word.ipa === original.ipa) word.ipa = "";
      changeRow(editing.key, { word: { ...word, id: "custom-" + crypto.randomUUID(), source: undefined, lemma: undefined, pronunciations: undefined }, edited: true });
    }
    setEditing(null); setEditError("");
  }
  function save() {
    if (inFlight.current) return;
    setError("");
    try {
      const title = name.trim();
      if (!title || title.length > 80) throw Error("Tên bộ từ cần từ 1 đến 80 ký tự.");
      if (id && !existing) throw Error("Bộ từ này không còn tồn tại.");
      if (state.collections.some(c => c.id !== id && normalize(c.name) === normalize(title))) throw Error("Tên bộ từ đã tồn tại.");
      if (!ready) throw Error("Hãy tra từ và kiểm tra danh sách trước khi thêm.");
      if (!kept.length) throw Error("Hãy giữ lại ít nhất một từ để thêm.");
      const words = kept.map(row => row.word);
      if (words.length > 100 || words.some(w => !validateWord(w) || !w.meaning.trim())) throw Error("Mỗi từ cần có từ tiếng Anh và nghĩa hợp lệ.");
      if (new Set(words.map(w => normalize(w.term))).size !== words.length) throw Error("Danh sách có từ trùng. Hãy sửa hoặc xóa dòng trùng.");
      const collectionId = existing?.id ?? "folder-" + crypto.randomUUID();
      inFlight.current = true;
      const committed = update(s => {
        if (s.collections.some(c => c.id !== id && normalize(c.name) === normalize(title))) throw Error("Tên bộ từ đã tồn tại.");
        const knownIds = new Set(vocabWords(s).map(w => w.id));
        return { ...s, customWords: [...s.customWords, ...words.filter(w => !knownIds.has(w.id))], collections: existing ? s.collections.map(c => c.id === collectionId ? { ...c, name: title, wordIds: [...new Set([...c.wordIds, ...words.map(w => w.id)])] } : c) : [...s.collections, { id: collectionId, name: title, description: "Bộ từ của bạn", topic: "Cá nhân", level: s.profile.level, wordIds: words.map(w => w.id) }] };
      });
      if (committed) { try { localStorage.removeItem(draftKey); } catch { /* Optional draft cleanup. */ } navigate("collection", collectionId, { returnTo: true }); }
      else inFlight.current = false;
    } catch (e) { inFlight.current = false; setError(e instanceof Error ? e.message : "Không thể thêm từ."); }
  }
  function readImport() {
    setError("");
    try {
      if (text.length > 500000) throw Error("Tệp quá lớn.");
      const data = JSON.parse(text);
      if (data.format !== "englishflow-collection-1" || typeof data.name !== "string" || !Array.isArray(data.words) || data.words.length > 100 || !data.words.every(validateWord)) throw Error("Cần tệp bộ từ EnglishFlow hợp lệ, tối đa 100 từ.");
      setName(data.name.slice(0, 80));
      const unique = [...new Map((data.words as Word[]).map(w => [normalize(w.term), w])).values()];
      setRows(unique.map(w => ({ key: normalize(w.term), input: w.term, word: { ...w, id: "custom-" + crypto.randomUUID() }, edited: false, removed: false })));
      setReviewedText(text); setMatches(new Map());
    } catch (e) { setRows(null); setError(e instanceof Error ? e.message : "Tệp không hợp lệ."); }
  }
  return <><form className="collection-editor" aria-busy={busy} onSubmit={e => { e.preventDefault(); if (ready) save(); else if (importing) readImport(); else void preview(); }}>
    <fieldset disabled={busy}>
      <label className="field">Tên bộ từ<input aria-label="Tên bộ từ" placeholder="Nhập tên bộ từ" required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <h2>{importing ? "Thêm bộ từ của bạn bè" : "Danh sách từ"}</h2>
      {importing ? <><p>Dán tệp bộ từ JSON được xuất từ EnglishFlow, sau đó kiểm tra từng từ trước khi thêm.</p><textarea aria-label="Nội dung bộ từ chia sẻ" value={text} maxLength={500000} onChange={e => setText(e.target.value)} /><button type="button" className="button secondary full" onClick={readImport}>Đọc bộ từ</button></> : <>
        <p>Nhập mỗi dòng một từ. Tra tự động, sửa hoặc xóa từ trong danh sách rồi nhấn “Thêm từ” để lưu.</p>
        <textarea aria-label="Danh sách từ" placeholder={'Ví dụ:\nhello\nlove'} maxLength={11000} value={text} onChange={e => setText(e.target.value)} />
        <small>{lineCount}/100 từ khác nhau</small>
        <button type="button" className="button secondary full lookup-draft" onClick={() => void preview()}>{busy ? "Đang tra từ…" : "Tra nghĩa tự động"}</button>
      </>}
      {busy && <p role="status">Đang tra từ. Danh sách chưa được thêm vào bộ.</p>}
      {rows && !ready && <p role="status">Danh sách nhập đã thay đổi. Hãy {importing ? "đọc" : "tra"} lại trước khi thêm.</p>}
      {ready && <section className="draft-review" aria-label="Danh sách từ chờ thêm">
        <div className="row between"><h2>Kiểm tra từ trước khi thêm</h2><span>{kept.length} từ</span></div>
        <p className="phone-footnote">Các từ dưới đây đang là bản nháp. Bạn có thể sửa chi tiết, chọn nghĩa hoặc xóa từng từ.</p>
        {kept.map(row => { const options = matches.get(row.key) ?? []; return <article className="resolved-word" key={row.key}>
          <div className="row between"><strong>{row.word.term}</strong><div className="row"><button className="icon-button" type="button" aria-label={"Sửa " + row.input} onClick={() => { setEditing({ key: row.key, word: { ...row.word } }); setEditError(""); }}><Pencil size={19} /></button><button className="icon-button" type="button" aria-label={"Xóa " + row.input} onClick={() => changeRow(row.key, { removed: true })}><Trash2 size={19} /></button></div></div>
          {row.edited && <small>Đã chỉnh sửa</small>}
          {row.word.lemma && <small>Dạng của {row.word.lemma} · xem nghĩa theo ngữ cảnh</small>}
          {!row.edited && options.length > 1 ? <label className="field">Chọn nghĩa<select aria-label={"Chọn nghĩa của " + row.input} value={row.word.id} onChange={e => { const word = options.find(w => w.id === e.target.value); if (word) changeRow(row.key, { word }); }}>{options.map(w => <option key={w.id} value={w.id}>{w.pos} · {w.meaning}</option>)}</select></label> : row.unresolved ? <label className="field">Chưa tìm thấy từ. Bổ sung nghĩa hoặc xóa từ này.<input aria-label={"Nghĩa của " + row.input} maxLength={1000} value={row.word.meaning} onChange={e => changeRow(row.key, { word: { ...row.word, meaning: e.target.value }, edited: true })} /></label> : <p>{row.word.meaning}</p>}
          <WordPronunciation word={row.word} /><small>{row.word.pos}</small><p>{row.word.example}</p>
        </article>; })}
        {!kept.length && <Empty title="Chưa chọn từ nào">Khôi phục một từ hoặc nhập danh sách khác để tiếp tục.</Empty>}
        {rows.some(row => row.removed) && <div className="removed-draft"><h3>Đã xóa khỏi danh sách chờ</h3>{rows.filter(row => row.removed).map(row => <div className="row between" key={row.key}><span>{row.word.term}</span><button type="button" className="text-button" aria-label={"Khôi phục " + row.input} onClick={() => changeRow(row.key, { removed: false })}>Khôi phục</button></div>)}</div>}
      </section>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="draft-footer"><small>{ready ? kept.length + " từ chờ thêm · chưa lưu vào bộ" : "Tra từ để kiểm tra danh sách trước khi lưu"}</small><button className="button full" type="submit" disabled={busy || !ready || !kept.length || kept.some(row => !row.word.meaning.trim())}>Thêm từ</button></div>
    </fieldset>
  </form>{editing && <Sheet title="Sửa chi tiết từ" onClose={() => { setEditing(null); setEditError(""); }}><form className="draft-word-editor" onChange={() => setEditError("")} onSubmit={e => { e.preventDefault(); saveEdit(); }}>
    {([['term', 'Từ tiếng Anh', 100], ['meaning', 'Nghĩa tiếng Việt', 1000], ['ipa', 'Phiên âm IPA', 150], ['pos', 'Loại từ', 50], ['example', 'Câu ví dụ', 1000]] as const).map(([key, label, max]) => <label className="field" key={key}>{label}{key === "meaning" || key === "example" ? <textarea aria-label={label} required={key === "meaning"} maxLength={max} value={editing.word[key]} onChange={e => setEditing({ ...editing, word: { ...editing.word, [key]: e.target.value } })} /> : <input aria-label={label} required={key === "term"} maxLength={max} value={editing.word[key]} onChange={e => setEditing({ ...editing, word: { ...editing.word, [key]: e.target.value } })} />}</label>)}
    <p className="phone-footnote">Thay đổi chỉ áp dụng cho từ đang chờ thêm. Dữ liệu trong các bộ từ đã lưu được giữ nguyên.</p>
    {editError && <p className="form-error" role="alert">{editError}</p>}
    <button className="button full">Lưu chỉnh sửa</button><button className="text-button full" type="button" onClick={() => setEditing(null)}>Hủy</button>
  </form></Sheet>}</>;
}
