import { useState } from "react";
import {
  Check,
  Download,
  Monitor,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { initialState, validateState } from "./domain";
import { download, useStore } from "./store";
import type { AppState } from "./model";

export function Settings() {
  const { state, update, notice } = useStore();
  const [name, setName] = useState(state.profile.name);
  const [goal, setGoal] = useState(state.profile.goal);
  const [level, setLevel] = useState(state.profile.level);
  const [theme, setTheme] = useState(state.profile.theme);
  const [deleting, setDeleting] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [pending, setPending] = useState<AppState | null>(null);
  function restore(file?: File) {
    if (!file) return;
    if (file.size > 10_000_000) {
      notice("Bản sao lưu tối đa 10 MB.");
      return;
    }
    file
      .text()
      .then((text) => setPending(validateState(JSON.parse(text))))
      .catch((e) => notice(e.message));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR YOUR OWN PACE</span>
          <h1>
            Góc học của bạn<span className="heading-dot">.</span>
          </h1>
          <p>Một mục tiêu vừa sức. Một thói quen lâu dài.</p>
        </div>
      </div>
      <div className="settings-grid">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !name.trim() ||
              !Number.isInteger(goal) ||
              goal < 5 ||
              goal > 120
            ) {
              notice("Nhập tên và mục tiêu từ 5 đến 120 phút.");
              return;
            }
            if (
              update((s) => ({
                ...s,
                profile: { name: name.trim(), goal, level, theme },
              }))
            )
              notice("Đã lưu sở thích học tập.");
          }}
        >
          <div className="section-title">
            <h2>Hồ sơ học tập</h2>
            <Monitor size={21} />
          </div>
          <label className="field">
            Tên hiển thị
            <input
              value={name}
              required
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            Mục tiêu mỗi ngày (phút)
            <input
              type="number"
              min={5}
              max={120}
              step={1}
              value={goal}
              required
              onChange={(e) => setGoal(Number(e.target.value))}
            />
          </label>
          <label className="field">
            Trình độ ưu tiên
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
            >
              <option value="A2">A2 · Sơ cấp</option>
              <option value="B1">B1 · Trung cấp</option>
              <option value="B2">B2 · Trên trung cấp</option>
            </select>
          </label>
          <label className="field">
            Giao diện
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as typeof theme)}
            >
              <option value="light">Sáng · Garden</option>
              <option value="dark">Tối · Forest</option>
            </select>
          </label>
          <label className="field">
            Ngôn ngữ giao diện
            <input readOnly value="Tiếng Việt · Nội dung học tiếng Anh" />
          </label>
          <button type="submit" className="button">
            <Check size={17} /> Lưu thay đổi
          </button>
        </form>
        <div className="settings-stack">
          <section className="panel">
            <div className="section-title">
              <h2>Dữ liệu của bạn</h2>
              <ShieldCheck size={21} />
            </div>
            <p>
              Đây là bản học cục bộ trên một thiết bị, không có tài khoản hoặc
              đăng nhập máy chủ. Dữ liệu được lưu trong trình duyệt hiện tại;
              hãy sao lưu trước khi xóa bộ nhớ.
            </p>
            <div className="stacked-actions">
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    "englishflow-backup.json",
                    JSON.stringify(state, null, 2),
                  )
                }
              >
                <Download size={17} /> Xuất toàn bộ dữ liệu
              </button>
              <label className="button secondary file-button">
                <Upload size={17} /> Khôi phục từ bản sao lưu
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    restore(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {pending && (
              <div className="feedback">
                <h3>Khôi phục bản sao lưu?</h3>
                <p>
                  {Object.keys(pending.saved).length} từ đã lưu ·{" "}
                  {pending.events.length} sự kiện. Thao tác này sẽ thay thế dữ
                  liệu hiện tại. Xuất dữ liệu hiện tại trước nếu cần giữ lại.
                </p>
                <div className="row">
                  <button
                    className="button"
                    onClick={() => {
                      if (update(() => pending)) {
                        setName(pending.profile.name);
                        setGoal(pending.profile.goal);
                        setLevel(pending.profile.level);
                        setTheme(pending.profile.theme);
                        setPending(null);
                        notice("Đã khôi phục dữ liệu và hồ sơ học tập.");
                      }
                    }}
                  >
                    Thay thế bằng bản sao lưu
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => setPending(null)}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </section>
          <section className="panel ai-settings">
            <span className="eyebrow">OPTIONAL · AI TUTOR</span>
            <h3>Gia sư AI chưa được cấu hình</h3>
            <p>
              Chưa có máy chủ và thông tin nhà cung cấp. Bạn vẫn có thể sử dụng
              mọi bài học, từ điển và ôn tập. Không nhập API key vào ứng dụng
              này.
            </p>
          </section>
          <section className="panel danger-zone">
            <h3>Bắt đầu một hành trình mới</h3>
            <p>
              Xóa từ đã lưu, lịch sử, bộ từ cá nhân và tùy chỉnh trên trình
              duyệt này.
            </p>
            {deleting ? (
              <div>
                <label className="field">
                  Nhập XÓA để xác nhận
                  <input
                    aria-label="Xác nhận xóa"
                    value={deleteText}
                    onChange={(e) => setDeleteText(e.target.value)}
                  />
                </label>
                <div className="row">
                  <button
                    className="button danger"
                    disabled={deleteText !== "XÓA"}
                    onClick={() => {
                      if (update(initialState)) {
                        setName("Bạn");
                        setGoal(15);
                        setLevel("B1");
                        setTheme("light");
                        setDeleting(false);
                        setDeleteText("");
                        notice("Đã xóa dữ liệu học tập và tạo hồ sơ mới.");
                      }
                    }}
                  >
                    Xóa vĩnh viễn trên thiết bị
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => setDeleting(false)}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="text-button error-text"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={16} /> Xóa dữ liệu học tập
              </button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
