import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Download,
  FolderPlus,
  Layers,
  Plus,
  RotateCcw,
  Upload,
  Volume2,
} from "lucide-react";
import { Badge, Empty, SearchBox, allWords, speak } from "./components";
import { event, newSaved, parseVocabulary, schedule } from "./domain";
import { download, useStore } from "./store";
import type { Collection, Level } from "./model";

export function Vocabulary({
  onLookup,
  onReview,
  initialCollectionId,
}: {
  onLookup: (s: string) => void;
  onReview: () => void;
  initialCollectionId?: string;
}) {
  const { state, update, notice } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<string | null>(initialCollectionId ?? null);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const dictionary = allWords(state.customWords);
  const collection = state.collections.find((c) => c.id === active);
  const matching = dictionary
    .filter(
      (w) =>
        (active
          ? collection?.wordIds.includes(w.id) ||
            state.saved[w.id]?.collectionId === active
          : !!state.saved[w.id]) &&
        (filter === "all" || w.level === filter) &&
        (w.term + " " + w.meaning).toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "alpha"
        ? a.term.localeCompare(b.term)
        : sort === "difficult"
          ? (state.saved[b.id]?.lapses ?? 0) - (state.saved[a.id]?.lapses ?? 0)
          : (state.saved[b.id]?.added ?? 0) - (state.saved[a.id]?.added ?? 0),
    );
  const shown = matching.slice((page - 1) * 8, page * 8);
  function importWords(file?: File) {
    if (!file) return;
    if (file.size > 5_000_000) {
      notice("Tệp tối đa 5 MB.");
      return;
    }
    file
      .text()
      .then((text) => {
        const imported = parseVocabulary(text);
        if (
          update((s) => {
            const existing = new Set([...dictionary.map((w) => w.id)]);
            const fresh = imported.filter((w) => !existing.has(w.id));
            const saved = { ...s.saved };
            for (const w of imported)
              saved[w.id] ??= newSaved(w.id, active ?? s.collections[0].id);
            return { ...s, customWords: [...s.customWords, ...fresh], saved };
          })
        )
          notice(`Đã nhập ${imported.length} từ (ID đã có được giữ nguyên).`);
      })
      .catch((e) => notice(e.message));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORDS, YOUR WORLD</span>
          <h1>
            Từ vựng của bạn<span className="heading-dot">.</span>
          </h1>
          <p>Lưu hôm nay. Nhớ lâu hơn mỗi ngày.</p>
        </div>
        <button className="button" onClick={onReview}>
          <RotateCcw size={17} /> Ôn tập đến hạn
        </button>
      </div>
      <div className="section-title">
        <h2>
          Bộ sưu tập từ vựng{" "}
          <span className="count">{state.collections.length}</span>
        </h2>
        <button
          className="text-button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
            setFormError("");
          }}
        >
          <FolderPlus size={17} /> Tạo bộ từ
        </button>
      </div>
      {showForm && (
        <form
          className="panel collection-form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const name = String(data.get("name")).trim();
            if (!name) {
              setFormError("Tên bộ từ không được để trống.");
              return;
            }
            if (
              state.collections.some(
                (c) =>
                  c.id !== editing?.id &&
                  c.name.toLowerCase() === name.toLowerCase(),
              )
            ) {
              setFormError("Tên bộ từ đã tồn tại.");
              return;
            }
            const next: Collection = {
              id: editing?.id ?? crypto.randomUUID(),
              name,
              description: String(data.get("description")).trim(),
              level: String(data.get("level")) as Level,
              topic: editing?.topic ?? "Personal",
              wordIds: editing?.wordIds ?? [],
            };
            if (
              update((s) => ({
                ...s,
                collections: editing
                  ? s.collections.map((c) => (c.id === editing.id ? next : c))
                  : [...s.collections, next],
              }))
            ) {
              setShowForm(false);
              notice("Đã lưu bộ từ.");
            }
          }}
        >
          <h3>{editing ? "Chỉnh sửa bộ từ" : "Tạo bộ từ riêng"}</h3>
          <label className="field">
            Tên bộ từ
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={editing?.name ?? ""}
            />
          </label>
          <label className="field">
            Mô tả
            <input
              name="description"
              maxLength={500}
              defaultValue={editing?.description ?? ""}
            />
          </label>
          <label className="field">
            Trình độ
            <select name="level" defaultValue={editing?.level ?? "B1"}>
              <option>A2</option>
              <option>B1</option>
              <option>B2</option>
            </select>
          </label>
          {formError && (
            <p role="alert" className="error-text">
              {formError}
            </p>
          )}
          <div className="row">
            <button type="submit" className="button">
              Lưu bộ từ
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setShowForm(false)}
            >
              Hủy
            </button>
          </div>
        </form>
      )}
      <div className="collection-grid">
        {state.collections.map((c, i) => (
          <button
            key={c.id}
            className={`collection-card tone-${i % 4} ${active === c.id ? "active" : ""}`}
            onClick={() => {
              setActive(c.id);
              setPage(1);
            }}
          >
            <div className="row between">
              <span className="collection-icon">
                <Layers size={22} />
              </span>
              <Badge>{c.level}</Badge>
            </div>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <span className="small">
              {
                new Set([
                  ...c.wordIds,
                  ...Object.values(state.saved)
                    .filter((w) => w.collectionId === c.id)
                    .map((w) => w.wordId),
                ]).size
              }{" "}
              từ <ArrowRight size={15} />
            </span>
          </button>
        ))}
      </div>
      <div className="section-title word-section">
        <h2>
          {collection?.name ?? "Từ đã lưu"}{" "}
          <span className="count">{matching.length}</span>
        </h2>
        <div className="row">
          {collection && (
            <>
              <button
                className="text-button"
                onClick={() => {
                  setEditing(collection);
                  setShowForm(true);
                }}
              >
                Chỉnh sửa
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setActive(null);
                  setPage(1);
                }}
              >
                Tất cả từ đã lưu
              </button>
            </>
          )}
        </div>
      </div>
      <div className="filterbar">
        <SearchBox
          value={query}
          onChange={(s) => {
            setQuery(s);
            setPage(1);
          }}
          placeholder="Tìm từ hoặc nghĩa tiếng Việt…"
        />
        <select
          aria-label="Lọc trình độ từ vựng"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Mọi trình độ</option>
          <option>A2</option>
          <option>B1</option>
          <option>B2</option>
        </select>
        <select
          aria-label="Sắp xếp từ vựng"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">Mới lưu gần đây</option>
          <option value="alpha">A → Z</option>
          <option value="difficult">Hay quên nhất</option>
        </select>
      </div>
      {collection && (
        <div className="row collection-actions">
          <button
            className="button secondary"
            onClick={() => {
              if (
                update((s) => {
                  const saved = { ...s.saved };
                  for (const id of collection.wordIds)
                    saved[id] ??= newSaved(id, collection.id);
                  return { ...s, saved };
                })
              )
                notice("Đã thêm các từ trong bộ vào danh sách ôn tập.");
            }}
          >
            <Plus size={16} /> Lưu cả bộ để ôn
          </button>
          <label className="inline-label">
            Thêm từ vào bộ
            <select
              aria-label="Thêm từ vào bộ"
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (id)
                  update((s) => ({
                    ...s,
                    collections: s.collections.map((c) =>
                      c.id === collection.id
                        ? { ...c, wordIds: [...c.wordIds, id] }
                        : c,
                    ),
                  }));
              }}
            >
              <option value="">Chọn từ…</option>
              {dictionary
                .filter((w) => !collection.wordIds.includes(w.id))
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.term}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      <div className="word-list">
        {shown.map((w) => (
          <div className="word-row" key={w.id}>
            <button className="word-name" onClick={() => onLookup(w.term)}>
              <strong>{w.term}</strong>
              <span>{w.ipa}</span>
            </button>
            <div className="word-meaning">
              <span>{w.meaning}</span>
              <small>{w.example}</small>
            </div>
            <Badge>{w.level}</Badge>
            <button
              className="icon-button"
              aria-label={`Phát âm ${w.term}`}
              onClick={() => speak(w.term, notice)}
            >
              <Volume2 size={18} />
            </button>
            <button
              className={`button small ${state.saved[w.id] ? "secondary" : ""}`}
              onClick={() =>
                update((s) => {
                  const saved = { ...s.saved };
                  if (saved[w.id]) delete saved[w.id];
                  else
                    saved[w.id] = newSaved(w.id, active ?? s.collections[0].id);
                  return { ...s, saved };
                })
              }
            >
              {state.saved[w.id] ? "Bỏ lưu" : "Lưu từ"}
            </button>
            {collection?.wordIds.includes(w.id) && (
              <button
                className="text-button small"
                aria-label={`Bỏ ${w.term} khỏi bộ`}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    collections: s.collections.map((c) =>
                      c.id === collection.id
                        ? {
                            ...c,
                            wordIds: c.wordIds.filter((id) => id !== w.id),
                          }
                        : c,
                    ),
                    saved:
                      s.saved[w.id]?.collectionId === collection.id
                        ? {
                            ...s.saved,
                            [w.id]: {
                              ...s.saved[w.id],
                              collectionId:
                                s.collections.find(
                                  (c) => c.id !== collection.id,
                                )?.id ?? collection.id,
                            },
                          }
                        : s.saved,
                  }))
                }
              >
                Bỏ khỏi bộ
              </button>
            )}
          </div>
        ))}
      </div>
      {!matching.length && (
        <Empty
          title={
            query ? "Không tìm thấy từ phù hợp" : "Bắt đầu bộ từ của riêng bạn"
          }
        >
          Tra từ trong từ điển hoặc mở một bộ sưu tập và lưu những từ bạn muốn
          học.
        </Empty>
      )}
      <div className="row between pagination">
        <div className="row">
          <button
            className="text-button"
            onClick={() =>
              download(
                "englishflow-vocabulary.json",
                JSON.stringify(matching, null, 2),
              )
            }
          >
            <Download size={16} /> Xuất từ (JSON)
          </button>
          <label className="text-button file-button">
            <Upload size={16} /> Nhập từ (JSON)
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                importWords(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {matching.length > 8 && (
          <div className="row">
            <button
              className="icon-button"
              aria-label="Trang trước"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ArrowLeft size={18} />
            </button>
            <span>
              {page}/{Math.ceil(matching.length / 8)}
            </span>
            <button
              className="icon-button"
              aria-label="Trang sau"
              disabled={page >= Math.ceil(matching.length / 8)}
              onClick={() => setPage(page + 1)}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export function Review({
  onLookup,
  onVocabulary,
}: {
  onLookup: (s: string) => void;
  onVocabulary: () => void;
}) {
  const { state, update, notice } = useStore();
  const [queue] = useState(() =>
    Object.values(state.saved)
      .filter((w) => w.due <= Date.now())
      .sort((a, b) => a.due - b.due)
      .map((w) => w.wordId),
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [answers, setAnswers] = useState<{ term: string; quality: number }[]>(
    [],
  );
  const dictionary = useMemo(
    () => allWords(state.customWords),
    [state.customWords],
  );
  const word = dictionary.find((w) => w.id === queue[index]);
  function rate(quality: 1 | 3 | 4 | 5) {
    if (!word) return;
    if (!state.saved[word.id]) {
      notice("Từ này đã bị bỏ lưu trong thẻ khác.");
      setIndex(index + 1);
      setRevealed(false);
      return;
    }
    if (
      update((s) => ({
        ...s,
        saved: { ...s.saved, [word.id]: schedule(s.saved[word.id], quality) },
        events: [
          ...s.events,
          event("review", word.id, { correct: quality >= 3 }),
        ],
      }))
    ) {
      setCorrect(correct + (quality >= 3 ? 1 : 0));
      setAnswers([...answers, { term: word.term, quality }]);
      setIndex(index + 1);
      setRevealed(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE PRACTICE, A LASTING MEMORY</span>
          <h1>
            Ôn tập thông minh<span className="heading-dot">.</span>
          </h1>
          <p>Nhớ đúng lúc với phương pháp lặp lại ngắt quãng SM-2.</p>
        </div>
      </div>
      {!queue.length ? (
        <Empty title="Bạn đã sẵn sàng cho từ mới!">
          Chưa có từ đến hạn.{" "}
          <button className="text-button" onClick={onVocabulary}>
            Khám phá bộ từ <ArrowRight size={16} />
          </button>
        </Empty>
      ) : index >= queue.length ? (
        <div className="panel review-summary">
          <div className="success-mark">
            <BookOpen size={32} />
          </div>
          <h2>Thêm một bước tiến!</h2>
          <p>
            Đã ôn {answers.length} từ · Nhớ được {correct}/{answers.length} từ
          </p>
          <p className="muted">
            Lịch ôn tiếp theo đã lưu. Từ chưa nhớ sẽ trở lại sau 10 phút.
          </p>
          <div className="mistakes">
            {answers.map((a) => (
              <p key={a.term}>
                <button
                  className="text-button"
                  onClick={() => onLookup(a.term)}
                >
                  {a.term}
                </button>
                <span>
                  {a.quality < 3
                    ? "10 phút"
                    : state.saved[dictionary.find((w) => w.term === a.term)!.id]
                        ?.interval + " ngày"}
                </span>
              </p>
            ))}
          </div>
          <button className="button" onClick={onVocabulary}>
            Về bộ từ vựng <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        word && (
          <div className="review-area">
            <div className="row between">
              <span className="eyebrow">FLASHCARDS · TỪ ĐẾN HẠN</span>
              <span>
                {index + 1} / {queue.length}
              </span>
            </div>
            <progress value={index} max={queue.length} />
            <div className="flashcard">
              <span className="eyebrow">BẠN CÓ NHỚ TỪ NÀY?</span>
              <h2>{word.term}</h2>
              <div className="row centered muted">
                {word.ipa}
                <button
                  className="icon-button"
                  aria-label="Nghe phát âm"
                  onClick={() => speak(word.term, notice)}
                >
                  <Volume2 size={20} />
                </button>
              </div>
              {revealed ? (
                <div className="flashcard-answer">
                  <Badge>{word.pos}</Badge>
                  <h3>{word.meaning}</h3>
                  <p>“{word.example}”</p>
                  {state.saved[word.id]?.note && (
                    <p className="personal-note">{state.saved[word.id].note}</p>
                  )}
                </div>
              ) : (
                <button className="button" onClick={() => setRevealed(true)}>
                  Hiện đáp án <ArrowRight size={17} />
                </button>
              )}
            </div>
            {revealed && (
              <>
                <p className="muted centered">Bạn nhớ từ này như thế nào?</p>
                <div className="rating-buttons">
                  {(
                    [
                      { q: 1, label: "Chưa nhớ", time: "10 phút" },
                      { q: 3, label: "Hơi khó", time: "SM-2 · q3" },
                      { q: 4, label: "Nhớ được", time: "SM-2 · q4" },
                      { q: 5, label: "Rất dễ", time: "SM-2 · q5" },
                    ] as const
                  ).map((r) => (
                    <button key={r.q} onClick={() => rate(r.q)}>
                      <strong>{r.label}</strong>
                      <span>{r.time}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      )}
    </>
  );
}
