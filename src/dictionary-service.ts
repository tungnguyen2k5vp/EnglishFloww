import type { Word } from "./model.ts";
import { normalize, validateWord } from "./domain.ts";
import { englishFormCandidates } from "./english-morphology.ts";

export const DICTIONARY_HEADWORDS = 104703;
type Shard = Record<string, Word[]>;
const cache = new Map<string, Promise<Shard>>();
let inventory: Promise<Set<string>> | undefined;
const bucket = (key: string) => /^[a-z]{2}/u.test(key) ? key.slice(0, 2) : "_";
const posNames: Record<string, string> = { N: "danh từ", V: "động từ", A: "tính từ", R: "trạng từ", D: "trạng từ", P: "giới từ", C: "liên từ", I: "thán từ", noun: "danh từ", verb: "động từ", adjective: "tính từ", adverb: "trạng từ" };

async function shard(key: string): Promise<Shard> {
  const prefix = bucket(key);
  if (!cache.has(prefix)) {
    const loading = (async () => {
      inventory ??= fetch("/dictionary/manifest.json", { signal: AbortSignal.timeout(15000) }).then(async response => {
        if (!response.ok) throw Error("Không mở được danh mục từ điển. Hãy thử tra lại.");
        const data = await response.json().catch(() => { throw Error("Danh mục từ điển không hợp lệ."); });
        if (!data || !Array.isArray(data.shards) || !data.shards.every((p: unknown) => typeof p === "string" && /^(?:[a-z]{2}|_)$/u.test(p))) throw Error("Danh mục từ điển không hợp lệ.");
        return new Set<string>(data.shards);
      }).catch(error => { inventory = undefined; throw error; });
      if (!(await inventory).has(prefix)) return {};
      const response = await fetch(`/dictionary/${prefix}.json`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error("Không mở được từ điển ngoại tuyến. Hãy thử tra lại.");
      const data: unknown = await response.json().catch(() => { throw Error("Dữ liệu từ điển không hợp lệ. Hãy thử tra lại."); });
      if (!data || typeof data !== "object" || Array.isArray(data) || !Object.values(data).every(rows => Array.isArray(rows) && rows.every(validateWord))) throw Error("Dữ liệu từ điển không hợp lệ.");
      return data as Shard;
    })();
    cache.set(prefix, loading);
    loading.catch(() => { if (cache.get(prefix) === loading) cache.delete(prefix); });
    // ponytail: immutable prefix shards, bounded to 12 in memory; use native SQLite if measured memory needs it.
    if (cache.size > 12) cache.delete(cache.keys().next().value!);
  }
  return cache.get(prefix)!;
}
async function exact(key: string) {
  const entries = await shard(key);
  return (Object.hasOwn(entries, key) ? entries[key] : []).map(w => ({ ...w, pos: posNames[w.pos] ?? w.pos }));
}
export async function lookupDictionary(input: string): Promise<Word[]> {
  const key = normalize(input);
  if (!key || key.length > 100 || /[\u0000-\u001f]/u.test(key)) return [];
  const direct = await exact(key);
  const inflectionOnly = /(?:quá khứ|phân từ|số nhiều)\s+(?:và phân từ quá khứ\s+)?của|động từ chia|(?:past tense|past participle|plural form) of/iu;
  if (direct.some(w => !inflectionOnly.test(w.meaning))) return direct;
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)))].map(b => b.toString(16).padStart(2, "0")).join("");
  const aliases: Record<string, string[]> = { V: ["động từ", "verb"], N: ["danh từ", "noun"], A: ["tính từ", "adjective"], R: ["trạng từ", "adverb"], ANY: [] };
  const rows = await Promise.all(englishFormCandidates(key).map(async form => (await exact(form.lemma)).filter(w => form.pos === "ANY" || aliases[form.pos].includes(w.pos)).map(w => ({ ...w, id: w.id + "-" + digest, term: key, lemma: w.term, ipa: "", pronunciations: [] }))));
  return [...new Map([...rows.flat(), ...direct].map(w => [w.id, w])).values()];
}
export async function resolveDictionary(inputs: string[]): Promise<Word[][]> {
  if (inputs.length > 100) throw Error("Chỉ tra tối đa 100 từ mỗi lần.");
  const result: Word[][] = [];
  for (let i = 0; i < inputs.length; i += 4) result.push(...await Promise.all(inputs.slice(i, i + 4).map(lookupDictionary)));
  return result;
}
export async function searchDictionary(input: string): Promise<Word[]> {
  const key = normalize(input);
  if (key.length < 2 || key.length > 100) return [];
  const direct = await lookupDictionary(key);
  const entries = await shard(key);
  return [...direct, ...Object.entries(entries).filter(([term]) => term !== key && term.startsWith(key)).sort(([a], [b]) => a.localeCompare(b)).slice(0, 12).map(([, rows]) => ({ ...rows[0], pos: posNames[rows[0].pos] ?? rows[0].pos }))].slice(0, 12);
}
export const dictionaryService = {
  search(entries: Word[], query: string) {
    return entries.filter((w) =>
      normalize(w.term + " " + w.meaning).includes(normalize(query)),
    );
  },
  lookup(entries: Word[], term: string) {
    return entries.find(
      (w) => normalize(w.term) === normalize(term) || w.id === term,
    );
  },
};
