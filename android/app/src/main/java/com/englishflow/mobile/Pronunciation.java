package com.englishflow.mobile;

import android.content.Context;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import ai.onnxruntime.*;
import java.io.*;
import java.nio.*;
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.regex.*;
import org.json.*;

/** Local acoustic practice feedback; not a human-calibrated pronunciation exam. */
final class Pronunciation implements AutoCloseable {
    private final Context context;
    private final OrtEnvironment environment = OrtEnvironment.getEnvironment();
    private OrtSession session;
    private JSONObject lexicon, vocabulary;
    private final Map<Integer, String> symbols = new HashMap<>();

    Pronunciation(Context context) { this.context = context; }

    private String asset(String name) throws IOException {
        try (InputStream in = context.getAssets().open("assessment/" + name)) {
            return new String(read(in), java.nio.charset.StandardCharsets.UTF_8);
        }
    }
    private static byte[] read(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[16384]; int count;
        while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
        return out.toByteArray();
    }
    private void load() throws Exception {
        if (session != null) return;
        lexicon = new JSONObject(asset("lexicon.json"));
        vocabulary = new JSONObject(asset("vocab.json"));
        Iterator<String> keys = vocabulary.keys();
        while (keys.hasNext()) { String key = keys.next(); symbols.put(vocabulary.getInt(key), key); }
        try (OrtSession.SessionOptions options = new OrtSession.SessionOptions()) {
            options.setIntraOpNumThreads(2);
            JSONObject source = new JSONObject(asset("sources.json"));
            String digest = source.getString("sha256");
            if (!digest.matches("[a-f0-9]{64}")) throw new IOException("Thông tin mô hình không hợp lệ.");
            File model = new File(context.getNoBackupFilesDir(), "phonemes-" + digest.substring(0, 12) + ".onnx");
            if (!model.isFile() || model.length() != source.getLong("bytes")) {
                File temp = new File(model.getAbsolutePath() + ".part");
                java.security.MessageDigest sha = java.security.MessageDigest.getInstance("SHA-256");
                try (InputStream in = context.getAssets().open("assessment/phonemes.onnx"); OutputStream out = new FileOutputStream(temp)) {
                    byte[] buffer = new byte[32768]; int count;
                    while ((count = in.read(buffer)) != -1) { out.write(buffer, 0, count); sha.update(buffer, 0, count); }
                }
                StringBuilder hex = new StringBuilder(); for (byte b : sha.digest()) hex.append(String.format("%02x", b & 255));
                if (!hex.toString().equals(digest) || !temp.renameTo(model)) { temp.delete(); throw new IOException("Không lưu được mô hình chấm. Kiểm tra bộ nhớ trống."); }
            }
            session = environment.createSession(model.getAbsolutePath(), options);
        }
    }

