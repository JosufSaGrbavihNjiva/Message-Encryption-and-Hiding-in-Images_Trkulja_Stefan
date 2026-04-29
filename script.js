const hideImageInput = document.getElementById("hideImageInput");
const revealImageInput = document.getElementById("revealImageInput");

const hideDropZone = document.getElementById("hideDropZone");
const revealDropZone = document.getElementById("revealDropZone");

const originalCanvas = document.getElementById("originalCanvas");
const hiddenCanvas = document.getElementById("hiddenCanvas");
const differenceCanvas = document.getElementById("differenceCanvas");
const revealCanvas = document.getElementById("revealCanvas");

const originalCtx = originalCanvas.getContext("2d");
const hiddenCtx = hiddenCanvas.getContext("2d");
const differenceCtx = differenceCanvas.getContext("2d");
const revealCtx = revealCanvas.getContext("2d");

const secretMessage = document.getElementById("secretMessage");
const hidePassword = document.getElementById("hidePassword");
const revealPassword = document.getElementById("revealPassword");

const hideBtn = document.getElementById("hideBtn");
const revealBtn = document.getElementById("revealBtn");
const downloadBtn = document.getElementById("downloadBtn");
const demoBtn = document.getElementById("demoBtn");
const clearBtn = document.getElementById("clearBtn");

const encryptionMode = document.getElementById("encryptionMode");
const revealMode = document.getElementById("revealMode");

const imageInfo = document.getElementById("imageInfo");
const revealImageInfo = document.getElementById("revealImageInfo");

const uploadedPreview = document.getElementById("uploadedPreview");
const revealPreview = document.getElementById("revealPreview");

const revealedMessage = document.getElementById("revealedMessage");
const logList = document.getElementById("logList");
const passwordBar = document.getElementById("passwordBar");
const passwordText = document.getElementById("passwordText");

let hiddenImageReady = false;

function addLog(message) {
    const li = document.createElement("li");
    li.textContent = "✓ " + message;
    logList.prepend(li);
}

function setupDropZone(dropZone, input, callback) {
    dropZone.addEventListener("click", () => input.click());

    dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropZone.classList.remove("dragover");

        const file = event.dataTransfer.files[0];

        if (file) {
            input.files = event.dataTransfer.files;
            callback(file);
        }
    });

    input.addEventListener("change", () => {
        const file = input.files[0];

        if (file) {
            callback(file);
        }
    });
}

function loadImageToCanvas(file, canvas, ctx, callback) {
    const reader = new FileReader();

    reader.onload = function(event) {
        const img = new Image();

        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            callback(img);
        };

        img.src = event.target.result;
    };

    reader.readAsDataURL(file);
}

function updateImageCapacityInfo() {
    if (!originalCanvas.width || !originalCanvas.height) {
        imageInfo.textContent = "Zatiaľ nebol nahratý žiadny obrázok.";
        return;
    }

    const pixels = originalCanvas.width * originalCanvas.height;
    const maxBytes = Math.floor(pixels / 8);
    const maxChars = Math.floor(maxBytes * 0.75);
    const currentChars = secretMessage.value.length;
    const usage = maxChars > 0 ? ((currentChars / maxChars) * 100).toFixed(3) : 0;

    imageInfo.innerHTML = `
        <strong>Rozlíšenie:</strong> ${originalCanvas.width} × ${originalCanvas.height} px<br>
        <strong>Počet pixelov:</strong> ${pixels.toLocaleString()}<br>
        <strong>Približná kapacita:</strong> ${maxChars.toLocaleString()} znakov<br>
        <strong>Dĺžka aktuálnej správy:</strong> ${currentChars} znakov<br>
        <strong>Využitie:</strong> ${usage} %
    `;
}

function checkPasswordStrength(password) {
    let score = 0;

    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    let width = "0%";
    let color = "#777";
    let label = "nezadané";

    if (password.length > 0) {
        if (score <= 2) {
            width = "33%";
            color = "#ff4d4d";
            label = "slabé";
        } else if (score <= 4) {
            width = "66%";
            color = "#ffd43b";
            label = "stredné";
        } else {
            width = "100%";
            color = "#35ff7a";
            label = "silné";
        }
    }

    passwordBar.style.width = width;
    passwordBar.style.background = color;
    passwordText.textContent = "Sila hesla: " + label;
}

function xorEncryptDecrypt(text, password) {
    let result = "";

    for (let i = 0; i < text.length; i++) {
        const keyChar = password.charCodeAt(i % password.length);
        result += String.fromCharCode(text.charCodeAt(i) ^ keyChar);
    }

    return result;
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";

    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
}

async function getAesKey(password, salt) {
    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        {
            name: "AES-GCM",
            length: 256
        },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptAES(message, password) {
    const encoder = new TextEncoder();

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getAesKey(password, salt);

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encoder.encode(message)
    );

    return JSON.stringify({
        salt: arrayBufferToBase64(salt),
        iv: arrayBufferToBase64(iv),
        data: arrayBufferToBase64(encrypted)
    });
}

