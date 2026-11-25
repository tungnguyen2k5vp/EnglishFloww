package com.englishflow.mobile;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.Toast;
import android.widget.FrameLayout;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView web;
    private TextToSpeech tts;
    private volatile boolean speechReady;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] exportBytes;
    private MediaRecorder recorder;
    private MediaPlayer player;
    private AudioManager audioManager;
    private File recording;
    private boolean pendingRecord;
    private boolean destroyed;
    private final ExecutorService scoreWorker = Executors.newSingleThreadExecutor();
    private final AtomicInteger scoreGeneration = new AtomicInteger();
    private final AtomicBoolean scoreBusy = new AtomicBoolean();
    private Pronunciation pronunciation;
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        if (change < 0) runOnUiThread(() -> { stopAudio(); audioEvent("stopped", "Âm thanh đã tạm dừng do ứng dụng khác sử dụng microphone hoặc loa."); });
    };

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        pronunciation = new Pronunciation(this);
        // Keep the active clip out of evictable cache; discard it on the next launch or activity destruction.
        recording = new File(getFilesDir(), "shadowing.m4a");
        if (recording.isFile() && !recording.delete()) toast("Không xóa được bản ghi cũ. Hãy kiểm tra bộ nhớ ứng dụng.");
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        web = new WebView(this);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        web.setBackgroundColor(Color.WHITE);
        FrameLayout content = new FrameLayout(this);
        content.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        content.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            }
            return insets;
        });
        setContentView(content);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new Device(), "EnglishFlowDevice");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost())) return blocked();
                String path = uri.getPath();
                if (path == null || path.contains("..") || path.contains("\\")) return blocked();
                if (path.equals("/")) path = "/mobile.html";
                try {
                    byte[] bytes;
                    try (InputStream input = getAssets().open(path.substring(1)); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                        byte[] chunk = new byte[16384];
                        int read;
                        while ((read = input.read(chunk)) != -1) buffer.write(chunk, 0, read);
                        bytes = buffer.toByteArray();
                    }
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'");
                    headers.put("X-Content-Type-Options", "nosniff");
                    headers.put("Content-Length", String.valueOf(bytes.length));
                    return new WebResourceResponse(mime(path), "UTF-8", 200, "OK", headers, new ByteArrayInputStream(bytes));
                } catch (IOException e) { return blocked(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) return false;
                if (request.isForMainFrame() && "https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (android.content.ActivityNotFoundException e) { toast("Không có trình duyệt để mở liên kết."); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(pick, 10); }
                catch (android.content.ActivityNotFoundException e) { fileCallback.onReceiveValue(null); fileCallback = null; toast("Không mở được trình chọn tệp."); }
                return true;
            }
        });
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS && !destroyed && tts != null) {
                int language = tts.setLanguage(Locale.US);
                speechReady = language != TextToSpeech.LANG_MISSING_DATA && language != TextToSpeech.LANG_NOT_SUPPORTED;
                tts.setSpeechRate(0.85f);
            }
        });
        tts.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
            @Override public void onStart(String id) { audioEvent("speech-started", null); }
            @Override public void onDone(String id) { audioManager.abandonAudioFocus(focusListener); audioEvent("speech-finished", null); }
            @Override public void onError(String id) { audioManager.abandonAudioFocus(focusListener); audioEvent("error", "Giọng đọc không khả dụng. Kiểm tra gói giọng tiếng Anh trong Android."); }
        });
        web.loadUrl("https://" + HOST + "/mobile.html");
    }

    private WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(MimeTypeMap.getFileExtensionFromUrl(path));
        return type == null ? "application/octet-stream" : type;
    }
    private void toast(String message) { runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show()); }
    private void audioEvent(String state, String message) {
        if (destroyed) return;
        try {
            org.json.JSONObject detail = new org.json.JSONObject().put("state", state);
            if (message != null) detail.put("message", message);
            String json = detail.toString();
            web.post(() -> { if (!destroyed) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('ef-audio',{detail:" + json + "}))", null); });
        } catch (org.json.JSONException ignored) { toast("Không gửi được trạng thái âm thanh."); }
    }
    private boolean focus() {
        return audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }
    private void startRecording() {
        pendingRecord = false;
        stopAudio();
        if (!focus()) { audioEvent("error", "Âm thanh đang được ứng dụng khác sử dụng. Hãy thử lại."); return; }
        try {
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(64000);
            recorder.setAudioSamplingRate(44100);
            recorder.setOutputFile(recording.getAbsolutePath());
            recorder.setMaxDuration(30000);
            recorder.setOnInfoListener((r, what, extra) -> { if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) finishRecording(); });
            recorder.setOnErrorListener((r, what, extra) -> { stopAudio(); audioEvent("error", "Ghi âm bị gián đoạn. Hãy thử lại."); });
            recorder.prepare(); recorder.start();
            audioEvent("recording", null);
        } catch (IOException | RuntimeException e) { stopAudio(); audioEvent("error", "Không dùng được microphone. Kiểm tra quyền và thử lại."); }
    }
    private void finishRecording() {
        if (recorder == null) return;
        MediaRecorder active = recorder;
        recorder = null;
        boolean success = false;
        try { active.stop(); success = recording.isFile() && recording.length() > 0; }
        catch (RuntimeException e) { /* A recording shorter than one audio frame cannot be played. */ }
        finally { active.release(); audioManager.abandonAudioFocus(focusListener); }
        audioEvent(success ? "ready" : "error", success ? null : "Bản ghi quá ngắn. Hãy nói trong ít nhất một giây rồi thử lại.");
    }
    private void stopAudio() {
        scoreGeneration.incrementAndGet();
        pendingRecord = false;
        finishRecording();
        if (player != null) { player.release(); player = null; }
        if (tts != null) tts.stop();
        audioManager.abandonAudioFocus(focusListener);
    }

    public final class Device {
        @JavascriptInterface public void cancelAssessment() { scoreGeneration.incrementAndGet(); }
        @JavascriptInterface public void assessPronunciation(String text, String requestId) {
            if (destroyed || requestId == null || !requestId.matches("[a-zA-Z0-9-]{1,80}")) return;
            runOnUiThread(() -> {
                int generation = scoreGeneration.incrementAndGet();
                if (recorder != null || !scoreBusy.compareAndSet(false, true)) {
                    assessmentEvent(requestId, null, "Hãy dừng ghi âm và chờ lượt chấm trước kết thúc rồi thử lại."); return;
                }
                scoreWorker.execute(() -> {
                    try {
                        org.json.JSONObject result = pronunciation.assess(recording, text, () -> destroyed || generation != scoreGeneration.get());
                        if (generation == scoreGeneration.get()) assessmentEvent(requestId, result, null);
                    } catch (InterruptedException ignored) {
                        // A cancelled/navigation-obsolete attempt never publishes a score.
                    } catch (Exception | OutOfMemoryError error) {
                        if (generation == scoreGeneration.get()) assessmentEvent(requestId, null, error instanceof IOException ? error.getMessage() : "Chưa chạy được mô hình chấm trên thiết bị này. Đóng bớt ứng dụng và thử lại.");
                    } finally { scoreBusy.set(false); }
                });
            });
        }
        @JavascriptInterface public String readState() {
            return getSharedPreferences("englishflow", MODE_PRIVATE).getString("studyState", "");
        }
        @JavascriptInterface public boolean saveState(String json) {
            if (json == null || json.length() > 8_000_000) return false;
            try {
                if (new org.json.JSONObject(json).optInt("version") != 1) return false;
                // commit() finishes the private disk write before JavaScript publishes the new state.
                return getSharedPreferences("englishflow", MODE_PRIVATE).edit().putString("studyState", json).commit();
            } catch (org.json.JSONException | RuntimeException e) { return false; }
        }
        @JavascriptInterface public boolean speak(String text) {
            return speakAccent(text, "en-US");
        }
        @JavascriptInterface public boolean speakAccent(String text, String accent) {
            if (text == null || text.trim().isEmpty() || text.length() > 2000 || !speechReady) return false;
            if (!"en-US".equals(accent) && !"en-GB".equals(accent)) return false;
            runOnUiThread(() -> {
                MainActivity.this.stopAudio();
                Locale locale = Locale.forLanguageTag(accent);
                Set<android.speech.tts.Voice> voices = tts.getVoices();
                android.speech.tts.Voice voice = voices == null ? null : voices.stream()
                    .filter(v -> !v.isNetworkConnectionRequired() && !v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) && v.getLocale().getLanguage().equals("en") && v.getLocale().getCountry().equals(locale.getCountry()))
                    .sorted(Comparator.comparing(android.speech.tts.Voice::getName)).findFirst().orElse(null);
                if (voice == null || tts.setVoice(voice) == TextToSpeech.ERROR) {
                    audioEvent("error", "Chưa có giọng " + ("en-GB".equals(accent) ? "UK" : "US") + " ngoại tuyến. Hãy cài gói giọng tiếng Anh trong Android.");
                    return;
                }
                tts.setSpeechRate(0.85f);
                if (!focus() || tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "englishflow") == TextToSpeech.ERROR)
                    audioEvent("error", "Không phát được giọng mẫu. Hãy kiểm tra gói giọng tiếng Anh trong Android.");
            });
            return true;
        }
        @JavascriptInterface public void record() {
            runOnUiThread(() -> {
                if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    pendingRecord = true;
                    requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO}, 12);
                } else startRecording();
            });
        }
        @JavascriptInterface public void stopRecording() { runOnUiThread(() -> finishRecording()); }
        @JavascriptInterface public void stopAudio() { runOnUiThread(() -> MainActivity.this.stopAudio()); }
        @JavascriptInterface public void playRecording() {
            runOnUiThread(() -> {
                MainActivity.this.stopAudio();
                if (!recording.isFile() || recording.length() == 0) { audioEvent("error", "Chưa có bản ghi. Hãy ghi âm trước."); return; }
                if (!focus()) { audioEvent("error", "Âm thanh đang bận. Hãy thử lại."); return; }
                try {
                    player = new MediaPlayer();
                    player.setDataSource(recording.getAbsolutePath());
                    player.setOnCompletionListener(p -> { MainActivity.this.stopAudio(); audioEvent("ready", null); });
                    player.setOnErrorListener((p, what, extra) -> { MainActivity.this.stopAudio(); audioEvent("error", "Không phát được bản ghi. Hãy ghi lại."); return true; });
                    player.prepare(); player.start(); audioEvent("playing", null);
                } catch (IOException | RuntimeException e) { MainActivity.this.stopAudio(); audioEvent("error", "Không phát được bản ghi. Hãy ghi lại."); }
            });
        }
        @JavascriptInterface public boolean download(String name, String text) {
            if (name == null || text == null || !name.matches("[a-zA-Z0-9._-]{1,100}") || text.length() > 8_000_000) return false;
            runOnUiThread(() -> {
                if (exportBytes != null) { toast("Hãy lưu hoặc hủy tệp đang xuất trước."); return; }
                exportBytes = text.getBytes(StandardCharsets.UTF_8);
                String mime = name.endsWith(".csv") ? "text/csv" : name.endsWith(".txt") ? "text/plain" : "application/json";
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType(mime).addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(save, 11); }
                catch (android.content.ActivityNotFoundException e) { exportBytes = null; toast("Không mở được trình lưu tệp."); }
            });
            return true;
        }
    }
    private void assessmentEvent(String id, org.json.JSONObject result, String error) {
        if (destroyed) return;
        try {
            org.json.JSONObject detail = new org.json.JSONObject().put("id", id);
            if (result != null) detail.put("result", result);
            if (error != null) detail.put("error", error);
            runOnUiThread(() -> { if (!destroyed) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('ef-assessment',{detail:" + detail + "}))", null); });
        } catch (org.json.JSONException ignored) { }
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 12) {
            boolean requested = pendingRecord;
            pendingRecord = false;
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) { if (requested) startRecording(); }
            else audioEvent("error", "Chưa được cấp quyền microphone. Bạn vẫn có thể nghe mẫu; cấp quyền trong Cài đặt Android để ghi âm.");
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 10 && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            fileCallback = null;
        }
        if (request == 11) {
            byte[] bytes = exportBytes;
            exportBytes = null;
            if (result == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (output == null) throw new IOException("No output stream");
                    output.write(bytes);
                    toast("Đã lưu tệp.");
                } catch (IOException e) { toast("Không lưu được tệp. Dữ liệu trong ứng dụng vẫn được giữ."); }
            }
        }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.englishFlowBack ? window.englishFlowBack() : null", handled -> {
            if ("false".equals(handled)) finish();
            else if (!"true".equals(handled)) {
                if (web.canGoBack()) web.goBack(); else finish();
            }
        });
    }
    @Override protected void onPause() {
        super.onPause();
        web.onPause();
        web.evaluateJavascript("document.querySelectorAll('audio,video').forEach(m=>m.pause())", null);
        boolean permissionDialog = pendingRecord;
        stopAudio();
        pendingRecord = permissionDialog;
        scoreWorker.execute(() -> { try { pronunciation.close(); } catch (Exception ignored) { } });
        audioEvent("stopped", null);
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        stopAudio();
        destroyed = true;
        scoreWorker.execute(() -> { try { pronunciation.close(); } catch (Exception ignored) { } });
        scoreWorker.shutdown();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (tts != null) { speechReady = false; tts.stop(); tts.shutdown(); }
        web.removeJavascriptInterface("EnglishFlowDevice");
        web.destroy();
        if (recording.isFile() && !recording.delete()) recording.deleteOnExit();
        super.onDestroy();
    }
}
