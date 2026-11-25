import React from "react";
import ReactDOM from "react-dom/client";
import MobileApp from "./MobileApp";
import { StoreProvider } from "./store";
import "./styles.css";
import "./mobile.css";
import "./mobile-details.css";

class Recovery extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="empty"><h1>Không mở được màn hình này</h1><p>Dữ liệu đã lưu vẫn được giữ trên thiết bị.</p><button className="button" onClick={() => { location.hash = "home"; location.reload(); }}>Mở lại ứng dụng</button></main> : this.props.children;
  }
}
document.documentElement.classList.add("mobile-app");
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><Recovery><StoreProvider><MobileApp /></StoreProvider></Recovery></React.StrictMode>,
);
if (import.meta.env.PROD && !window.EnglishFlowDevice && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(error => console.warn("Offline shell unavailable", error));
