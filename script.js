// URL do modelo da IA (VERIFIQUE SE ESTÁ CORRETA):
const URL = "https://teachablemachine.withgoogle.com/models/-3-2Ngyl-/";

let model, webcam, labelContainer, maxPredictions, barsContainer;
let isWebcamActive = false;
let isPaused = false;
let currentPredictionSource = null;
// MODO FIXO: Define a câmera traseira como padrão e única opção
let currentFacingMode = 'environment';

// Limites de Confiança
const CONFIDENCE_THRESHOLD_SUGGESTION = 0.40;
const CONFIDENCE_THRESHOLD_CONFIRM = 0.85;

// Elementos HTML
const webcamVideo = document.getElementById("webcam-video");
const uploadedImage = document.getElementById("uploaded-image");
const webcamButton = document.getElementById("webcamButton");
const frozenImage = document.getElementById("frozen-image");

// ----------------------------------------------------
// Funções de Inicialização e Controle de Câmera
// ----------------------------------------------------

async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    try {
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        labelContainer = document.getElementById("label-container");
        barsContainer = document.getElementById("bars-container");
    } catch (e) {
        document.getElementById("label-container").innerHTML = '<p class="disposal-inconclusivo" style="color: red;">Erro ao carregar o modelo de IA. Verifique a URL.</p>';
        console.error("Erro ao carregar o modelo de IA:", e);
    }
}

async function startWebcam() {
    if (!model) {
        labelContainer.innerHTML = '<p style="color: red;">Modelo de IA não carregado. Verifique a URL do modelo no script.js.</p>';
        return;
    }

    if (isWebcamActive) {
        return isPaused ? resumeWebcam() : pauseWebcam();
    }

    uploadedImage.style.display = 'none';
    frozenImage.style.display = 'none';
    webcamVideo.style.display = 'none';

    const width = 400;
    const height = 400;
    const flip = true;

    try {
        const webcamSettings = { facingMode: currentFacingMode };

        if (webcam) {
            if (webcam.webcam && webcam.webcam.srcObject) {
                webcam.webcam.srcObject.getTracks().forEach(track => track.stop());
            }
            webcam.stop();
            webcam = null;
        }

        webcam = new tmImage.Webcam(width, height, flip, webcamSettings);

        await webcam.setup();
        await webcam.play();

    } catch (e) {
        console.error("Erro grave ao iniciar a webcam:", e);
        labelContainer.innerHTML = '<div class="disposal-inconclusivo">❌ Erro de Acesso! Verifique as **permissões da câmera** e se o dispositivo não está em uso por outro programa.</div>';
        return;
    }

    // Sucesso na inicialização
    webcamVideo.srcObject = webcam.webcam.srcObject;
    webcamVideo.style.display = 'block';
    isWebcamActive = true;
    isPaused = false;
    currentPredictionSource = 'webcam';
    webcamButton.innerHTML = '<i class="fas fa-pause"></i> Pausar câmera';

    window.requestAnimationFrame(loop);
}

function pauseWebcam() {
    if (!isWebcamActive || isPaused) return;

    if (webcam && webcam.canvas) {
        webcam.update();
        const snapshot = webcam.canvas.toDataURL('image/jpeg', 1.0);
        frozenImage.src = snapshot;
        frozenImage.style.display = 'block';
        frozenImage.style.width = webcamVideo.clientWidth + 'px';
        frozenImage.style.height = webcamVideo.clientHeight + 'px';
    }

    webcamVideo.style.display = 'none';
    isPaused = true;
    webcamButton.innerHTML = '<i class="fas fa-play"></i> ▶️Despausar';
    labelContainer.innerHTML = '<p class="initial-message" style="color: #007bff;">⏸️ Câmera Pausada</p>';
}

async function resumeWebcam() {
    if (!isWebcamActive || !isPaused) return;

    frozenImage.style.display = 'none';
    frozenImage.src = '';
    webcamVideo.style.display = 'block';
    isPaused = false;
    webcamButton.innerHTML = '<i class="fas fa-pause"></i> Pausar câmera';
    window.requestAnimationFrame(loop);
}

