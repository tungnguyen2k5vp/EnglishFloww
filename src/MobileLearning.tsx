import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, Clock, Download, PenLine, Volume2 } from "lucide-react";
import { useStore, download } from "./store";
import { event, normalize } from "./domain";
import { Empty, Quiz, speak, TextLookup } from "./components";
import { AudioDock } from "./MobileDetails";
import { ContentCredits } from "./ContentCredits";
import { openContent } from "./open-content-data";
import { countWords, writingChecks, writingPrompts } from "./learning-content";
import { dailyPlan } from "./learning-plan";
import { WritingFeedback } from "./LearningAssessment";
import type { Navigate } from "./MobileApp";

export function PlanCard({ navigate }: { navigate: Navigate }) {
  const { state } = useStore();
  const tasks = dailyPlan(state);
  const done = tasks.filter(t => t.done).length;
  return <button className="daily-plan-card" onClick={() => navigate("plan")}><span><small>LỘ TRÌNH CỦA BẠN</small><strong>Hôm nay học gì?</strong><span>{done}/{tasks.length} nhiệm vụ · Mục tiêu {state.profile.goal} phút</span></span><span className="plan-ring">{done}/{tasks.length}<ArrowRight size={18} /></span></button>;
}

export function LearningPlan({ navigate }: { navigate: Navigate }) {
  const { state } = useStore();
  const tasks = dailyPlan(state);
  const done = tasks.filter(t => t.done).length;
  return <><div className="learning-hero"><span className="eyebrow">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}</span><h2>Từng bước, mỗi ngày</h2><p>Gợi ý theo trình độ {state.profile.level} và lịch ôn trên thiết bị.</p><progress aria-label="Nhiệm vụ hoàn thành" value={done} max={tasks.length} /><p>{done}/{tasks.length} nhiệm vụ hoàn thành</p></div><div className="plan-tasks">{tasks.map((t, i) => <button key={t.id} onClick={() => navigate(t.page, t.target)}><span className={"task-index " + (t.done ? "complete" : "")}>{t.done ? <Check /> : i + 1}</span><span><strong>{t.title}</strong><small>{t.detail}</small></span><ArrowRight size={18} /></button>)}</div><p className="phone-intro">Nhiệm vụ được ghi nhận sau khi trả lời thẻ hoặc hoàn thành bài kiểm tra. Mở bài học chưa tính là hoàn thành.</p><button className="pack-action" onClick={() => navigate("progress")}><Clock />Xem tiến độ thực tế<ArrowRight /></button><button className="pack-action" onClick={() => navigate("settings")}><BookOpen />Đổi trình độ và mục tiêu<ArrowRight /></button></>;
}

export function Writing({ id, navigate }: { id: string | null; navigate: Navigate }) {
  const { state } = useStore();
  const [query, setQuery] = useState(""), [level, setLevel] = useState("");
  const list = writingPrompts.filter(p => (!level || p.level === level) && normalize(p.title + " " + p.kind + " " + p.prompt).includes(normalize(query)));
  const prompt = writingPrompts.find(p => p.id === id);
  if (prompt) return <WritingEditor key={id} id={prompt.id} />;
  if (id) return <Empty title="Không tìm thấy đề viết"><button className="button" onClick={() => navigate("writing")}>Về thư viện đề viết</button></Empty>;
  return <><div className="learning-hero"><PenLine size={35} /><h2>Viết để diễn đạt rõ hơn</h2><p>{writingPrompts.length} đề từ A2 đến B2 · Dàn ý · Bản nháp · Bài tham khảo</p></div><label className="phone-search"><input aria-label="Tìm đề viết" placeholder="Tìm đề, thể loại hoặc từ khóa" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="library-filters"><label className="field">Trình độ<select aria-label="Trình độ đề viết" value={level} onChange={e => setLevel(e.target.value)}><option value="">Tất cả</option>{["A2", "B1", "B2"].map(l => <option key={l}>{l}</option>)}</select></label></div><p className="phone-intro">{list.length}/{writingPrompts.length} đề phù hợp</p><div className="learning-list">{list.map(p => <button key={p.id} onClick={() => navigate("writing", p.id)}><PenLine /><span><strong>{p.title}</strong><small>{p.level} · {p.kind} · {p.minutes} phút · {p.minimum}+ từ</small><small>{state.writing?.[p.id]?.submitted ? "Đã nộp · Có thể sửa lại" : state.writing?.[p.id]?.text ? `Bản nháp · ${countWords(state.writing[p.id].text)} từ` : "Bắt đầu bài mới"}</small></span><ArrowRight size={18} /></button>)}</div><p className="phone-footnote">Đề thực hành do EnglishFlow biên soạn, độc lập với kỳ thi IELTS. Chấm tự động theo quy tắc giúp tìm lỗi và gợi ý sửa. Chỉ số luyện viết không đánh giá sâu lập luận hoặc quy đổi band IELTS.</p></>;
}

