import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = (await readdir("dist/assets")).map((name) => "/assets/" + name);
async function bundled(dir) {
  const rows = await readdir("dist/" + dir, { withFileTypes: true });
  return (await Promise.all(rows.map(row => row.isDirectory() ? bundled(dir + "/" + row.name) : "/" + dir + "/" + row.name))).flat();
}
const files = [
  "/",
  "/index.html",
  "/mobile.html",
  "/dictionary/manifest.json",
  "/dictionary/attribution.html",
  "/icon.svg",
  "/manifest.webmanifest",
  ...assets,
  ...(await Promise.all(["content", "fonts", "art", "books", "media"].map(bundled))).flat(),
];
const hash = createHash("sha256");
for (const file of files.filter(file => file !== "/"))
  hash.update(await readFile("dist" + file));
const version = "englishflow-" + hash.digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  `
const CACHE=${JSON.stringify(version)}, FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('englishflow-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.headers.has('range')&&FILES.includes(new URL(event.request.url).pathname))event.respondWith(caches.match(event.request.url).then(async cached=>{
    if(!cached)return fetch(event.request);
    const bytes=await cached.arrayBuffer(), size=bytes.byteLength, range=/^bytes=(\\d*)-(\\d*)$/.exec(event.request.headers.get('range'));
    if(!range||!range[1]&&!range[2])return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
    const start=range[1]?Number(range[1]):Math.max(0,size-Number(range[2])), end=range[1]&&range[2]?Math.min(size-1,Number(range[2])):size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
    return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':cached.headers.get('Content-Type')||'application/octet-stream','Content-Range':'bytes '+start+'-'+end+'/'+size,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
  }));
  else if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match(new URL(event.request.url).pathname==='/mobile.html'?'/mobile.html':'/index.html')));
  else if(FILES.includes(new URL(event.request.url).pathname))event.respondWith(caches.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request)));
  else if(new URL(event.request.url).pathname.startsWith('/dictionary/'))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;})));
});
`,
);
console.log("Offline app shell generated:", version);