async function stopWebcam() {
    if (webcam) {
        if (webcam.webcam && webcam.webcam.srcObject) {
            webcam.webcam.srcObject.getTracks().forEach(track => track.stop());
            webcam.webcam.srcObject = null;
        }
        webcam.stop();
        webcam = null;
    }

    if (webcamVideo) {
        webcamVideo.srcObject = null;
    }

    webcamVideo.style.display = 'none';
    uploadedImage.style.display = 'none';
    frozenImage.style.display = 'none';
    frozenImage.src = '';

    isWebcamActive = false;
    isPaused = false;
    currentPredictionSource = null;

    webcamButton.innerHTML = '<i class="fas fa-video"></i> Iniciar câmera';
    labelContainer.className = 'result-box';
    labelContainer.innerHTML = '<p class="initial-message">Aguardando...</p>';
    barsContainer.innerHTML = '';
}

async function loop() {
    if (isWebcamActive && !isPaused && currentPredictionSource === 'webcam') {
        webcam.update();
        await predict(webcam.canvas);
        window.requestAnimationFrame(loop);
    }
}

// CORREÇÃO 3: Garante que a imagem carregada seja a única a ser exibida.
async function handleImageUpload(event) {
    if (!model) { labelContainer.innerHTML = '<p style="color: red;">Modelo de IA não carregado.</p>'; return; }

    if (isWebcamActive) {
        await stopWebcam();
        webcamButton.innerHTML = '<i class="fas fa-video"></i> Iniciar câmera';
    }

    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();

        // 1. Limpa visualização antes de carregar o arquivo
        webcamVideo.style.display = 'none';
        frozenImage.style.display = 'none';
        uploadedImage.style.display = 'none'; // Esconde primeiro

        reader.onload = function (e) {
            uploadedImage.src = e.target.result;

            // 2. CRÍTICO: Usa o evento onload do elemento <img> para exibir e classificar
            uploadedImage.onload = function () {
                uploadedImage.style.display = 'block'; // Exibe a imagem APÓS o carregamento
                currentPredictionSource = 'image';
                predict(uploadedImage);
            }

            // 3. Caso a imagem já esteja em cache (onload não dispara), chama manualmente
            if (uploadedImage.complete) {
                uploadedImage.onload();
            }
        };
        reader.readAsDataURL(file);
    } else {
        uploadedImage.style.display = 'none';
        labelContainer.className = 'result-box';
        labelContainer.innerHTML = '<p class="initial-message">Aguardando objeto...</p>';
        barsContainer.innerHTML = '';
    }
}


// ----------------------------------------------------
// Funções de Descarte e Predição (Mantidas)
// ----------------------------------------------------

function getDisposalInfo(className) {
    const lowerCaseName = className.toLowerCase();

    // ⚠️ ATENÇÃO: Verifique se estes nomes correspondem às classes do seu modelo!
    const plasticForceLabels = ["não reciclável", "lixo comum", "outros lixos", "plástico"];

    // 1. PLÁSTICO (e classes forçadas)
    if (plasticForceLabels.some(label => lowerCaseName.includes(label))) {
        return {
            className: "disposal-plastico",
            barClass: "bar-plastico",
            material: "Plástico",
            color: "VERMELHA",
            icon: "fas fa-recycle",
            instrucao: "Lave e seque antes de descartar. Não descarte plásticos que contenham produtos tóxicos."
        };
    }

    // 2. METAL
    if (lowerCaseName.includes("metal") || lowerCaseName.includes("metais")) {
        return { className: "disposal-metal", barClass: "bar-metais", material: "Metal", color: "AMARELA", icon: "fas fa-cogs", instrucao: "Lave as latas e amasse para otimizar o espaço." };
    }

    // 3. VIDRO
    if (lowerCaseName.includes("vidro")) {
        return { className: "disposal-vidro", barClass: "bar-vidro", material: "Vidro", color: "VERDE", icon: "fas fa-glass-martini", instrucao: "Descarte com segurança em caixas ou embrulhados (não use plástico filme)." };
    }

    // 4. PAPEL
    if (lowerCaseName.includes("papel") || lowerCaseName.includes("papelao")) {
        return { className: "disposal-papel", barClass: "bar-papel", material: "Papel/Papelão", color: "AZUL", icon: "fas fa-file-alt", instrucao: "Não descarte papéis molhados, sujos ou engordurados, eles são rejeitos." };
    }

    // 5. REJEITO/COMUM
    return {
        className: "disposal-comum",
        barClass: "bar-comum",
        material: "Outros Resíduos",
        color: "CINZA ou PRETA",
        icon: "fas fa-trash-alt",
        instrucao: "Este item deve ser descartado como lixo comum (rejeito ou orgânico)."
    };
}

