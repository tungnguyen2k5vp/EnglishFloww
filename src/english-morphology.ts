/** Original, bounded English grammar rules. Candidates are suggestions, never source facts.
 * Every candidate must still resolve to a real dictionary entry with compatible POS. */
export type FormCandidate = { lemma: string; pos: 'V' | 'N' | 'A' | 'R' | 'ANY'; reason: string };
const irregular: Record<string, string[]> = {
  went: ['go'], gone: ['go'], ate: ['eat'], eaten: ['eat'], saw: ['see'], seen: ['see'],
  ran: ['run'], run: ['run'], met: ['meet'], left: ['leave'], took: ['take'], taken: ['take'],
  gave: ['give'], given: ['give'], did: ['do'], done: ['do'], had: ['have'], made: ['make'],
  was: ['be'], were: ['be'], been: ['be'], am: ['be'], is: ['be'], are: ['be'],
  got: ['get'], gotten: ['get'], bought: ['buy'], brought: ['bring'], thought: ['think'],
  taught: ['teach'], caught: ['catch'], wrote: ['write'], written: ['write'], spoke: ['speak'],
  spoken: ['speak'], broke: ['break'], broken: ['break'], chose: ['choose'], chosen: ['choose'],
  knew: ['know'], known: ['know'], drove: ['drive'], driven: ['drive'], flew: ['fly'], flown: ['fly'],
  grew: ['grow'], grown: ['grow'], fell: ['fall'], fallen: ['fall'], felt: ['feel'], found: ['find'],
  heard: ['hear'], held: ['hold'], kept: ['keep'], lost: ['lose'], paid: ['pay'], said: ['say'],
  sold: ['sell'], sent: ['send'], sat: ['sit'], slept: ['sleep'], stood: ['stand'], told: ['tell'],
  won: ['win'], wore: ['wear'], worn: ['wear'], understood: ['understand'],
};
const plurals: Record<string, string> = { children: 'child', mice: 'mouse', teeth: 'tooth', feet: 'foot', men: 'man', women: 'woman', people: 'person', geese: 'goose' };
const contractions: Record<string, string[]> = {
  "don't": ['do not'], "can't": ['cannot', 'can'], "won't": ['will not', 'will'],
  "i'm": ['i am', 'be'], "they've": ['they have', 'have'], "we're": ['we are', 'be'],
  "it's": ['it is', 'it has'], "he's": ['he is', 'he has'], "she's": ['she is', 'she has'],
};
export function normalizeDictionaryInput(value: string): string {
  return value.normalize('NFC').trim().replace(/[’‘ʼ]/gu, "'").replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}
export function englishFormCandidates(input: string): FormCandidate[] {
  const word = normalizeDictionaryInput(input);
  if (!word || word.length > 200 || !/^[a-z]+(?:[' -][a-z]+)*$/u.test(word)) return [];
  const found: FormCandidate[] = [];
  const add = (lemma: string, pos: FormCandidate['pos'], reason: string) => {
    if (lemma !== word && lemma.length >= 2 && !found.some(row => row.lemma === lemma && row.pos === pos)) found.push({ lemma, pos, reason });
  };
  for (const lemma of irregular[word] ?? []) add(lemma, 'V', 'Động từ bất quy tắc');
  if (plurals[word]) add(plurals[word], 'N', 'Danh từ số nhiều bất quy tắc');
  if (word === 'better' || word === 'best') { add('good', 'A', 'Dạng so sánh'); add('well', 'R', 'Dạng so sánh'); }
  if (word === 'worse' || word === 'worst') { add('bad', 'A', 'Dạng so sánh'); add('badly', 'R', 'Dạng so sánh'); }
  for (const lemma of contractions[word] ?? []) add(lemma, 'ANY', 'Dạng viết tắt; cần xem ngữ cảnh');
  const stem = (suffix: string, pos: FormCandidate['pos'], reason: string, restoreE: boolean) => {
    if (!word.endsWith(suffix) || word.length <= suffix.length + 2) return;
    const base = word.slice(0, -suffix.length);
    add(base, pos, reason);
    if (restoreE) add(`${base}e`, pos, reason);
    if (/([bdgmnprt])\1$/u.test(base)) add(base.slice(0, -1), pos, reason);
  };
  if (word.endsWith('ying')) add(`${word.slice(0, -4)}ie`, 'V', 'Dạng -ing');
  stem('ing', 'V', 'Dạng -ing', true);
  if (word.endsWith('ied')) add(`${word.slice(0, -3)}y`, 'V', 'Dạng quá khứ -ied');
  stem('ed', 'V', 'Dạng quá khứ -ed', true);
  if (word.endsWith('ies')) { add(`${word.slice(0, -3)}y`, 'N', 'Danh từ số nhiều'); add(`${word.slice(0, -3)}y`, 'V', 'Động từ ngôi thứ ba'); }
  if (/(?:ches|shes|xes|zes|sses|oes)$/u.test(word)) {
    add(word.slice(0, -2), 'N', 'Danh từ số nhiều'); add(word.slice(0, -2), 'V', 'Động từ ngôi thứ ba');
  }
  if (word.endsWith('s') && !/(?:ss|us|is)$/u.test(word)) {
    add(word.slice(0, -1), 'N', 'Danh từ số nhiều'); add(word.slice(0, -1), 'V', 'Động từ ngôi thứ ba');
  }
  for (const suffix of ['er', 'est']) {
    if (word.endsWith(`i${suffix}`)) add(`${word.slice(0, -(suffix.length + 1))}y`, 'A', 'Dạng so sánh');
    stem(suffix, 'A', 'Dạng so sánh', true);
  }
  return found.slice(0, 16);
}
