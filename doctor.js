// ====== Sesión ======
const raw = localStorage.getItem("doctor_session");
if (!raw) window.location.href = "index.html";
const session = JSON.parse(raw);
document.getElementById("who").textContent = `Sesión: ${session.name} (${session.username})`;

document.getElementById("logout").addEventListener("click", () => {
  stopCamera(); // ✅
  localStorage.removeItem("doctor_session");
  window.location.href = "index.html";
});
document.getElementById("toHome").addEventListener("click", () => {
  stopCamera(); // ✅
  window.location.href = "index.html";
});

// ====== Teachable Machine ======
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/J2TZFW5dx/"; // tu URL ✅

let model, maxPredictions;
let lastTop = null; // {label, prob}

const $ = (id) => document.getElementById(id);
const setStatus = (t) => ($("status").textContent = t);

const modeCamBtn = $("modeCam");
const modeFileBtn = $("modeFile");
const camPanel = $("camPanel");
const filePanel = $("filePanel");

const startCamBtn = $("startCam");
const analyzeCamBtn = $("analyzeCam");
const analyzeFileBtn = $("analyzeFile");
const continueBtn = $("continue");

const camVideo = document.getElementById("camVideo");
const camCanvas = document.getElementById("camCanvas");
const camCtx = camCanvas.getContext("2d");
let camStream = null;

const labelEl = $("label");
const confEl = $("conf");

// ====== NUEVO: elementos para subir imagen ======
const fileInput = document.getElementById("fileInput");
const fileCanvas = document.getElementById("fileCanvas");
const fileCtx = fileCanvas.getContext("2d");
let fileReady = false;

function resetFileState() {
  fileReady = false;
  analyzeFileBtn.disabled = true;
  if (fileCanvas) fileCanvas.style.display = "none";
}

// ====== Modelo ======
async function loadModelOnce() {
  if (model) return;
  setStatus("Cargando modelo...");
  const modelURL = MODEL_URL + "model.json";
  const metadataURL = MODEL_URL + "metadata.json";
  model = await tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();
  setStatus("Modelo cargado ✅");
}

function updateResult(top) {
  lastTop = top;
  labelEl.textContent = top.label;
  confEl.textContent = (top.prob * 100).toFixed(1) + "%";
  continueBtn.disabled = false;
}

// ====== Cámara: stop (para evitar cámara ocupada / conflictos) ======
function stopCamera() {
  if (camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }
  if (camVideo) camVideo.srcObject = null;
}

// ====== Cambiar modos ======
modeCamBtn.addEventListener("click", () => {
  camPanel.style.display = "block";
  filePanel.style.display = "none";
  setStatus("Modo cámara seleccionado.");
});

modeFileBtn.addEventListener("click", () => {
  // ✅ opcional: apagar cámara cuando te vas a subir imagen
  stopCamera();
  analyzeCamBtn.disabled = true;

  filePanel.style.display = "block";
  camPanel.style.display = "none";
  setStatus("Modo subir imagen seleccionado.");

  // ✅ resetea estado de archivo
  resetFileState();
});

// ====== Iniciar cámara ======
startCamBtn.addEventListener("click", async () => {
  startCamBtn.disabled = true;

  try {
    await loadModelOnce();
    setStatus("Solicitando cámara...");

    camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: "user" },
      audio: false
    });

    camVideo.srcObject = camStream;

    await new Promise((resolve) => {
      camVideo.onloadedmetadata = () => resolve();
    });

    await camVideo.play();

    analyzeCamBtn.disabled = false;
    setStatus("Cámara lista ✅ Presiona Analizar.");
  } catch (e) {
    console.error("Error cámara:", e);

    if (e?.name === "NotAllowedError") {
      alert("Permiso de cámara denegado. Permite la cámara en el navegador.");
      setStatus("Permiso denegado ❌");
    } else if (e?.name === "NotFoundError") {
      alert("No se encontró cámara conectada.");
      setStatus("Sin cámara ❌");
    } else if (e?.name === "NotReadableError") {
      alert("La cámara está siendo usada por otra app (Zoom/Teams/Meet). Ciérrala e intenta de nuevo.");
      setStatus("Cámara ocupada ❌");
    } else {
      alert("No se pudo iniciar la cámara. Revisa la consola (F12).");
      setStatus("Error iniciando cámara ❌");
    }

    startCamBtn.disabled = false;
  }
});

