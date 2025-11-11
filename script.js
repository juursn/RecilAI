// URL do modelo da IA (Mantida):
const URL = "https://teachablemachine.withgoogle.com/models/-3-2Ngyl-/";

let model, webcam, labelContainer, maxPredictions, barsContainer;
let isWebcamActive = false;
let currentPredictionSource = null;
const CONFIDENCE_THRESHOLD = 0.40; 

// Elementos HTML
const webcamVideo = document.getElementById("webcam-video");
const uploadedImage = document.getElementById("uploaded-image");
const webcamButton = document.getElementById("webcamButton");

// ----------------------------------------------------
// Funções de Inicialização e Controle (Estáveis)
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
    if (!model) { labelContainer.innerHTML = '<p style="color: red;">Modelo de IA não carregado.</p>'; return; }
    if (isWebcamActive) { await stopWebcam(); webcamButton.innerHTML = '<i class="fas fa-camera"></i> Ativar Webcam'; return; }

    uploadedImage.style.display = 'none';

    try {
        webcam = new tmImage.Webcam(400, 400, true);
        await webcam.setup();
        await webcam.play();
        window.requestAnimationFrame(loop);
        webcamVideo.style.display = 'block';
        webcamVideo.srcObject = webcam.webcam.srcObject;
        isWebcamActive = true;
        currentPredictionSource = 'webcam';
        webcamButton.innerHTML = '<i class="fas fa-camera"></i> Desligar Webcam';
        loop();
    } catch (error) {
        labelContainer.innerHTML = '<div class="disposal-inconclusivo">Erro ao acessar a webcam. Verifique as permissões do navegador.</div>';
    }
}

async function stopWebcam() {
    if (webcam) {
        webcam.stop();
        if (webcam.webcam.srcObject) {
            webcam.webcam.srcObject.getTracks().forEach(track => track.stop());
        }
    }
    webcamVideo.style.display = 'none';
    isWebcamActive = false;
    currentPredictionSource = null;
    
    labelContainer.className = 'result-box';
    labelContainer.innerHTML = '<p class="initial-message">Aguardando objeto...</p>';
    barsContainer.innerHTML = '';
}

async function loop() {
    if (isWebcamActive && currentPredictionSource === 'webcam') {
        webcam.update();
        await predict(webcam.canvas);
        window.requestAnimationFrame(loop);
    }
}

function handleImageUpload(event) {
    if (!model) { labelContainer.innerHTML = '<p style="color: red;">Modelo de IA não carregado.</p>'; return; }
    
    if (isWebcamActive) { stopWebcam(); webcamButton.innerHTML = '<i class="fas fa-camera"></i> Ativar Webcam'; }

    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            uploadedImage.src = e.target.result;
            uploadedImage.style.display = 'block';

            uploadedImage.onload = function() {
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
// Função de Informações de Descarte (CORRIGIDA)
// ----------------------------------------------------

function getDisposalInfo(className) {
    const lowerCaseName = className.toLowerCase();
    
    // Lista de rótulos a serem forçados como PLÁSTICO (Adiciona Outros Lixos, Lixo Comum, Não Reciclável)
    const plasticForceLabels = ["não reciclável", "lixo comum", "outros lixos", "plástico"];

    // 1. Mapeamento FORÇADO para PLÁSTICO
    if (plasticForceLabels.some(label => lowerCaseName.includes(label))) {
        return {
            className: "disposal-plastico",
            barClass: "bar-plastico",
            material: "Plástico",
            color: "VERMELHA",
            icon: "fas fa-recycle"
        };
    }
    
    // 2. Mapeamento para outros recicláveis padrão (Sem substituições)
    if (lowerCaseName.includes("metal") || lowerCaseName.includes("metais")) {
        return { className: "disposal-metal", barClass: "bar-metais", material: "Metal", color: "AMARELA", icon: "fas fa-cogs" };
    }
    if (lowerCaseName.includes("vidro")) {
        return { className: "disposal-vidro", barClass: "bar-vidro", material: "Vidro", color: "VERDE", icon: "fas fa-glass-martini" };
    }
    if (lowerCaseName.includes("papel") || lowerCaseName.includes("papelao")) {
        return { className: "disposal-papel", barClass: "bar-papel", material: "Papel/Papelão", color: "AZUL", icon: "fas fa-file-alt" };
    }
    
    // 3. Fallback genérico (para o caso de classes não mapeadas que não sejam as forçadas)
    return {
        className: "disposal-comum",
        barClass: "bar-comum",
        material: "Outros Resíduos",
        color: "CINZA ou PRETA",
        icon: "fas fa-trash-alt"
    };
}

// ----------------------------------------------------
// Função de Predição e Geração da Saída (Mantida e Estável)
// ----------------------------------------------------

async function predict(imageElement) {
    if (!model) return;

    const prediction = await model.predict(imageElement, false);
    
    labelContainer.innerHTML = '';
    labelContainer.className = 'result-box';
    barsContainer.innerHTML = '';
    
    let topPrediction = { className: "Não Identificado", probability: 0 };
    
    // 1. Loop para CRIAR AS BARRAS DE PROBABILIDADE e encontrar a maior predição
    prediction.forEach(p => {
        // A função getDisposalInfo gerencia a substituição (ex: Lixo Comum -> Plástico)
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

    // 2. Geração da Mensagem Principal
    const resultDiv = document.createElement("div");
    
    // A função getDisposalInfo também gerencia a substituição para o resultado final
    const disposalInfo = getDisposalInfo(topPrediction.className);

    labelContainer.classList.add(disposalInfo.className);

    resultDiv.innerHTML = `
        <p class="result-header" style="font-size: 1.1em; margin-bottom: 0;">
            <i class="${disposalInfo.icon}"></i> **Tipo de Lixo Identificado:**
        </p>
        <h3 class="result-header" style="font-size: 2.2em; margin-top: 5px; margin-bottom: 10px;">
            ${disposalInfo.material}
        </h3>
        
        <p class="disposal-text" style="font-size: 1.2em; font-weight: 700; border-top: 1px dashed #ccc; padding-top: 10px;">
            <i class="fas fa-trash"></i> Descarte na Lixeira: **${disposalInfo.color}**
        </p>
        
        <p style="font-size: 0.8em; color: #666; margin-top: 10px;">
            Confiança da IA na classe mais alta: ${(topPrediction.probability * 100).toFixed(0)}%
        </p>
    `;
    
    labelContainer.appendChild(resultDiv);
}

// Inicia o carregamento do modelo
window.onload = init;