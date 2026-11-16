// The only readable code on the published page.
// It asks for the passphrase, unscrambles the app (app.enc) on this device,
// and starts it. The unscrambling key is remembered on this device so the
// passphrase is typed once. Without the passphrase, app.enc is unreadable.
(function () {
  var SALT = "EGLA2ZD9efg+Pxu5O07u/w==";
  var ITERATIONS = 600000;
  var KEY_NAME = "strikerx-lock-key";

  if ("serviceWorker" in navigator) {
    // updateViaCache "none": always ask the server whether sw.js changed, never reuse a stored copy.
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(function () {});
  }

  function fromB64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toB64(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  // Must match normalize() in lock-shared.mjs exactly.
  function normalize(p) {
    return p.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function deriveKeyBytes(passphrase) {
    var enc = new TextEncoder().encode(normalize(passphrase));
    return crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveBits"]).then(function (base) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(SALT), iterations: ITERATIONS }, base, 256);
    }).then(function (bits) { return new Uint8Array(bits); });
  }

  function decrypt(keyBytes, sealed) {
    var iv = sealed.slice(0, 12), body = sealed.slice(12);
    return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, body);
    }).then(function (plain) { return new TextDecoder().decode(plain); });
  }

  function startApp(code) {
    var lock = document.getElementById("lock");
    if (lock) lock.remove();
    var s = document.createElement("script");
    s.textContent = code;
    document.body.appendChild(s);
  }

  function el(tag, style, text) {
    var e = document.createElement(tag);
    if (style) e.setAttribute("style", style);
    if (text) e.textContent = text;
    return e;
  }

  function showMessage(text) {
    var lock = document.getElementById("lock");
    lock.textContent = "";
    lock.appendChild(el("p", "color:#cbd5e1;font:16px/1.5 system-ui,sans-serif;max-width:300px;text-align:center;", text));
  }

  function showForm(sealed) {
    var lock = document.getElementById("lock");
    lock.textContent = "";
    var img = el("img", "width:112px;height:112px;border-radius:24px;");
    img.src = "icon-192.png";
    img.alt = "StrikeRX";
    var form = el("form", "display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:320px;");
    var label = el("label", "color:#cbd5e1;font:16px system-ui,sans-serif;", "Enter your passphrase");
    label.htmlFor = "pass";
    var input = el("input", "width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:1px solid #334155;background:#0f172a;color:#f8fafc;font:16px system-ui,sans-serif;");
    input.id = "pass";
    input.type = "password";
    input.autocomplete = "current-password";
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocorrect", "off");
    input.spellcheck = false;
    var showRow = el("label", "color:#94a3b8;font:14px system-ui,sans-serif;display:flex;gap:8px;align-items:center;");
    var show = el("input");
    show.type = "checkbox";
    show.addEventListener("change", function () { input.type = show.checked ? "text" : "password"; });
    showRow.appendChild(show);
    showRow.appendChild(document.createTextNode("Show what I type"));
    var button = el("button", "width:100%;padding:14px;border:0;border-radius:12px;background:#f59e0b;color:#070b18;font:600 16px system-ui,sans-serif;", "Unlock");
    button.type = "submit";
    var note = el("p", "min-height:20px;margin:0;color:#fca5a5;font:14px system-ui,sans-serif;text-align:center;");
    note.setAttribute("role", "alert");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!input.value.trim()) return;
      button.disabled = true;
      note.style.color = "#94a3b8";
      note.textContent = "Checking...";
      var keyBytes;
      deriveKeyBytes(input.value).then(function (k) {
        keyBytes = k;
        return decrypt(k, sealed);
      }).then(function (code) {
        try { localStorage.setItem(KEY_NAME, toB64(keyBytes)); } catch (e) {}
        startApp(code);
      }).catch(function () {
        button.disabled = false;
        note.style.color = "#fca5a5";
        note.textContent = "That passphrase did not work. Try again.";
        input.select();
      });
    });

    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(showRow);
    form.appendChild(button);
    form.appendChild(note);
    lock.appendChild(img);
    lock.appendChild(form);
    input.focus();
  }

  if (!window.crypto || !crypto.subtle) {
    showMessage("This browser cannot unlock StrikeRX. Open the page in Safari or Chrome with https.");
    return;
  }

  fetch("app.enc").then(function (res) {
    if (!res.ok) throw new Error("load");
    return res.arrayBuffer();
  }).then(function (buf) {
    var sealed = new Uint8Array(buf);
    var saved = null;
    try { saved = localStorage.getItem(KEY_NAME); } catch (e) {}
    if (!saved) return showForm(sealed);
    return decrypt(fromB64(saved), sealed).then(startApp, function () {
      // The passphrase was changed since this device last unlocked.
      try { localStorage.removeItem(KEY_NAME); } catch (e) {}
      showForm(sealed);
    });
  }).catch(function () {
    showMessage("StrikeRX could not load. Check your signal and open it again.");
  });
})();