// ====== Predicción top ======
async function predictTop(sourceEl) {
  const preds = await model.predict(sourceEl);
  preds.sort((a, b) => b.probability - a.probability);
  return { label: preds[0].className, prob: preds[0].probability };
}

// ====== (Opcional) Redirigir automático ======
function goToResult(top) {
  updateResult(top);
  setStatus("Resultado obtenido ✅ Redirigiendo...");

  localStorage.setItem("last_prediction", JSON.stringify({
    label: top.label,
    confidence: top.prob,
    ts: Date.now()
  }));

  setTimeout(() => {
    window.location.href = "result.html";
  }, 400);
}

// ====== Analizar (cámara) ======
analyzeCamBtn.addEventListener("click", async () => {
  try {
    if (!model) {
      alert("Primero inicia el modelo.");
      return;
    }
    if (!camVideo || !camVideo.srcObject) {
      alert("Primero inicia la cámara.");
      return;
    }

    // Espera a que el video tenga datos
    if (camVideo.readyState < 2) {
      setStatus("Esperando frames de la cámara...");
      await new Promise((resolve) => {
        const t = setInterval(() => {
          if (camVideo.readyState >= 2) {
            clearInterval(t);
            resolve();
          }
        }, 100);
      });
    }

    camCtx.drawImage(camVideo, 0, 0, camCanvas.width, camCanvas.height);

    const top = await predictTop(camCanvas);

    updateResult(top);
    setStatus("Resultado obtenido ✅ Puedes continuar.");
    // o: goToResult(top);
  } catch (e) {
    console.error("Error en Analizar (cámara):", e);
    alert("Error al analizar cámara. Abre consola (F12) para ver detalles.");
    setStatus("Error al analizar ❌");
  }
});

// ====== NUEVO: Cargar imagen (subir archivo) ======
resetFileState();

fileInput?.addEventListener("change", async () => {
  try {
    resetFileState();

    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor sube una imagen válida (JPG/PNG/etc).");
      fileInput.value = "";
      return;
    }

    await loadModelOnce();

    setStatus("Cargando imagen...");

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = new Image();
    img.onload = () => {
      const cw = fileCanvas.width, ch = fileCanvas.height;
      fileCtx.clearRect(0, 0, cw, ch);

      // Mantener proporción centrada
      const ratio = Math.min(cw / img.width, ch / img.height);
      const nw = img.width * ratio;
      const nh = img.height * ratio;
      const x = (cw - nw) / 2;
      const y = (ch - nh) / 2;

      fileCtx.drawImage(img, x, y, nw, nh);

      fileCanvas.style.display = "block";
      fileCanvas.style.borderRadius = "12px";
      fileCanvas.style.border = "1px solid #e6e6ef";

      fileReady = true;
      analyzeFileBtn.disabled = false;
      setStatus("Imagen cargada ✅ Presiona Analizar.");
    };

    img.onerror = () => {
      alert("No se pudo leer la imagen. Intenta con otra.");
      setStatus("Error leyendo imagen ❌");
    };

    img.src = dataUrl;
  } catch (e) {
    console.error("Error al cargar imagen:", e);
    alert("Error al cargar la imagen. Revisa consola (F12).");
    setStatus("Error al cargar imagen ❌");
  }
});

// ====== NUEVO: Analizar (archivo) ======
analyzeFileBtn.addEventListener("click", async () => {
  try {
    if (!model) {
      alert("Primero carga el modelo.");
      return;
    }
    if (!fileReady) {
      alert("Primero selecciona una imagen.");
      return;
    }

    const top = await predictTop(fileCanvas);

    updateResult(top);
    setStatus("Resultado obtenido ✅ Puedes continuar.");
    // o: goToResult(top);
  } catch (e) {
    console.error("Error en Analizar (archivo):", e);
    alert("Error al analizar imagen. Abre consola (F12) para ver detalles.");
    setStatus("Error al analizar ❌");
  }
});

// ====== Continuar a otra página ======
continueBtn.addEventListener("click", () => {
  if (!lastTop) return;

  localStorage.setItem("last_prediction", JSON.stringify({
    label: lastTop.label,
    confidence: lastTop.prob,
    ts: Date.now()
  }));

  window.location.href = "result.html";
});


