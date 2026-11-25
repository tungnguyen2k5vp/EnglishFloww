import { useEffect, useState } from "react";
import {
  BarChart3,
  BookA,
  BookOpen,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  Headphones,
  House,
  Layers,
  Leaf,
  Menu,
  RotateCcw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { Dashboard, Progress, type Navigate, type Page } from "./Dashboard";
import { Dictionary } from "./Dictionary";
import { LookupDialog } from "./components";
import { Vocabulary, Review } from "./Vocabulary";
import { Reading } from "./Reading";
import { Media } from "./Media";
import { Practice } from "./Practice";
import { Settings } from "./Settings";
import { statistics } from "./domain";
import { useStore } from "./store";

const nav = [
  { id: "home", label: "Hôm nay", Icon: House },
  { id: "dictionary", label: "Từ điển", Icon: BookA },
  { id: "vocabulary", label: "Từ vựng", Icon: Layers },
  { id: "reading", label: "Đọc song ngữ", Icon: BookOpen },
  { id: "listening", label: "Nghe & Video", Icon: Headphones },
  { id: "practice", label: "Luyện tập", Icon: GraduationCap },
  { id: "progress", label: "Tiến độ học tập", Icon: BarChart3 },
] as const;
function route() {
  const [candidate, id] = location.hash.slice(1).split("/");
  const page = [...nav.map((n) => n.id), "settings", "review"].includes(
    candidate as Page,
  )
    ? (candidate as Page)
    : "home";
  let decoded: string | null = null;
  try {
    decoded = id ? decodeURIComponent(id) : null;
  } catch {
    /* Invalid route parameters fall back to the library. */
  }
  return { page, id: decoded };
}
export default function App() {
  const { state, update } = useStore();
  const [current, setCurrent] = useState(route);
  const [menu, setMenu] = useState(false);
  const [lookup, setLookup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [help, setHelp] = useState(false);
  const stats = statistics(state);
  useEffect(() => {
    const listener = () => {
      setCurrent(route());
      setMenu(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    document.title = `${nav.find((n) => n.id === current.page)?.label ?? (current.page === "review" ? "Ôn tập" : "Cài đặt")} · EnglishFlow`;
  }, [current.page]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement | null;
    document.querySelector<HTMLElement>(".sidebar nav a")?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      previous?.focus();
    };
  }, [menu]);
  const navigate: Navigate = (page, id) => {
    location.hash = page + (id ? "/" + encodeURIComponent(id) : "");
    setMenu(false);
  };
  function onLookup(term: string) {
    setLookup(term.slice(0, 100));
    update((s) => ({
      ...s,
      searches: [term, ...s.searches.filter((w) => w !== term)].slice(0, 8),
    }));
  }
  return (
    <div className="app-shell">
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Đến nội dung chính
      </a>
      {menu && (
        <button
          className="nav-scrim"
          aria-label="Đóng menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <a className="brand" href="#home">
          <span className="brand-icon">
            <BookOpen size={23} />
          </span>
          <span>
            english<span>flow</span>
            <small>MAKE ENGLISH YOUR EVERYDAY</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Đóng điều hướng"
          onClick={() => setMenu(false)}
        >
          <X size={22} />
        </button>
        <span className="nav-label">KHÔNG GIAN HỌC TẬP</span>
        <nav aria-label="Điều hướng chính">
          {nav.map(({ id, label, Icon }) => (
            <a
              href={`#${id}`}
              key={id}
              aria-current={current.page === id ? "page" : undefined}
              className={current.page === id ? "active" : ""}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "vocabulary" && Object.keys(state.saved).length > 0 && (
                <small>{Object.keys(state.saved).length}</small>
              )}
              {id === current.page && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-art">
              <Leaf size={29} />
              <i>✧</i>
            </span>
            <h3>
              Little by little,
              <br />a little becomes a lot.
            </h3>
            <p>
              15 phút hôm nay,
              <br />
              tự tin hơn ngày mai.
            </p>
            <button onClick={() => navigate("review")} className="text-button">
              Giữ nhịp học của bạn <ChevronRight size={15} />
            </button>
          </div>
          <a
            href="#settings"
            className={`settings-link ${current.page === "settings" ? "active" : ""}`}
          >
            <Settings2 size={18} /> Cài đặt & dữ liệu
          </a>
          <button className="profile-link" onClick={() => navigate("settings")}>
            <span className="avatar">
              {state.profile.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{state.profile.name}</strong>
              <small>Hồ sơ trên thiết bị · {state.profile.level}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        </div>
        <span className="sidebar-footer">
          ENGLISHFLOW · LEARN WITH CURIOSITY
        </span>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="row">
            <button
              className="mobile-menu icon-button"
              aria-label="Mở menu điều hướng"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu size={23} />
            </button>
            <span className="breadcrumb">
              Không gian học tập <ChevronRight size={14} />
              <strong>
                {nav.find((n) => n.id === current.page)?.label ??
                  (current.page === "review" ? "Ôn tập" : "Cài đặt")}
              </strong>
            </span>
          </div>
          <div className="topbar-actions">
            <form
              className="top-search"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) onLookup(query.trim());
              }}
            >
              <Search size={16} />
              <input
                aria-label="Tra từ nhanh"
                placeholder="Tra nhanh một từ…"
                value={query}
                maxLength={100}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <button
              className="streak-chip"
              onClick={() => navigate("progress")}
              aria-label={`${stats.streak} ngày học liên tiếp`}
            >
              <span>♨</span>
              {stats.streak}
              <small>ngày</small>
            </button>
            <button
              className="icon-button help-button"
              aria-label="Hướng dẫn sử dụng"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={20} />
            </button>
            <button
              className="avatar"
              aria-label="Hồ sơ của bạn"
              onClick={() => navigate("settings")}
            >
              {state.profile.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className={
            current.page === "home"
              ? "main-content home-content"
              : "main-content"
          }
        >
          {current.page === "home" && (
            <Dashboard navigate={navigate} onLookup={onLookup} />
          )}
          {current.page === "dictionary" && <Dictionary />}
          {current.page === "vocabulary" && (
            <Vocabulary
              onLookup={onLookup}
              onReview={() => navigate("review")}
            />
          )}
          {current.page === "review" && (
            <Review
              onLookup={onLookup}
              onVocabulary={() => navigate("vocabulary")}
            />
          )}
          {current.page === "reading" && (
            <Reading
              activeId={current.id}
              onOpen={(id) => navigate("reading", id ?? undefined)}
              onLookup={onLookup}
            />
          )}
          {current.page === "listening" && (
            <Media
              activeId={current.id}
              onOpen={(id) => navigate("listening", id ?? undefined)}
              onLookup={onLookup}
            />
          )}
          {current.page === "practice" && (
            <Practice
              onLookup={onLookup}
              activeId={current.id}
              onOpen={(id) => navigate("practice", id ?? undefined)}
            />
          )}
          {current.page === "progress" && <Progress navigate={navigate} />}
          {current.page === "settings" && <Settings />}
          <footer className="main-footer">
            <span>Made for curious minds.</span>
            <span>EnglishFlow · <a href="/mobile.html#sources">Nguồn và giấy phép</a> · <a href="/mobile.html#writing">Luyện viết</a></span>
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom" aria-label="Điều hướng nhanh">
        {[nav[0], nav[2], nav[3], nav[4]].map(({ id, label, Icon }) => (
          <a
            href={`#${id}`}
            key={id}
            aria-current={current.page === id ? "page" : undefined}
            className={current.page === id ? "active" : ""}
          >
            <Icon size={20} />
            <span>
              {label === "Đọc song ngữ"
                ? "Đọc"
                : label === "Nghe & Video"
                  ? "Nghe"
                  : label}
            </span>
          </a>
        ))}
        <button aria-label="Mở tất cả mục" onClick={() => setMenu(true)}>
          <Menu size={21} />
          <span>Thêm</span>
        </button>
      </nav>
      {lookup && (
        <LookupDialog
          term={lookup}
          onLookup={onLookup}
          onClose={() => setLookup(null)}
        />
      )}
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
function Help({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const el = document.querySelector<HTMLDialogElement>("#help-dialog");
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      id="help-dialog"
      className="lookup-dialog help-dialog"
      onCancel={onClose}
    >
      <button
        className="dialog-close icon-button"
        aria-label="Đóng hướng dẫn"
        onClick={onClose}
      >
        <X />
      </button>
      <span className="eyebrow">WELCOME TO ENGLISHFLOW</span>
      <h2>Một vòng học thật đơn giản</h2>
      <ol>
        <li>Mở bài đọc hoặc bài nghe bạn thích.</li>
        <li>Chạm từ gạch chân để xem nghĩa và lưu từ.</li>
        <li>Ôn những từ đến hạn, chọn mức độ nhớ thật của bạn.</li>
        <li>Làm bài tập và xem lại lỗi trong Tiến độ.</li>
      </ol>
      <p className="hint">
        Dữ liệu lưu trên thiết bị. Xuất bản sao lưu trong Cài đặt để giữ hành
        trình của bạn.
      </p>
      <button className="button" onClick={onClose}>
        <RotateCcw size={17} /> Bắt đầu khám phá
      </button>
    </dialog>
  );
}
