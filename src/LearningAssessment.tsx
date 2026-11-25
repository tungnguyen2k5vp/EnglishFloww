import { useEffect, useRef, useState } from "react";
import { Check, Download, Mic, RefreshCw, X } from "lucide-react";
import { assessWriting, loadSpellingWords, validPronunciationReport, type PronunciationReport, type WritingReport } from "./assessment";
import { download, useStore } from "./store";
import { device } from "./native";
import { event as studyEvent } from "./domain";
import { countWords } from "./learning-content";

export function WritingFeedback({ text, minimum, model, checked, onCheck, onChange }: { text: string; minimum: number; model: string; checked: boolean; onCheck: () => void; onChange: (text: string) => void }) {
  const [report, setReport] = useState<WritingReport | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setReport(null); setError(""); setBusy(checked);
    if (checked) loadSpellingWords().then(words => {
      if (!cancelled) setReport(assessWriting(text, minimum, words, model));
    }).catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : "Chưa chấm được bài. Hãy thử lại."); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [text, minimum, model, checked, retry]);
  function apply(index: number) {
    const issue = report?.issues[index];
    if (!issue || issue.replacement === undefined || text.slice(issue.start, issue.end) !== issue.original) return;
    onChange(text.slice(0, issue.start) + issue.replacement + text.slice(issue.end));
  }
  return <section className="assessment-panel writing-assessment"><h3>Chấm Writing tự động</h3><p>Chạy trên thiết bị, gồm chính tả, lỗi ngữ pháp thường gặp và các tiêu chí có thể đo. Bài viết không được gửi đi.</p><button className="button full" disabled={countWords(text) < 15 || busy} onClick={() => { if (!checked) onCheck(); else setRetry(r => r + 1); }}><RefreshCw size={18} />{busy ? "Đang kiểm tra bài…" : report ? "Chấm lại bài" : "Chấm bài tự động"}</button>{countWords(text) < 15 && <small>Viết ít nhất 15 từ để bắt đầu chấm.</small>}{error && <p role="alert" className="audio-error">{error}</p>}{report && <div className="writing-auto-result" role="status"><div className="assessment-score"><strong>{report.score}<small>/100</small></strong><span>Chỉ số luyện viết<br /><small>Trung bình bốn tiêu chí bên dưới</small></span></div><p className="phone-footnote">Đây là phản hồi theo quy tắc, chưa đánh giá đúng/sai của lập luận hay mức trả lời đủ đề; không quy đổi band IELTS.</p><div className="assessment-criteria">{report.criteria.map(c => <div key={c.label}><div className="row between"><strong>{c.label}</strong><b>{c.score}/100</b></div><progress aria-label={c.label} value={c.score} max={100} /><small>{c.detail}</small></div>)}</div>{report.warnings.map(w => <p className="assessment-warning" key={w}>{w}</p>)}<h4>{report.issues.length ? `${report.issues.length} vị trí cần xem lại` : "Chưa phát hiện lỗi trong phạm vi bộ kiểm tra"}</h4><div className="writing-issues">{report.issues.map((issue, index) => <article key={issue.start}><small>{issue.kind === "grammar" ? "Ngữ pháp" : issue.kind === "spelling" ? "Chính tả" : "Diễn đạt"} · Ký tự {issue.start + 1}</small><p><mark>{issue.original}</mark>{issue.replacement !== undefined && <> → <strong>{issue.replacement}</strong></>}</p><p>{issue.message}</p>{issue.replacement !== undefined && <button className="button secondary" onClick={() => apply(index)}><Check size={15} />Áp dụng gợi ý này</button>}</article>)}</div><p className="phone-footnote">Xem lại ngữ cảnh trước khi sửa, nhất là tên riêng và thuật ngữ. Áp dụng một gợi ý sẽ mở lại bản nháp; chấm lại để cập nhật kết quả.</p><button className="text-button" onClick={() => download("EnglishFlow-writing-feedback.txt", `CHỈ SỐ LUYỆN VIẾT: ${report.score}/100\nTheo quy tắc, không phải band IELTS.\n\n${report.criteria.map(c => `${c.label}: ${c.score}/100 — ${c.detail}`).join("\n")}\n\n${report.issues.map(i => `${i.original}${i.replacement ? " → " + i.replacement : ""}: ${i.message}`).join("\n")}\n\n${report.warnings.join("\n")}\n\nBÀI VIẾT\n${text}`)}><Download size={17} />Xuất phản hồi và bài viết</button></div>}</section>;
}

