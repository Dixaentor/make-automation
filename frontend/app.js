/* EZ-one — formulaire candidat
   ------------------------------------------------------------------
   Multi-step (3 etapes) :
     1. Identite (nom, email, tel, localisation, dispo, poste)
     2. CV   -> upload direct Cloudinary
     3. Video -> upload direct Cloudinary
   Submit final = POST Netlify Forms (urlencoded, ~1 Ko : meta + URLs).
   ------------------------------------------------------------------
*/

(function () {
  "use strict";

  // Config resiliente : si config.js manque, on garde des valeurs par defaut
  // pour que la navigation du form fonctionne. Seuls les uploads Cloudinary
  // echoueront (avec un message clair).
  const DEFAULT_CFG = {
    CLOUDINARY: { cloud_name: "", upload_preset: "", folder: "candidatures" },
    LIMITS:     { cv_max_mb: 25, video_max_mb: 100, video_max_seconds: 90 },
  };
  const cfg = window.EZONE_CONFIG || DEFAULT_CFG;
  const CLOUDINARY_CONFIGURED = !!(cfg.CLOUDINARY && cfg.CLOUDINARY.cloud_name && cfg.CLOUDINARY.upload_preset);

  if (!window.EZONE_CONFIG) {
    console.warn(
      "[EZ-one] config.js manquant. Copiez config.example.js vers config.js " +
      "et remplissez vos valeurs Cloudinary. La navigation marche, les uploads non."
    );
  } else if (!CLOUDINARY_CONFIGURED) {
    console.warn(
      "[EZ-one] config.js trouve mais cloud_name ou upload_preset vides. " +
      "Les uploads Cloudinary echoueront tant que ces valeurs ne sont pas remplies."
    );
  }

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const form         = $("#candidate-form");
  const statusEl     = $("#status");
  const stepperFill  = $(".stepper__fill");
  const stepperItems = $$(".stepper__item");

  const cvInput   = $("#cv-input");
  const cvDrop    = $("#cv-drop");
  const cvTitle   = $("#cv-title");
  const cvHint    = $("#cv-hint");
  const cvProg    = $("#cv-progress");
  const cvClear   = $("#cv-clear");
  const cvNext    = $("#cv-next");

  const videoInput   = $("#video-input");
  const videoDrop    = $("#video-drop");
  const videoTitle   = $("#video-title");
  const videoHint    = $("#video-hint");
  const videoProg    = $("#video-progress");
  const videoClear   = $("#video-clear");
  const videoPreview = $("#video-preview");

  const submitBtn = $("#submit-btn");

  const phoneInput = $("#phone-input");
  const availabilityOther = $("#availability-other");

  const hidden = {
    cv_url:          $("#cv-url"),
    cv_public_id:    $("#cv-public-id"),
    cv_bytes:        $("#cv-bytes"),
    video_url:       $("#video-url"),
    video_public_id: $("#video-public-id"),
    video_bytes:     $("#video-bytes"),
    video_duration:  $("#video-duration"),
    submitted_at:    $("#submitted-at"),
  };

  // ---------- State ----------
  const state = {
    step: 1,
    totalSteps: 3,
    cv: null,
    cvUploaded: null,
    video: null,
    videoUploaded: null,
    submitting: false,
    uploading: false,
  };

  // Detecte si on tourne en local (Netlify Forms ne traite pas en local).
  const IS_LOCAL_DEV =
    ["localhost", "127.0.0.1", ""].includes(location.hostname) ||
    location.protocol === "file:";

  // Timeouts upload (ms)
  const UPLOAD_TIMEOUT = { cv: 60_000, video: 300_000 };

  // ---------- Helpers ----------
  const bytesToMB = (b) => Math.round((b / 1024 / 1024) * 10) / 10;

  function setStatus(msg, kind) {
    statusEl.className = "status" + (kind ? " is-" + kind : "");
    statusEl.textContent = msg || "";
  }

  function setInvalid(el, invalid) {
    el.classList.toggle("is-invalid", !!invalid);
  }

  // ---------- Phone validation ----------
  // Format international : +XXXXXXX (chiffres uniquement, 6-15 chiffres apres le +)
  const PHONE_RE = /^\+\d{6,15}$/;

  function validatePhone(value) {
    if (!value) return "Le telephone est requis.";
    if (!PHONE_RE.test(value)) {
      return "Format attendu : +XXXXXXXXX (chiffres uniquement, sans espaces ni tirets).";
    }
    return null;
  }

  // Nettoyage live : enleve les espaces, tirets, points, parentheses
  phoneInput.addEventListener("input", (e) => {
    const cleaned = e.target.value.replace(/[\s\-.()]/g, "");
    if (cleaned !== e.target.value) e.target.value = cleaned;
    setInvalid(phoneInput, false);
  });

  phoneInput.addEventListener("blur", () => {
    const err = validatePhone(phoneInput.value);
    setInvalid(phoneInput, !!err);
  });

  // ---------- Disponibilite : afficher input "autre" si selectionne ----------
  $$('input[name="availability"]').forEach((r) => {
    r.addEventListener("change", () => {
      const isOther = document.querySelector('input[name="availability"]:checked')?.value === "other";
      availabilityOther.hidden = !isOther;
      if (!isOther) availabilityOther.value = "";
      else availabilityOther.focus();
    });
  });

  // ---------- Step navigation ----------
  function goToStep(n) {
    if (n < 1 || n > state.totalSteps) return;

    $$(".step").forEach((el) => {
      el.classList.toggle("is-active", Number(el.dataset.step) === n);
    });

    stepperItems.forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle("is-active", s === n);
      el.classList.toggle("is-done", s < n);
    });

    const pct = (n / state.totalSteps) * 100;
    stepperFill.style.setProperty("--p", pct + "%");

    state.step = n;
    setStatus("");

    if (window.innerWidth < 880) {
      $(".card").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function validateStep1() {
    // Champs requis
    const required = [
      ["full_name", "Nom complet requis."],
      ["email",     "Email requis."],
      ["phone",     "Telephone requis."],
      ["city",      "Ville requise."],
      ["country",   "Pays requis."],
      ["role",      "Indiquez le poste qui vous attire."],
    ];

    for (const [name, msg] of required) {
      const el = form.elements[name];
      if (!el || !el.value.trim()) {
        setStatus(msg, "error");
        if (el) { setInvalid(el, true); el.focus(); }
        return false;
      }
    }

    // Email
    const email = form.elements["email"];
    if (!email.checkValidity()) {
      setStatus("L'adresse email ne semble pas valide.", "error");
      setInvalid(email, true);
      email.focus();
      return false;
    }

    // Phone
    const phoneErr = validatePhone(phoneInput.value);
    if (phoneErr) {
      setStatus(phoneErr, "error");
      setInvalid(phoneInput, true);
      phoneInput.focus();
      return false;
    }

    // Disponibilite
    const dispo = document.querySelector('input[name="availability"]:checked');
    if (!dispo) {
      setStatus("Indiquez votre disponibilite.", "error");
      return false;
    }
    if (dispo.value === "other" && !availabilityOther.value.trim()) {
      setStatus("Precisez votre disponibilite.", "error");
      availabilityOther.focus();
      return false;
    }

    return true;
  }

  $$('[data-action="next"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.step === 1 && !validateStep1()) return;
      if (state.step === 2 && !state.cvUploaded) {
        setStatus("Deposez votre CV avant de continuer.", "error");
        return;
      }
      goToStep(state.step + 1);
    });
  });

  $$('[data-action="prev"]').forEach((btn) => {
    btn.addEventListener("click", () => goToStep(state.step - 1));
  });

  // Clear invalid state on input
  $$(".field input").forEach((el) => {
    el.addEventListener("input", () => setInvalid(el, false));
  });

  // ---------- Dropzone bindings ----------
  // NOTE: <label> declenche NATIVEMENT input.click() au click utilisateur.
  // On ne doit PAS rappeler input.click() en JS (sinon double file picker).
  // On utilise e.preventDefault() pour bloquer ce comportement natif quand
  // le contexte ne s'y prete pas (clear button, upload en cours, deja uploade).
  function bindDropzone(dropEl, inputEl, onFile) {
    dropEl.addEventListener("click", (e) => {
      // Clic sur le bouton X (clear) : on ne veut pas ouvrir le picker.
      if (e.target.closest(".dropzone__clear")) {
        e.preventDefault();
        return;
      }
      // Upload en cours ou fichier deja uploade : on ne re-ouvre pas le picker.
      if (
        dropEl.classList.contains("is-uploading") ||
        dropEl.classList.contains("is-uploaded")
      ) {
        e.preventDefault();
      }
      // Sinon : on laisse le navigateur faire son boulot natif (label -> input click).
    });

    dropEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dropEl.classList.contains("is-uploaded") && !dropEl.classList.contains("is-uploading")) {
        dropEl.classList.add("is-drag");
      }
    });
    dropEl.addEventListener("dragleave", () => dropEl.classList.remove("is-drag"));
    dropEl.addEventListener("drop", (e) => {
      e.preventDefault();
      dropEl.classList.remove("is-drag");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) onFile(file);
    });
    inputEl.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) onFile(file);
    });
  }

  // ---------- File validation ----------
  function validateCv(file) {
    if (file.type !== "application/pdf") return "Le CV doit etre au format PDF.";
    if (bytesToMB(file.size) > cfg.LIMITS.cv_max_mb) {
      return `CV trop lourd (${bytesToMB(file.size)} Mo, max ${cfg.LIMITS.cv_max_mb} Mo).`;
    }
    return null;
  }

  function validateVideo(file) {
    const ok = ["video/mp4", "video/webm", "video/quicktime"];
    if (!ok.includes(file.type)) return "Format video : MP4, WebM ou MOV.";
    if (bytesToMB(file.size) > cfg.LIMITS.video_max_mb) {
      return `Video trop lourde (${bytesToMB(file.size)} Mo, max ${cfg.LIMITS.video_max_mb} Mo).`;
    }
    return null;
  }

  function probeVideoDuration(file) {
    return new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(v.src);
        resolve(v.duration);
      };
      v.onerror = () => resolve(null);
      v.src = URL.createObjectURL(file);
    });
  }

  // ---------- Cloudinary upload ----------
  // Gere :
  //   - HTTP success (2xx)
  //   - HTTP error (4xx / 5xx) avec parsing du message Cloudinary
  //   - Timeout (XHR.timeout)
  //   - Erreurs reseau / CORS (xhr.onerror — JS ne peut pas distinguer)
  //   - Annulation (xhr.onabort)
  function cloudinaryUpload(file, kind, progressEl, signal) {
    return new Promise((resolve, reject) => {
      if (!CLOUDINARY_CONFIGURED) {
        reject(new Error(
          "Stockage non configure. Renseignez cloud_name et upload_preset dans frontend/config.js."
        ));
        return;
      }

      const url = `https://api.cloudinary.com/v1_1/${cfg.CLOUDINARY.cloud_name}/${kind}/upload`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", cfg.CLOUDINARY.upload_preset);
      if (cfg.CLOUDINARY.folder) fd.append("folder", cfg.CLOUDINARY.folder);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.timeout = UPLOAD_TIMEOUT[kind] || UPLOAD_TIMEOUT.cv;

      progressEl.hidden = false;
      progressEl.value = 0;

      // Permet d'annuler l'upload en cas de besoin
      if (signal) {
        signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          progressEl.value = Math.round((e.loaded / e.total) * 100);
        }
      });

      xhr.onload = () => {
        let parsed = null;
        try { parsed = JSON.parse(xhr.responseText); } catch { /* not JSON */ }

        if (xhr.status >= 200 && xhr.status < 300 && parsed && parsed.secure_url) {
          resolve(parsed);
          return;
        }

        // Erreur cote serveur Cloudinary : parser le message de l'API
        const apiMsg = parsed && parsed.error && parsed.error.message;
        if (apiMsg) {
          reject(new Error(`Cloudinary : ${apiMsg}`));
          return;
        }

        // Cas specifiques de codes HTTP
        if (xhr.status === 401 || xhr.status === 403) {
          reject(new Error("Upload preset invalide ou non-public. Verifiez la configuration Cloudinary."));
          return;
        }
        if (xhr.status === 413) {
          reject(new Error("Fichier trop volumineux pour Cloudinary."));
          return;
        }
        if (xhr.status === 0) {
          // Status 0 = bloque par CORS, navigateur offline, ou requete annulee
          reject(new Error(
            "Connexion bloquee. Causes possibles : pas d'acces internet, CORS mal configure cote Cloudinary, " +
            "ou cloud_name invalide. Verifiez la console pour plus de details."
          ));
          return;
        }

        reject(new Error(`Cloudinary a repondu HTTP ${xhr.status}.`));
      };

      xhr.onerror = () => {
        // CORS, DNS, offline — le navigateur ne donne pas de detail.
        reject(new Error(
          "Impossible de joindre Cloudinary. Causes possibles : connexion coupee, " +
          "cloud_name invalide, ou CORS bloque par le navigateur."
        ));
      };

      xhr.ontimeout = () => {
        reject(new Error(
          `Upload trop long (timeout ${xhr.timeout / 1000}s). ` +
          `Reessayez avec un fichier ${kind === "video" ? "plus court ou compresse" : "plus leger"}.`
        ));
      };

      xhr.onabort = () => reject(new Error("Upload annule."));

      try {
        xhr.send(fd);
      } catch (e) {
        reject(new Error("Echec d'envoi de la requete : " + e.message));
      }
    });
  }

  // ---------- Upload state helpers (verrouille la nav pendant un upload) ----------
  function lockNav(locked) {
    state.uploading = locked;
    $$('button[data-action="prev"], button[data-action="next"]').forEach((b) => {
      // On ne touche pas au "next" du step 2 (cv-next) qui a sa propre logique
      if (b.id !== "cv-next") b.disabled = locked;
    });
    if (locked) cvNext.disabled = true;
  }

  // ---------- CV flow ----------
  bindDropzone(cvDrop, cvInput, async (file) => {
    if (cvDrop.classList.contains("is-uploading")) return;

    const err = validateCv(file);
    if (err) { setStatus(err, "error"); return; }

    state.cv = file;
    cvTitle.textContent = file.name;
    cvHint.textContent  = `${bytesToMB(file.size)} Mo · upload en cours...`;
    cvDrop.classList.add("is-uploading");
    cvDrop.setAttribute("aria-busy", "true");
    setStatus("");
    lockNav(true);

    try {
      const res = await cloudinaryUpload(file, "raw", cvProg);
      state.cvUploaded = res;
      hidden.cv_url.value       = res.secure_url;
      hidden.cv_public_id.value = res.public_id;
      hidden.cv_bytes.value     = res.bytes;

      cvDrop.classList.remove("is-uploading");
      cvDrop.classList.add("is-uploaded");
      cvDrop.removeAttribute("aria-busy");
      cvHint.textContent = `${bytesToMB(res.bytes)} Mo · enregistre`;
      cvClear.hidden = false;
      cvProg.hidden = true;
      lockNav(false);
      cvNext.disabled = false;
    } catch (e) {
      cvDrop.classList.remove("is-uploading");
      cvDrop.removeAttribute("aria-busy");
      cvProg.hidden = true;
      cvHint.textContent = "Echec de l'envoi. Reessayez.";
      cvInput.value = "";
      state.cv = null;
      lockNav(false);
      setStatus(e.message, "error");
    }
  });

  cvClear.addEventListener("click", (e) => {
    e.preventDefault();   // empeche le label de declencher le file picker
    e.stopPropagation();
    state.cv = null; state.cvUploaded = null;
    hidden.cv_url.value = ""; hidden.cv_public_id.value = ""; hidden.cv_bytes.value = "";
    cvInput.value = "";
    cvDrop.classList.remove("is-uploaded", "is-uploading");
    cvTitle.textContent = "Glissez votre CV ici";
    cvHint.textContent  = "ou cliquez pour parcourir · PDF jusqu'a 25 Mo";
    cvClear.hidden = true;
    cvNext.disabled = true;
    setStatus("");
  });

  // ---------- Video flow ----------
  bindDropzone(videoDrop, videoInput, async (file) => {
    if (videoDrop.classList.contains("is-uploading")) return;

    const err = validateVideo(file);
    if (err) { setStatus(err, "error"); return; }

    const duration = await probeVideoDuration(file);
    if (duration && duration > cfg.LIMITS.video_max_seconds + 5) {
      setStatus(
        `Video un peu longue (${Math.round(duration)} sec, ideal sous ${cfg.LIMITS.video_max_seconds} sec).`,
        "error"
      );
      return;
    }

    state.video = file;
    videoTitle.textContent = file.name;
    videoHint.textContent  = `${bytesToMB(file.size)} Mo · upload en cours...`;
    videoDrop.classList.add("is-uploading");
    videoDrop.setAttribute("aria-busy", "true");
    setStatus("");
    lockNav(true);
    submitBtn.disabled = true;

    try {
      const res = await cloudinaryUpload(file, "video", videoProg);
      state.videoUploaded = res;
      hidden.video_url.value       = res.secure_url;
      hidden.video_public_id.value = res.public_id;
      hidden.video_bytes.value     = res.bytes;
      hidden.video_duration.value  = res.duration || duration || "";

      videoDrop.classList.remove("is-uploading");
      videoDrop.classList.add("is-uploaded");
      videoDrop.removeAttribute("aria-busy");
      videoHint.textContent = duration
        ? `${Math.round(duration)} sec · ${bytesToMB(res.bytes)} Mo · enregistre`
        : `${bytesToMB(res.bytes)} Mo · enregistre`;
      videoClear.hidden = false;
      videoProg.hidden = true;

      videoPreview.src = res.secure_url;
      videoPreview.hidden = false;

      lockNav(false);
      submitBtn.disabled = false;
    } catch (e) {
      videoDrop.classList.remove("is-uploading");
      videoDrop.removeAttribute("aria-busy");
      videoProg.hidden = true;
      videoHint.textContent = "Echec de l'envoi. Reessayez.";
      videoInput.value = "";
      state.video = null;
      lockNav(false);
      setStatus(e.message, "error");
    }
  });

  videoClear.addEventListener("click", (e) => {
    e.preventDefault();   // empeche le label de declencher le file picker
    e.stopPropagation();
    state.video = null; state.videoUploaded = null;
    hidden.video_url.value = ""; hidden.video_public_id.value = "";
    hidden.video_bytes.value = ""; hidden.video_duration.value = "";
    videoInput.value = "";
    videoDrop.classList.remove("is-uploaded", "is-uploading");
    videoTitle.textContent = "Deposez votre video";
    videoHint.textContent  = "MP4 / WebM / MOV · jusqu'a 100 Mo · ~60 sec";
    videoClear.hidden = true;
    videoPreview.hidden = true;
    videoPreview.src = "";
    submitBtn.disabled = true;
    setStatus("");
  });

  // ---------- Form submit (Netlify Forms) ----------
  // - Verifie l'etat (deja en cours ?, fichiers presents)
  // - En local dev : skip Netlify (pas de handler) et passe direct sur /merci.html
  // - Sinon : POST urlencoded vers Netlify, redirige sur succes
  // - Tous les echecs reactivent le bouton et affichent un message clair
  function resetSubmitButton(label) {
    submitBtn.disabled = false;
    submitBtn.classList.remove("is-loading");
    submitBtn.querySelector(".btn__label").textContent = label || "Envoyer mon dossier";
    state.submitting = false;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // Garde-fou : pas de double-submit
    if (state.submitting) return;
    // Source de verite : les hidden fields (memes valeurs que celles envoyees a Netlify)
    if (!hidden.cv_url.value)    { setStatus("CV manquant. Revenez a l'etape 2.", "error"); return; }
    if (!hidden.video_url.value) { setStatus("Video manquante. Revenez a l'etape 3.", "error"); return; }

    hidden.submitted_at.value = new Date().toISOString();

    state.submitting = true;
    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");
    submitBtn.querySelector(".btn__label").textContent = "Envoi";
    setStatus("Transmission de votre dossier...", "info");

    const fd = new FormData(form);

    // En local : Netlify Forms ne traite pas. On simule un succes.
    if (IS_LOCAL_DEV) {
      console.info("[EZ-one] mode local detecte. Payload qui aurait ete envoye a Netlify :",
        Object.fromEntries(fd.entries())
      );
      setStatus("(local) Dossier valide. Redirection vers la confirmation.", "ok");
      setTimeout(() => { window.location.href = form.action || "/merci.html"; }, 700);
      return;
    }

    // Production : POST a la racine, Netlify intercepte selon name="candidature"
    fetch("/", {
      method: "POST",
      body: new URLSearchParams(fd).toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
      .then(async (resp) => {
        if (resp.ok || resp.status === 200 || resp.status === 302) {
          setStatus("Dossier transmis. Redirection...", "ok");
          setTimeout(() => { window.location.href = form.action || "/merci.html"; }, 600);
          return;
        }
        // Tente de lire le corps pour un diagnostic plus fin
        let detail = `HTTP ${resp.status}`;
        try {
          const txt = await resp.text();
          if (txt && txt.length < 240) detail += ` — ${txt.trim()}`;
        } catch { /* ignore */ }
        throw new Error(detail);
      })
      .catch((err) => {
        console.error("[EZ-one] submit failed", err);
        const isOffline = !navigator.onLine;
        const msg = isOffline
          ? "Vous semblez hors ligne. Vos fichiers sont deja stockes, reessayez quand le reseau revient."
          : `Le dossier n'a pas pu etre transmis (${err.message}). Vos fichiers sont en securite sur Cloudinary, reessayez l'envoi.`;
        setStatus(msg, "error");
        resetSubmitButton();
      });
  });

  // ---------- Form control : Enter sur step 1/2 -> next, jamais submit precoce ----------
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (e.target.tagName !== "INPUT") return;
    if (e.target.type === "submit") return;

    // Sur les step 1 et 2, Enter declenche "Continuer" plutot que de submit le form
    if (state.step < state.totalSteps) {
      e.preventDefault();
      const nextBtn = document.querySelector('.step.is-active button[data-action="next"]');
      if (nextBtn && !nextBtn.disabled) nextBtn.click();
    }
    // Sur le step 3, Enter laisse le form submit naturellement
  });

  // ---------- Avertir si offline / online ----------
  window.addEventListener("offline", () => {
    setStatus("Vous etes hors ligne. Les uploads et l'envoi vont echouer tant que le reseau est coupe.", "error");
  });
  window.addEventListener("online", () => {
    if (statusEl.classList.contains("is-error") && statusEl.textContent.includes("hors ligne")) {
      setStatus("Reseau retrouve. Vous pouvez reessayer.", "info");
    }
  });

  // ---------- Init ----------
  goToStep(1);
})();
