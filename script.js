// URL do modelo da IA (VERIFIQUE SE ESTÁ CORRETA):
const URL = "https://teachablemachine.withgoogle.com/models/-3-2Ngyl-/";

let model, webcam, labelContainer, maxPredictions, barsContainer;
let isWebcamActive = false;
let isPaused = false;
let currentPredictionSource = null;
let currentFacingMode = 'environment'; // Padrão: 'environment' (traseira)

// Limites de Confiança
const CONFIDENCE_THRESHOLD_SUGGESTION = 0.40;
const CONFIDENCE_THRESHOLD_CONFIRM = 0.85;

// Elementos HTML
const webcamVideo = document.getElementById("webcam-video");
const uploadedImage = document.getElementById("uploaded-image");
const webcamButton = document.getElementById("webcamButton");
const toggleCameraButton = document.getElementById("toggleCameraButton");
const frozenImage = document.getElementById("frozen-image");

// ----------------------------------------------------
// Funções de Inicialização e Controle de Câmera
// ----------------------------------------------------

async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    toggleCameraButton.innerHTML = '<i class="fas fa-sync-alt"></i> Câmera Traseira';

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
    const width = 400;
    const height = 400;
    const flip = true;

    try {
        const webcamSettings = { facingMode: currentFacingMode };

        // 🚨 CRÍTICO: Garante a destruição completa do objeto anterior
        if (webcam) {
            if (webcam.webcam && webcam.webcam.srcObject) {
                webcam.webcam.srcObject.getTracks().forEach(track => track.stop());
            }
            webcam.stop();
            webcam = null;
        }

        // RECRIAMOS A INSTÂNCIA DO ZERO com o currentFacingMode
        webcam = new tmImage.Webcam(width, height, flip, webcamSettings);

        await webcam.setup();
        await webcam.play();

    } catch (e) {
        console.error("Erro grave ao iniciar a webcam:", e);
        // Lança um erro para ser pego pela função chamadora (toggleCameraDirection)
        throw new Error("Falha ao iniciar stream de webcam.");
    }

    // Sucesso na inicialização
    webcamVideo.style.display = 'block';
    webcamVideo.srcObject = webcam.webcam.srcObject;
    isWebcamActive = true;
    isPaused = false;
    currentPredictionSource = 'webcam';
    webcamButton.innerHTML = '<i class="fas fa-pause"></i> Pausar câmera';
    toggleCameraButton.disabled = false;
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
        // 🚨 CORREÇÃO CRÍTICA: Adiciona verificação de existência para webcam.webcam e srcObject
        if (webcam.webcam && webcam.webcam.srcObject) {
            // Interrompe as tracks da câmera
            webcam.webcam.srcObject.getTracks().forEach(track => track.stop());
            webcam.webcam.srcObject = null;
        }
        // Interrompe o objeto tmImage.Webcam
        webcam.stop();
        webcam = null; // Limpa a referência do objeto para o garbage collector
    }

    // Assegura que todos os elementos de visualização sejam escondidos
    webcamVideo.style.display = 'none';
    uploadedImage.style.display = 'none';
    frozenImage.style.display = 'none';
    frozenImage.src = '';

    isWebcamActive = false;
    isPaused = false;
    currentPredictionSource = null;
    toggleCameraButton.disabled = true;

    webcamButton.innerHTML = '<i class="fas fa-video"></i> Iniciar câmera';
    labelContainer.className = 'result-box';
    labelContainer.innerHTML = '<p class="initial-message">Aguardando...</p>';
    barsContainer.innerHTML = '';
}

// CORREÇÃO FINAL: Lógica de recuperação de falha ao alternar a câmera
async function toggleCameraDirection() {
    if (!isWebcamActive) return;

    const originalFacingMode = currentFacingMode;

    // 1. Inverte o modo e atualiza o feedback
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
    const directionText = (currentFacingMode === 'environment') ? 'Traseira' : 'Frontal';
    toggleCameraButton.innerHTML = `<i class="fas fa-sync-alt"></i> Câmera ${directionText}`;

    // 2. Desliga a câmera atual (essencial para liberar o recurso)
    await stopWebcam();

    // 3. Tenta iniciar a câmera com o NOVO MODO
    try {
        await startWebcam();

    } catch (e) {
        // 🚨 LÓGICA DE RECUPERAÇÃO: O novo modo falhou. Tentar reverter.
        console.error("Tentativa de alternar a câmera falhou. Tentando reverter...", e);

        // Reverte o currentFacingMode para o original
        currentFacingMode = originalFacingMode;

        // Tenta iniciar a câmera no modo original
        try {
            await startWebcam();

            // Se a recuperação for bem-sucedida
            const revertedDirectionText = (currentFacingMode === 'environment') ? 'Traseira' : 'Frontal';
            toggleCameraButton.innerHTML = `<i class="fas fa-sync-alt"></i> Câmera ${revertedDirectionText}`;
            labelContainer.innerHTML = '<div class="disposal-inconclusivo" style="color: orange;">⚠️ Falha ao alternar! Restaurado o modo de câmera anterior.</div>';

        } catch (e2) {
            // Se a recuperação também falhar
            console.error("Falha ao restaurar a câmera original. Parando tudo.", e2);
            await stopWebcam();
            labelContainer.innerHTML = '<div class="disposal-inconclusivo" style="color: red;">❌ Erro Crítico: Não foi possível alternar nem restaurar a câmera. Verifique permissões.</div>';
        }
    }
}

async function loop() {
    if (isWebcamActive && !isPaused && currentPredictionSource === 'webcam') {
        webcam.update();
        await predict(webcam.canvas);
        window.requestAnimationFrame(loop);
    }
}

// CORRIGIDO: Transformada em async e adicionado await para stopWebcam()
async function handleImageUpload(event) {
    if (!model) { labelContainer.innerHTML = '<p style="color: red;">Modelo de IA não carregado.</p>'; return; }

    if (isWebcamActive) {
        await stopWebcam();
        webcamButton.innerHTML = '<i class="fas fa-video"></i> Iniciar câmera';
    }

    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            uploadedImage.src = e.target.result;
            uploadedImage.style.display = 'block';
            webcamVideo.style.display = 'none';
            frozenImage.style.display = 'none';

            uploadedImage.onload = function () {
                currentPredictionSource = 'image';
                predict(uploadedImage);
            }

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