async function decryptAES(encryptedJson, password) {
    const decoder = new TextDecoder();
    const parsed = JSON.parse(encryptedJson);

    const salt = new Uint8Array(base64ToArrayBuffer(parsed.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(parsed.iv));
    const encryptedData = base64ToArrayBuffer(parsed.data);

    const key = await getAesKey(password, salt);

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encryptedData
    );

    return decoder.decode(decrypted);
}

function textToBinary(text) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    let binary = "";

    for (const byte of bytes) {
        binary += byte.toString(2).padStart(8, "0");
    }

    return binary;
}

function binaryToText(binary) {
    const bytes = [];

    for (let i = 0; i < binary.length; i += 8) {
        const byte = binary.slice(i, i + 8);
        bytes.push(parseInt(byte, 2));
    }

    const decoder = new TextDecoder();
    return decoder.decode(new Uint8Array(bytes));
}

function createDifferenceMap(originalData, modifiedData, width, height) {
    differenceCanvas.width = width;
    differenceCanvas.height = height;

    const diffImageData = differenceCtx.createImageData(width, height);
    const diff = diffImageData.data;

    for (let i = 0; i < modifiedData.length; i += 4) {
        const changed =
            originalData[i] !== modifiedData[i] ||
            originalData[i + 1] !== modifiedData[i + 1] ||
            originalData[i + 2] !== modifiedData[i + 2];

        if (changed) {
            diff[i] = 0;
            diff[i + 1] = 234;
            diff[i + 2] = 255;
            diff[i + 3] = 255;
        } else {
            diff[i] = 0;
            diff[i + 1] = 0;
            diff[i + 2] = 0;
            diff[i + 3] = 255;
        }
    }

    differenceCtx.putImageData(diffImageData, 0, 0);
}

function buildPayload(mode, encryptedMessage) {
    const payload = JSON.stringify({
        app: "MessageEncryptionImageHiding",
        mode: mode,
        message: encryptedMessage
    });

    return payload + "###END###";
}

function extractPayload(text) {
    const endIndex = text.indexOf("###END###");

    if (endIndex === -1) {
        return null;
    }

    const payloadText = text.slice(0, endIndex);
    return JSON.parse(payloadText);
}

async function hideMessage() {
    const message = secretMessage.value;
    const password = hidePassword.value;
    const mode = encryptionMode.value;

    if (!originalCanvas.width || !originalCanvas.height) {
        alert("Najprv nahraj obrázok.");
        return;
    }

    if (!message.trim()) {
        alert("Napíš tajnú správu.");
        return;
    }

    if (!password) {
        alert("Zadaj heslo.");
        return;
    }

    try {
        addLog("Začína sa šifrovanie správy.");

        let encryptedMessage;

        if (mode === "aes") {
            encryptedMessage = await encryptAES(message, password);
            addLog("Správa bola zašifrovaná pomocou AES-GCM.");
        } else {
            encryptedMessage = btoa(unescape(encodeURIComponent(xorEncryptDecrypt(message, password))));
            addLog("Správa bola zašifrovaná pomocou Basic XOR.");
        }

        const finalPayload = buildPayload(mode, encryptedMessage);
        const binaryMessage = textToBinary(finalPayload);

        const originalImageData = originalCtx.getImageData(
            0,
            0,
            originalCanvas.width,
            originalCanvas.height
        );

        const hiddenImageData = hiddenCtx.getImageData(
            0,
            0,
            hiddenCanvas.width,
            hiddenCanvas.height
        );

        const data = hiddenImageData.data;

        if (binaryMessage.length > data.length / 4) {
            alert("Správa je príliš dlhá pre tento obrázok.");
            addLog("Chyba: správa je príliš dlhá.");
            return;
        }

        let bitIndex = 0;

        for (let i = 0; i < data.length && bitIndex < binaryMessage.length; i += 4) {
            data[i] = (data[i] & 254) | Number(binaryMessage[bitIndex]);
            bitIndex++;
        }

        hiddenCtx.putImageData(hiddenImageData, 0, 0);

        createDifferenceMap(
            originalImageData.data,
            hiddenImageData.data,
            hiddenCanvas.width,
            hiddenCanvas.height
        );

        hiddenImageReady = true;
        downloadBtn.disabled = false;

        addLog("Zašifrované dáta boli zapísané do najmenej významných bitov pixelov.");
        addLog("Mapa skrytých dát bola vytvorená.");
        addLog("Výsledný PNG obrázok je pripravený na stiahnutie.");

        alert("Správa bola úspešne ukrytá do obrázka.");
    } catch (error) {
        console.error(error);
        alert("Nastala chyba pri ukrývaní správy.");
        addLog("Chyba pri ukrývaní správy.");
    }
}

