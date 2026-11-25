import { articles, grammarLessons, mediaLessons } from "./data.ts";
import { dayKey } from "./domain.ts";
import type { AppState } from "./model.ts";

export function dailyPlan(state: AppState, now = Date.now()) {
  const today = state.events.filter(e => dayKey(e.at) === dayKey(now));
  const day = new Date(now);
  const index = Math.floor(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 86400000);
  const choose = <T extends { level: string }>(items: T[]) => { const matching = items.filter(a => a.level === state.profile.level); const list = matching.length ? matching : items; return list[index % list.length]; };
  const article = choose(articles), audio = choose(mediaLessons), grammar = choose(grammarLessons);
  const reviewed = new Set(today.filter(e => e.kind === "review").map(e => e.target)).size;
  const due = Object.values(state.saved).filter(s => s.due <= now).length;
  const target = Math.min(5, Math.max(1, due + reviewed));
  const completed = (kind: string, id: string) => today.some(e => e.kind === kind && e.target.split(":")[0] === id);
  return [
    { id: "vocabulary", title: `Học hoặc ôn ${target} từ`, detail: `${reviewed}/${target} từ đã trả lời · ${due} từ đến hạn`, page: due ? "review" : "learn", target: undefined, done: reviewed >= target },
    { id: "reading", title: "Đọc và kiểm tra hiểu", detail: article.title, page: "reading", target: article.id, done: completed("reading", article.id) },
    { id: "listening", title: "Nghe và làm câu hỏi", detail: audio.title, page: "listening", target: audio.id, done: completed("listening", audio.id) },
    { id: "grammar", title: "Một điểm ngữ pháp", detail: grammar.title, page: "grammar", target: grammar.id, done: completed("grammar", grammar.id) },
    { id: "practice", title: "Viết hoặc nói một chút", detail: "Nộp một bài viết hoặc hoàn thành một bài luyện nói", page: "writing", target: undefined, done: today.some(e => e.kind === "practice" && /^(writing:|shadowing:)/u.test(e.target)) },
  ] as const;
}
