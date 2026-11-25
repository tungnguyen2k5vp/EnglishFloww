import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./store";
import "./web-fonts.css";
import "./styles.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("EnglishFlow UI error", error);
  }
  render() {
    return this.state.failed ? (
      <main className="empty">
        <h1>Không thể mở trang học này</h1>
        <p>Dữ liệu đã lưu vẫn ở trong trình duyệt. Hãy tải lại để thử tiếp.</p>
        <button className="button" onClick={() => location.reload()}>
          Tải lại ứng dụng
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker
    .register("/sw.js")
    .catch((error) => console.warn("Offline shell unavailable", error));
