import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { grammarLessons, words } from "./data";
import {
  Badge,
  Empty,
  Quiz,
  SearchBox,
  TextLookup,
  allWords,
} from "./components";
import { useStore } from "./store";
import type { Question } from "./model";

export function Practice({
  onLookup,
  activeId,
  onOpen,
  initialMode,
}: {
  onLookup: (s: string) => void;
  activeId: string | null;
  onOpen: (id: string | null) => void;
  initialMode?: "choice" | "gap" | "typed" | "spelling";
}) {
  const { state } = useStore();
  const [tab, setTab] = useState<"grammar" | "words">(initialMode ? "words" : "grammar");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [mode, setMode] = useState<"choice" | "gap" | "typed" | "spelling">(
    initialMode ?? "choice",
  );
  const [started, setStarted] = useState(false);
  const lesson = grammarLessons.find((l) => l.id === activeId);
  const dictionary = allWords(state.customWords);
  const saved = dictionary.filter((w) => state.saved[w.id]);
  const practiceWords = saved.length ? saved.slice(0, 10) : words.slice(0, 6);
  const questions: Question[] = practiceWords.map((w) => ({
    prompt:
      mode === "gap"
        ? w.example.replace(
            new RegExp(w.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
            "_____",
          )
        : mode === "spelling"
          ? `Nghe và viết lại từ · Gợi ý: ${w.meaning}`
          : mode === "typed"
            ? `Từ tiếng Anh nào có nghĩa là “${w.meaning}”?`
            : `“${w.term}” có nghĩa là gì?`,
    answer: mode === "choice" ? w.meaning : w.term,
    options: [
      w.meaning,
      ...dictionary
        .filter((x) => x.id !== w.id)
        .slice(0, 3)
        .map((x) => x.meaning),
    ].sort((a, b) => a.localeCompare(b, "vi")),
    explanation: `${w.term}: ${w.meaning}. ${w.example}`,
  }));
  if (lesson)
    return (
      <>
        <button
          className="text-button back-button"
          onClick={() => onOpen(null)}
        >
          <ArrowLeft size={17} /> Các chủ điểm ngữ pháp
        </button>
        <div className="grammar-detail">
          <Badge>{lesson.level}</Badge>
          <span className="eyebrow"> {lesson.category}</span>
          <h1>{lesson.title}</h1>
          <div className="panel grammar-explanation">
            <h3>Hiểu cách dùng</h3>
            <p>{lesson.explanation}</p>
            <div className="formula">{lesson.formula}</div>
            <h3>Ví dụ</h3>
            {lesson.examples.map((ex) => (
              <p key={ex} className="example">
                <TextLookup text={ex} onLookup={onLookup} />
              </p>
            ))}
          </div>
          <Quiz
            key={lesson.id}
            questions={lesson.questions}
            target={lesson.id}
            kind="grammar"
          />
        </div>
      </>
    );
  const filtered = grammarLessons.filter(
    (l) =>
      (l.title + " " + l.explanation)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === "all" || l.category === category) &&
      (level === "all" || l.level === level),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">UNDERSTAND IT. USE IT. REMEMBER IT.</span>
          <h1>
            Luyện tập mỗi ngày<span className="heading-dot">.</span>
          </h1>
          <p>Từ kiến thức nhỏ đến những câu nói tự tin.</p>
        </div>
        <span className="library-stamp">
          <PencilLine size={28} />
        </span>
      </div>
      <div className="tabs">
        <button
          className={tab === "grammar" ? "active" : ""}
          onClick={() => setTab("grammar")}
        >
          <BookOpen size={18} /> Ngữ pháp
        </button>
        <button
          className={tab === "words" ? "active" : ""}
          onClick={() => setTab("words")}
        >
          <Sparkles size={18} /> Luyện từ vựng
        </button>
      </div>
      {tab === "grammar" ? (
        <>
          <div className="filterbar">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Tìm chủ điểm ngữ pháp…"
            />
            <select
              aria-label="Trình độ ngữ pháp"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="all">Mọi trình độ</option>
              <option>A2</option>
              <option>B1</option>
              <option>B2</option>
            </select>
            <select
              aria-label="Nhóm ngữ pháp"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">Mọi chủ điểm</option>
              {[...new Set(grammarLessons.map((l) => l.category))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="grammar-grid">
            {filtered.map((l, i) => {
              const done = state.events.some(
                (e) => e.kind === "grammar" && e.target === l.id,
              );
              return (
                <button
                  key={l.id}
                  className="panel grammar-card"
                  onClick={() => onOpen(l.id)}
                >
                  <div className="row between">
                    <span className="grammar-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Badge>{l.level}</Badge>
                  </div>
                  <span className="eyebrow">{l.category}</span>
                  <h3>{l.title}</h3>
                  <p>{l.examples[0]}</p>
                  <span className="text-button">
                    {done ? (
                      <>
                        <Check size={16} /> Đã luyện tập
                      </>
                    ) : (
                      <>
                        {l.questions.length} câu hỏi
                        <ArrowRight size={16} />
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {!filtered.length && (
            <Empty title="Không tìm thấy chủ điểm">
              Hãy thử một bộ lọc khác.
            </Empty>
          )}
        </>
      ) : (
        <>
          <div className="panel practice-intro">
            <span className="eyebrow">PRACTICE YOUR WAY</span>
            <h2>Nhớ từ theo cách của bạn</h2>
            <p>
              {saved.length
                ? `Luyện với ${practiceWords.length} từ đã lưu của bạn.`
                : "Bài luyện sử dụng 6 từ mẫu. Lưu từ riêng để luyện theo bộ của bạn."}
            </p>
            <div className="chips">
              {(
                [
                  { id: "choice", name: "Trắc nghiệm" },
                  { id: "gap", name: "Điền từ" },
                  { id: "typed", name: "Gõ từ" },
                  { id: "spelling", name: "Chính tả" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  className={mode === m.id ? "active" : ""}
                  onClick={() => {
                    setMode(m.id);
                    setStarted(false);
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <button className="button" onClick={() => setStarted(true)}>
              Bắt đầu <ArrowRight size={17} />
            </button>
          </div>
          {started && (
            <Quiz
              key={mode}
              questions={questions}
              mode={mode}
              target={`vocabulary:${mode}`}
            />
          )}
        </>
      )}
    </>
  );
}
