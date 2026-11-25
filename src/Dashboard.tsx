import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Flame,
  Headphones,
  Leaf,
  RotateCcw,
  Target,
  TrendingUp,
} from "lucide-react";
import { articles, mediaLessons, words } from "./data";
import { Badge, Empty, LessonCard, Scene } from "./components";
import { dayKey, statistics } from "./domain";
import { useStore } from "./store";
export type Page =
  | "home"
  | "dictionary"
  | "vocabulary"
  | "review"
  | "reading"
  | "listening"
  | "practice"
  | "progress"
  | "settings";
export type Navigate = (page: Page, id?: string) => void;

export function Dashboard({
  navigate,
  onLookup,
}: {
  navigate: Navigate;
  onLookup: (s: string) => void;
}) {
  const { state } = useStore();
  const stats = statistics(state);
  const goal = Math.min(
    100,
    Math.round((stats.todaySeconds / (state.profile.goal * 60)) * 100),
  );
  const lastReading = Object.keys(state.reading).at(-1);
  const recommended =
    articles.find((a) => a.id === lastReading) ??
    articles.find((a) => a.level === state.profile.level) ??
    articles[0];
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    return date;
  });
  const activeDays = new Set(state.events.map((e) => dayKey(e.at)));
  const dailyWord = words[new Date().getDate() % words.length];
  return (
    <div className="dashboard-layout">
      <div className="dashboard-main">
        <div className="page-heading dashboard-greeting">
          <div>
            <span className="eyebrow">A LITTLE ENGLISH, EVERY DAY</span>
            <h1>
              Chào {state.profile.name}, học một chút nhé
              <span className="heading-dot">.</span>
            </h1>
            <p>Mỗi ngày một bước nhỏ. Cả hành trình thật xa.</p>
          </div>
          <span className="date-chip">
            {new Date().toLocaleDateString("vi-VN", {
              day: "numeric",
              month: "long",
            })}
          </span>
        </div>
        <section className="hero">
          <Scene kind="garden" />
          <div className="hero-content">
            <span className="eyebrow">
              <span className="tiny-line" /> YOUR DAILY DOSE OF ENGLISH
            </span>
            <h2>
              Mở một trang mới.
              <br />
              Khám phá một thế giới mới.
            </h2>
            <p>
              Học tiếng Anh từ những điều bạn yêu thích.
              <br />
              Bắt đầu bằng một câu chuyện hôm nay.
            </p>
            <button
              className="button"
              onClick={() => navigate("reading", recommended.id)}
            >
              Bắt đầu đọc <ArrowRight size={18} />
            </button>
            <span className="hero-footnote">
              <BookOpen size={14} /> Bài đọc song ngữ · Tra từ tức thì
            </span>
          </div>
          <span className="hero-number">01 / EVERYDAY DISCOVERIES</span>
        </section>
        <div className="quick-stats">
          <div>
            <span className="stat-icon peach">
              <Flame size={21} />
            </span>
            <div>
              <strong>
                {stats.streak}
                <small> ngày</small>
              </strong>
              <span>Chuỗi học liên tục</span>
            </div>
          </div>
          <div>
            <span className="stat-icon sage">
              <BookOpen size={21} />
            </span>
            <div>
              <strong>
                {stats.learned}
                <small> từ</small>
              </strong>
              <span>Từ đã ôn thành công</span>
            </div>
          </div>
          <div>
            <span className="stat-icon lavender">
              <Clock3 size={21} />
            </span>
            <div>
              <strong>
                {Math.floor(stats.seconds / 60)}
                <small> phút</small>
              </strong>
              <span>Thời gian học</span>
            </div>
          </div>
        </div>
        <div className="section-title">
          <div>
            <span className="eyebrow">KEEP THE MOMENTUM</span>
            <h2>Tiếp tục hành trình</h2>
          </div>
          <button className="text-button" onClick={() => navigate("progress")}>
            Xem tiến độ <ArrowRight size={16} />
          </button>
        </div>
        <div className="continue-card">
          <div className="continue-art">
            <Scene kind={recommended.scene} />
            <BookOpen size={22} />
          </div>
          <div>
            <div className="row">
              <Badge>{recommended.level}</Badge>
              <span className="small muted">
                {lastReading
                  ? "Đọc tiếp từ vị trí đã lưu"
                  : "Gợi ý theo trình độ của bạn"}
              </span>
            </div>
            <h3>{recommended.title}</h3>
            <p>{recommended.subtitle}</p>
          </div>
          <button
            className="circle-button"
            aria-label={`Đọc ${recommended.title}`}
            onClick={() => navigate("reading", recommended.id)}
          >
            <ArrowRight size={21} />
          </button>
        </div>
        <div className="section-title recommendations">
          <div>
            <span className="eyebrow">PICK YOUR NEXT DISCOVERY</span>
            <h2>Dành cho hôm nay</h2>
          </div>
          <button className="text-button" onClick={() => navigate("reading")}>
            Khám phá thêm <ArrowRight size={16} />
          </button>
        </div>
        <div className="recommendation-grid">
          <LessonCard
            title={articles[0].title}
            subtitle={articles[0].subtitle}
            level={articles[0].level}
            topic="LIFESTYLE · READING"
            scene={articles[0].scene}
            meta="3 phút"
            onOpen={() => navigate("reading", articles[0].id)}
            id={articles[0].id}
          />
          <LessonCard
            title={mediaLessons[0].title}
            subtitle={mediaLessons[0].description}
            level={mediaLessons[0].level}
            topic="DAILY LIFE · LISTENING"
            scene="desk"
            meta={mediaLessons[0].duration}
            onOpen={() => navigate("listening", mediaLessons[0].id)}
            id={mediaLessons[0].id}
            media
          />
        </div>
        <PersonalShelf navigate={navigate} onLookup={onLookup} />
        <div className="bottom-invitation">
          <Leaf size={22} />
          <span>Không cần học thật nhiều. Chỉ cần trở lại mỗi ngày.</span>
          <button className="text-button" onClick={() => navigate("settings")}>
            Đặt mục tiêu của bạn <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <aside className="daily-sidebar">
        <section className="panel goal-card">
          <div className="row between">
            <h3>Mục tiêu hôm nay</h3>
            <Target size={19} />
          </div>
          <div
            className="goal-ring"
            style={{
              background: `conic-gradient(var(--green) ${goal}%,var(--line) 0)`,
            }}
          >
            <div>
              <strong>
                {Math.floor(stats.todaySeconds / 60)}
                <span> / {state.profile.goal}</span>
              </strong>
              <small>phút học</small>
            </div>
          </div>
          <h4>
            {goal >= 100
              ? "Bạn đã đạt mục tiêu!"
              : "Dành một chút thời gian cho bạn"}
          </h4>
          <p>
            {goal >= 100
              ? "Giữ nhịp này vào ngày mai nhé."
              : `Còn ${Math.max(0, state.profile.goal - Math.floor(stats.todaySeconds / 60))} phút để hoàn thành mục tiêu.`}
          </p>
          <button className="text-button" onClick={() => navigate("settings")}>
            Điều chỉnh mục tiêu <ArrowRight size={14} />
          </button>
        </section>
        <section className="review-reminder">
          <span className="review-reminder-icon">
            <RotateCcw size={24} />
          </span>
          <div className="row between">
            <h3>Đến giờ ôn tập</h3>
            <span className="due-number">{stats.due}</span>
          </div>
          <p>
            {stats.due
              ? `${stats.due} từ đang chờ bạn gặp lại.`
              : "Lưu những từ đầu tiên để bắt đầu."}
            <br />
            Ôn một chút, nhớ dài lâu.
          </p>
          <button
            className="button full"
            onClick={() => navigate(stats.due ? "review" : "vocabulary")}
          >
            {stats.due ? "Ôn tập ngay" : "Khám phá bộ từ"}{" "}
            <ArrowRight size={17} />
          </button>
        </section>
        <section className="panel weekly-card">
          <div className="row between">
            <h3>Nhịp học của bạn</h3>
            <TrendingUp size={18} />
          </div>
          <div className="week-days">
            {dates.map((d, i) => (
              <div key={i}>
                <span>
                  {["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()]}
                </span>
                <span
                  className={`day-circle ${activeDays.has(dayKey(d.getTime())) ? "done" : ""} ${i === 6 ? "today" : ""}`}
                >
                  {activeDays.has(dayKey(d.getTime())) ? (
                    <Check size={14} />
                  ) : (
                    d.getDate()
                  )}
                </span>
              </div>
            ))}
          </div>
          <p>
            <span className="tiny-green-dot" />
            {dates.filter((d) => activeDays.has(dayKey(d.getTime()))).length} /
            7 ngày đã học trong tuần qua
          </p>
        </section>
        <section className="word-of-day">
          <span className="eyebrow">A WORD TO TAKE WITH YOU</span>
          <div className="row between">
            <h2>{dailyWord.term}</h2>
            <span className="sparkle">✧</span>
          </div>
          <span className="muted small">
            {dailyWord.ipa} · {dailyWord.pos}
          </span>
          <p>{dailyWord.meaning}</p>
          <button
            className="text-button"
            onClick={() => onLookup(dailyWord.term)}
          >
            Khám phá từ này <ArrowRight size={15} />
          </button>
        </section>
        <div className="local-note">
          <span className="tiny-green-dot" /> Dữ liệu của bạn được lưu trên
          thiết bị.
        </div>
      </aside>
    </div>
  );
}

function PersonalShelf({
  navigate,
  onLookup,
}: {
  navigate: Navigate;
  onLookup: (s: string) => void;
}) {
  const { state } = useStore();
  const bookmarked = [...articles, ...mediaLessons].filter((l) =>
    state.bookmarks.includes(l.id),
  );
  const recent = state.events
    .filter((e) => e.kind !== "time")
    .slice(-3)
    .reverse();
  if (!bookmarked.length && !recent.length) return null;
  return (
    <section className="personal-shelf">
      <div className="section-title">
        <h2>Góc học gần đây</h2>
        <button className="text-button" onClick={() => navigate("progress")}>
          Lịch sử <ArrowRight size={15} />
        </button>
      </div>
      {bookmarked.length > 0 && (
        <div className="saved-content">
          <span className="eyebrow">ĐÃ ĐÁNH DẤU</span>
          {bookmarked.map((l) => (
            <button
              className="shelf-row"
              key={l.id}
              onClick={() =>
                navigate(
                  articles.some((a) => a.id === l.id) ? "reading" : "listening",
                  l.id,
                )
              }
            >
              <BookOpen size={16} />
              <span>{l.title}</span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      )}
      {recent.map((e) => (
        <button
          className="shelf-row"
          key={e.id}
          onClick={() => {
            if (e.kind === "review") onLookup(e.target);
            else
              navigate(
                e.kind === "reading"
                  ? "reading"
                  : e.kind === "listening"
                    ? "listening"
                    : "practice",
                e.kind === "practice" ? undefined : e.target.split(":")[0],
              );
          }}
        >
          <Clock3 size={16} />
          <span>
            {e.kind === "review"
              ? "Ôn từ: "
              : e.kind === "grammar"
                ? "Ngữ pháp: "
                : e.kind === "practice"
                  ? "Luyện tập: "
                  : ""}
            {[...articles, ...mediaLessons].find(
              (l) => l.id === e.target.split(":")[0],
            )?.title ?? e.target.replaceAll("-", " ")}
          </span>
          <small>{new Date(e.at).toLocaleDateString("vi-VN")}</small>
        </button>
      ))}
    </section>
  );
}

export function Progress({ navigate }: { navigate: Navigate }) {
  const { state } = useStore();
  const stats = statistics(state);
  const sessions = state.events
    .filter((e) => e.kind !== "time")
    .slice()
    .reverse();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    const seconds = state.events
      .filter(
        (e) => e.kind === "time" && dayKey(e.at) === dayKey(date.getTime()),
      )
      .reduce((n, e) => n + (e.seconds ?? 0), 0);
    return { date, seconds };
  });
  const max = Math.max(60, ...days.map((d) => d.seconds));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOOK HOW FAR YOU’VE COME</span>
          <h1>
            Mỗi bước đều đáng kể<span className="heading-dot">.</span>
          </h1>
          <p>Tiến độ thực tế, từ những lần bạn đã luyện tập.</p>
        </div>
      </div>
      <div className="metric-grid">
        {[
          {
            label: "Từ đã ôn thành công",
            value: stats.learned,
            Icon: BookOpen,
          },
          {
            label: "Chính xác khi ôn",
            value: `${stats.accuracy}%`,
            Icon: Target,
          },
          { label: "Ngày liên tiếp", value: stats.streak, Icon: Flame },
          { label: "Bài đã luyện tập", value: stats.completed, Icon: Check },
        ].map((m) => (
          <div className="panel metric" key={m.label}>
            <m.Icon size={21} />
            <strong>{m.value}</strong>
            <span>{m.label}</span>
          </div>
        ))}
      </div>
      <div className="progress-grid">
        <section className="panel">
          <div className="section-title">
            <h2>7 ngày gần nhất</h2>
            <span className="small muted">
              Phút học · {Math.floor(stats.seconds / 60)} phút tổng
            </span>
          </div>
          <div className="activity-chart">
            {days.map((d) => (
              <div key={d.date.toISOString()}>
                <span>{Math.floor(d.seconds / 60)}</span>
                <div className="bar-track">
                  <div style={{ height: `${(d.seconds / max) * 100}%` }} />
                </div>
                <small>
                  {d.date.getDate()}/{d.date.getMonth() + 1}
                </small>
              </div>
            ))}
          </div>
          <p className="hint">
            Đếm thời gian khi thẻ ứng dụng đang hiển thị, theo khoảng 15 giây.
            Lịch theo múi giờ thiết bị.
          </p>
        </section>
        <section className="panel skill-progress">
          <h2>Luyện tập theo kỹ năng</h2>
          {[
            { kind: "review", label: "Từ vựng", Icon: BookOpen },
            { kind: "reading", label: "Đọc hiểu", Icon: BookOpen },
            { kind: "listening", label: "Nghe", Icon: Headphones },
            { kind: "grammar", label: "Ngữ pháp", Icon: Target },
          ].map((k) => (
            <div key={k.kind}>
              <span className="row">
                <k.Icon size={17} />
                {k.label}
              </span>
              <strong>
                {state.events.filter((e) => e.kind === k.kind).length} lượt
              </strong>
            </div>
          ))}
          <button
            className="button secondary full"
            onClick={() => navigate("review")}
          >
            {stats.due} từ đến hạn <ArrowRight size={16} />
          </button>
        </section>
      </div>
      <div className="section-title">
        <h2>Lịch sử học tập</h2>
        <span className="muted small">
          {sessions.length} lượt · 20 lượt gần nhất
        </span>
      </div>
      {sessions.length ? (
        <div className="history-list panel">
          {sessions.slice(0, 20).map((e) => (
            <div className="history-row" key={e.id}>
              <span className="history-icon">
                {e.kind === "review" ? (
                  <RotateCcw size={18} />
                ) : (
                  <BookOpen size={18} />
                )}
              </span>
              <div>
                <strong>
                  {[...articles, ...mediaLessons].find((a) => a.id === e.target)
                    ?.title ??
                    (e.kind === "review"
                      ? "Ôn từ: " + e.target
                      : e.kind === "grammar"
                        ? "Ngữ pháp: " + e.target
                        : "Luyện tập: " + e.target)}
                </strong>
                <span>
                  {new Date(e.at).toLocaleString("vi-VN")}
                  {e.mistakes?.length
                    ? " · " + e.mistakes.length + " câu cần ôn lại"
                    : ""}
                </span>
                {!!e.mistakes?.length && (
                  <details>
                    <summary>Xem lỗi cần ôn</summary>
                    {e.mistakes.map((m, i) => (
                      <p key={i}>{m}</p>
                    ))}
                  </details>
                )}
              </div>
              <Badge>
                {e.kind === "review"
                  ? e.correct
                    ? "Đã nhớ"
                    : "Cần ôn"
                  : e.score + "/" + e.total}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Trang đầu tiên của hành trình">
          Hoàn thành một bài học hoặc ôn một từ để nhìn thấy tiến độ của bạn.
        </Empty>
      )}
      <p className="hint">
        “Từ đã ôn thành công” là số từ có lần ôn đạt gần nhất; không phải đánh
        giá khả năng thành thạo. Bài đã luyện tập được tính cả lần làm còn sai.
      </p>
    </>
  );
}
