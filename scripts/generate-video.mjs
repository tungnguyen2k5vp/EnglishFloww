import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5178");
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    const audioContext = new AudioContext();
    await audioContext.resume();
    const buffer = await audioContext.decodeAudioData(
      await (await fetch("/media/garden.wav")).arrayBuffer(),
    );
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    const stream = canvas.captureStream(20);
    stream.addTrack(destination.stream.getAudioTracks()[0]);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8,opus",
      videoBitsPerSecond: 400000,
    });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise(
      (resolve) =>
        (recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i++)
            binary += String.fromCharCode(bytes[i]);
          resolve(btoa(binary));
        }),
    );
    const started = performance.now();
    function draw() {
      const elapsed = (performance.now() - started) / 1000;
      ctx.fillStyle = "#e8eddf";
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = "#f5efcd";
      ctx.beginPath();
      ctx.arc(765, 105, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c2caaa";
      ctx.beginPath();
      ctx.ellipse(650, 460, 700, 220, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#91a17c";
      ctx.beginPath();
      ctx.ellipse(140, 560, 650, 240, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#587658";
      ctx.fillRect(0, 455, 960, 85);
      for (let i = 0; i < 7; i++) {
        const x = 70 + i * 137;
        const height = 70 + Math.min(elapsed / 8, 1) * 40;
        const sway = Math.sin(elapsed * 0.8 + i) * 4;
        ctx.strokeStyle = "#3d6146";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, 470);
        ctx.lineTo(x + sway, 470 - height);
        ctx.stroke();
        for (let j = 0; j < 3; j++) {
          ctx.fillStyle = i % 2 ? "#789762" : "#a6b987";
          ctx.beginPath();
          ctx.ellipse(
            x + sway + (j % 2 ? 15 : -15),
            450 - j * 24,
            23,
            10,
            j % 2 ? -0.6 : 0.6,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.fillStyle = "#284c38";
      ctx.font = "16px sans-serif";
      ctx.fillText("ENGLISHFLOW ORIGINALS  /  B1 LISTENING", 50, 60);
      ctx.font = "42px Georgia";
      ctx.fillText("Growing a greener", 50, 153);
      ctx.fillText("neighborhood", 50, 206);
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#60765b";
      ctx.fillText(
        [
          "A shared space. A stronger community.",
          "Growing together. Wasting less.",
          "Learning from one another.",
          "Small steps. Lasting changes.",
        ][Math.min(3, Math.floor(elapsed / 8))],
        50,
        260,
      );
      ctx.fillStyle = "#f2f2dc";
      ctx.font = "13px sans-serif";
      ctx.fillText(
        "Original illustrated lesson · Synthesized narration",
        50,
        515,
      );
      if (recorder.state === "recording") requestAnimationFrame(draw);
    }
    recorder.start();
    draw();
    source.start();
    setTimeout(() => {
      recorder.stop();
      source.stop();
      stream.getTracks().forEach((t) => t.stop());
      audioContext.close();
    }, buffer.duration * 1000);
    return done;
  });
  await writeFile(
    new URL("../public/media/garden.webm", import.meta.url),
    Buffer.from(base64, "base64"),
  );
  console.log("Generated original 32-second narrated garden.webm");
} finally {
  await browser.close();
}