export function PronunciationFeedback({ reference, target, clip, ready }: { reference: string; target: string; clip: number; ready: boolean }) {
  const { state, update } = useStore();
  const [report, setReport] = useState<PronunciationReport | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(""), timer = useRef<ReturnType<typeof setTimeout>>();
  const updateRef = useRef(update); updateRef.current = update;
  const previous = state.events.filter(e => e.target === "pronunciation:" + target).at(-1);
  function cancel() { request.current = ""; clearTimeout(timer.current); device()?.cancelAssessment?.(); setBusy(false); }
  useEffect(() => {
    setReport(null); setError(""); setBusy(false);
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; result?: unknown; error?: string }>).detail;
      if (!detail || !request.current || detail.id !== request.current) return;
      request.current = ""; clearTimeout(timer.current); setBusy(false);
      if (typeof detail.error === "string") { setError(detail.error.slice(0, 400)); return; }
      if (!validPronunciationReport(detail.result)) { setError("Kết quả chấm chưa hợp lệ. Hãy ghi âm và thử lại."); return; }
      const result = detail.result; setReport(result);
      updateRef.current(s => ({ ...s, events: [...s.events, { ...studyEvent("practice", "pronunciation:" + target), score: result.score, total: 100, mistakes: result.words.filter(w => w.score < 60).map(w => w.word) }] }));
    };
    const hide = () => { if (document.hidden) cancel(); };
    const stopped = (event: Event) => { if ((event as CustomEvent).detail?.state === "stopped" && request.current) cancel(); };
    window.addEventListener("ef-assessment", receive); window.addEventListener("ef-audio", stopped); document.addEventListener("visibilitychange", hide);
    return () => { request.current = ""; clearTimeout(timer.current); device()?.cancelAssessment?.(); window.removeEventListener("ef-assessment", receive); window.removeEventListener("ef-audio", stopped); document.removeEventListener("visibilitychange", hide); };
  }, [reference, target, clip]);
  function assess() {
    if (!ready || busy || !device()?.assessPronunciation) return;
    device()?.stopAudio(); setError(""); setBusy(true); setReport(null);
    const id = crypto.randomUUID(); request.current = id;
    timer.current = setTimeout(() => { if (request.current === id) { cancel(); setError("Chấm quá lâu. Hãy đóng bớt ứng dụng, ghi một câu ngắn và thử lại."); } }, 60000);
    device()!.assessPronunciation!(reference, id);
  }
  return <section className="assessment-panel pronunciation-assessment"><h3><Mic size={19} />Chấm âm vị trên thiết bị</h3><p>Đọc theo câu gợi ý để so âm. Với câu trả lời tự do, hãy nghe lại bản ghi để tự đối chiếu nội dung.</p>{device()?.assessPronunciation ? <><button className="button full" disabled={!ready || busy} onClick={assess}>{busy ? "Đang phân tích âm thanh…" : "Chấm bản ghi vừa đọc"}</button>{busy && <><p role="status">Lần đầu cần mở mô hình. Hãy chờ; âm thanh vẫn ở trên máy.</p><button className="text-button" onClick={cancel}><X size={15} />Hủy lượt chấm</button></>}{!ready && !busy && <small>Ghi âm một câu từ 0,4 đến 15 giây rồi dừng để chấm.</small>}</> : <p>Chấm âm vị cục bộ có trong APK Android 1.7 trở lên. Bạn vẫn có thể ghi âm và nghe lại trên trình duyệt.</p>}{error && <p className="audio-error" role="alert">{error}</p>}{report ? <div className="pronunciation-result" role="status"><div className="assessment-score"><strong>{report.score}<small>/100</small></strong><span>Chỉ số khớp âm vị<br /><small>{report.seconds} giây · Mẫu từ điển Anh–Mỹ</small></span></div><p>Chạm từ để xem các âm cần luyện. Số thấp là gợi ý nghe lại, không tự kết luận bạn phát âm sai.</p><div className="phoneme-words">{report.words.map((word, i) => <details className={word.score < 60 ? "needs-practice" : ""} key={i}><summary>{word.word} <b>{word.score}</b></summary><div>{word.phones.map((phone, n) => <span key={n}>/{phone.symbol}/ <b>{phone.score}</b></span>)}</div></details>)}</div></div> : previous && <p>Lần chấm trước: <strong>{previous.score}/100</strong> · {new Date(previous.at).toLocaleDateString("vi-VN")}</p>}<details className="content-credits"><summary>Cách chấm và giới hạn</summary><p>Mô hình âm học Wav2Vec2 nhận diện âm vị, căn với chuỗi âm trong CMU Dictionary và tính chỉ số từ xác suất âm học. Không lấy độ khớp bản chép lời làm điểm phát âm.</p><p>Chỉ số thử nghiệm chưa hiệu chuẩn bằng giáo viên; giọng vùng miền và tiếng ồn có thể ảnh hưởng. Chưa chấm ngữ điệu, trọng âm hay điểm thi. Bản ghi không được gửi lên mạng.</p><p><a href="https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/tree/c69750f5043e5e1f8a71ab95dd3b98338c280c92" target="_blank" rel="noreferrer">Meta AI / ONNX Community · Apache-2.0</a></p><p><a href="https://github.com/cmusphinx/cmudict/tree/74790861f652b15e4ac49015a90074ad62a27690" target="_blank" rel="noreferrer">CMU Dictionary · BSD-2-Clause</a></p></details></section>;
}
