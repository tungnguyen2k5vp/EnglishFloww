import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Languages,
} from "lucide-react";
import { articleProvider } from "./content-service";
import {
  Badge,
  BookmarkButton,
  Empty,
  LessonCard,
  Quiz,
  SearchBox,
  TextLookup,
} from "./components";
import { useStore } from "./store";
import { ContentCredits } from "./ContentCredits";
const articles = articleProvider.list();

export function Reading({
  activeId,
  onOpen,
  onLookup,
}: {
  activeId: string | null;
  onOpen: (id: string | null) => void;
  onLookup: (s: string) => void;
}) {
  const { state, update } = useStore();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [level, setLevel] = useState("all");
  const [type, setType] = useState("all");
  const [onlySaved, setOnlySaved] = useState(false);
  const article = articles.find((a) => a.id === activeId);
  if (article)
    return (
      <Reader
        key={article.id}
        id={article.id}
        onBack={() => onOpen(null)}
        onLookup={onLookup}
      />
    );
  const filtered = articles.filter(
    (a) =>
      (a.title + " " + a.subtitle)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (topic === "all" || a.topic === topic) &&
      (level === "all" || a.level === level) &&
      (type === "all" || a.kind === type) &&
      (!onlySaved || state.bookmarks.includes(a.id)),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">READ SOMETHING WORTH LEARNING</span>
          <h1>
            Đọc để khám phá<span className="heading-dot">.</span>
          </h1>
          <p>Những câu chuyện hay. Những từ mới đáng nhớ.</p>
        </div>
        <div className="library-stamp">
          <BookOpen size={25} />
          <span>
            Thư viện mở
            <br />
            <strong>Anh – Việt</strong>
          </span>
        </div>
      </div>
      <div className="filterbar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Tìm bài đọc…"
        />
        <select
          aria-label="Trình độ bài đọc"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">Mọi trình độ</option>
          <option>A2</option>
          <option>B1</option>
          <option>B2</option>
        </select>
        <select
          aria-label="Loại bài đọc"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">Mọi nội dung</option>
          {[...new Set(articles.map((a) => a.kind))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="row between topicbar">
        <div className="chips">
          {["all", ...new Set(articles.map((a) => a.topic))].map((t) => (
            <button
              key={t}
              className={topic === t ? "active" : ""}
              onClick={() => setTopic(t)}
            >
              {t === "all" ? "Tất cả" : t}
            </button>
          ))}
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlySaved}
            onChange={(e) => setOnlySaved(e.target.checked)}
          />{" "}
          Đã đánh dấu
        </label>
      </div>
      <div className="library-grid">
        {filtered.map((a) => (
          <div key={a.id}>
            <LessonCard
              title={a.title}
              subtitle={a.subtitle}
              level={a.level}
              topic={a.topic}
              scene={a.scene}
              meta={`${a.minutes} phút đọc`}
              onOpen={() => onOpen(a.id)}
              id={a.id}
            />
            {state.reading[a.id] !== undefined && (
              <div className="reading-card-progress">
                <progress
                  value={state.reading[a.id] + 1}
                  max={a.paragraphs.length}
                />
                <span>
                  {Math.round(
                    ((state.reading[a.id] + 1) / a.paragraphs.length) * 100,
                  )}
                  % vị trí đọc
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      {!filtered.length && (
        <Empty title="Chưa tìm thấy bài đọc">
          Thử từ khóa khác hoặc thay đổi bộ lọc.
        </Empty>
      )}
      <div className="editor-note">
        <Languages size={21} />
        <div>
          <strong>Một lần đọc, hai cách hiểu.</strong>
          <p>
            Bật bản dịch khi cần. Chạm từ được gạch chân để tra nghĩa và lưu
            ngay trong bài.
          </p>
        </div>
      </div>
      <button
        className="text-button"
        onClick={() =>
          update((s) => ({
            ...s,
            profile: {
              ...s.profile,
              level: s.profile.level === "A2" ? "B1" : "A2",
            },
          }))
        }
      >
        Trình độ gợi ý hiện tại: {state.profile.level} · Thay đổi nhanh
      </button>
    </>
  );
}
function Reader({
  id,
  onBack,
  onLookup,
}: {
  id: string;
  onBack: () => void;
  onLookup: (s: string) => void;
}) {
  const { state, update, notice } = useStore();
  const article = articleProvider.get(id)!;
  const [translation, setTranslation] = useState(true);
  const [position, setPosition] = useState(state.reading[id] ?? 0);
  const [quiz, setQuiz] = useState(false);
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current && state.reading[id] !== undefined) {
      document
        .getElementById(`paragraph-${id}-${position}`)
        ?.scrollIntoView({ block: "center" });
      restored.current = true;
    }
  }, [id, position, state.reading]);
  function mark(index: number) {
    if (
      update((s) => {
        const reading = { ...s.reading };
        delete reading[id];
        return { ...s, reading: { ...reading, [id]: index } };
      })
    ) {
      setPosition(index);
      notice("Đã lưu vị trí đọc.");
    }
  }
  return (
    <div className="reader">
      <button className="text-button back-button" onClick={onBack}>
        <ArrowLeft size={17} /> Thư viện bài đọc
      </button>
      <div className="row between">
        <div className="row">
          <Badge>{article.level}</Badge>
          <span className="eyebrow">{article.topic}</span>
          <span className="small muted row">
            <Clock size={14} />
            {article.minutes} phút
          </span>
        </div>
        <BookmarkButton id={id} />
      </div>
      <h1>{article.title}</h1>
      <p className="reader-subtitle">{article.subtitle}</p>
      <div className="reader-toolbar">
        <span className="row">
          <BookOpen size={17} /> EnglishFlow Originals
        </span>
        <button
          className={`button small ${translation ? "" : "secondary"}`}
          aria-pressed={translation}
          onClick={() => setTranslation(!translation)}
        >
          <Languages size={16} />
          {translation ? "Ẩn bản dịch" : "Hiện bản dịch"}
        </button>
      </div>
      <p className="hint">
        Chạm từ gạch chân để tra nghĩa. Lưu vị trí ở cuối mỗi đoạn để đọc tiếp
        lần sau.
      </p>
      {article.paragraphs.map((p, i) => (
        <section
          className={`reading-paragraph ${position === i ? "current-paragraph" : ""}`}
          id={`paragraph-${id}-${i}`}
          key={i}
        >
          <p className="english-text">
            <TextLookup text={p.en} onLookup={onLookup} />
          </p>
          {translation && <p className="translation">{p.vi}</p>}
          <button className="text-button small" onClick={() => mark(i)}>
            {state.reading[id] === i ? (
              <>
                <Check size={14} /> Vị trí đã lưu
              </>
            ) : (
              <>
                Lưu vị trí đoạn {i + 1}
                <BookOpen size={14} />
              </>
            )}
          </button>
        </section>
      ))}
      <div className="reader-end panel">
        <span className="eyebrow">TURN READING INTO LEARNING</span>
        <h2>Đã đọc xong? Cùng kiểm tra nhé.</h2>
        <p>Ôn lại ý chính qua {article.questions.length} câu hỏi ngắn.</p>
        <button
          className="button"
          onClick={() => {
            mark(article.paragraphs.length - 1);
            setQuiz(true);
          }}
        >
          Làm bài đọc hiểu <ArrowRight size={17} />
        </button>
      </div>
      {quiz && (
        <Quiz questions={article.questions} target={id} kind="reading" />
      )}
      <ContentCredits ids={article.credits} />
      <div className="reader-vocabulary">
        <h2>Từ vựng trong bài</h2>
        <div className="chips">
          {[
            "habit",
            "community",
            "discover",
            "journey",
            "focus",
            "sustainable",
            "feedback",
            "perspective",
          ]
            .filter((w) =>
              article.paragraphs.some((p) => p.en.toLowerCase().includes(w)),
            )
            .map((w) => (
              <button key={w} onClick={() => onLookup(w)}>
                {w}
                <PlusIcon />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
function PlusIcon() {
  return <span aria-hidden="true">+</span>;
}