    JSONObject assess(File audio, String text, BooleanSupplier cancelled) throws Exception {
        if (text == null || text.length() > 600) throw new IOException("Câu mẫu quá dài. Chọn một câu ngắn để chấm.");
        if (Pattern.compile("[0-9]").matcher(text).find()) throw new IOException("Câu này có số viết bằng chữ số. Chọn câu viết số bằng chữ để căn đủ âm.");
        load();
        ArrayList<String> terms = new ArrayList<>();
        ArrayList<Integer> phones = new ArrayList<>(), owners = new ArrayList<>();
        Matcher matcher = Pattern.compile("[a-z]+(?:'[a-z]+)?").matcher(text.toLowerCase(Locale.US).replace('’', '\''));
        ArrayList<String> missing = new ArrayList<>();
        while (matcher.find()) {
            String word = matcher.group();
            JSONArray sequence = lexicon.optJSONArray(word);
            if (sequence == null) { missing.add(word); continue; }
            int index = terms.size(); terms.add(word);
            for (int n = 0; n < sequence.length(); n++) { phones.add(sequence.getInt(n)); owners.add(index); }
        }
        if (!missing.isEmpty()) throw new IOException("Chưa có âm mẫu cho: " + String.join(", ", missing) + ". Hãy chọn câu khác.");
        if (terms.isEmpty() || terms.size() > 45 || phones.size() > 200) throw new IOException("Chọn câu tiếng Anh từ 1 đến 45 từ để chấm.");
        if (cancelled.getAsBoolean()) throw new InterruptedException();
        float[] samples = decode(audio);
        if (samples.length < 6400) throw new IOException("Bản ghi quá ngắn. Hãy đọc trọn câu rồi thử lại.");
        if (samples.length > 240000) throw new IOException("Chấm tối đa 15 giây mỗi lần. Hãy ghi lại một câu ngắn hơn.");
        double mean = 0, energy = 0; int clipped = 0;
        for (float sample : samples) { mean += sample; energy += sample * sample; if (Math.abs(sample) > .98) clipped++; }
        mean /= samples.length;
        double variance = Math.max(0, energy / samples.length - mean * mean);
        if (Math.sqrt(variance) < .003) throw new IOException("Bản ghi quá nhỏ hoặc im lặng. Đưa máy gần hơn và đọc lại.");
        if (clipped > samples.length * .15) throw new IOException("Âm thanh bị vỡ. Đưa microphone xa hơn và ghi lại.");
        double scale = Math.sqrt(variance + 1e-7);
        for (int i = 0; i < samples.length; i++) samples[i] = (float) ((samples[i] - mean) / scale);
        if (cancelled.getAsBoolean()) throw new InterruptedException();
        float[][] logits;
        try (OnnxTensor input = OnnxTensor.createTensor(environment, FloatBuffer.wrap(samples), new long[]{1, samples.length});
             OrtSession.Result result = session.run(Collections.singletonMap("input_values", input))) {
            logits = ((float[][][]) result.get(0).getValue())[0];
        }
        if (cancelled.getAsBoolean()) throw new InterruptedException();
        int blank = vocabulary.has("<pad>") ? vocabulary.getInt("<pad>") : vocabulary.getInt("[PAD]");
        double[] scores = align(logits, phones, blank);
        JSONArray words = new JSONArray();
        double total = 0;
        for (int word = 0; word < terms.size(); word++) {
            JSONArray detail = new JSONArray(); double sum = 0; int count = 0;
            for (int i = 0; i < phones.size(); i++) if (owners.get(i) == word) {
                int score = (int) Math.round(scores[i]); sum += score; count++;
                detail.put(new JSONObject().put("symbol", symbols.get(phones.get(i))).put("score", score));
            }
            int score = (int) Math.round(sum / Math.max(1, count)); total += sum;
            words.put(new JSONObject().put("word", terms.get(word)).put("score", score).put("phones", detail));
        }
        return new JSONObject().put("engine", "phoneme-ctc-1").put("score", Math.round(total / phones.size()))
                .put("seconds", Math.round(samples.length / 160.0) / 100.0).put("words", words);
    }

    // CTC Viterbi alignment keeps every expected phone in order, including repeats.
    // ponytail: posterior index is uncalibrated; add human-rated accent-diverse validation before examination use.
    static double[] align(float[][] logits, List<Integer> phones, int blank) throws IOException {
        int frames = logits.length, states = phones.size() * 2 + 1;
        if (frames < phones.size()) throw new IOException("Bản ghi chưa đủ dài cho câu mẫu. Hãy đọc trọn câu.");
        int[] labels = new int[states]; Arrays.fill(labels, blank);
        for (int i = 0; i < phones.size(); i++) labels[i * 2 + 1] = phones.get(i);
        double[][] logp = new double[frames][];
        for (int t = 0; t < frames; t++) {
            double max = -Double.MAX_VALUE, sum = 0;
            for (float value : logits[t]) max = Math.max(max, value);
            for (float value : logits[t]) sum += Math.exp(value - max);
            double norm = max + Math.log(sum); logp[t] = new double[logits[t].length];
            for (int c = 0; c < logits[t].length; c++) logp[t][c] = logits[t][c] - norm;
        }
        double[] previous = new double[states]; Arrays.fill(previous, Double.NEGATIVE_INFINITY);
        previous[0] = logp[0][blank]; previous[1] = logp[0][labels[1]];
        byte[][] back = new byte[frames][states];
        for (int t = 1; t < frames; t++) {
            double[] next = new double[states]; Arrays.fill(next, Double.NEGATIVE_INFINITY);
            for (int s = 0; s < states; s++) {
                double best = previous[s]; byte step = 0;
                if (s > 0 && previous[s - 1] > best) { best = previous[s - 1]; step = 1; }
                if (s > 1 && labels[s] != blank && labels[s] != labels[s - 2] && previous[s - 2] > best) { best = previous[s - 2]; step = 2; }
                next[s] = best + logp[t][labels[s]]; back[t][s] = step;
            }
            previous = next;
        }
        int s = previous[states - 1] > previous[states - 2] ? states - 1 : states - 2;
        if (!Double.isFinite(previous[s])) throw new IOException("Chưa căn được âm thanh với câu mẫu. Hãy ghi lại.");
        double[] peak = new double[phones.size()];
        for (int t = frames - 1; t >= 0; t--) {
            if (s % 2 == 1) peak[s / 2] = Math.max(peak[s / 2], Math.exp(logp[t][labels[s]]));
            if (t > 0) s -= back[t][s];
        }
        for (int i = 0; i < peak.length; i++) peak[i] *= 100;
        return peak;
    }