async function revealMessage() {
    const file = revealImageInput.files[0];
    const password = revealPassword.value;

    if (!file) {
        alert("Nahraj obrázok s ukrytou správou.");
        return;
    }

    if (!password) {
        alert("Zadaj heslo.");
        return;
    }

    loadImageToCanvas(file, revealCanvas, revealCtx, async function() {
        try {
            addLog("Začína sa čítanie ukrytých dát z obrázka.");

            const imageData = revealCtx.getImageData(
                0,
                0,
                revealCanvas.width,
                revealCanvas.height
            );

            const data = imageData.data;
            let binaryMessage = "";

            for (let i = 0; i < data.length; i += 4) {
                binaryMessage += (data[i] & 1).toString();

                if (binaryMessage.length % 8 === 0) {
                    const currentText = binaryToText(binaryMessage);

                    if (currentText.includes("###END###")) {
                        const payload = extractPayload(currentText);

                        if (!payload || !payload.message) {
                            throw new Error("Invalid payload");
                        }

                        let decryptedMessage;

                        if (payload.mode === "aes") {
                            decryptedMessage = await decryptAES(payload.message, password);
                            addLog("Správa bola dešifrovaná pomocou AES-GCM.");
                        } else {
                            const encryptedXorText = decodeURIComponent(escape(atob(payload.message)));
                            decryptedMessage = xorEncryptDecrypt(encryptedXorText, password);
                            addLog("Správa bola dešifrovaná pomocou Basic XOR.");
                        }

                        revealedMessage.textContent = decryptedMessage;
                        addLog("Ukrytá správa bola úspešne zobrazená.");
                        return;
                    }
                }
            }

            revealedMessage.textContent = "Správa sa nenašla.";
            addLog("Správa sa v obrázku nenašla.");
        } catch (error) {
            console.error(error);
            revealedMessage.textContent =
                "Správa sa nedá prečítať. Pravdepodobne je nesprávne heslo alebo bol obrázok poškodený.";
            addLog("Chyba: správa sa nedá dešifrovať.");
        }
    });
}

function downloadHiddenImage() {
    if (!hiddenImageReady) {
        return;
    }

    const link = document.createElement("a");
    link.download = "hidden-message.png";
    link.href = hiddenCanvas.toDataURL("image/png");
    link.click();

    addLog("Výsledný obrázok bol stiahnutý.");
}

function loadHideImage(file) {
    const previewUrl = URL.createObjectURL(file);

    uploadedPreview.src = previewUrl;
    uploadedPreview.style.display = "block";

    hideDropZone.classList.add("file-loaded");
    hideDropZone.querySelector("p").textContent = "Obrázok bol pridaný";
    hideDropZone.querySelector("span").textContent = "Môžeš napísať správu a spustiť šifrovanie";

    loadImageToCanvas(file, originalCanvas, originalCtx, function() {
        hiddenCanvas.width = originalCanvas.width;
        hiddenCanvas.height = originalCanvas.height;

        hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
        hiddenCtx.drawImage(originalCanvas, 0, 0);

        differenceCanvas.width = originalCanvas.width;
        differenceCanvas.height = originalCanvas.height;

        differenceCtx.fillStyle = "black";
        differenceCtx.fillRect(0, 0, differenceCanvas.width, differenceCanvas.height);

        hiddenImageReady = false;
        downloadBtn.disabled = true;

        updateImageCapacityInfo();
        addLog("Obrázok bol načítaný a zobrazený v náhľade.");
    });
}

function loadRevealImage(file) {
    const previewUrl = URL.createObjectURL(file);

    revealPreview.src = previewUrl;
    revealPreview.style.display = "block";

    const fileSizeKb = (file.size / 1024).toFixed(2);

    revealImageInfo.innerHTML = `
        <strong>Obrázok bol pridaný:</strong> ${file.name}<br>
        <strong>Veľkosť:</strong> ${fileSizeKb} KB<br>
        <strong>Typ:</strong> ${file.type || "neznámy"}
    `;

    revealDropZone.classList.add("file-loaded");
    revealDropZone.querySelector("p").textContent = "Obrázok s ukrytou správou bol pridaný";
    revealDropZone.querySelector("span").textContent = "Môžeš zadať heslo a kliknúť Prečítať správu";

    addLog("Obrázok na čítanie správy bol načítaný a zobrazený.");
}

demoBtn.addEventListener("click", () => {
    secretMessage.value =
        "Toto je tajná správa ukrytá v obrázku. Projekt demonštruje šifrovanie a steganografiu priamo v prehliadači.";

    hidePassword.value = "Student2026!";
    encryptionMode.value = "aes";

    checkPasswordStrength(hidePassword.value);
    updateImageCapacityInfo();

    addLog("Demo správa a heslo boli načítané.");
});

clearBtn.addEventListener("click", () => {
    secretMessage.value = "";
    hidePassword.value = "";
    revealPassword.value = "";

    revealedMessage.textContent = "Tu sa zobrazí ukrytá správa.";

    checkPasswordStrength("");
    updateImageCapacityInfo();

    addLog("Formulár bol vyčistený.");
});

hidePassword.addEventListener("input", () => {
    checkPasswordStrength(hidePassword.value);
});

secretMessage.addEventListener("input", updateImageCapacityInfo);

hideBtn.addEventListener("click", hideMessage);
revealBtn.addEventListener("click", revealMessage);
downloadBtn.addEventListener("click", downloadHiddenImage);

setupDropZone(hideDropZone, hideImageInput, loadHideImage);
setupDropZone(revealDropZone, revealImageInput, loadRevealImage);

addLog("Systém pripravený. Nahraj obrázok a napíš správu.");