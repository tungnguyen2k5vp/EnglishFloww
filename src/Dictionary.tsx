import { useState } from "react";
import { ArrowUpRight, BookA, Clock3 } from "lucide-react";
import {
  Badge,
  DictionaryEntry,
  Empty,
  SearchBox,
  allWords,
} from "./components";
import { dictionaryService } from "./dictionary-service";
import { useStore } from "./store";
import type { Word } from "./model";

export function Dictionary() {
  const { state, update } = useStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const dictionary = allWords(state.customWords);
  const results = query.trim()
    ? dictionaryService.search(dictionary, query)
    : dictionary.slice(0, 12);
  const word = dictionary.find((w) => w.id === selected);
  function open(w: Word) {
    setSelected(w.id);
    update((s) => ({
      ...s,
      searches: [w.term, ...s.searches.filter((x) => x !== w.term)].slice(0, 8),
    }));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE RIGHT WORD OPENS A DOOR</span>
          <h1>
            Hiểu từng từ mới<span className="heading-dot">.</span>
          </h1>
          <p>Tra nghĩa, nghe phát âm, lưu vào hành trang của bạn.</p>
        </div>
        <span className="library-stamp">
          <BookA size={29} />
        </span>
      </div>
      <div className="dictionary-search">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Nhập từ tiếng Anh hoặc nghĩa tiếng Việt…"
          label="Tìm từ điển"
        />
        <span className="small muted">
          {dictionary.length} mục từ trong từ điển cục bộ · Có hỗ trợ cụm từ
        </span>
      </div>
      {state.searches.length > 0 && (
        <div className="recent-searches">
          <Clock3 size={16} />
          <span className="small muted">Gần đây</span>
          {state.searches.map((s) => (
            <button
              className="chip"
              key={s}
              onClick={() => {
                setQuery(s);
                const found = dictionaryService.lookup(dictionary, s);
                if (found) open(found);
              }}
            >
              {s}
            </button>
          ))}
          <button
            className="text-button small"
            onClick={() => update((s) => ({ ...s, searches: [] }))}
          >
            Xóa lịch sử
          </button>
        </div>
      )}
      <div className="dictionary-layout">
        <section>
          <div className="section-title">
            <h2>
              {query ? "Kết quả tìm kiếm" : "Bắt đầu từ những từ quen thuộc"}
            </h2>
            <span className="small muted">{results.length} từ</span>
          </div>
          <div className="dictionary-results">
            {results.map((w) => (
              <button
                key={w.id}
                className={`dictionary-result ${selected === w.id ? "active" : ""}`}
                onClick={() => open(w)}
              >
                <div>
                  <strong>{w.term}</strong>
                  <span>
                    {w.ipa} · {w.pos}
                  </span>
                  <p>{w.meaning}</p>
                </div>
                <div className="result-right">
                  <Badge>{w.level}</Badge>
                  <ArrowUpRight size={17} />
                </div>
              </button>
            ))}
          </div>
          {!results.length && (
            <Empty title="Chưa có từ này trong bộ mẫu">
              Từ điển cục bộ không bao phủ mọi từ tiếng Anh. Thử “habit”,
              “journey” hoặc nhập từ vựng riêng trong trang Từ vựng.
            </Empty>
          )}
        </section>
        <aside className="panel dictionary-detail">
          {word ? (
            <DictionaryEntry key={word.id} word={word} />
          ) : (
            <Empty title="Một từ mới, một góc nhìn mới">
              Chọn một kết quả để xem nghĩa, ví dụ và lưu từ.
            </Empty>
          )}
        </aside>
      </div>
    </>
  );
}