function WritingEditor({ id }: { id: string }) {
  const prompt = writingPrompts.find(p => p.id === id)!;
  const { state, update, notice } = useStore();
  const draft = state.writing?.[id] ?? { text: "", elapsed: 0 };
  const [running, setRunning] = useState(false);
  const [model, setModel] = useState(false);
  const checks = writingChecks(draft.text, prompt.minimum);
  const saveText = (text: string) => update(s => ({ ...s, writing: { ...s.writing, [id]: { ...s.writing?.[id] ?? { elapsed: 0 }, text, submitted: false, checked: false } } }));
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now(), seconds = Math.floor((now - last) / 1000);
      if (!seconds) return;
      last = now;
      if (document.hidden) return;
      const saved = update(s => { const value = s.writing?.[id] ?? { text: "", elapsed: 0 }; return { ...s, writing: { ...s.writing, [id]: { ...value, elapsed: Math.min(604800, value.elapsed + seconds) } } }; });
      if (!saved) setRunning(false);
    }, 1000);
    const visibility = () => { if (document.hidden) setRunning(false); };
    document.addEventListener("visibilitychange", visibility);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [running, id]);
  return <div className="writing-editor"><span className="eyebrow">{prompt.kind} · {prompt.level}</span><h2>{prompt.title}</h2><div className="writing-prompt"><p>{prompt.prompt}</p></div><details className="writing-outline"><summary>Gợi ý lập dàn ý</summary><ol>{prompt.outline.map(o => <li key={o}>{o}</li>)}</ol></details><div className="writing-toolbar"><span><Clock size={17} />{Math.floor(draft.elapsed / 60).toString().padStart(2, "0")}:{(draft.elapsed % 60).toString().padStart(2, "0")} / {prompt.minutes} phút</span><button className="text-button" aria-pressed={running} onClick={() => setRunning(!running)}>{running ? "Tạm dừng" : "Bấm giờ"}</button></div>{draft.elapsed >= prompt.minutes * 60 && <p role="status">Đã hết thời gian gợi ý. Bạn vẫn có thể tiếp tục chỉnh bài.</p>}<label className="field"><span>Bài viết của bạn</span><textarea className="writing-text" aria-label="Bài viết của bạn" spellCheck lang="en" maxLength={20000} placeholder="Write your answer here…" value={draft.text} onChange={e => saveText(e.target.value)} /></label><div className="row between"><strong aria-live="polite">{countWords(draft.text)} / {prompt.minimum}+ từ</strong><small>Lưu trên thiết bị sau mỗi thay đổi</small></div><button className="button full" disabled={!draft.text.trim() || !!draft.submitted} onClick={() => { if (update(s => ({ ...s, writing: { ...s.writing, [id]: { ...s.writing![id], submitted: true } }, events: [...s.events, event("practice", "writing:" + id)] }))) { setRunning(false); notice("Đã lưu bài nộp. Hãy tự rà soát nội dung theo checklist."); } }}>Nộp bài và tự đánh giá</button>{draft.submitted && <div className="writing-feedback" role="status"><h3>Đã lưu bài viết</h3><p>Kiểm tra hình thức tự động:</p>{checks.map(c => <p key={c.label}>{c.passed ? "✓" : "○"} {c.label}</p>)}<h3>Checklist nội dung để bạn tự kiểm tra</h3>{["Tôi đã trả lời đủ các ý trong đề.", "Mỗi đoạn có một ý chính và ví dụ phù hợp.", "Tôi đã kiểm tra thì, chủ ngữ–động từ và chính tả.", "Tôi diễn đạt bằng lời của mình và không chép bài mẫu."].map(c => <label key={c}><input type="checkbox" />{c}</label>)}<p className="muted">Checklist này không đánh giá độ đúng của thông tin hay thay thế phản hồi giáo viên. Sửa văn bản để nộp lại.</p></div>}<WritingFeedback text={draft.text} minimum={prompt.minimum} model={prompt.model} checked={!!draft.checked} onCheck={() => update(s => ({ ...s, writing: { ...s.writing, [id]: { ...s.writing?.[id] ?? { text: "", elapsed: 0 }, checked: true } } }))} onChange={saveText} /><button className="pack-action" disabled={!draft.text.trim()} onClick={() => download(`EnglishFlow-${id}.txt`, prompt.title + "\n\n" + draft.text)}><Download />Xuất bài viết<ArrowRight /></button><button className="pack-action" onClick={() => setModel(!model)}><BookOpen />{model ? "Ẩn" : "Xem"} bài tham khảo<ArrowRight /></button>{model && <div className="writing-model"><p>Bài minh họa do EnglishFlow biên soạn. Có nhiều cách trả lời phù hợp khác.</p><div>{prompt.model}</div></div>}<ContentCredits /></div>;
}

