import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppState } from "./model";
import { initialState, STORAGE_KEY, validateState, event } from "./domain";

type Store = {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => boolean;
  notice: (message: string) => void;
};
const Context = createContext<Store>(null!);
const readStored = () => window.EnglishFlowDevice?.readState?.() || localStorage.getItem(STORAGE_KEY);
export const useStore = () => useContext(Context);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [startupError, setStartupError] = useState("");
  const [state, setState] = useState<AppState>(() => {
    try {
      const raw = readStored();
      return raw ? validateState(JSON.parse(raw)) : initialState();
    } catch {
      return initialState();
    }
  });
  const current = useRef(state);
  const blocked = useRef(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const audioError = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.state === "error" && typeof detail.message === "string") setMessage(detail.message); };
    window.addEventListener("ef-audio", audioError);
    return () => window.removeEventListener("ef-audio", audioError);
  }, []);
  useEffect(() => {
    try {
      const raw = readStored();
      if (raw) validateState(JSON.parse(raw));
    } catch {
      blocked.current = true;
      setStartupError(
        "Dữ liệu lưu trên thiết bị bị lỗi hoặc bộ nhớ không truy cập được. Bản gốc được giữ nguyên; hãy tải bản gốc để khôi phục trước khi bắt đầu lại.",
      );
    }
  }, []);
  function update(fn: (s: AppState) => AppState) {
    if (blocked.current) {
      setMessage(
        "Đang bảo vệ dữ liệu cũ. Hãy xử lý thông báo khôi phục trước.",
      );
      return false;
    }
    try {
      const next = fn(current.current);
      const json = JSON.stringify(next);
      if (window.EnglishFlowDevice?.saveState) {
        if (!window.EnglishFlowDevice.saveState(json)) throw Error("Android chưa lưu được dữ liệu");
        try { localStorage.setItem(STORAGE_KEY, json); } catch { /* Android is authoritative; the WebView copy is only a cache. */ }
      } else localStorage.setItem(STORAGE_KEY, json);
      current.current = next;
      setState(next);
      return true;
    } catch (error) {
      setMessage(
        `Không thể lưu thay đổi: ${error instanceof Error ? error.message : "Bộ nhớ đã đầy"}. Hãy xuất dữ liệu và kiểm tra dung lượng.`,
      );
      return false;
    }
  }
  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const seconds = Math.min(15, Math.floor((now - last) / 1000));
      last = now;
      if (document.visibilityState === "visible" && seconds > 0)
        updateRef.current((s) => ({
          ...s,
          events: [...s.events, event("time", "study", { seconds })],
        }));
    };
    const visibility = () => {
      last = Date.now();
    };
    const id = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", visibility);
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const next = validateState(JSON.parse(e.newValue));
          current.current = next;
          setState(next);
        } catch {
          setMessage(
            "Một thẻ khác đã lưu dữ liệu không hợp lệ. Hãy tải lại để khôi phục.",
          );
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = state.profile.theme;
  }, [state.profile.theme]);
  useEffect(() => {
    if (message) {
      const id = setTimeout(() => setMessage(""), 6000);
      return () => clearTimeout(id);
    }
  }, [message]);
  return (
    <Context.Provider value={{ state, update, notice: setMessage }}>
      {startupError && (
        <div className="recovery" role="alert">
          <p>{startupError}</p>
          <button
            onClick={() => {
              try {
                download(
                  "englishflow-recovery.txt",
                  readStored() ?? "",
                );
              } catch {
                setMessage("Không đọc được bộ nhớ trình duyệt.");
              }
            }}
          >
            Tải bản gốc
          </button>
          <button
            onClick={() => {
              try {
                if (window.EnglishFlowDevice?.saveState && !window.EnglishFlowDevice.saveState(JSON.stringify(initialState()))) throw Error("Android chưa lưu được dữ liệu");
                localStorage.removeItem(STORAGE_KEY);
                blocked.current = false;
                setStartupError("");
              } catch {
                setMessage("Trình duyệt không cho phép truy cập bộ nhớ.");
              }
            }}
          >
            Bắt đầu lại trên thiết bị
          </button>
        </div>
      )}
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
          <button aria-label="Đóng thông báo" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function download(name: string, text: string) {
  if (window.EnglishFlowDevice) {
    if (!window.EnglishFlowDevice.download(name, text))
      throw new Error("Không thể xuất tệp này. Hãy kiểm tra tên và dung lượng dữ liệu.");
    return;
  }
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
