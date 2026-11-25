import { useState } from "react";
import { openContent } from "./open-content-data";
import { download, useStore } from "./store";

export const contentNotice = (ids?: string[]) => openContent.credits.filter(c => ids?.includes(c.id)).map(c => `${c.title}\n${c.author}\n${c.url}\n${c.license} — ${c.licenseUrl}\n${c.changes}`).join("\n\n") || "EnglishFlow original learning content — CC BY 4.0 https://creativecommons.org/licenses/by/4.0/";

export function ContentCredits({ ids }: { ids?: string[] }) {
  const rows = openContent.credits.filter(c => ids?.includes(c.id));
  return <details className="content-credits"><summary>Nguồn và giấy phép</summary>{rows.length ? rows.map(c => <div key={c.id}><a href={c.url} target="_blank" rel="noreferrer">{c.provider} · {c.title}</a><p>{c.author}</p><a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a>{"translationLicense" in c && <p>Bản dịch: <a href={c.translationUrl} target="_blank" rel="noreferrer">{c.translationLicense}</a></p>}<p>{c.changes}</p><small>Truy xuất {c.retrieved}</small></div>) : <p>EnglishFlow tự biên soạn văn bản, câu hỏi và hình minh họa. CC BY 4.0. Giọng đọc hệ thống sử dụng dịch vụ TTS đã cài trên thiết bị.</p>}</details>;
}

export function Sources() {
  const [query, setQuery] = useState("");
  const { notice } = useStore();
  async function exportSource(name: string) {
    try {
      const response = await fetch("/content/" + name);
      if (!response.ok) throw Error("Không mở được bản kê trên thiết bị.");
      download("EnglishFlow-" + name, JSON.stringify(await response.json(), null, 2));
    } catch { notice("Chưa xuất được bản kê. Hãy thử lại hoặc kiểm tra bộ nhớ."); }
  }
  const providers = [...new Set(openContent.credits.map(c => c.provider))];
  return <div className="sources-page"><div className="learning-hero"><span className="eyebrow">THƯ VIỆN MỞ · 25/10/2026</span><h2>Học với nguồn rõ ràng</h2><p>{openContent.sentences.length} câu song ngữ · {openContent.media.length} bản thu · {openContent.articles.length} bài đọc · {openContent.packs.length} bộ từ đã duyệt.</p></div><p>Nội dung được chọn qua API hoặc dữ liệu có giấy phép. Cấp độ A2–B2 do EnglishFlow ước lượng. Quyền văn bản và bản thu được kiểm tra riêng; ảnh từ nguồn không được đóng gói lại.</p><label className="field">Lọc nguồn<select value={query} onChange={e => setQuery(e.target.value)}><option value="">Tất cả</option>{providers.map(p => <option key={p}>{p}</option>)}</select></label><ContentCredits />{providers.filter(p => !query || query === p).map(provider => <section key={provider}><h2>{provider}</h2>{openContent.credits.filter(c => c.provider === provider).map(c => <ContentCredits key={c.id} ids={[c.id]} />)}</section>)}<section className="panel"><h2>Tài nguyên kèm theo</h2><p><a href="/dictionary/attribution.html" target="_blank" rel="noreferrer">Toàn bộ nguồn và thay đổi của từ điển Skypedia</a></p><p><button className="text-button" onClick={() => exportSource("catalog.json")}>Xuất danh mục và văn bản được cấp phép</button></p><p><button className="text-button" onClick={() => exportSource("manifest.json")}>Xuất bản kê nguồn, giấy phép và SHA-256</button></p><p><button className="text-button" onClick={() => exportSource("assessment-sources.json")}>Xu?t ngu?n v? SHA-256 m? h?nh ?m v?</button></p><p><a href="/content/APACHE-2.0.txt" target="_blank" rel="noreferrer">M? h?nh / ONNX Runtime ? Apache-2.0</a></p><p><a href="/content/CMUDICT-LICENSE.txt" target="_blank" rel="noreferrer">CMU Dictionary ? BSD-2-Clause</a></p><p><a href="/fonts/OFL.txt" target="_blank" rel="noreferrer">Inter Tight · SIL Open Font License</a></p><p>Ngữ pháp, đề viết, hội thoại và hình minh họa mới: EnglishFlow, CC BY 4.0. Sách văn học giữ nguyên thông báo Gutenberg trong từng bản sách. Không có quan hệ bảo trợ với NASA, Wikimedia, Tatoeba hay IELTS.</p></section></div>;
}
