/*
 * RupeeQ personal-loan landing page — form flow and page interactions.
 * Plain browser JS, no build step. Configure via window.RQ_CONFIG (see index.html).
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ config */

  var CONFIG = Object.assign(
    {
      apiBase: "",
      offersPath: "/personal-loan/offers",
      links: { terms: "/terms", privacy: "/privacy" },
    },
    window.RQ_CONFIG || {},
  );
  var DEMO = !CONFIG.apiBase;
  var FORM_KEY = "rq_pl_form_v1";
  var ATTR_KEY = "rq_attr";
  var EXIT_KEY = "rq_exit_shown";
  var PERSISTED = [
    "name", "mobile", "consent", "employment", "income", "pincode",
    "step", "leadId", "token", "requestId", "purpose", "amountHint",
  ];
  var STEP_FIELDS = {
    1: ["name", "mobile", "consent"],
    2: ["otp"],
    3: ["employment", "income", "pincode"],
    4: [],
  };
  var EMPTY_DATA = {
    name: "", mobile: "", consent: false, otp: "",
    employment: "", income: "", pincode: "", purpose: "", amountHint: "",
  };
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------------- utils */

  var inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  function rupees(n) { return "₹" + inr.format(Math.round(Number(n) || 0)); }
  function groupDigits(v) { return v === "" || v == null ? "" : inr.format(Number(v)); }
  function digits(v) { return String(v || "").replace(/\D/g, ""); }
  function firstName(v) { return (v || "").trim().split(/\s+/)[0] || ""; }
  function lakh(n) {
    if (n >= 1e5) {
      var l = n / 1e5;
      return "₹" + (Number.isInteger(l) ? l : l.toFixed(1).replace(/\.0$/, "")) + " Lakh";
    }
    return rupees(n);
  }
  function normaliseMobile(v) {
    var d = digits(v);
    if (d.length > 10 && d.indexOf("91") === 0) d = d.slice(2);
    if (d.length > 10 && d.indexOf("0") === 0) d = d.slice(1);
    return d.slice(0, 10);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var ICON_ATTRS =
    'width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  var icon = {
    arrow: function (cls) {
      return "<svg " + ICON_ATTRS + ' stroke-width="2" class="' + (cls || "h-5 w-5") + '"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>';
    },
    check: function (cls, sw) {
      return "<svg " + ICON_ATTRS + ' stroke-width="' + (sw || 2) + '" class="' + cls + '"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>';
    },
    lock: function (cls) {
      return "<svg " + ICON_ATTRS + ' stroke-width="2" class="' + cls + '"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"></rect><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"></path></svg>';
    },
    briefcase: function (cls) {
      return "<svg " + ICON_ATTRS + ' stroke-width="2" class="' + cls + '"><rect x="3" y="7.5" width="18" height="12" rx="2.5"></rect><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"></path><path d="M3 12.5h18"></path></svg>';
    },
    store: function (cls) {
      return "<svg " + ICON_ATTRS + ' stroke-width="2" class="' + cls + '"><path d="M4 10v9.5h16V10"></path><path d="M3 5h18l-1.5 5a2.8 2.8 0 0 1-5.2.4A2.8 2.8 0 0 1 12 12a2.8 2.8 0 0 1-2.3-1.6 2.8 2.8 0 0 1-5.2-.4L3 5Z"></path><path d="M9.5 19.5v-5h5v5"></path></svg>';
    },
    doc: function (cls) {
      return "<svg " + ICON_ATTRS + ' stroke-width="2" class="' + cls + '"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"></path><path d="M14 3v5h5"></path><path d="M9 13h6M9 17h4"></path></svg>';
    },
    clock: function (cls) {
      return "<svg " + ICON_ATTRS + ' stroke-width="2" class="' + cls + '"><circle cx="12" cy="12" r="9.5"></circle><path d="M12 7v5l3 2"></path></svg>';
    },
    close: function () {
      return "<svg " + ICON_ATTRS + ' stroke-width="2" class="h-5 w-5"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>';
    },
  };

  /* -------------------------------------------------------------- validation */

  var validators = {
    name: function (v) {
      var t = (v || "").trim();
      if (!t) return "Please tell us your name.";
      if (t.length < 2) return "That looks a little short. Please enter your full name.";
      return /^[A-Za-z][A-Za-z.' ]*$/.test(t) ? "" : "Please use letters only, as on your PAN.";
    },
    mobile: function (v) {
      var d = digits(v);
      if (!d) return "We need your mobile number to send the OTP.";
      if (d.length < 10) return "Just " + (10 - d.length) + " more digit" + (d.length === 9 ? "" : "s") + " to go.";
      return /^[6-9]/.test(d) ? "" : "Indian mobile numbers start with 6, 7, 8 or 9.";
    },
    consent: function (v) {
      return v ? "" : "Please tick the box so we can contact you about your offers.";
    },
    otp: function (v) {
      return digits(v).length === 6 ? "" : "Enter the 6-digit code we sent you.";
    },
    employment: function (v) {
      return v ? "" : "Please choose how you earn.";
    },
    income: function (v) {
      var n = Number(digits(v));
      if (!n) return "Please enter your monthly income.";
      if (n < 1e3) return "Please enter your monthly income in rupees.";
      return n > 1e7 ? "That looks too high for a monthly figure. Please check." : "";
    },
    pincode: function (v) {
      var d = digits(v);
      if (!d) return "Please enter your current PIN code.";
      if (d.length !== 6) return "PIN code has 6 digits.";
      return d[0] === "0" ? "PIN codes don’t start with 0." : "";
    },
  };
  function validate(field, value) {
    return validators[field] ? validators[field](value) : "";
  }

  /* --------------------------------------------------------------- analytics */

  var PII_KEY = /name|phone|mobile|pan|dob|birth|email|otp|pincode|pin_code|income|address|aadhaar/i;
  var PII_VALUE = [
    /\b[6-9]\d{9}\b/,
    /\b[A-Z]{5}\d{4}[A-Z]\b/i,
    /\b\d{2}\/\d{2}\/\d{4}\b/,
    /[^\s@]+@[^\s@]+\.[^\s@]+/,
    /\b\d{6}\b/,
  ];
  function track(event, params) {
    var clean = {};
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (PII_KEY.test(k)) return;
      if (typeof v === "string" && PII_VALUE.some(function (re) { return re.test(v); })) return;
      clean[k] = v;
    });
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: event }, clean));
    } catch (e) {}
  }

  function trackScrollDepth() {
    var marks = [25, 50, 75, 90, 100];
    var seen = {};
    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (max <= 0) return;
        var pct = Math.round((window.scrollY / max) * 100);
        marks.forEach(function (m) {
          if (pct >= m && !seen[m]) {
            seen[m] = true;
            track("scroll_depth", { percent: m });
          }
        });
        if (Object.keys(seen).length === marks.length) window.removeEventListener("scroll", onScroll);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ------------------------------------------------------------- attribution */

  var ATTR_PARAMS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "gclid", "gbraid", "wbraid", "fbclid",
  ];
  function readAttribution() {
    try { return JSON.parse(sessionStorage.getItem(ATTR_KEY) || "null"); } catch (e) { return null; }
  }
  function captureAttribution() {
    var qs = new URLSearchParams(window.location.search);
    var fresh = {};
    ATTR_PARAMS.forEach(function (k) {
      var v = qs.get(k);
      if (v) fresh[k] = v.slice(0, 500);
    });
    var stored = readAttribution();
    var attr =
      Object.keys(fresh).length > 0 || !stored
        ? Object.assign(fresh, {
            landing_page: window.location.origin + window.location.pathname,
            referrer: document.referrer || "",
            first_seen: new Date().toISOString(),
          })
        : stored;
    if (attr.fbclid && !attr.fbc) attr.fbc = "fb.1." + Date.now() + "." + attr.fbclid;
    try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr)); } catch (e) {}
    return attr;
  }
  function attribution() { return readAttribution() || captureAttribution(); }

  /* --------------------------------------------------------------------- api */

  function post(path, body) {
    return fetch(CONFIG.apiBase + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) {
          var err = new Error(json.message || "Something went wrong. Please try again.");
          err.code = json.code;
          throw err;
        }
        return json;
      });
    });
  }

  var api = {
    sendOtp: function (p) {
      if (DEMO) return sleep(700).then(function () { return { requestId: "mock-" + Date.now() }; });
      return post("/api/pl/otp/send", {
        name: p.name,
        mobile: p.mobile,
        consent_marketing: p.consent,
        consent_ts: new Date().toISOString(),
        attribution: p.attribution,
        context: p.context,
      });
    },
    verifyOtp: function (p) {
      if (DEMO) {
        return sleep(700).then(function () {
          if (p.otp === "000000") {
            var err = new Error("That code didn’t match. Please check the SMS and try again.");
            err.code = "OTP_MISMATCH";
            throw err;
          }
          return { leadId: "lead_" + Math.random().toString(36).slice(2, 10), token: "mock-token" };
        });
      }
      return post("/api/pl/otp/verify", { request_id: p.requestId, otp: p.otp });
    },
    eligibility: function (p) {
      if (DEMO) {
        return sleep(1800).then(function () {
          return { redirectUrl: CONFIG.offersPath + "?lead=" + encodeURIComponent(p.leadId) };
        });
      }
      return post("/api/pl/eligibility", p);
    },
  };

  /* ------------------------------------------------------------------- state */

  function loadSaved() {
    try {
      var saved = JSON.parse(sessionStorage.getItem(FORM_KEY) || "null");
      if (!saved) return null;
      var out = {};
      PERSISTED.forEach(function (k) { if (saved[k] !== undefined) out[k] = saved[k]; });
      return out;
    } catch (e) {
      return null;
    }
  }
  function clearSaved() {
    try { sessionStorage.removeItem(FORM_KEY); } catch (e) {}
  }

  var saved = loadSaved() || {};
  var initialStep = 1;
  if (saved.step >= 3 && saved.token) initialStep = 3;
  else if (saved.step === 2 && saved.requestId && !validate("mobile", saved.mobile || "")) initialStep = 2;

  var state = {
    step: initialStep,
    data: Object.assign({}, EMPTY_DATA),
    errors: {},
    requestId: saved.requestId || null,
    leadId: saved.leadId || null,
    token: saved.token || null,
    restored: initialStep > 1,
    busy: false,
    formError: "",
  };
  Object.keys(EMPTY_DATA).forEach(function (k) { if (saved[k] !== undefined) state.data[k] = saved[k]; });

  function persist() {
    try {
      var src = Object.assign({}, state.data, {
        step: state.step, leadId: state.leadId, token: state.token, requestId: state.requestId,
      });
      var out = {};
      PERSISTED.forEach(function (k) {
        if (src[k] !== undefined && src[k] !== "" && src[k] !== null) out[k] = src[k];
      });
      sessionStorage.setItem(FORM_KEY, JSON.stringify(out));
    } catch (e) {}
  }

  function setField(field, value) {
    state.data[field] = value;
    // A field with an error clears it as soon as the value becomes valid.
    if (state.errors[field] && !validate(field, value)) setError(field, "");
    persist();
  }

  /* ---------------------------------------------------------- form rendering */

  var card = $("#apply");
  var progressEl = $("#apply-progress");
  var bodyEl = $("#apply-body");
  var STEP_LABELS = ["Details", "Verify", "Offers"];

  function renderProgress() {
    var shown = Math.min(state.step, 3);
    var labels = STEP_LABELS.map(function (label, i) {
      return (
        "<span" + (shown === i + 1 ? ' aria-current="step"' : "") + ' class="' + (shown >= i + 1 ? "text-ink" : "") + '">' +
        label + (i < 2 ? '<span aria-hidden="true" class="mx-1.5 text-line">·</span>' : "") + "</span>"
      );
    }).join("");
    var bars = STEP_LABELS.map(function (_, i) {
      var fill = state.step > i + 1 ? 1 : state.step === i + 1 ? 0.6 : 0;
      return (
        '<div class="h-1.5 overflow-hidden rounded-full bg-brand-100">' +
        '<div class="rq-progress-fill h-full origin-left rounded-full bg-brand" style="--progress:' + fill + '"></div></div>'
      );
    }).join("");
    var existing = $$(".rq-progress-fill", progressEl);
    if (existing.length === 3) {
      // Update in place so the bar widths animate between steps.
      $("[data-progress-labels]", progressEl).innerHTML = '<span class="sr-only">Step ' + shown + " of 3: </span>" + labels;
      existing.forEach(function (el, i) {
        el.style.setProperty("--progress", state.step > i + 1 ? 1 : state.step === i + 1 ? 0.6 : 0);
      });
      return;
    }
    progressEl.innerHTML =
      '<div class="mb-2 flex items-center justify-between text-xs font-semibold">' +
      '<span class="text-ink-soft" data-progress-labels><span class="sr-only">Step ' + shown + " of 3: </span>" + labels + "</span></div>" +
      '<div class="grid grid-cols-3 gap-1.5" aria-hidden="true">' + bars + "</div>";
  }

  function textField(o) {
    var err = state.errors[o.field];
    var id = "f-" + o.field;
    var describedBy = [err ? id + "-err" : null, o.hint ? id + "-hint" : null].filter(Boolean).join(" ");
    var attrs = Object.keys(o.attrs || {}).map(function (k) {
      return " " + k + '="' + esc(o.attrs[k]) + '"';
    }).join("");
    return (
      '<div data-field="' + o.field + '">' +
      '<div data-field-box class="' + fieldBoxClass(err) + '">' +
      (o.prefix
        ? '<span class="ml-4 flex items-center gap-2 pt-4 text-base font-semibold text-ink" aria-hidden="true">' + o.prefix + '<span class="h-5 w-px bg-line"></span></span>'
        : "") +
      '<input id="' + id + '" placeholder="' + esc(o.prefix ? o.placeholder || "" : " ") + '" aria-invalid="' + (err ? "true" : "false") + '"' +
      (describedBy ? ' aria-describedby="' + describedBy + '"' : "") +
      ' class="peer h-full w-full rounded-2xl bg-transparent pt-4 text-base font-semibold text-ink outline-none ' +
      (o.prefix ? "pl-2 pr-4 placeholder:text-ink-soft/70" : "px-4 placeholder:text-transparent") + '"' +
      attrs + ' value="' + esc(o.value) + '">' +
      '<label for="' + id + '" class="pointer-events-none absolute left-4 top-2 text-xs font-medium text-ink-soft transition-all peer-focus:text-brand' +
      (o.prefix ? "" : " peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs") +
      '">' + o.label + "</label></div>" +
      (o.hint && !err ? '<p id="' + id + '-hint" class="mt-1.5 px-1 text-xs text-ink-soft">' + o.hint + "</p>" : "") +
      (err ? fieldErrorHtml(id + "-err", err) : "") +
      "</div>"
    );
  }
  function fieldBoxClass(err) {
    return (
      "group relative flex h-14 items-center rounded-2xl border-2 bg-white transition-colors " +
      (err ? "border-err" : "border-line focus-within:border-brand hover:border-brand-100 focus-within:hover:border-brand")
    );
  }
  function fieldErrorHtml(id, msg) {
    return (
      '<p id="' + id + '" role="alert" class="mt-1.5 flex items-start gap-1.5 px-1 text-[13px] font-medium text-err">' +
      '<span aria-hidden="true">•</span>' + esc(msg) + "</p>"
    );
  }

  function consentField() {
    var err = state.errors.consent;
    return (
      '<div data-field="consent"><label for="f-consent" class="flex min-h-12 cursor-pointer items-start gap-3 py-1">' +
      '<span class="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">' +
      '<input id="f-consent" type="checkbox"' + (state.data.consent ? " checked" : "") +
      ' aria-invalid="' + (err ? "true" : "false") + '"' + (err ? ' aria-describedby="f-consent-err"' : "") +
      ' class="' + consentClass(err) + '">' +
      '<svg viewBox="0 0 24 24" class="pointer-events-none absolute h-4 w-4 text-white opacity-0 peer-checked:opacity-100" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>' +
      "</span>" +
      '<span class="text-[13px] leading-snug text-ink-soft">I agree to the ' +
      '<a class="font-semibold text-brand underline underline-offset-2" href="' + esc(CONFIG.links.terms) + '" target="_blank" rel="noopener">Terms</a> and ' +
      '<a class="font-semibold text-brand underline underline-offset-2" href="' + esc(CONFIG.links.privacy) + '" target="_blank" rel="noopener">Privacy Policy</a>' +
      ", and allow RupeeQ and its lending partners to contact me by call, SMS, WhatsApp or email about my loan request.</span></label>" +
      (err ? '<p id="f-consent-err" role="alert" class="ml-9 text-[13px] font-medium text-err">' + esc(err) + "</p>" : "") +
      "</div>"
    );
  }
  function consentClass(err) {
    return (
      "peer h-6 w-6 cursor-pointer appearance-none rounded-md border-2 bg-white transition-colors checked:border-brand checked:bg-brand " +
      (err ? "border-err" : "border-ink-soft/50")
    );
  }

  var EMPLOYMENT = [
    { id: "salaried", label: "Salaried", sub: "Monthly salary", icon: icon.briefcase },
    { id: "self_employed", label: "Self-employed", sub: "Business / profession", icon: icon.store },
  ];
  function employmentField() {
    var value = state.data.employment;
    var err = state.errors.employment;
    var focusIdx = Math.max(0, EMPLOYMENT.findIndex(function (o) { return o.id === value; }));
    var buttons = EMPLOYMENT.map(function (o, i) {
      var on = value === o.id;
      return (
        '<button id="emp-' + o.id + '" data-emp="' + o.id + '" type="button" role="radio" aria-checked="' + on + '" tabindex="' + (i === focusIdx ? 0 : -1) + '"' +
        (i === focusIdx ? ' data-focus-target="employment"' : "") +
        ' class="relative flex min-h-[88px] flex-col items-start justify-center gap-1 rounded-2xl border-2 p-3 text-left transition-all ' +
        (on ? "border-brand bg-brand-50 shadow-[var(--shadow-soft)]" : err ? "border-err bg-white" : "border-line bg-white hover:border-brand-100") + '">' +
        '<span class="flex h-9 w-9 items-center justify-center rounded-xl ' + (on ? "bg-brand text-white" : "bg-lilac text-brand") + '">' + o.icon("h-5 w-5") + "</span>" +
        '<span class="text-[15px] font-bold text-ink">' + o.label + "</span>" +
        '<span class="text-xs text-ink-soft">' + o.sub + "</span>" +
        (on
          ? '<span class="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-ok text-white">' + icon.check("h-3.5 w-3.5", 3) + "</span>"
          : "") +
        "</button>"
      );
    }).join("");
    return (
      '<fieldset data-field="employment"><legend class="mb-2 px-1 text-sm font-semibold text-ink">How do you earn?</legend>' +
      '<div role="radiogroup" aria-label="Employment type" aria-invalid="' + (err ? "true" : "false") + '" class="grid grid-cols-2 gap-3">' + buttons + "</div>" +
      (err ? '<p role="alert" class="mt-1.5 px-1 text-[13px] font-medium text-err">' + esc(err) + "</p>" : "") +
      "</fieldset>"
    );
  }

  function formErrorHtml() {
    return state.formError
      ? '<p role="alert" data-form-error class="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-err">' + esc(state.formError) + "</p>"
      : '<p data-form-error hidden></p>';
  }
  function setFormError(msg) {
    state.formError = msg;
    var el = $("[data-form-error]", bodyEl);
    if (el) el.outerHTML = formErrorHtml();
  }

  function submitButton(label, extraClass, disabled) {
    return (
      '<button type="submit" data-submit data-label="' + esc(label) + '"' + (disabled ? " disabled" : "") +
      ' aria-busy="false" class="rq-submit btn-primary relative min-h-14 text-[17px] ' + extraClass + '">' +
      '<span data-submit-content class="contents">' + label + " " + icon.arrow() + "</span></button>"
    );
  }
  function setBusy(busy) {
    state.busy = busy;
    var btn = $("[data-submit]", bodyEl);
    if (btn) {
      btn.setAttribute("aria-busy", String(busy));
      $("[data-submit-content]", btn).innerHTML = busy
        ? '<span class="flex items-center gap-2"><span class="h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white" aria-hidden="true"></span><span>Please wait…</span></span>'
        : btn.getAttribute("data-label") + " " + icon.arrow();
      syncSubmitDisabled();
    }
    if (state.step === 2) {
      renderOtpStatus();
      var otpInput = $("#f-otp");
      if (otpInput) otpInput.disabled = busy;
      renderOtpBoxes();
    }
  }
  function syncSubmitDisabled() {
    var btn = $("[data-submit]", bodyEl);
    if (!btn) return;
    btn.disabled = state.busy || (state.step === 2 && state.data.otp.length < 6);
  }

  function renderStep1() {
    var d = state.data;
    return (
      '<form novalidate aria-labelledby="s1-title" data-step="1">' +
      '<h2 id="s1-title" class="text-xl text-ink">' + (state.restored || d.name ? "Pick up where you left off" : "Check your offers") + "</h2>" +
      '<p class="mt-1 hidden text-sm text-ink-soft sm:block">Takes about 2 minutes.</p>' +
      '<div class="mt-4 space-y-3">' +
      textField({
        field: "name", label: "Full name (as on PAN)", value: d.name,
        attrs: { autocomplete: "name", autocapitalize: "words", enterkeyhint: "next", inputmode: "text", maxlength: "60", name: "name" },
      }) +
      textField({
        field: "mobile", label: "Mobile number", prefix: "+91", placeholder: "10-digit number", value: d.mobile,
        attrs: { type: "tel", inputmode: "numeric", autocomplete: "tel-national", enterkeyhint: "next", name: "mobile" },
      }) +
      consentField() +
      "</div>" +
      formErrorHtml() +
      submitButton("Get OTP", "mt-4 w-full") +
      '<p class="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">' +
      icon.lock("h-3.5 w-3.5 text-ok") + " Your data is encrypted. We never share it without consent.</p>" +
      "</form>"
    );
  }

  function renderStep2() {
    var d = state.data;
    var fname = firstName(d.name);
    return (
      '<form novalidate aria-labelledby="s2-title" data-step="2">' +
      '<h2 id="s2-title" class="text-xl text-ink">' + (fname ? "Thanks, " + esc(fname) + "! " : "") + "Enter the OTP</h2>" +
      '<p class="mt-1 text-sm text-ink-soft">Sent to <span class="font-bold text-ink">+91 ' + esc(d.mobile.slice(0, 5) + " " + d.mobile.slice(5)) + "</span> " +
      '<button type="button" data-change-number class="ml-1 inline-flex min-h-12 items-center font-bold text-brand underline underline-offset-2">Change number</button></p>' +
      '<div class="mt-2"><span id="otp-label" class="sr-only">6-digit OTP</span>' +
      '<div class="relative" data-field="otp">' +
      '<input id="f-otp" value="' + esc(d.otp) + '" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" aria-labelledby="otp-label" aria-invalid="false" enterkeyhint="done" class="absolute inset-0 z-10 h-full w-full cursor-text opacity-0" style="caret-color: transparent">' +
      '<div class="grid grid-cols-6 gap-2" aria-hidden="true" data-otp-boxes></div>' +
      '<p id="otp-err" role="alert" class="mt-2 text-[13px] font-medium text-err" data-otp-error hidden></p>' +
      "</div></div>" +
      (DEMO ? '<p class="mt-2 text-xs text-ink-soft">Demo mode: any 6 digits work (000000 shows an error).</p>' : "") +
      formErrorHtml() +
      '<div class="mt-3 flex min-h-12 items-center justify-between text-sm">' +
      '<span class="text-ink-soft" aria-live="polite" data-otp-status></span>' +
      '<button type="button" data-resend class="min-h-12 rounded-xl px-3 font-bold text-brand disabled:text-ink-soft/60">Resend OTP</button></div>' +
      submitButton("Verify &amp; Continue", "mt-2 w-full", d.otp.length < 6) +
      "</form>"
    );
  }

  function renderStep3() {
    var d = state.data;
    return (
      '<form novalidate aria-labelledby="s3-title" data-step="3">' +
      '<h2 id="s3-title" class="text-xl text-ink">Hi ' + esc(firstName(d.name) || "there") + ", almost there!</h2>" +
      '<p class="mt-1 text-sm text-ink-soft">Just a few quick details to find your offers.</p>' +
      '<div class="mt-4 space-y-3">' +
      '<div data-employment-slot>' + employmentField() + "</div>" +
      textField({
        field: "income",
        label: d.employment === "self_employed" ? "Average monthly income" : "Monthly in-hand salary",
        prefix: "₹", placeholder: "e.g. 45,000", value: groupDigits(d.income),
        attrs: { name: "income", inputmode: "numeric", autocomplete: "off", enterkeyhint: "next" },
      }) +
      textField({
        field: "pincode", label: "Current PIN code", value: d.pincode,
        attrs: { name: "postal-code", inputmode: "numeric", autocomplete: "postal-code", enterkeyhint: "next", maxlength: "6" },
      }) +
      "</div>" +
      formErrorHtml() +
      submitButton("See My Offers", "mt-4 w-full") +
      '<p class="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">' +
      icon.lock("h-3.5 w-3.5 text-ok") + " Your details are encrypted and secure.</p>" +
      "</form>"
    );
  }

  var LOADER_STEPS = ["Checking lenders that match your profile", "Comparing rates and charges", "Preparing your offers"];
  function renderStep4() {
    var fname = firstName(state.data.name);
    var rings = [0, 1, 2].map(function (i) {
      return '<span class="rq-ring absolute inset-0 rounded-full border-2 border-brand/40" style="--ring-delay:' + i * 0.8 + 's"></span>';
    }).join("");
    return (
      '<div class="flex flex-col items-center py-6 text-center" role="status" aria-live="polite" data-step="4">' +
      '<div class="relative h-24 w-24" aria-hidden="true">' + rings +
      '<span class="absolute inset-4 flex items-center justify-center rounded-full bg-brand text-white shadow-[var(--shadow-cta)]">' + icon.check("h-8 w-8", 2.6) + "</span></div>" +
      '<h2 class="mt-6 text-xl text-ink">Finding offers for you…</h2>' +
      '<p class="mt-1 text-sm text-ink-soft">' + (fname ? "Thanks, " + esc(fname) + ". " : "") + "This usually takes a few seconds.</p>" +
      '<ul class="mt-5 space-y-2 text-left text-sm" data-loader-list></ul>' +
      '<p class="mt-5 rounded-xl bg-peach p-3 text-xs text-ink" data-demo-note hidden></p>' +
      "</div>"
    );
  }
  function renderLoaderList(active) {
    var list = $("[data-loader-list]", bodyEl);
    if (!list) return;
    list.innerHTML = LOADER_STEPS.map(function (label, i) {
      var done = i < active;
      return (
        '<li class="flex items-center gap-2 ' + (i <= active ? "text-ink" : "text-ink-soft/60") + '">' +
        '<span class="flex h-5 w-5 items-center justify-center rounded-full ' + (done ? "bg-ok text-white" : "bg-brand-100 text-brand") + '">' +
        (done ? icon.check("h-3 w-3", 3) : '<span class="h-1.5 w-1.5 rounded-full bg-current"></span>') +
        "</span>" + label + "</li>"
      );
    }).join("");
  }

  var stepTimers = [];
  function clearStepTimers() {
    stepTimers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    stepTimers = [];
    if (otpAbort) { otpAbort.abort(); otpAbort = null; }
  }

  function renderForm(animate) {
    clearStepTimers();
    renderProgress();
    var html = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4 }[state.step]();
    bodyEl.innerHTML = html;
    var root = bodyEl.firstElementChild;
    if (animate && !reducedMotion.matches) root.classList.add("rq-step-enter");
    if (state.step === 1) setupStep1();
    if (state.step === 2) setupStep2();
    if (state.step === 4) setupStep4();
    updateStickyLabel();
  }

  function goToStep(step, extra) {
    var changed = state.step !== step;
    state.step = step;
    state.errors = {};
    Object.assign(state, extra || {});
    if (changed) state.formError = "";
    persist();
    renderForm(true);
    if (changed) {
      var first = STEP_FIELDS[step][0];
      if (first) setTimeout(function () { focusField(first); }, 380);
    }
  }

  /* ------------------------------------------------------------ field errors */

  function setError(field, msg) {
    state.errors[field] = msg;
    var wrap = $('[data-field="' + field + '"]', bodyEl);
    if (!wrap) return;
    if (field === "employment") {
      $("[data-employment-slot]", bodyEl).innerHTML = employmentField();
      return;
    }
    if (field === "otp") {
      renderOtpBoxes();
      return;
    }
    if (field === "consent") {
      var box = $("#f-consent");
      box.className = consentClass(msg);
      box.setAttribute("aria-invalid", msg ? "true" : "false");
      var old = $("#f-consent-err");
      if (old) old.remove();
      if (msg) {
        box.setAttribute("aria-describedby", "f-consent-err");
        wrap.insertAdjacentHTML("beforeend", '<p id="f-consent-err" role="alert" class="ml-9 text-[13px] font-medium text-err">' + esc(msg) + "</p>");
      } else {
        box.removeAttribute("aria-describedby");
      }
      return;
    }
    var id = "f-" + field;
    var input = $("#" + id);
    $("[data-field-box]", wrap).className = fieldBoxClass(msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    var prev = $("#" + id + "-err");
    if (prev) prev.remove();
    if (msg) {
      input.setAttribute("aria-describedby", id + "-err");
      wrap.insertAdjacentHTML("beforeend", fieldErrorHtml(id + "-err", msg));
    } else {
      input.removeAttribute("aria-describedby");
    }
  }

  function focusField(field) {
    var el = field === "employment" ? $('[data-focus-target="employment"]', bodyEl) : $("#f-" + field);
    if (el) el.focus({ preventScroll: true });
    return el;
  }

  // Validate a set of fields, show every error, focus the first invalid one.
  function validateFields(fields) {
    var firstBad = null;
    fields.forEach(function (f) {
      var msg = validate(f, state.data[f]);
      setError(f, msg);
      if (msg && !firstBad) firstBad = f;
    });
    if (firstBad) focusField(firstBad);
    return !firstBad;
  }

  function validateOnBlur(field) {
    if (!state.data[field]) return;
    var msg = validate(field, state.data[field]);
    if (msg) setError(field, msg);
  }

  // Enter moves to the next invalid field of the step, or submits when all are valid.
  function handleEnter(e, field, submit) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    var msg = validate(field, state.data[field]);
    if (msg) {
      setError(field, msg);
      return;
    }
    var fields = STEP_FIELDS[state.step];
    var isBad = function (f) { return !!validate(f, state.data[f]); };
    var next = fields.slice(fields.indexOf(field) + 1).find(isBad) || fields.find(isBad);
    if (next) focusField(next);
    else submit();
  }

  /* ------------------------------------------------------------------ step 1 */

  var idlePulseArmed = true;
  var idlePulseWatching = false;
  function setupStep1() {
    var form = $("form", bodyEl);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      requestOtp(false);
    });
    var name = $("#f-name");
    name.addEventListener("input", function () {
      var clean = name.value.replace(/[^A-Za-z.' ]/g, "");
      if (clean !== name.value) name.value = clean;
      setField("name", clean);
    });
    name.addEventListener("blur", function () { validateOnBlur("name"); });
    name.addEventListener("keydown", function (e) { handleEnter(e, "name", function () { requestOtp(false); }); });

    var mobile = $("#f-mobile");
    mobile.addEventListener("input", function () {
      var clean = normaliseMobile(mobile.value);
      if (clean !== mobile.value) mobile.value = clean;
      setField("mobile", clean);
    });
    mobile.addEventListener("blur", function () { validateOnBlur("mobile"); });
    mobile.addEventListener("keydown", function (e) { handleEnter(e, "mobile", function () { requestOtp(false); }); });

    var consent = $("#f-consent");
    consent.addEventListener("change", function () { setField("consent", consent.checked); });
    consent.addEventListener("keydown", function (e) { handleEnter(e, "consent", function () { requestOtp(false); }); });

    if (idlePulseArmed) armIdlePulse();
  }

  // After 5s without interaction on step 1, pulse the Get OTP button once.
  function armIdlePulse() {
    if (reducedMotion.matches || idlePulseWatching) return;
    idlePulseWatching = true;
    var timer;
    var events = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"];
    function reset() {
      clearTimeout(timer);
      timer = setTimeout(fire, 5000);
    }
    function fire() {
      events.forEach(function (ev) { window.removeEventListener(ev, reset); });
      idlePulseArmed = false;
      var btn = state.step === 1 && $("[data-submit]", bodyEl);
      if (!btn) return;
      btn.classList.add("rq-pulse");
      btn.insertAdjacentHTML("afterbegin", '<span aria-hidden="true" class="rq-pulse-ring pointer-events-none absolute inset-0 rounded-2xl ring-4 ring-brand"></span>');
    }
    events.forEach(function (ev) { window.addEventListener(ev, reset, { passive: true }); });
    reset();
  }

  function requestOtp(resend) {
    if (!resend && !validateFields(STEP_FIELDS[1])) return Promise.resolve(false);
    setBusy(true);
    setFormError("");
    track("otp_request", { resend: resend, form_step: 1 });
    var d = state.data;
    return api
      .sendOtp({
        name: d.name.trim(),
        mobile: d.mobile,
        consent: d.consent,
        attribution: attribution(),
        context: { purpose: d.purpose || null, amount_hint: d.amountHint || null },
      })
      .then(function (res) {
        state.busy = false;
        if (resend) {
          state.requestId = res.requestId;
          state.errors = {};
          persist();
          setBusy(false);
        } else {
          goToStep(2, { requestId: res.requestId });
        }
        return true;
      })
      .catch(function (err) {
        setBusy(false);
        setFormError(err.message || "We couldn’t send the OTP. Please try again.");
        return false;
      });
  }

  /* ------------------------------------------------------------------ step 2 */

  var otpCountdown = 0;
  var otpFocused = false;
  var otpLastSubmitted = "";
  var otpAbort = null;

  function renderOtpBoxes() {
    var boxes = $("[data-otp-boxes]", bodyEl);
    if (!boxes) return;
    var value = state.data.otp;
    var err = state.errors.otp;
    var chars = value.padEnd(6, " ").split("").slice(0, 6);
    var cursor = Math.min(value.length, 5);
    boxes.innerHTML = chars.map(function (ch, i) {
      var active = otpFocused && i === cursor;
      var cls = err ? "border-err" : active ? "border-brand ring-4 ring-brand-100" : ch.trim() ? "border-brand-100" : "border-line";
      return (
        '<div class="flex h-14 items-center justify-center rounded-xl border-2 bg-white text-2xl font-extrabold text-ink transition-colors ' + cls + '">' +
        (ch.trim() ? esc(ch) : active ? '<span class="h-6 w-0.5 animate-pulse bg-brand"></span>' : "") +
        "</div>"
      );
    }).join("");
    var input = $("#f-otp");
    var errEl = $("[data-otp-error]", bodyEl);
    input.setAttribute("aria-invalid", err ? "true" : "false");
    if (err) {
      input.setAttribute("aria-describedby", "otp-err");
      errEl.textContent = err;
      errEl.hidden = false;
    } else {
      input.removeAttribute("aria-describedby");
      errEl.hidden = true;
      errEl.textContent = "";
    }
  }

  function renderOtpStatus() {
    var status = $("[data-otp-status]", bodyEl);
    var resend = $("[data-resend]", bodyEl);
    if (!status) return;
    status.textContent = state.busy
      ? "Verifying…"
      : otpCountdown > 0
        ? "Resend OTP in 0:" + String(otpCountdown).padStart(2, "0")
        : "Didn’t get it?";
    resend.disabled = otpCountdown > 0 || state.busy;
  }

  function startCountdown(seconds) {
    otpCountdown = seconds;
    renderOtpStatus();
    var t = setInterval(function () {
      otpCountdown = Math.max(0, otpCountdown - 1);
      renderOtpStatus();
      if (otpCountdown === 0) clearInterval(t);
    }, 1000);
    stepTimers.push(t);
    listenForSmsOtp();
  }

  // WebOTP: autofill the code on supporting Android browsers.
  function listenForSmsOtp() {
    if (!("OTPCredential" in window)) return;
    if (otpAbort) otpAbort.abort();
    otpAbort = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: otpAbort.signal })
      .then(function (cred) {
        if (cred && cred.code && state.step === 2) {
          var code = cred.code.replace(/\D/g, "").slice(0, 6);
          $("#f-otp").value = code;
          onOtpChange(code);
        }
      })
      .catch(function () {});
  }

  function onOtpChange(value) {
    setField("otp", value);
    renderOtpBoxes();
    syncSubmitDisabled();
    if (value.length < 6) otpLastSubmitted = "";
    else if (value !== otpLastSubmitted && !state.busy) {
      otpLastSubmitted = value;
      verifyOtp(value);
    }
  }

  function setupStep2() {
    otpLastSubmitted = "";
    otpFocused = false;
    var input = $("#f-otp");
    input.addEventListener("input", function () {
      var clean = input.value.replace(/\D/g, "").slice(0, 6);
      if (clean !== input.value) input.value = clean;
      onOtpChange(clean);
    });
    input.addEventListener("focus", function () { otpFocused = true; renderOtpBoxes(); });
    input.addEventListener("blur", function () { otpFocused = false; renderOtpBoxes(); });
    $("form", bodyEl).addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.data.otp.length === 6) verifyOtp(state.data.otp);
    });
    $("[data-change-number]", bodyEl).addEventListener("click", function () {
      goToStep(1, { requestId: null });
      setTimeout(function () { focusField("mobile"); }, 400);
    });
    $("[data-resend]", bodyEl).addEventListener("click", function () {
      requestOtp(true).then(function (ok) { if (ok) startCountdown(30); });
    });
    renderOtpBoxes();
    startCountdown(state.restored ? 0 : 30);
    // A restored session only counts as restored for its first render.
    state.restored = false;
  }

  function verifyOtp(code) {
    setBusy(true);
    api
      .verifyOtp({ requestId: state.requestId, otp: code })
      .then(function (res) {
        track("otp_success", { form_step: 2 });
        state.data.otp = "";
        state.busy = false;
        goToStep(3, { leadId: res.leadId, token: res.token });
      })
      .catch(function (err) {
        state.data.otp = "";
        otpLastSubmitted = "";
        $("#f-otp").value = "";
        setBusy(false);
        setError("otp", err.message || "That code didn’t work. Please try again.");
        syncSubmitDisabled();
        focusField("otp");
      });
  }

  /* ------------------------------------------------------------------ step 3 */

  function selectEmployment(id, focus) {
    setField("employment", id);
    $("[data-employment-slot]", bodyEl).innerHTML = employmentField();
    var incomeLabel = $('label[for="f-income"]', bodyEl);
    if (incomeLabel) incomeLabel.textContent = id === "self_employed" ? "Average monthly income" : "Monthly in-hand salary";
    if (focus) $("#emp-" + id).focus();
  }

  function submitStep3() {
    if (!validateFields(STEP_FIELDS[3])) return;
    var d = state.data;
    track("eligibility_complete", { employment_type: d.employment, form_step: 3 });
    goToStep(4);
    Promise.all([
      api.eligibility({
        leadId: state.leadId,
        token: state.token,
        employment_type: d.employment,
        monthly_income: Number(digits(d.income)),
        pincode: d.pincode,
        purpose: d.purpose || null,
        amount_hint: d.amountHint || null,
        attribution: attribution(),
      }),
      sleep(2200),
    ])
      .then(function (res) {
        clearSaved();
        var url = res[0].redirectUrl || CONFIG.offersPath;
        if (DEMO) {
          var note = $("[data-demo-note]", bodyEl);
          if (note) {
            note.textContent = "Demo mode: would redirect to " + url;
            note.hidden = false;
          }
        } else {
          window.location.assign(url);
        }
      })
      .catch(function (err) {
        goToStep(3);
        setFormError(err.message || "We couldn’t fetch offers right now. Please try again.");
      });
  }

  // Step 3 inputs are bound by delegation so the employment group can re-render freely.
  bodyEl.addEventListener("click", function (e) {
    var emp = e.target.closest("[data-emp]");
    if (!emp || state.step !== 3) return;
    selectEmployment(emp.getAttribute("data-emp"), false);
    setTimeout(function () {
      var next = ["income", "pincode"].find(function (f) { return validate(f, state.data[f]); });
      if (next) focusField(next);
    }, 50);
  });
  bodyEl.addEventListener("keydown", function (e) {
    if (state.step !== 3) return;
    var emp = e.target.closest("[data-emp]");
    if (emp) {
      var idx = EMPLOYMENT.findIndex(function (o) { return o.id === emp.getAttribute("data-emp"); });
      if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].indexOf(e.key) !== -1) {
        e.preventDefault();
        var step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : EMPLOYMENT.length - 1;
        selectEmployment(EMPLOYMENT[(idx + step) % EMPLOYMENT.length].id, true);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectEmployment(EMPLOYMENT[idx].id, true);
      }
      return;
    }
    if (e.target.id === "f-income") handleEnter(e, "income", submitStep3);
    if (e.target.id === "f-pincode") handleEnter(e, "pincode", submitStep3);
  });
  bodyEl.addEventListener("input", function (e) {
    if (state.step !== 3) return;
    var t = e.target;
    if (t.id === "f-income") {
      var raw = digits(t.value).replace(/^0+/, "").slice(0, 9);
      t.value = groupDigits(raw);
      setField("income", raw);
    }
    if (t.id === "f-pincode") {
      var pin = digits(t.value).slice(0, 6);
      if (pin !== t.value) t.value = pin;
      setField("pincode", pin);
    }
  });
  bodyEl.addEventListener("focusout", function (e) {
    if (state.step !== 3) return;
    if (e.target.id === "f-income") validateOnBlur("income");
    if (e.target.id === "f-pincode") validateOnBlur("pincode");
  });
  bodyEl.addEventListener("submit", function (e) {
    if (state.step !== 3) return;
    e.preventDefault();
    submitStep3();
  });

  /* ------------------------------------------------------------------ step 4 */

  function setupStep4() {
    var active = 0;
    renderLoaderList(active);
    var t = setInterval(function () {
      active = Math.min(active + 1, LOADER_STEPS.length - 1);
      renderLoaderList(active);
    }, 900);
    stepTimers.push(t);
  }

  /* ------------------------------------------------------------- focus form */

  var formStarted = false;
  card.addEventListener("focusin", function () {
    if (formStarted) return;
    formStarted = true;
    track("form_start", { form_step: state.step });
  });

  // Every "Check offers" CTA on the page lands here.
  function focusForm(location, merge) {
    track("cta_click", { cta_location: location });
    if (merge) {
      Object.assign(state.data, merge);
      persist();
      if (merge.employment && state.step === 3) selectEmployment(merge.employment, false);
    }
    var fields = STEP_FIELDS[state.step] || [];
    var target = fields.find(function (f) { return validate(f, state.data[f]); }) || fields[0];
    if (target) focusField(target);
    card.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  }

  document.addEventListener("click", function (e) {
    var cta = e.target.closest("[data-cta]");
    if (!cta) return;
    var purpose = cta.getAttribute("data-purpose");
    focusForm(cta.getAttribute("data-cta"), purpose ? { purpose: purpose } : undefined);
  });

  /* ------------------------------------------------------------------ header */

  var header = $("#site-header");
  var headerBar = $("#site-header-bar");
  function syncHeader() {
    var scrolled = window.scrollY > 24;
    header.classList.toggle("bg-transparent", !scrolled);
    ["bg-white/95", "shadow-[0_4px_20px_-8px_rgb(11_34_84/0.15)]", "backdrop-blur"].forEach(function (c) {
      header.classList.toggle(c, scrolled);
    });
    headerBar.classList.toggle("h-14", scrolled);
    headerBar.classList.toggle("h-16", !scrolled);
  }
  window.addEventListener("scroll", syncHeader, { passive: true });
  syncHeader();

  /* ------------------------------------------------------------ scroll reveal */

  var revealEls = $$("[data-reveal]");
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ----------------------------------------------------------- EMI calculator */

  var emi = {
    amount: $("#emi-amount"),
    tenure: $("#emi-tenure"),
    rate: $("#emi-rate"),
    section: $("#emi-calculator"),
  };
  var emiTrackTimer;
  function calcEmi(principal, ratePa, months) {
    var r = ratePa / 12 / 100;
    if (!principal || !months) return { emi: 0, interest: 0, total: 0 };
    var raw = r === 0 ? principal / months : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    var monthly = Math.round(raw);
    var total = monthly * months;
    return { emi: monthly, interest: total - principal, total: total };
  }
  function renderEmi(trackIt) {
    var amount = Number(emi.amount.value);
    var tenure = Number(emi.tenure.value);
    var rateRaw = emi.rate.value;
    var rate = Math.min(Math.max(parseFloat(rateRaw) || 0, 0), 60);
    var res = calcEmi(amount, rate, tenure);
    var s = emi.section;

    [emi.amount, emi.tenure].forEach(function (input) {
      var min = Number(input.min), max = Number(input.max), val = Number(input.value);
      input.style.setProperty("--fill", ((val - min) / (max - min)) * 100 + "%");
    });
    var amountText = rupees(amount);
    var tenureText = tenure + " months";
    $('output[for="emi-amount"]', s).textContent = amountText;
    emi.amount.setAttribute("aria-valuetext", amountText);
    $('output[for="emi-tenure"]', s).textContent = tenureText;
    emi.tenure.setAttribute("aria-valuetext", tenureText);

    var circumference = 2 * Math.PI * 42;
    var share = amount / (amount + res.interest || 1);
    $("[data-emi-donut]", s).setAttribute("stroke-dasharray", share * circumference + " " + circumference);
    $("[data-emi-monthly]", s).textContent = rupees(res.emi);
    $("[data-emi-principal]", s).textContent = rupees(amount);
    $("[data-emi-interest]", s).textContent = rupees(res.interest);
    $("[data-emi-total]", s).textContent = rupees(res.total);
    $("[data-emi-cta-label]", s).textContent = "Check offers for " + lakh(amount);

    var rateErr = rateRaw !== "" && (parseFloat(rateRaw) <= 0 || parseFloat(rateRaw) > 60) ? "Enter a rate between 1% and 60%." : "";
    var box = emi.rate.parentElement;
    box.className =
      "mt-2 flex h-14 w-40 items-center rounded-2xl border-2 bg-white px-4 " + (rateErr ? "border-err" : "border-line focus-within:border-brand");
    emi.rate.setAttribute("aria-invalid", rateErr ? "true" : "false");
    var errEl = $("#emi-rate-err");
    if (rateErr) {
      emi.rate.setAttribute("aria-describedby", "emi-rate-err");
      if (!errEl) box.insertAdjacentHTML("afterend", '<p id="emi-rate-err" role="alert" class="mt-1.5 text-[13px] font-medium text-err"></p>');
      $("#emi-rate-err").textContent = rateErr;
    } else {
      emi.rate.removeAttribute("aria-describedby");
      if (errEl) errEl.remove();
    }

    if (trackIt) {
      clearTimeout(emiTrackTimer);
      emiTrackTimer = setTimeout(function () {
        track("calculator_use", { loan_amount: amount, tenure_months: tenure, rate_pct: rate });
      }, 1200);
    }
  }
  if (emi.section) {
    emi.amount.addEventListener("input", function () { renderEmi(true); });
    emi.tenure.addEventListener("input", function () { renderEmi(true); });
    emi.rate.addEventListener("input", function () {
      var clean = emi.rate.value.replace(/[^0-9.]/g, "").slice(0, 5);
      if (clean !== emi.rate.value) emi.rate.value = clean;
      renderEmi(true);
    });
    emi.rate.addEventListener("keydown", function (e) { if (e.key === "Enter") emi.rate.blur(); });
    $("#emi-cta").addEventListener("click", function () {
      focusForm("emi_calculator", { amountHint: Number(emi.amount.value) });
    });
    renderEmi(false);
  }

  /* -------------------------------------------------------- charges & terms */

  var CHARGES = [
    ["Interest rate", "Set by the lender based on your profile."],
    ["Processing fee", "Varies by lender – a percentage of the loan or a fixed amount, plus 18% GST."],
    ["Late payment charges", "As per the lender’s Key Fact Statement (KFS)."],
    ["Full disclosure", "Exact charges, APR and repayment schedule are disclosed in the Key Fact Statement before you accept the loan."],
  ];
  function makeCollapse(id, innerHtml, attrs) {
    var el = document.createElement("div");
    el.id = id;
    el.className = "rq-collapse";
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    el.innerHTML = "<div>" + innerHtml + "</div>";
    return el;
  }
  // Opens/closes a collapse; the panel is removed from the DOM when closed.
  function toggleCollapse(btn, rotateEl, build) {
    var open = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(open));
    rotateEl.classList.toggle("rotate-180", open);
    var panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (open) {
      if (panel) panel.remove();
      panel = build();
      btn.closest(".card").appendChild(panel);
      panel.getBoundingClientRect();
      panel.classList.add("is-open");
    } else if (panel) {
      panel.classList.remove("is-open");
      var remove = function () { if (btn.getAttribute("aria-expanded") === "false") panel.remove(); };
      if (reducedMotion.matches) remove();
      else setTimeout(remove, 260);
    }
    return open;
  }

  var chargesBtn = $("#charges-btn");
  if (chargesBtn) {
    chargesBtn.addEventListener("click", function () {
      var opened = toggleCollapse(chargesBtn, $("svg", chargesBtn), function () {
        return makeCollapse(
          "charges-panel",
          '<dl class="divide-y divide-line border-t border-line px-5">' +
            CHARGES.map(function (row) {
              return (
                '<div class="grid gap-1 py-3 sm:grid-cols-[200px_1fr]"><dt class="text-sm font-bold text-ink">' + row[0] +
                '</dt><dd class="text-sm text-ink-soft">' + row[1] + "</dd></div>"
              );
            }).join("") +
            "</dl>",
        );
      });
      if (opened) track("charges_expand");
    });
  }

  /* --------------------------------------------------------------------- FAQ */

  // Answers come from the FAQPage JSON-LD, which lists questions in page order.
  var faqAnswers = [];
  try {
    var ld = JSON.parse($('#faq script[type="application/ld+json"]').textContent);
    faqAnswers = ld.mainEntity.map(function (q) { return q.acceptedAnswer.text; });
  } catch (e) {}
  $$('#faq button[id^="faq-btn-"]').forEach(function (btn, index) {
    btn.addEventListener("click", function () {
      var id = btn.id.replace("faq-btn-", "");
      var opened = toggleCollapse(btn, $("span", btn), function () {
        return makeCollapse(
          "faq-" + id,
          '<p class="px-5 pb-5 text-[15px] leading-relaxed text-ink-soft">' + esc(faqAnswers[index] || "") + "</p>",
          { role: "region", "aria-labelledby": btn.id },
        );
      });
      if (opened) track("faq_open", { faq_id: id });
    });
  });

  /* ------------------------------------------------------- eligibility tabs */

  var ELIGIBILITY = {
    salaried: {
      checks: [
        "Indian resident",
        "Age typically 21–60 years (varies by lender)",
        "Working with a private company, PSU or government body",
        "Regular monthly salary credited to a bank account",
        "Minimum income and work experience as set by the lender",
      ],
      docs: ["PAN card", "Aadhaar", "Latest salary slips", "Bank statement"],
    },
    self_employed: {
      checks: [
        "Indian resident",
        "Age typically 21–60 years (varies by lender)",
        "Business owner, shopkeeper, freelancer or professional",
        "Stable business income, usually for 1–2+ years",
        "Minimum income as set by the lender",
      ],
      docs: ["PAN card", "Aadhaar", "ITR or business proof (GST/registration)", "Bank statement"],
    },
  };
  var TAB_IDS = Object.keys(ELIGIBILITY);
  var activeTab = "salaried";
  var tabs = $$('#eligibility [role="tab"]');
  function selectTab(id, focus) {
    activeTab = id;
    tabs.forEach(function (tab) {
      var on = tab.id === "tab-" + id;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.className =
        "flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 text-[15px] font-bold whitespace-nowrap sm:px-5 transition-colors " +
        (on ? "bg-brand text-white" : "text-ink hover:bg-lilac");
      if (on && focus) tab.focus();
    });
    var panel = $('#eligibility [role="tabpanel"]');
    var info = ELIGIBILITY[id];
    panel.id = "panel-" + id;
    panel.setAttribute("aria-labelledby", "tab-" + id);
    panel.innerHTML =
      '<div class="card p-5 sm:p-6"><h3 class="text-lg text-ink">Eligibility checklist</h3><ul class="mt-3 space-y-2.5">' +
      info.checks.map(function (c) {
        return (
          '<li class="flex gap-3 text-[15px] text-ink"><span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok text-white">' +
          icon.check("h-3.5 w-3.5", 3) + "</span>" + c + "</li>"
        );
      }).join("") +
      '</ul></div><div class="card p-5 sm:p-6"><h3 class="text-lg text-ink">Documents to keep handy</h3><ul class="mt-3 grid gap-2.5 sm:grid-cols-2">' +
      info.docs.map(function (d) {
        return (
          '<li class="flex items-center gap-3 rounded-2xl bg-lilac px-3 py-3 text-[15px] font-semibold text-ink">' +
          icon.doc("h-5 w-5 shrink-0 text-brand") + " " + d + "</li>"
        );
      }).join("") +
      "</ul></div>";
    panel.classList.remove("rq-panel-enter");
    if (!reducedMotion.matches) {
      panel.getBoundingClientRect();
      panel.classList.add("rq-panel-enter");
    }
  }
  tabs.forEach(function (tab) {
    var id = tab.id.replace("tab-", "");
    tab.addEventListener("click", function () { selectTab(id, false); });
    tab.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var i = TAB_IDS.indexOf(activeTab);
      var next = TAB_IDS[(i + (e.key === "ArrowRight" ? 1 : TAB_IDS.length - 1)) % TAB_IDS.length];
      selectTab(next, true);
    });
  });
  var eligCta = $("#elig-cta");
  if (eligCta) {
    eligCta.addEventListener("click", function () {
      focusForm("eligibility_" + activeTab, { employment: activeTab });
    });
  }

  /* ------------------------------------------------------ mobile sticky CTA */

  var sticky = $("#sticky-cta");
  var stickyState = { cardOut: false, typing: false, hiddenZone: false };
  // Visibility is driven by .is-shown (see site.css) so the bar can slide in and out.
  sticky.hidden = false;
  sticky.setAttribute("inert", "");
  sticky.setAttribute("aria-hidden", "true");
  function updateStickyLabel() {
    var label = $("[data-sticky-label]", sticky);
    if (label) label.textContent = state.step === 1 ? "Check My Offers" : "Continue where you left off";
    syncSticky();
  }
  function syncSticky() {
    var show = stickyState.cardOut && !stickyState.typing && !stickyState.hiddenZone && state.step < 4;
    sticky.classList.toggle("is-shown", show);
    sticky.setAttribute("aria-hidden", String(!show));
    if (show) sticky.removeAttribute("inert");
    else sticky.setAttribute("inert", "");
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      stickyState.cardOut = !entries[0].isIntersecting;
      syncSticky();
    }, { threshold: 0 }).observe(card);
    var visibleZones = new Set();
    var zoneObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visibleZones.add(entry.target);
        else visibleZones.delete(entry.target);
      });
      stickyState.hiddenZone = visibleZones.size > 0;
      syncSticky();
    }, { threshold: 0 });
    $$("[data-hide-sticky]").forEach(function (el) { zoneObserver.observe(el); });
  }
  function isTypingTarget(el) {
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) && el.type !== "range" && el.type !== "checkbox";
  }
  document.addEventListener("focusin", function (e) {
    stickyState.typing = isTypingTarget(e.target);
    syncSticky();
  });
  document.addEventListener("focusout", function () {
    setTimeout(function () {
      stickyState.typing = isTypingTarget(document.activeElement);
      syncSticky();
    }, 50);
  });

  /* ------------------------------------------------------- exit-intent modal */

  var EXIT_COPY = {
    1: "Just your name and mobile number to start. It takes about 2 minutes.",
    2: "Just verify the OTP we sent to your mobile.",
    3: "Add a few basic details and see offers from RBI-regulated lenders.",
  };
  function exitShown(set) {
    try {
      if (set) sessionStorage.setItem(EXIT_KEY, "1");
      return sessionStorage.getItem(EXIT_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  var modalRoot = $("#exit-modal-root");
  var modalReturnFocus = null;
  function onModalKey(e) { if (e.key === "Escape") closeExitModal(); }
  function openExitModal(trigger) {
    if (exitShown() || state.step >= 4) return;
    exitShown(true);
    modalReturnFocus = document.activeElement;
    track("exit_modal_view", { trigger: trigger, form_step: state.step });
    modalRoot.innerHTML =
      '<div class="rq-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" data-modal-backdrop>' +
      '<div role="dialog" aria-modal="true" aria-labelledby="exit-title" aria-describedby="exit-desc" class="rq-modal-dialog card relative w-full max-w-md p-6 text-center sm:p-8">' +
      '<button type="button" data-modal-close aria-label="Close" class="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full text-ink-soft hover:bg-lilac">' + icon.close() + "</button>" +
      '<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lilac text-brand" aria-hidden="true">' + icon.clock("h-7 w-7") + "</div>" +
      '<h2 id="exit-title" class="mt-4 text-2xl text-ink">Your offers are 1 step away</h2>' +
      '<p id="exit-desc" class="mt-2 text-ink-soft">' + (EXIT_COPY[state.step] || EXIT_COPY[1]) + "</p>" +
      '<button type="button" data-modal-continue class="btn-primary mt-6 min-h-14 w-full text-[17px]">Continue ' + icon.arrow() + "</button>" +
      '<button type="button" data-modal-close class="mt-2 min-h-12 w-full font-semibold text-ink-soft">Not now</button>' +
      "</div></div>";
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onModalKey);
    var backdrop = $("[data-modal-backdrop]", modalRoot);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) closeExitModal(); });
    $$("[data-modal-close]", modalRoot).forEach(function (b) { b.addEventListener("click", closeExitModal); });
    var cont = $("[data-modal-continue]", modalRoot);
    cont.addEventListener("click", function () {
      closeExitModal(true);
      focusForm("exit_modal");
    });
    cont.focus();
  }
  function closeExitModal(skipRestore) {
    modalRoot.innerHTML = "";
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onModalKey);
    if (!skipRestore && modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus({ preventScroll: true });
  }

  if (window.matchMedia("(pointer: fine)").matches) {
    // Desktop: cursor leaves through the top of the window, after 8s on the page.
    var armedAt = Date.now() + 8000;
    document.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget && e.clientY <= 0 && Date.now() > armedAt) openExitModal("exit_intent");
    });
  } else if (!exitShown()) {
    // Touch: intercept the first back navigation once the visitor has interacted.
    window.addEventListener("pointerdown", function () {
      window.history.pushState({ rqExit: true }, "");
    }, { once: true });
    window.addEventListener("popstate", function onPop() {
      if (!exitShown() && state.step < 4) openExitModal("back_button");
      window.removeEventListener("popstate", onPop);
    });
  }

  /* -------------------------------------------------------------------- boot */

  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  var attr = captureAttribution();
  track("page_view", {
    page_path: window.location.pathname,
    page_title: document.title,
    page_type: "personal_loan_lp",
    utm_source: attr.utm_source,
    utm_medium: attr.utm_medium,
    utm_campaign: attr.utm_campaign,
    has_click_id: !!(attr.gclid || attr.gbraid || attr.wbraid || attr.fbclid),
  });
  trackScrollDepth();
  renderForm(false);
})();
