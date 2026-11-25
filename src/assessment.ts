export type WritingIssue = { start: number; end: number; original: string; replacement?: string; message: string; kind: "grammar" | "spelling" | "style" };
export type WritingReport = { score: number; words: number; criteria: { label: string; score: number; detail: string }[]; issues: WritingIssue[]; warnings: string[] };
const tokens = (text: string) => [...text.matchAll(/[a-z]+(?:['’][a-z]+)*/gi)];
const typoPairs = "teh:the,recieve:receive,recieved:received,beleive:believe,definately:definitely,seperate:separate,occured:occurred,untill:until,becuase:because,wich:which,thier:their,freind:friend,enviroment:environment,goverment:government,comming:coming,writting:writing,begining:beginning,succesful:successful,neccessary:necessary,accomodation:accommodation,alot:a lot,everytime:every time,im:I'm,dont:don't,cant:can't,doesnt:doesn't,didnt:didn't,isnt:isn't,wasnt:wasn't,wont:won't,shouldnt:shouldn't,couldnt:couldn't,grammer:grammar,langauge:language,studing:studying,swiming:swimming,happend:happened,knowlege:knowledge,diferent:different,interresting:interesting,exemple:example,improove:improve,benifit:benefit,benifits:benefits,experiance:experience,oppertunity:opportunity,responsability:responsibility";
const typos = new Map(typoPairs.split(",").map(pair => pair.split(":") as [string, string]));
const stop = new Set("a an the this that these those i you he she it we they me him her us them my your his its our their is am are was were be been being do does did have has had and or but if so as at by for from in into of on to with without not no can could will would should may might must also very more most some any all than then there here what which who when where why how one two three".split(" "));
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
let wordlist: Promise<Set<string>> | undefined;
export function loadSpellingWords() {
  return wordlist ??= fetch("/content/wordlist.json").then(async response => {
    if (!response.ok) throw Error("Không mở được từ điển kiểm tra chính tả. Hãy mở lại bài để thử lại.");
    const text = await response.text();
    if (text.length > 3_000_000) throw Error("Từ điển kiểm tra không hợp lệ.");
    const words: unknown = JSON.parse(text);
    if (!Array.isArray(words) || words.length < 10000 || words.some(w => typeof w !== "string" || w.length > 128 || !/^[a-z]+(?:'[a-z]+)?$/.test(w))) throw Error("Từ điển kiểm tra không hợp lệ.");
    return new Set(words as string[]);
  }).catch(error => { wordlist = undefined; throw error; });
}
function known(word: string, lexicon: Set<string>) {
  return lexicon.has(word) || [word.replace(/s$/, ""), word.replace(/es$/, ""), word.replace(/ies$/, "y"), word.replace(/ed$/, ""), word.replace(/d$/, ""), word.replace(/ing$/, ""), word.replace(/ing$/, "e"), word.replace(/(.)\1(ing|ed)$/, "$1")].some(w => w !== word && lexicon.has(w));
}
function near(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    previous = next;
  }
  return previous[b.length] <= 1;
}
export function assessWriting(text: string, minimum: number, lexicon: Set<string>, model = ""): WritingReport {
  if (typeof text !== "string" || text.length > 20000 || !Number.isFinite(minimum) || minimum < 1 || minimum > 1000) throw Error("Bài viết không hợp lệ.");
  const matches = tokens(text), words = matches.map(m => m[0].toLowerCase().replace(/’/g, "'"));
  if (words.length < 15) throw Error("Viết ít nhất 15 từ tiếng Anh để nhận phản hồi có ích.");
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.filter(c => /[a-z]/i.test(c)).length / Math.max(1, letters.length) < .92) throw Error("Bộ chấm này dành cho bài viết tiếng Anh. Hãy viết phần trả lời bằng tiếng Anh.");
  const issues: WritingIssue[] = [], warnings: string[] = [];
  function add(start: number, end: number, message: string, kind: WritingIssue["kind"], replacement?: string) {
    if (issues.length >= 80 || issues.some(i => start < i.end && end > i.start)) return;
    issues.push({ start, end, original: text.slice(start, end), message, kind, ...(replacement === undefined ? {} : { replacement }) });
  }
  function rule(pattern: RegExp, message: string, replacement: (m: RegExpMatchArray) => string) {
    for (const m of text.matchAll(pattern)) {
      const prefix = text.slice(Math.max(0, m.index! - 90), m.index!);
      if (/^(he|she|it|we|you|they|I)\b/i.test(m[0]) && (/\b(do|does|did|don't|doesn't|didn't|can|could|should|would|will|may|might|must)\s+$/i.test(prefix) || /\b(suggest|insist|recommend|request|demand|require)\w*\b[^.!?]*\bthat\s+$/i.test(prefix))) continue;
      add(m.index!, m.index! + m[0].length, message, "grammar", replacement(m));
    }
  }
  const cap = (original: string, replacement: string) => /^[A-Z]/.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
  rule(/\b(I) has\b/gi, "I dùng have.", () => "I have");
  rule(/\b(he|she|it) have\b/gi, "Chủ ngữ ngôi ba số ít dùng has ở hiện tại.", m => m[1] + " has");
  rule(/\b(we|you|they) has\b/gi, "We/you/they dùng have.", m => m[1] + " have");
  rule(/\bI (is|are)\b/g, "I dùng am ở hiện tại.", () => "I am");
  rule(/\b(he|she|it) (are|am)\b/gi, "He/she/it dùng is ở hiện tại.", m => m[1] + " is");
  rule(/\b(we|you|they|people|children) is\b/gi, "Kiểm tra sự hòa hợp chủ ngữ–động từ.", m => m[1] + " are");
  rule(/\b(he|she|it) (don't|do not)\b/gi, "Ngôi ba số ít dùng does not/doesn't.", m => m[1] + " doesn't");
  rule(/\b(we|you|they|I) (doesn't|does not)\b/gi, "Chủ ngữ này dùng do not/don't.", m => m[1] + " don't");
  rule(/\b(he|she|it) (go|work|like|want|need|live|play|study|watch|make|take|eat|drink|walk|speak)\b/gi, "Thêm -s/-es cho động từ hiện tại với he/she/it.", m => m[1] + " " + (/y$/.test(m[2]) ? m[2].slice(0, -1) + "ies" : /[ox]$|ch$/.test(m[2]) ? m[2] + "es" : m[2] + "s"));
  const bases: Record<string, string> = { went: "go", goes: "go", likes: "like", liked: "like", wanted: "want", wants: "want", ate: "eat", eats: "eat", studied: "study", studies: "study", works: "work", worked: "work", saw: "see", seen: "see", had: "have", has: "have", took: "take", taken: "take", made: "make", makes: "make", wrote: "write", written: "write", bought: "buy", boughten: "buy" };
  rule(/\b(did|didn't|does|doesn't|can|could|should|must|will|would) (went|goes|likes|liked|wanted|wants|ate|eats|studied|studies|works|worked|saw|seen|had|has|took|taken|made|makes|wrote|written|bought)\b/gi, "Sau trợ động từ này dùng động từ nguyên mẫu.", m => m[1] + " " + bases[m[2].toLowerCase()]);
  rule(/\b(I|you|he|she|it|we|they) (am|is|are|was|were) agree\b/gi, "Agree là động từ, không thêm be trước nó.", m => m[1] + " " + (/was|were/i.test(m[2]) ? "agreed" : /he|she|it/i.test(m[1]) ? "agrees" : "agree"));
  rule(/\b(I['’]m|he['’]s|she['’]s|it['’]s|we['’]re|you['’]re|they['’]re) agree\b/gi, "Agree là động từ, không thêm be trước nó.", m => m[1].split(/['’]/)[0] + " " + (/^(he|she|it)/i.test(m[1]) ? "agrees" : "agree"));
  rule(/\bdiscuss about\b/gi, "Discuss thường nhận tân ngữ trực tiếp.", m => cap(m[0], "discuss"));
  rule(/\bdepend of\b/gi, "Cụm thông dụng là depend on.", m => cap(m[0], "depend on"));
  rule(/\binterested (on|about)\b/gi, "Dùng interested in.", m => cap(m[0], "interested in"));
  rule(/\bmarried with\b/gi, "Khi nói kết hôn với ai, dùng married to.", m => cap(m[0], "married to"));
  rule(/\b(informations|advices|furnitures|equipments|homeworks|luggages)\b/gi, "Danh từ không đếm được này thường không có -s.", m => m[0].slice(0, -1));
  rule(/\ba (advice|information|equipment|furniture|homework)\b/gi, "Dùng some hoặc a piece of với danh từ không đếm được.", m => "some " + m[1]);
  rule(/\bmuch (people|students|books|cars|friends)\b/gi, "Danh từ đếm được số nhiều đi với many.", m => cap(m[0], "many " + m[1]));
  rule(/\bmany (money|water|information|time)\b(?=\s*(?:[.,!?;:]|$))/gi, "Danh từ không đếm được đi với much trong ngữ cảnh này.", m => cap(m[0], "much " + m[1]));
  rule(/\ba (apple|egg|idea|orange|umbrella|hour|honest)\b/gi, "Chọn an trước âm nguyên âm.", m => cap(m[0], "an " + m[1]));
  rule(/\ban (book|car|dog|friend|house|university|uniform|user)\b/gi, "Chọn a trước âm phụ âm, kể cả /j/ trong university.", m => cap(m[0], "a " + m[1]));
  rule(/\bi\b/g, "Đại từ I luôn viết hoa.", () => "I");
  for (const m of text.matchAll(/\b(the|a|an|to|of|in|with|and|is|are)\s+\1\b/gi)) add(m.index!, m.index! + m[0].length, "Có thể bạn đã lặp từ ngoài ý muốn.", "style", m[1]);
  for (const m of text.matchAll(/ +([,.!?;:])/g)) add(m.index!, m.index! + m[0].length, "Bỏ khoảng trắng trước dấu câu.", "style", m[1]);
  const unknown = matches.filter(m => !known(m[0].toLowerCase().replace(/’/g, "'"), lexicon));
  const suggestions = new Map<string, string | undefined>();
  for (const m of matches) {
    if (issues.length >= 80) break;
    const word = m[0].toLowerCase().replace(/’/g, "'"), replacement = typos.get(word);
    if (!replacement && (known(word, lexicon) || /^[A-Z]/.test(m[0]) || word.length < 3)) continue;
    if (!replacement && !suggestions.has(word)) {
      let examined = 0, suggestion: string | undefined;
      for (const candidate of lexicon) if (candidate[0] === word[0] && Math.abs(candidate.length - word.length) <= 1) {
        if (++examined > 1200) break;
        if (near(word, candidate)) { suggestion = candidate; break; }
      }
      suggestions.set(word, suggestion);
    }
    const suggestion = replacement ?? suggestions.get(word);
    add(m.index!, m.index! + m[0].length, replacement ? "Có thể sai chính tả hoặc thiếu dấu nháy." : "Chưa thấy từ này trong từ điển; kiểm tra chính tả hoặc tên riêng.", "spelling", suggestion ? cap(m[0], suggestion) : undefined);
  }
  if (unknown.length / words.length > .3) warnings.push("Nhiều từ chưa có trong từ điển. Kết quả có thể không đáng tin nếu có tên riêng, thuật ngữ hoặc ngôn ngữ khác.");
  const paragraphs = text.trim().split(/\n\s*\n/).filter(Boolean), sentences = text.split(/[.!?]+(?:\s|$)/).map(s => tokens(s).length).filter(Boolean);
  const connectors = new Set(words.filter(w => ["because", "however", "although", "therefore", "first", "second", "finally", "also", "instead", "example", "while", "but", "and"].includes(w))).size;
  const content = words.filter(w => !stop.has(w));
  const windows = Array.from({ length: Math.max(1, content.length - 49) }, (_, i) => content.slice(i, i + 50));
  const diversity = windows.reduce((sum, window) => sum + new Set(window).size / Math.max(1, window.length), 0) / windows.length;
  const counts = new Map<string, number>(); for (const w of content) counts.set(w, (counts.get(w) ?? 0) + 1);
  const repeated = [...counts].filter(([, n]) => n > Math.max(4, words.length * .07)).map(([w]) => w);
  if (repeated.length) warnings.push("Từ nội dung lặp nhiều: " + repeated.slice(0, 8).join(", ") + ". Hãy xem từ nào có thể diễn đạt lại.");
  const modelWords = tokens(model).map(m => m[0].toLowerCase()).join(" ");
  if (modelWords && words.length > 30 && modelWords.includes(words.slice(0, 30).join(" "))) warnings.push("Đoạn đầu trùng nhiều với bài tham khảo. Chỉ số này chưa phản ánh khả năng viết độc lập.");
  const weighted = issues.reduce((sum, i) => sum + (i.kind === "grammar" ? 5 : i.kind === "spelling" ? 2.5 : 1), 0);
  const criteria = [
    { label: "Ngôn ngữ theo quy tắc", score: clamp(100 - weighted * Math.sqrt(80 / Math.max(30, words.length))), detail: `${issues.filter(i => i.kind !== "style").length} vị trí cần kiểm tra; không phát hiện lỗi không có nghĩa là bài hoàn toàn đúng.` },
    { label: "Độ dài theo đề", score: clamp(100 * words.length / minimum), detail: `${words.length} từ / yêu cầu tối thiểu ${minimum}.` },
    { label: "Cấu trúc có thể đo", score: clamp(45 * Math.min(1, paragraphs.length / (minimum <= 120 ? 1 : 3)) + 35 * sentences.filter(n => n >= 4 && n <= 35).length / Math.max(1, sentences.length) + 20 * Math.min(1, connectors / 3)), detail: `${paragraphs.length} đoạn, ${sentences.length} câu, ${connectors} từ nối khác nhau; chưa xác nhận tính logic hay mức đáp ứng đề.` },
    { label: "Đa dạng từ nội dung", score: clamp(100 * diversity - repeated.length * 8), detail: "Tỷ lệ từ khác nhau trong cửa sổ tối đa 50 từ nội dung; không đo độ đúng của cách dùng từ." },
  ];
  let score = clamp(criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length);
  if (words.length < minimum / 2) score = Math.min(score, 50);
  if (unknown.length / words.length > .3) score = Math.min(score, 40);
  if (diversity < .2 || content.length < words.length * .15) score = Math.min(score, 30);
  return { score, words: words.length, criteria, issues: issues.sort((a, b) => a.start - b.start), warnings };
}

export type PronunciationReport = { engine: "phoneme-ctc-1"; score: number; seconds: number; words: { word: string; score: number; phones: { symbol: string; score: number }[] }[] };
export function validPronunciationReport(value: unknown): value is PronunciationReport {
  const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  const score = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
  return object(value) && value.engine === "phoneme-ctc-1" && score(value.score) && typeof value.seconds === "number" && Number.isFinite(value.seconds) && value.seconds >= .4 && value.seconds <= 15 && Array.isArray(value.words) && value.words.length > 0 && value.words.length <= 45 && value.words.every(w => object(w) && typeof w.word === "string" && /^[a-z]+(?:'[a-z]+)?$/.test(w.word) && w.word.length <= 80 && score(w.score) && Array.isArray(w.phones) && w.phones.length > 0 && w.phones.length <= 40 && w.phones.every(p => object(p) && typeof p.symbol === "string" && p.symbol.length <= 12 && score(p.score)));
}