async function predict(imageElement) {
    if (!model) return;

    const prediction = await model.predict(imageElement, false);

    labelContainer.innerHTML = '';
    labelContainer.className = 'result-box';
    barsContainer.innerHTML = '';

    let topPrediction = { className: "Não Identificado", probability: 0 };

    // 1. Cria as Barras e encontra a maior predição
    prediction.forEach(p => {
        const info = getDisposalInfo(p.className);
        const probabilityPercent = (p.probability * 100).toFixed(0);

        const rowHTML = `
            <div class="prediction-row">
                <div class="class-label">${info.material}</div>
                <div class="progress-bar-container">
                    <div class="progress-bar ${info.barClass}" style="width: ${probabilityPercent}%;">
                        ${probabilityPercent}%
                    </div>
                </div>
            </div>
        `;
        barsContainer.innerHTML += rowHTML;

        if (p.probability > topPrediction.probability) {
            topPrediction = p;
        }
    });

    // 2. Geração da Mensagem Principal (Lógica de Confiança em 3 Níveis)
    const resultDiv = document.createElement("div");
    const topInfo = getDisposalInfo(topPrediction.className);
    const probability = topPrediction.probability;

    labelContainer.classList.add(topInfo.className);

    let messageHTML = '';
    let headerText = '';
    let headerStyle = '';

    if (probability >= CONFIDENCE_THRESHOLD_CONFIRM) {
        // NÍVEL 1: Acima de 85% (Confirmação)
        headerText = `✅Indentificado: ${topInfo.material}`;
        headerStyle = `style="color: var(--color-vidro); font-size: 1.7em;"`;
        messageHTML = `
            <p class="disposal-text" style="font-size: 1.2em; font-weight: 700; border-top: 1px dashed #ccc; padding-top: 10px;">
                <i class="fas fa-trash"></i> Descarte na Lixeira: ${topInfo.color}
            </p>
            <p style="font-size: 0.8em; color: #666; margin-top: 5px;">
                Dica: ${topInfo.instrucao}
            </p>
        `;

    } else if (probability >= CONFIDENCE_THRESHOLD_SUGGESTION) {
        // NÍVEL 2: Entre 40% e 84% (Sugestão Amigável)
        headerText = `❎Acredito que seja: ${topInfo.material}`;
        headerStyle = `style="color: var(--color-secondary); font-size: 1.7em;"`;
        messageHTML = `
            <p class="disposal-text" style="font-size: 1.2em; font-weight: 700; border-top: 1px dashed #ccc; padding-top: 10px;">
                <i class="fas fa-hand-point-right"></i> Sugiro Lixeira: ${topInfo.color}
            </p>
            <p style="font-size: 0.8em; color: #666; margin-top: 5px;">
                Dica: ${topInfo.instrucao}
            </p>
        `;
    } else {
        // NÍVEL 3: Abaixo de 40% (Inconclusivo)
        headerText = `❌ Inconclusivo: Apenas ${(probability * 100).toFixed(0)}%`;
        headerStyle = `style="color: var(--color-comum); font-size: 1.7em;"`;
        messageHTML = `
            <p class="disposal-text" style="font-size: 1.1em; font-weight: 600;">
                <i class="fas fa-search-plus"></i> Por favor, aproxime o objeto ou tente o Modo Upload.
            </p>
        `;
    }

    // Montagem final do resultado
    resultDiv.innerHTML = `
        <p class="result-header" style="font-size: 1.0em; margin-bottom: 0;">
            <i class="${topInfo.icon}"></i> Confiança: ${(topPrediction.probability * 100).toFixed(0)}%
        </p>
        <h3 class="result-header" ${headerStyle}>
            ${headerText}
        </h3>
        ${messageHTML}
    `;

    labelContainer.appendChild(resultDiv);
}

// Inicia o carregamento do modelo
window.onload = init;