export function Sentences({ onLookup }: { onLookup: (term: string) => void }) {
  const { notice } = useStore();
  const [topic, setTopic] = useState(""), [query, setQuery] = useState(""), [level, setLevel] = useState("");
  const [index, setIndex] = useState(0), [translation, setTranslation] = useState(false), [practice, setPractice] = useState(false);
  const topics = [...new Set(openContent.sentences.map(s => s.topic))];
  const list = openContent.sentences.filter(s => (!level || s.level === level) && (!topic || s.topic === topic) && (s.en + " " + s.vi).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const sentence = list[Math.min(index, list.length - 1)];
  const change = (value: number) => { setIndex(value); setTranslation(false); setPractice(false); };
  return <div className={"sentence-page " + (sentence && "audio" in sentence ? "with-audio-dock" : "")}><div className="learning-hero"><h2>{openContent.sentences.length} câu dùng mỗi ngày</h2><p>Đọc, tra từ, nghe và tự viết lại câu theo chủ đề.</p></div><label className="field">Tìm câu<input aria-label="Tìm câu song ngữ" value={query} maxLength={100} onChange={e => { setQuery(e.target.value); change(0); }} /></label><div className="library-filters"><label className="field">Trình độ<select aria-label="Trình độ câu song ngữ" value={level} onChange={e => { setLevel(e.target.value); change(0); }}><option value="">Tất cả</option>{["A2", "B1", "B2"].map(l => <option key={l}>{l}</option>)}</select></label></div><div className="phone-chips"><button className={!topic ? "active" : ""} onClick={() => { setTopic(""); change(0); }}>Tất cả</button>{topics.map(t => <button className={topic === t ? "active" : ""} key={t} onClick={() => { setTopic(t); change(0); }}>{t}</button>)}</div>{sentence ? <><div className="row between"><small>{Math.min(index, list.length - 1) + 1}/{list.length} · {sentence.topic}</small><button className="text-button" onClick={() => setPractice(!practice)}>{practice ? "Đọc và nghe" : "Luyện nhớ"}</button></div>{practice ? <Quiz key={sentence.id} questions={[{ prompt: `Viết câu tiếng Anh tương ứng: ${sentence.vi}`, options: [], answer: sentence.en, explanation: sentence.en + " — " + sentence.vi }]} target={"sentence:" + sentence.id} mode="typed" /> : <div className="sentence-card" key={sentence.id}><p><TextLookup text={sentence.en} onLookup={onLookup} /></p><button className="text-button" onClick={() => setTranslation(!translation)}>{translation ? "Ẩn nghĩa" : "Hiện nghĩa"}</button>{translation && <p className="translation">{sentence.vi}</p>}{!("audio" in sentence) && <button className="button secondary" onClick={() => speak(sentence.en, notice)}><Volume2 size={18} />Nghe giọng hệ thống</button>}</div>}<div className="row between"><button className="button secondary" disabled={index === 0} onClick={() => change(index - 1)}>Câu trước</button><button className="button" disabled={index + 1 >= list.length} onClick={() => change(index + 1)}>Câu tiếp<ArrowRight size={16} /></button></div><ContentCredits ids={[sentence.credit, sentence.credit + "-audio"]} />{"audio" in sentence && <AudioDock key={sentence.id} src={sentence.audio as string} />}</> : <Empty title="Không có câu phù hợp">Thử từ khóa hoặc chủ đề khác.</Empty>}</div>;
}