    /** Decode local AAC/MP3 to bounded 16 kHz mono PCM; no file uploads. */
    private static float[] decode(File file) throws Exception {
        if (!file.isFile() || file.length() == 0 || file.length() > 4_000_000) throw new IOException("Chưa có bản ghi hợp lệ. Hãy ghi âm trước.");
        MediaExtractor extractor = new MediaExtractor(); MediaCodec codec = null;
        try {
            try (FileInputStream input = new FileInputStream(file)) { extractor.setDataSource(input.getFD(), 0, file.length()); }
            int track = -1;
            for (int i = 0; i < extractor.getTrackCount(); i++) if (extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME).startsWith("audio/")) { track = i; break; }
            if (track < 0) throw new IOException("Không đọc được âm thanh trong bản ghi.");
            extractor.selectTrack(track); MediaFormat format = extractor.getTrackFormat(track);
            int rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE), channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
            if (rate < 8000 || rate > 192000 || channels < 1 || channels > 8) throw new IOException("Định dạng bản ghi chưa hỗ trợ.");
            codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)); codec.configure(format, null, null, 0); codec.start();
            ByteArrayOutputStream pcm = new ByteArrayOutputStream(); boolean inputDone = false, outputDone = false;
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo(); long deadline = System.nanoTime() + 15_000_000_000L;
            int encoding = android.media.AudioFormat.ENCODING_PCM_16BIT;
            while (!outputDone) {
                if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
                if (System.nanoTime() > deadline) throw new IOException("Đọc bản ghi quá lâu. Hãy ghi lại.");
                if (!inputDone) {
                    int index = codec.dequeueInputBuffer(10000);
                    if (index >= 0) {
                        ByteBuffer buffer = codec.getInputBuffer(index); int size = extractor.readSampleData(buffer, 0);
                        if (size < 0) { codec.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputDone = true; }
                        else { codec.queueInputBuffer(index, 0, size, extractor.getSampleTime(), 0); extractor.advance(); }
                    }
                }
                int index = codec.dequeueOutputBuffer(info, 10000);
                if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    MediaFormat decoded = codec.getOutputFormat(); rate = decoded.getInteger(MediaFormat.KEY_SAMPLE_RATE); channels = decoded.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                    if (decoded.containsKey(MediaFormat.KEY_PCM_ENCODING)) encoding = decoded.getInteger(MediaFormat.KEY_PCM_ENCODING);
                } else if (index >= 0) {
                    ByteBuffer buffer = codec.getOutputBuffer(index); buffer.position(info.offset); buffer.limit(info.offset + info.size);
                    byte[] bytes = new byte[info.size]; buffer.get(bytes); pcm.write(bytes);
                    outputDone = (info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0; codec.releaseOutputBuffer(index, false);
                    if (pcm.size() > rate * channels * 4 * 16) throw new IOException("Chấm tối đa 15 giây. Hãy ghi lại một câu ngắn hơn.");
                }
            }
            if (encoding != android.media.AudioFormat.ENCODING_PCM_16BIT && encoding != android.media.AudioFormat.ENCODING_PCM_FLOAT) throw new IOException("Định dạng PCM chưa hỗ trợ.");
            ByteBuffer pcmBytes = ByteBuffer.wrap(pcm.toByteArray()).order(ByteOrder.LITTLE_ENDIAN);
            int bytesPerSample = encoding == android.media.AudioFormat.ENCODING_PCM_FLOAT ? 4 : 2;
            int count = pcmBytes.remaining() / bytesPerSample / channels;
            if (count > rate * 15) throw new IOException("Chấm tối đa 15 giây. Hãy ghi lại một câu ngắn hơn.");
            float[] mono = new float[count];
            for (int i = 0; i < count; i++) for (int channel = 0; channel < channels; channel++) mono[i] += (bytesPerSample == 4 ? pcmBytes.getFloat() : pcmBytes.getShort() / 32768f) / channels;
            float[] output = new float[(int) ((long) count * 16000 / rate)];
            for (int i = 0; i < output.length; i++) { double position = (double) i * rate / 16000; int a = (int) position; output[i] = (float) (mono[a] + (mono[Math.min(count - 1, a + 1)] - mono[a]) * (position - a)); }
            return output;
        } finally {
            if (codec != null) { try { codec.stop(); } finally { codec.release(); } }
            extractor.release();
        }
    }
    @Override public synchronized void close() throws OrtException { if (session != null) { session.close(); session = null; } lexicon = null; vocabulary = null; symbols.clear(); }
}
