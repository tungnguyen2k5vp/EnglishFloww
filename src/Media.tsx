import { useEffect, useRef, useState } from "react";
import { ContentCredits } from "./ContentCredits";
import {
  ArrowLeft,
  Headphones,
  Languages,
  Play,
  Repeat2,
  Video,
} from "lucide-react";
import { mediaLessons } from "./data";
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
import type { MediaLesson, Question } from "./model";
import { device } from "./native";

export function Media({
  activeId,
  onOpen,
  onLookup,
}: {
  activeId: string | null;
  onOpen: (s: string | null) => void;
  onLookup: (s: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [level, setLevel] = useState("all");
  const [topic, setTopic] = useState("all");
  const lesson = mediaLessons.find((l) => l.id === activeId);
  if (lesson)
    return (
      <Player
        key={lesson.id}
        lesson={lesson}
        onBack={() => onOpen(null)}
        onLookup={onLookup}
      />
    );
  const filtered = mediaLessons.filter(
    (l) =>
      (l.title + " " + l.description)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (type === "all" || l.type === type) &&
      (level === "all" || l.level === level) &&
      (topic === "all" || l.topic === topic),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LISTEN CLOSELY. LEARN NATURALLY.</span>
          <h1>
            Lắng nghe thế giới<span className="heading-dot">.</span>
          </h1>
          <p>Luyện tai nghe, tìm từ mới và nói theo nhịp của bạn.</p>
        </div>
        <div className="library-stamp">
          <Headphones size={27} />
          <span>
            Nghe chủ động
            <br />
            <strong>Học sâu hơn</strong>
          </span>
        </div>
      </div>
      <div className="filterbar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Tìm bài nghe, video…"
        />
        <select
          aria-label="Trình độ bài nghe"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">Mọi trình độ</option>
          <option>A2</option>
          <option>B1</option>
          <option>B2</option>
        </select>
        <select
          aria-label="Chủ đề bài nghe"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="all">Mọi chủ đề</option>
          {[...new Set(mediaLessons.map((l) => l.topic))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="chips topicbar">
        {[
          { id: "all", name: "Tất cả", Icon: Headphones },
          { id: "audio", name: "Podcast & Audio", Icon: Headphones },
          { id: "video", name: "Video bài học", Icon: Video },
        ].map(({ id, name, Icon }) => (
          <button
            key={id}
            className={type === id ? "active" : ""}
            onClick={() => setType(id)}
          >
            <Icon size={16} />
            {name}
          </button>
        ))}
      </div>
      <div className="library-grid">
        {filtered.map((l) => (
          <LessonCard
            key={l.id}
            title={l.title}
            subtitle={l.description}
            level={l.level}
            topic={
              l.type === "video" ? "VIDEO · " + l.topic : "PODCAST · " + l.topic
            }
            scene={l.scene}
            meta={l.duration}
            onOpen={() => onOpen(l.id)}
            id={l.id}
            media
          />
        ))}
      </div>
      {!filtered.length && (
        <Empty title="Không có bài nghe phù hợp">
          Thử đổi trình độ hoặc từ khóa.
        </Empty>
      )}
      <div className="editor-note">
        <Repeat2 size={23} />
        <div>
          <strong>Nghe. Nhắc lại. Tự tin hơn.</strong>
          <p>
            Media mẫu gốc với giọng tổng hợp. Phát lại từng câu, tra từ trong
            transcript và luyện chép chính tả.
          </p>
        </div>
      </div>
    </>
  );
}
function Player({
  lesson,
  onBack,
  onLookup,
}: {
  lesson: MediaLesson;
  onBack: () => void;
  onLookup: (s: string) => void;
}) {
  const { state, update, notice } = useStore();
  const player = useRef<HTMLMediaElement | null>(null);
  const repeatEnd = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const [time, setTime] = useState(state.media[lesson.id] ?? 0);
  const [translation, setTranslation] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");
  const [source, setSource] = useState<string | undefined>(device() ? undefined : lesson.src);
  useEffect(() => {
    if (!device()) return;
    const controller = new AbortController();
    let localUrl: string | undefined;
    // ponytail: packaged lessons are under 2 MB; stream through a native media provider for long videos.
    fetch(lesson.src, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Missing bundled media"); return response.blob(); })
      .then(blob => { if (!controller.signal.aborted) { localUrl = URL.createObjectURL(blob); setSource(localUrl); } })
      .catch(() => { if (!controller.signal.aborted) setError("Không mở được bài nghe ngoại tuyến. Bạn vẫn có thể học bản chép lời."); });
    return () => { controller.abort(); if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [lesson.src]);
  const [mode, setMode] = useState<
    "comprehension" | "dictation" | "gap" | "shadowing"
  >("comprehension");
  const [quiz, setQuiz] = useState(false);
  const active = lesson.segments.findIndex(
    (s) => time >= s.start && time < s.end,
  );
  function save(at: number) {
    return update((s) => ({ ...s, media: { ...s.media, [lesson.id]: at } }));
  }
  useEffect(
    () => () => {
      const media = player.current;
      media?.pause();
    },
    [],
  );
  function replay(index: number) {
    const media = player.current;
    if (!media) return;
    const seg = lesson.segments[index];
    media.currentTime = seg.start;
    repeatEnd.current = seg.end;
    media
      .play()
      .catch(() =>
        notice("Không thể phát media. Hãy thử nút phát trên trình phát."),
      );
  }
  const questions: Question[] =
    mode === "dictation"
      ? lesson.segments.map((s) => ({
          prompt:
            "Nghe câu rồi nhập lại đầy đủ (chạm nút phát lại câu trong transcript).",
          options: [],
          answer: s.en,
          explanation: `Câu gốc: ${s.en} — ${s.vi}`,
        }))
      : mode === "gap"
        ? lesson.segments.map((s) => {
            const word =
              s.en.split(" ").find((w) => w.length > 6) ?? s.en.split(" ")[2];
            return {
              prompt: s.en.replace(word, "_____"),
              options: [],
              answer: word.replace(/[.,!?]/g, ""),
              explanation: s.vi,
            };
          })
        : lesson.questions;
  const mediaProps = {
    src: source,
    controls: true,
    preload: "metadata" as const,
    onLoadedMetadata: () => {
      const el = player.current;
      if (el) {
        el.currentTime = Math.min(
          state.media[lesson.id] ?? 0,
          Math.max(0, el.duration - 0.1),
        );
        el.playbackRate = speed;
      }
    },
    onError: () =>
      setError(
        "Không tải được media. Kiểm tra các tệp trong public/media; bạn vẫn có thể học transcript và làm bài tập.",
      ),
    onTimeUpdate: () => {
      const el = player.current;
      if (!el) return;
      setTime(el.currentTime);
      if (repeatEnd.current !== null && el.currentTime >= repeatEnd.current) {
        el.pause();
        repeatEnd.current = null;
      }
      if (Math.abs(el.currentTime - lastSaved.current) >= 5) {
        lastSaved.current = el.currentTime;
        save(el.currentTime);
      }
    },
    onPause: () => {
      if (player.current) save(player.current.currentTime);
    },
    onEnded: () => {
      if (player.current) save(player.current.duration);
    },
  };
  return (
    <>
      <button className="text-button back-button" onClick={onBack}>
        <ArrowLeft size={17} /> Thư viện nghe & video
      </button>
      <div className="row between">
        <div className="row">
          <Badge>{lesson.level}</Badge>
          <span className="eyebrow">
            {lesson.type === "video" ? "VIDEO LESSON" : "ORIGINAL AUDIO"} ·{" "}
            {lesson.topic}
          </span>
        </div>
        <BookmarkButton id={lesson.id} />
      </div>
      <h1 className="lesson-heading">{lesson.title}</h1>
      <p className="muted">{lesson.description}</p>
      <div className="media-study-layout">
        <div>
          <div
            className={`media-player ${lesson.type === "audio" ? "audio-player" : ""}`}
          >
            {lesson.type === "audio" && (
              <div className="audio-cover">
                <Headphones size={56} />
                <span className="eyebrow">ENGLISHFLOW ORIGINALS</span>
                <h2>{lesson.title}</h2>
                <div className="audio-waves">
                  {Array.from({ length: 24 }, (_, i) => (
                    <i key={i} style={{ height: 12 + ((i * 17) % 45) }} />
                  ))}
                </div>
              </div>
            )}
            {lesson.type === "video" ? (
              <video
                ref={(el) => {
                  player.current = el;
                }}
                {...mediaProps}
                aria-label={lesson.title}
              />
            ) : (
              <audio
                ref={(el) => {
                  player.current = el;
                }}
                {...mediaProps}
                aria-label={lesson.title}
              />
            )}
          </div>
          {error && (
            <p role="alert" className="feedback bad">
              {error}
            </p>
          )}
          <div className="row between media-controls">
            <label className="inline-label">
              Tốc độ
              <select
                aria-label="Tốc độ phát"
                value={speed}
                onChange={(e) => {
                  setSpeed(Number(e.target.value));
                  if (player.current)
                    player.current.playbackRate = Number(e.target.value);
                }}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => {
                if (save(time)) notice("Đã lưu vị trí nghe.");
              }}
            >
              Lưu vị trí {Math.floor(time)}s
            </button>
          </div>
          {lesson.type === "video" && captions && (
            <div className="live-caption" aria-live="off">
              <p>
                {lesson.segments[active]?.en ??
                  "Bật video để xem phụ đề theo thời gian."}
              </p>
              {translation && <small>{lesson.segments[active]?.vi}</small>}
            </div>
          )}
          <p className="hint">
            Bài mẫu do EnglishFlow biên soạn · Giọng tổng hợp trên thiết bị ·
            Video minh họa gốc. Shadowing là tự luyện; ứng dụng không ghi âm
            hoặc chấm giọng nói.
          </p>
        </div>
        <div className="transcript-panel panel">
          <div className="row between">
            <h3>Transcript</h3>
            <button
              className="icon-button"
              aria-label={
                translation ? "Ẩn dịch transcript" : "Hiện dịch transcript"
              }
              aria-pressed={translation}
              onClick={() => setTranslation(!translation)}
            >
              <Languages size={19} />
            </button>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={captions}
              onChange={(e) => setCaptions(e.target.checked)}
            />{" "}
            Hiện transcript / phụ đề
          </label>
          {captions &&
            lesson.segments.map((s, i) => (
              <div
                key={s.start}
                className={`transcript-line ${active === i ? "active" : ""}`}
              >
                <div className="row between">
                  <button className="timestamp" onClick={() => replay(i)}>
                    <Play size={12} />
                    {`0:${String(s.start).padStart(2, "0")}`}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Phát lại câu ${i + 1}`}
                    onClick={() => replay(i)}
                  >
                    <Repeat2 size={15} />
                  </button>
                </div>
                <p>
                  <TextLookup text={s.en} onLookup={onLookup} />
                </p>
                {translation && <small>{s.vi}</small>}
              </div>
            ))}
        </div>
      </div>
      <div className="section-title">
        <h2>Nghe chủ động</h2>
        <Badge>{lesson.segments.length} câu ngắn</Badge>
      </div>
      <div className="chips topicbar">
        {(
          [
            { id: "comprehension", label: "Đọc hiểu" },
            { id: "dictation", label: "Chép chính tả" },
            { id: "gap", label: "Điền từ" },
            { id: "shadowing", label: "Nói theo" },
          ] as const
        ).map((m) => (
          <button
            className={mode === m.id ? "active" : ""}
            key={m.id}
            onClick={() => {
              setMode(m.id);
              setQuiz(false);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === "shadowing" ? (
        <div className="panel">
          <h3>Nghe và nói theo từng câu</h3>
          <p>
            Phát một câu, lắng nghe trọng âm rồi nhắc lại thành tiếng. Không cần
            bật microphone.
          </p>
          <button
            className="button"
            onClick={() => replay(active >= 0 ? active : 0)}
          >
            <Repeat2 size={17} /> Nghe lại câu hiện tại
          </button>
        </div>
      ) : quiz ? (
        <Quiz
          key={mode}
          questions={questions}
          target={`${lesson.id}:${mode}`}
          kind="listening"
          mode={mode === "comprehension" ? "choice" : "typed"}
        />
      ) : (
        <div className="panel exercise-intro">
          <div>
            <h3>
              {mode === "dictation"
                ? "Bạn nghe được những gì?"
                : mode === "gap"
                  ? "Điền từ còn thiếu"
                  : "Nắm ý chính của bài nghe"}
            </h3>
            <p>
              {mode === "dictation"
                ? "Phát lại câu tương ứng trong transcript rồi nhập câu tiếng Anh."
                : "Kiểm tra ngay và xem giải thích cho từng câu."}
            </p>
          </div>
          <button className="button" onClick={() => setQuiz(true)}>
            Bắt đầu luyện tập <Play size={16} />
          </button>
        </div>
      )}
      <ContentCredits ids={lesson.credits} />
    </>
  );
}
