import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  Headphones,
  Leaf,
  Play,
  Plus,
  Search,
  Volume2,
  X,
} from "lucide-react";
import { words } from "./data";
import { event, newSaved, normalize } from "./domain";
import { useStore } from "./store";
import type { Question, StudyEvent, Word } from "./model";
import { dictionaryService, lookupDictionary } from "./dictionary-service";
import { device } from "./native";
export const allWords = (custom: Word[]) => [...words, ...custom];
export function Scene({
  kind = "garden",
  className = "",
}: {
  kind?: string;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`scene scene-${kind} ${className}`}>
      <div className="scene-sun" />
      <div className="scene-hill hill-back" />
      <div className="scene-hill hill-front" />
      <div className="scene-path" />
      <div className="scene-plant plant-one">
        <i />
        <i />
        <i />
      </div>
      <div className="scene-plant plant-two">
        <i />
        <i />
        <i />
      </div>
      <div className="scene-window" />
      <div className="scene-book" />
      <div className="scene-cup" />
    </div>
  );
}
export function Empty({
  title = "Chưa có nội dung",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Leaf size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Tìm kiếm…",
  label = "Tìm kiếm",
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="searchbox">
      <Search size={18} />
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button aria-label="Xóa tìm kiếm" onClick={() => onChange("")}>
          <X size={16} />
        </button>
      )}
    </label>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function BookmarkButton({ id }: { id: string }) {
  const { state, update } = useStore();
  const saved = state.bookmarks.includes(id);
  return (
    <button
      className={`icon-button bookmark ${saved ? "selected" : ""}`}
      aria-label={saved ? "Bỏ đánh dấu" : "Đánh dấu bài học"}
      aria-pressed={saved}
      onClick={() =>
        update((s) => ({
          ...s,
          bookmarks: saved
            ? s.bookmarks.filter((x) => x !== id)
            : [...s.bookmarks, id],
        }))
      }
    >
      <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
export function TextLookup({
  text,
  onLookup,
}: {
  text: string;
  onLookup: (term: string) => void;
}) {
  const { state } = useStore();
  const terms = new Set(
    allWords(state.customWords).map((w) => normalize(w.term)),
  );
  return (
    <>
      {text.split(/([\p{L}]+(?:['’-][\p{L}]+)*)/u).map((token, i) =>
        terms.has(normalize(token)) ? (
          <button key={i} className="word-link" onClick={() => onLookup(token)}>
            {token}
          </button>
        ) : (
          token
        ),
      )}
    </>
  );
}
export function stopSpeech() {
  device()?.stopAudio();
  window.speechSynthesis?.cancel();
}
export function speak(text: string, onError: (s: string) => void, accent: "en-US" | "en-GB" = "en-US") {
  if (!text.trim() || text.length > 2000) return;
  if (device()) {
    if (!(device()!.speakAccent ? device()!.speakAccent!(text, accent) : device()!.speak(text)))
      onError("Giọng đọc tiếng Anh chưa sẵn sàng. Hãy cài gói giọng đọc trong cài đặt Android rồi thử lại.");
    return;
  }
  if (!("speechSynthesis" in window)) {
    onError(
      "Trình duyệt này không hỗ trợ giọng đọc. Bạn vẫn có thể học qua IPA và ví dụ.",
    );
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent;
  const voices = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().replace("_", "-") === accent.toLowerCase() && v.localService);
  if (!voices.length) { onError("Chưa có giọng " + (accent === "en-GB" ? "UK" : "US") + " ngoại tuyến. Hãy cài giọng tiếng Anh trên thiết bị rồi thử lại."); return; }
  utterance.voice = voices[0];
  utterance.rate = 0.85;
  utterance.onerror = (e) => {
    if (e.error !== "interrupted" && e.error !== "canceled")
      onError(
        "Giọng đọc không khả dụng trên thiết bị này. Hãy kiểm tra gói giọng tiếng Anh.",
      );
  };
  speechSynthesis.speak(utterance);
}
window.addEventListener("hashchange", stopSpeech);
document.addEventListener("visibilitychange", () => { if (document.hidden) stopSpeech(); });
export function WordPronunciation({ word }: { word: Word }) {
  const { notice } = useStore();
  const pronunciations = word.pronunciations?.length ? word.pronunciations : word.ipa ? [{ ipa: word.ipa, region: "" }] : [];
  return <div className="word-pronunciation"><div>{pronunciations.map((p, i) => <small key={i}>{p.region && p.region + " "}{p.ipa}</small>)}</div><div className="row">{(["en-GB", "en-US"] as const).map(accent => <button type="button" className="text-button" key={accent} aria-label={"Nghe " + (accent === "en-GB" ? "UK" : "US")} onClick={() => speak(word.term, notice, accent)}><Volume2 size={18} />{accent === "en-GB" ? "UK" : "US"}</button>)}</div></div>;
}
export function DictionaryEntry({ word, initialCollectionId }: { word: Word; initialCollectionId?: string }) {
  const { state, update, notice } = useStore();
  const saved = state.saved[word.id];
  const [collection, setCollection] = useState(
    saved?.collectionId ?? state.collections.find(c => c.id === initialCollectionId)?.id ?? state.collections[0].id,
  );
  return (
    <div className="dictionary-entry">
      <div className="row between">
        <div>
          <span className="eyebrow">ENGLISH → TIẾNG VIỆT</span>
          <h2>{word.term}</h2>
          <span className="muted">
            {word.ipa} · {word.pos}
          </span>
        </div>
        <button
          className="sound-button"
          aria-label={`Phát âm ${word.term}`}
          onClick={() => speak(word.term, notice)}
        >
          <Volume2 size={23} />
        </button>
      </div>
      <div className="definition">
        {!word.source && <Badge>{word.level}</Badge>}
        <h3>{word.meaning}</h3>
        <p>“{word.example}”</p>
        <WordPronunciation word={word} />
        {word.lemma && <p>Dạng của {word.lemma} · chọn nghĩa theo ngữ cảnh.</p>}
        {word.source && <small>{word.source} · IPA theo mục từ; ví dụ từ nguồn có nội dung được tạo tự động. <a href="/dictionary/attribution.html" target="_blank" rel="noreferrer">Nguồn dữ liệu</a></small>}
      </div>
      <label className="field">
        Bộ từ vựng
        <select
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
        >
          {state.collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className={saved ? "button secondary full" : "button full"}
        onClick={() => {
          if (
            update((s) => {
              const copy = { ...s.saved };
              if (copy[word.id]) delete copy[word.id];
              else copy[word.id] = newSaved(word.id, collection);
              return { ...s, saved: copy, customWords: allWords(s.customWords).some(w => w.id === word.id) ? s.customWords : [...s.customWords, word] };
            })
          )
            notice(
              saved
                ? "Đã bỏ từ khỏi danh sách ôn tập."
                : "Đã lưu từ. Sẵn sàng cho lần ôn đầu tiên!",
            );
        }}
      >
        {saved ? (
          <>
            <Check size={17} /> Đã lưu · Bỏ lưu
          </>
        ) : (
          <>
            <Plus size={17} /> Lưu từ để ôn tập
          </>
        )}
      </button>
      {saved && (
        <label className="field note-field">
          Ghi chú cá nhân
          <textarea
            maxLength={2000}
            value={saved.note}
            onChange={(e) =>
              update((s) => ({
                ...s,
                saved: {
                  ...s.saved,
                  [word.id]: { ...s.saved[word.id], note: e.target.value },
                },
              }))
            }
            placeholder="Viết một câu của riêng bạn…"
          />
        </label>
      )}
    </div>
  );
}
export function LookupDialog({
  term,
  onClose,
  onLookup,
  initialCollectionId,
}: {
  term: string;
  onClose: () => void;
  onLookup: (s: string) => void;
  initialCollectionId?: string;
}) {
  const { state } = useStore();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(term);
  const local = dictionaryService.lookup(allWords(state.customWords), term);
  const [found, setFound] = useState<Word[]>([]), [loading, setLoading] = useState(false), [lookupError, setLookupError] = useState("");
  const [sense, setSense] = useState("");
  const [retry, setRetry] = useState(0);
  const entry = local ?? found.find(w => w.id === sense) ?? found[0];
  useEffect(() => {
    let active = true;
    setFound([]); setSense(""); setLookupError(""); setLoading(!local);
    if (!local) lookupDictionary(term).then(rows => { if (active) setFound(rows); }).catch(() => { if (active) setLookupError("Không mở được từ điển. Hãy thử lại."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; stopSpeech(); };
  }, [term, local?.id, retry]);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => setQuery(term), [term]);
  return (
    <dialog
      ref={dialog}
      className="lookup-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="dialog-close icon-button"
        aria-label="Đóng từ điển"
        onClick={onClose}
      >
        <X />
      </button>
      {found.length > 1 && <label className="field">Chọn nghĩa<select aria-label="Chọn nghĩa từ điển" value={entry?.id} onChange={e => setSense(e.target.value)}>{found.map(w => <option key={w.id} value={w.id}>{w.pos} · {w.meaning}</option>)}</select></label>}
      {loading ? <p role="status">Đang tra từ…</p> : lookupError ? <p role="alert">{lookupError}<button className="text-button" onClick={() => setRetry(retry + 1)}>Thử lại</button></p> : entry ? (
        <DictionaryEntry key={entry.id} word={entry} initialCollectionId={initialCollectionId} />
      ) : (
        <Empty title={`Chưa tìm thấy “${term}” trong từ điển`}>
          Kiểm tra chính tả hoặc bổ sung nghĩa trong bộ từ cá nhân.
        </Empty>
      )}
      <form
        className="row lookup-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) onLookup(query.trim());
        }}
      >
        <input
          aria-label="Tra từ khác"
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button secondary" type="submit">
          <Search size={18} /> Tra từ
        </button>
      </form>
    </dialog>
  );
}
export function Quiz({
  questions,
  target,
  kind = "practice",
  mode = "choice",
  onFinish,
}: {
  questions: Question[];
  target: string;
  kind?: StudyEvent["kind"];
  mode?: "choice" | "typed" | "gap" | "spelling";
  onFinish?: () => void;
}) {
  const { update, notice } = useStore();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const question = questions[index];
  const correct = normalize(answer) === normalize(question.answer);
  function next() {
    const nextResults = [...results, correct];
    const nextMistakes = correct
      ? mistakes
      : [...mistakes, `${question.prompt} → ${question.answer}`];
    if (index === questions.length - 1) {
      if (
        !update((s) => ({
          ...s,
          events: [
            ...s.events,
            event(kind, target, {
              score: nextResults.filter(Boolean).length,
              total: questions.length,
              mistakes: nextMistakes,
            }),
          ],
        }))
      )
        return;
      setFinished(true);
      onFinish?.();
    } else {
      setIndex(index + 1);
      setAnswer("");
      setChecked(false);
    }
    setResults(nextResults);
    setMistakes(nextMistakes);
  }
  if (finished)
    return (
      <div className="quiz-summary">
        <div className="success-mark">
          <Check size={32} />
        </div>
        <span className="eyebrow">HOÀN THÀNH BÀI TẬP</span>
        <h2>
          {results.filter(Boolean).length} / {questions.length} câu đúng
        </h2>
        <p>Mỗi lần luyện tập là một bước tiến.</p>
        {mistakes.length > 0 && (
          <div className="mistakes">
            <h3>Cùng xem lại</h3>
            {mistakes.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
          </div>
        )}
        <button
          className="button secondary"
          onClick={() => {
            setIndex(0);
            setAnswer("");
            setChecked(false);
            setResults([]);
            setMistakes([]);
            setFinished(false);
          }}
        >
          Luyện tập lại
        </button>
      </div>
    );
  return (
    <div className="quiz-panel">
      <div className="row between">
        <span className="eyebrow">
          LUYỆN TẬP ·{" "}
          {mode === "choice"
            ? "TRẮC NGHIỆM"
            : mode === "gap"
              ? "ĐIỀN TỪ"
              : mode === "spelling"
                ? "CHÍNH TẢ"
                : "GÕ ĐÁP ÁN"}
        </span>
        <span className="muted">
          {index + 1} / {questions.length}
        </span>
      </div>
      <progress value={index} max={questions.length} />
      <h3>{question.prompt}</h3>
      {mode === "spelling" && (
        <button
          className="button secondary"
          onClick={() => speak(question.answer, notice)}
        >
          <Headphones size={18} /> Nghe từ cần viết
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (answer.trim()) {
            if (checked) next();
            else setChecked(true);
          }
        }}
      >
        {mode === "choice" ? (
          <div className="answers">
            {question.options.map((option, i) => (
              <button
                type="button"
                disabled={checked}
                className={`answer ${answer === option ? "chosen" : ""} ${checked && option === question.answer ? "correct" : ""} ${checked && answer === option && !correct ? "incorrect" : ""}`}
                key={option}
                onClick={() => setAnswer(option)}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {option}
              </button>
            ))}
          </div>
        ) : (
          <input
            className="typed-answer"
            aria-label="Đáp án của bạn"
            placeholder="Nhập đáp án bằng tiếng Anh…"
            value={answer}
            disabled={checked}
            onChange={(e) => setAnswer(e.target.value)}
            autoComplete="off"
          />
        )}
        {checked && (
          <div className={`feedback ${correct ? "good" : "bad"}`} role="status">
            <strong>
              {correct ? "Chính xác!" : "Chưa đúng. Cùng thử lại lần sau."}
            </strong>
            <p>Đáp án: {question.answer}</p>
            <p>{question.explanation}</p>
          </div>
        )}
        <button type="submit" disabled={!answer.trim()} className="button">
          {checked
            ? index === questions.length - 1
              ? "Xem kết quả"
              : "Câu tiếp theo"
            : "Kiểm tra"}
          <ArrowRight size={17} />
        </button>
      </form>
    </div>
  );
}
export function LessonCard({
  title,
  subtitle,
  level,
  topic,
  scene,
  meta,
  onOpen,
  id,
  media = false,
}: {
  title: string;
  subtitle: string;
  level: string;
  topic: string;
  scene: string;
  meta: string;
  onOpen: () => void;
  id: string;
  media?: boolean;
}) {
  return (
    <article className="lesson-card">
      <div className="card-art">
        <button
          className="art-open"
          tabIndex={-1}
          aria-label={`Mở ${title}`}
          onClick={onOpen}
        >
          <Scene kind={scene} />
          {media && (
            <span className="play-bubble">
              <Play size={23} fill="currentColor" />
            </span>
          )}
        </button>
        <BookmarkButton id={id} />
        <span className="art-label">{level}</span>
      </div>
      <div className="card-body">
        <div className="row between">
          <span className="eyebrow">{topic}</span>
          <span className="small muted">{meta}</span>
        </div>
        <h3>
          <button className="title-link" onClick={onOpen}>
            {title}
          </button>
        </h3>
        <p>{subtitle}</p>
      </div>
    </article>
  );
}
