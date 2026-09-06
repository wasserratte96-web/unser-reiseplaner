package de.unserreiseplaner.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.widget.FrameLayout;
import android.view.ViewGroup;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String UPDATE_REPOSITORY = "wasserratte96-web/unser-reiseplaner";
    private static final int FILE_CHOOSER_REQUEST = 4001;

    private WebView webView;
    private FrameLayout root;
    private ValueCallback<Uri[]> filePathCallback;
    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private DatabaseHelper database;

    private boolean waitingForInstallPermission = false;
    private String pendingUpdateUrl = null;
    private String pendingUpdateLabel = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        database = new DatabaseHelper(this);

        // Android 15/16 erzwingt für targetSdk >= 35 Edge-to-Edge.
        // Padding direkt auf einer WebView ist je nach WebView-Version unzuverlässig.
        // Deshalb liegt die WebView in einem Root-Container. Die Insets werden nativ
        // als Root-Padding verarbeitet, inklusive OEM-Fallback für die Statusleiste.
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(248, 247, 243));
        setContentView(root);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(248, 247, 243));
        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        root.addView(webView, webParams);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(Color.rgb(248, 247, 243));
        getWindow().setNavigationBarColor(Color.rgb(248, 247, 243));

        // Systemleisten/Safe-Area: Die WebView selbst wird mit echten Layout-Margins
        // aus dem Bereich von Statusleiste, Navigationsleiste und Display-Cutout herausgehalten.
        // Das ist robuster als CSS-safe-area oder Padding in der WebView und funktioniert
        // auch bei Android 15/16 Edge-to-Edge sowie bei vielen OEM-WebViews.
        View decor = getWindow().getDecorView();
        View.OnApplyWindowInsetsListener insetListener = (view, insets) -> {
            applySafeInsets(insets);
            return insets;
        };
        root.setOnApplyWindowInsetsListener(insetListener);
        decor.setOnApplyWindowInsetsListener(insetListener);
        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        root.post(() -> { root.requestApplyInsets(); decor.requestApplyInsets(); applySafeInsets(root.getRootWindowInsets()); });
        root.postDelayed(() -> applySafeInsets(root.getRootWindowInsets()), 250);
        root.postDelayed(() -> applySafeInsets(root.getRootWindowInsets()), 900);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUserAgentString(settings.getUserAgentString() + " UnserReiseplaner/1.1.5");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String url = uri.toString();
                if (url.startsWith("file:///android_asset/")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                catch (Exception ignored) {}
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Dateiauswahl konnte nicht geöffnet werden.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new NativeBridge(), "AndroidBridge");
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private int systemDimension(String name) {
        int id = getResources().getIdentifier(name, "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    private void applySafeInsets(WindowInsets insets) {
        if (root == null || webView == null) return;
        if (Build.VERSION.SDK_INT < 35) {
            FrameLayout.LayoutParams oldLp = (FrameLayout.LayoutParams) webView.getLayoutParams();
            if (oldLp.leftMargin != 0 || oldLp.topMargin != 0 || oldLp.rightMargin != 0 || oldLp.bottomMargin != 0) {
                oldLp.setMargins(0, 0, 0, 0);
                webView.setLayoutParams(oldLp);
            }
            return;
        }
        int left = 0, top = 0, right = 0, bottom = 0;
        if (insets != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsetsIgnoringVisibility(
                        WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets gestures = insets.getInsets(WindowInsets.Type.systemGestures());
                left = Math.max(bars.left, gestures.left);
                top = bars.top;
                right = Math.max(bars.right, gestures.right);
                bottom = Math.max(bars.bottom, gestures.bottom);
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
        }
        // OEM-Fallbacks, falls bei der ersten Messung trotz sichtbarer Systemleiste 0 geliefert wird.
        if (top <= 0) top = systemDimension("status_bar_height");
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) webView.getLayoutParams();
        if (lp.leftMargin != left || lp.topMargin != top || lp.rightMargin != right || lp.bottomMargin != bottom) {
            lp.setMargins(left, top, right, bottom);
            webView.setLayoutParams(lp);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && root != null) {
            root.post(() -> { root.requestApplyInsets(); applySafeInsets(root.getRootWindowInsets()); });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (root != null) root.post(() -> { root.requestApplyInsets(); applySafeInsets(root.getRootWindowInsets()); });
        if (waitingForInstallPermission && getPackageManager().canRequestPackageInstalls()
                && pendingUpdateUrl != null) {
            waitingForInstallPermission = false;
            String url = pendingUpdateUrl;
            String label = pendingUpdateLabel;
            pendingUpdateUrl = null;
            pendingUpdateLabel = null;
            beginUpdateDownload(url, label);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] result = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                if (data.getData() != null) result = new Uri[]{data.getData()};
                else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    result = new Uri[count];
                    for (int i = 0; i < count; i++) result[i] = data.getClipData().getItemAt(i).getUri();
                }
            }
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        if (database != null) database.close();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private void notifyUpdater(String status, String message) {
        final String js = "window.AppUpdater && window.AppUpdater.__status(" +
                JSONObject.quote(status) + "," + JSONObject.quote(message) + ");";
        runOnUiThread(() -> webView.evaluateJavascript(js, null));
    }

    private boolean isAllowedReleaseUrl(String value) {
        try {
            URL url = new URL(value);
            if (!"https".equalsIgnoreCase(url.getProtocol())) return false;
            if (!"github.com".equalsIgnoreCase(url.getHost())) return false;
            return url.getPath().startsWith("/" + UPDATE_REPOSITORY + "/releases/download/");
        } catch (Exception e) {
            return false;
        }
    }

    private void beginUpdateDownload(String url, String versionLabel) {
        if (!isAllowedReleaseUrl(url)) {
            notifyUpdater("error", "Die Update-Adresse ist nicht erlaubt.");
            return;
        }

        executor.submit(() -> {
            HttpURLConnection connection = null;
            Uri apkUri = null;
            try {
                notifyUpdater("downloading", "Update wird heruntergeladen …");
                URL target = new URL(url);
                connection = (HttpURLConnection) target.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(60000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "UnserReiseplaner/1.1.5 Android updater");
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new IllegalStateException("HTTP " + status);

                String safeVersion = (versionLabel == null ? "update" : versionLabel)
                        .replaceAll("[^a-zA-Z0-9._-]+", "_");
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, "Unser_Reiseplaner-" + safeVersion + ".apk");
                values.put(MediaStore.Downloads.MIME_TYPE, "application/vnd.android.package-archive");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Unser Reiseplaner/Updates");
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                apkUri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (apkUri == null) throw new IllegalStateException("Update-Datei konnte nicht angelegt werden.");

                try (InputStream in = connection.getInputStream();
                     OutputStream out = getContentResolver().openOutputStream(apkUri)) {
                    if (out == null) throw new IllegalStateException("Update-Datei konnte nicht geöffnet werden.");
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    long total = 0;
                    long length = connection.getContentLengthLong();
                    int lastPercent = -1;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        total += read;
                        if (length > 0) {
                            int percent = (int) Math.min(100, (total * 100L) / length);
                            if (percent >= lastPercent + 10) {
                                lastPercent = percent;
                                notifyUpdater("downloading", "Update wird heruntergeladen … " + percent + " %");
                            }
                        }
                    }
                }

                ContentValues ready = new ContentValues();
                ready.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(apkUri, ready, null, null);

                Uri finalUri = apkUri;
                notifyUpdater("installing", "Download fertig. Android-Installer wird geöffnet …");
                runOnUiThread(() -> {
                    try {
                        Intent install = new Intent(Intent.ACTION_VIEW);
                        install.setDataAndType(finalUri, "application/vnd.android.package-archive");
                        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(install);
                    } catch (Exception e) {
                        notifyUpdater("error", "Installer konnte nicht geöffnet werden: " + e.getMessage());
                    }
                });
            } catch (Exception e) {
                if (apkUri != null) {
                    try { getContentResolver().delete(apkUri, null, null); }
                    catch (Exception ignored) {}
                }
                notifyUpdater("error", "Update fehlgeschlagen: " + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    public class NativeBridge {
        @JavascriptInterface
        public String loadState() {
            try { return database.get("main"); }
            catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public boolean saveState(String json) {
            try {
                database.put("main", json);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void request(String id, String url) {
            executor.submit(() -> {
                String body = "";
                String error = "";
                HttpURLConnection connection = null;
                try {
                    URL target = new URL(url);
                    String scheme = target.getProtocol();
                    if (!"https".equalsIgnoreCase(scheme)) throw new IllegalArgumentException("Nur HTTPS ist erlaubt.");
                    connection = (HttpURLConnection) target.openConnection();
                    connection.setRequestMethod("GET");
                    connection.setConnectTimeout(12000);
                    connection.setReadTimeout(25000);
                    connection.setInstanceFollowRedirects(true);
                    connection.setRequestProperty("Accept", "application/json,text/plain,*/*");
                    connection.setRequestProperty("Accept-Language", "de-DE,de;q=0.9,en;q=0.7");
                    String agent = "UnserReiseplanerBot/1.1.5 (https://github.com/wasserratte96-web/unser-reiseplaner)";
                    connection.setRequestProperty("User-Agent", agent);
                    if (target.getHost().endsWith("wikipedia.org") || target.getHost().endsWith("wikimedia.org") || target.getHost().endsWith("wikidata.org")) {
                        connection.setRequestProperty("Api-User-Agent", agent);
                    }
                    int status = connection.getResponseCode();
                    InputStream stream = (status >= 200 && status < 300) ? connection.getInputStream() : connection.getErrorStream();
                    if (stream != null) {
                        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                            StringBuilder out = new StringBuilder();
                            String line;
                            while ((line = reader.readLine()) != null) out.append(line).append('\n');
                            body = out.toString();
                        }
                    }
                    if (status < 200 || status >= 300) {
                        String detail = body == null ? "" : body.replaceAll("<[^>]+>", " ").replaceAll("&[a-zA-Z#0-9]+;", " ").replaceAll("\\s+", " ").trim();
                        String contentType = connection.getContentType();
                        if (contentType != null && (contentType.contains("html") || contentType.contains("xml"))) detail = "";
                        if (detail.length() > 120) detail = detail.substring(0, 120) + "…";
                        error = target.getHost() + ": HTTP " + status + (detail.isEmpty() ? "" : " – " + detail);
                    }
                } catch (Exception e) {
                    error = e.getClass().getSimpleName() + ": " + (e.getMessage() == null ? "Netzwerkfehler" : e.getMessage());
                } finally {
                    if (connection != null) connection.disconnect();
                }

                final String js = "window.NativeHttp && window.NativeHttp.__resolve(" +
                        JSONObject.quote(id) + "," + JSONObject.quote(body) + "," + JSONObject.quote(error) + ");";
                runOnUiThread(() -> webView.evaluateJavascript(js, null));
            });
        }

        @JavascriptInterface
        public String exportBackup(String json, String preferredName) {
            try {
                String safe = preferredName == null ? "" : preferredName.replaceAll("[^a-zA-Z0-9._-]+", "_");
                if (safe.isBlank()) {
                    safe = "Unser_Reiseplaner_" + new SimpleDateFormat("yyyyMMdd_HHmm", Locale.ROOT).format(new Date()) + ".json";
                }
                if (!safe.toLowerCase(Locale.ROOT).endsWith(".json")) safe += ".json";

                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Unser Reiseplaner");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return "Fehler: Download-Datei konnte nicht angelegt werden.";
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) return "Fehler: Datei konnte nicht geöffnet werden.";
                    out.write(json.getBytes(StandardCharsets.UTF_8));
                }
                return "Backup gespeichert: Downloads/Unser Reiseplaner/" + safe;
            } catch (Exception e) {
                return "Fehler beim Export: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String getAppVersion() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                JSONObject out = new JSONObject();
                out.put("versionName", info.versionName == null ? "" : info.versionName);
                out.put("versionCode", info.getLongVersionCode());
                out.put("repository", UPDATE_REPOSITORY);
                return out.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void downloadAndInstallApk(String url, String versionLabel) {
            runOnUiThread(() -> {
                if (!getPackageManager().canRequestPackageInstalls()) {
                    waitingForInstallPermission = true;
                    pendingUpdateUrl = url;
                    pendingUpdateLabel = versionLabel;
                    notifyUpdater("permission_required", "Bitte ‚Aus dieser Quelle zulassen‘ aktivieren. Danach kehrst du automatisch zur App zurück.");
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + getPackageName()));
                        startActivity(intent);
                    } catch (Exception e) {
                        notifyUpdater("error", "Android-Einstellung konnte nicht geöffnet werden.");
                    }
                    return;
                }
                beginUpdateDownload(url, versionLabel);
            });
        }

        @JavascriptInterface
        public void toast(String text) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, text, Toast.LENGTH_LONG).show());
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }
    }
}
