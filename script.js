const API_KEY = 'AIzaSyD00fZSXDsQBx60juOZxBdgT--jQKVvpl0';

// Configuration de sécurité
const securityConfig = {
    headers: {
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const uploadBtn = document.getElementById('uploadBtn');
    const captureBtn = document.getElementById('captureBtn');
    const fileInput = document.getElementById('fileInput');
    const camera = document.getElementById('camera');
    const preview = document.getElementById('preview');
    const imagePreview = document.getElementById('imagePreview');
    const resultTable = document.getElementById('resultTable');

    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', handleImageUpload);
    captureBtn.addEventListener('click', startCamera);

    // Fonction de sanitisation des données
    function sanitizeData(data) {
        const clean = {};
        for (let key in data) {
            clean[key] = typeof data[key] === 'string' 
                ? data[key].replace(/[<>]/g, '') 
                : data[key];
        }
        return clean;
    }

    // Modification de la fonction handleImageUpload
    async function handleImageUpload(e) {
        try {
            const file = e.target.files[0];
            if (file) {
                const imageUrl = URL.createObjectURL(file);
                preview.src = imageUrl;
                imagePreview.hidden = false;
                await analyzeMedication(file);
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert(error.message);
        }
    }

    async function startCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' }, // Utilise la caméra arrière par défaut
                    width: { ideal: 1920 }, // Résolution HD
                    height: { ideal: 1080 },
                    aspectRatio: { ideal: 1.7777777778 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            camera.srcObject = stream;
            camera.hidden = false;
            camera.play();

            // Ajout d'un bouton pour basculer entre les caméras
            const switchCameraBtn = document.createElement('button');
            switchCameraBtn.innerHTML = '🔄 Changer de caméra';
            switchCameraBtn.className = 'switch-camera-btn';
            camera.parentElement.appendChild(switchCameraBtn);

            switchCameraBtn.onclick = async () => {
                const currentFacingMode = constraints.video.facingMode.ideal;
                constraints.video.facingMode.ideal = currentFacingMode === 'environment' ? 'user' : 'environment';
                
                // Arrêter l'ancien flux
                stream.getTracks().forEach(track => track.stop());
                
                // Démarrer le nouveau flux
                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                camera.srcObject = newStream;
                camera.play();
            };

            camera.addEventListener('loadeddata', () => {
                const canvas = document.createElement('canvas');
                // Utiliser les dimensions réelles de la vidéo
                canvas.width = camera.videoWidth;
                canvas.height = camera.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(camera, 0, 0);
                
                canvas.toBlob(async (blob) => {
                    camera.hidden = true;
                    preview.src = URL.createObjectURL(blob);
                    imagePreview.hidden = false;
                    
                    // Nettoyer
                    stream.getTracks().forEach(track => track.stop());
                    switchCameraBtn.remove();
                    
                    await analyzeMedication(blob);
                }, 'image/jpeg', 0.95); // Qualité JPEG à 95%
            });

        } catch (err) {
            console.error('Erreur lors de l\'accès à la caméra:', err);
            let errorMessage = 'Impossible d\'accéder à la caméra. ';
            
            if (err.name === 'NotAllowedError') {
                errorMessage += 'Veuillez autoriser l\'accès à la caméra.';
            } else if (err.name === 'NotFoundError') {
                errorMessage += 'Aucune caméra n\'a été trouvée sur votre appareil.';
            } else if (err.name === 'NotReadableError') {
                errorMessage += 'La caméra est peut-être déjà utilisée par une autre application.';
            }
            
            alert(errorMessage);
        }
    }

    // Modification de la fonction analyzeMedication
    async function analyzeMedication(imageFile) {
        try {
            const scanStatus = document.getElementById('scanStatus');
            const statusMessage = document.getElementById('statusMessage');
            const generalInfo = document.getElementById('generalInfo');
            const medicalInfo = document.getElementById('medicalInfo');
            
            // Réinitialiser l'affichage
            scanStatus.hidden = false;
            resultTable.hidden = true;
            statusMessage.textContent = 'Scan en cours';
            statusMessage.classList.add('loading-dots');
            generalInfo.innerHTML = '';
            medicalInfo.innerHTML = '';

            const base64Image = await convertToBase64(imageFile);
            
            const prompt = `En tant qu'expert pharmaceutique, analyse cette image de médicament et fournis les informations suivantes de manière détaillée et structurée:

1. Nom commercial du médicament
2. Laboratoire pharmaceutique
3. Molécule (DCI/Principe actif)
4. Forme pharmaceutique (comprimé, gélule, solution, etc.)
5. Dosage précis
6. Classe thérapeutique
7. Indications thérapeutiques principales détaillées
8. Posologie recommandée (doses et fr��quence selon l'âge/poids)
9. Mode d'administration spécifique
10. Contre-indications majeures
11. Effets secondaires fréquents
12. Interactions médicamenteuses importantes
13. Précautions particulières d'emploi
14. Conservation (conditions et durée)
15. Population à risque
16. Surveillance particulière nécessaire
17. Statut (prescription obligatoire ou non)
18. Fabricant
19. Recommandations pour la durée de validité`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }, {
                            inline_data: {
                                mime_type: imageFile.type,
                                data: base64Image
                            }
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Format de réponse invalide');
            }

            const textResponse = data.candidates[0].content.parts[0].text;
            
            // Traitement des données
            const processedData = {
                name: extractInfoFromNumberedList(textResponse, 1) || "Information non disponible",
                laboratory: extractInfoFromNumberedList(textResponse, 2) || "Information non disponible",
                molecule: extractInfoFromNumberedList(textResponse, 3) || "Information non disponible",
                form: extractInfoFromNumberedList(textResponse, 4) || "Information non disponible",
                dosage: extractInfoFromNumberedList(textResponse, 5) || "Information non disponible",
                category: extractInfoFromNumberedList(textResponse, 6) || "Information non disponible",
                mainUse: extractInfoFromNumberedList(textResponse, 7) || "Information non disponible",
                posology: extractInfoFromNumberedList(textResponse, 8) || "Information non disponible",
                administration: extractInfoFromNumberedList(textResponse, 9) || "Information non disponible",
                contraindications: extractInfoFromNumberedList(textResponse, 10) || "Information non disponible",
                sideEffects: extractInfoFromNumberedList(textResponse, 11) || "Information non disponible",
                interactions: extractInfoFromNumberedList(textResponse, 12) || "Information non disponible",
                precautions: extractInfoFromNumberedList(textResponse, 13) || "Information non disponible",
                storage: extractInfoFromNumberedList(textResponse, 14) || "Information non disponible",
                riskPopulation: extractInfoFromNumberedList(textResponse, 15) || "Information non disponible",
                monitoring: extractInfoFromNumberedList(textResponse, 16) || "Information non disponible",
                status: extractInfoFromNumberedList(textResponse, 17) || "Information non disponible",
                manufacturer: extractInfoFromNumberedList(textResponse, 18) || "Information non disponible",
                expiry: extractInfoFromNumberedList(textResponse, 19) || "Information non disponible"
            };

            // Mise à jour du statut
            statusMessage.classList.remove('loading-dots');
            statusMessage.textContent = 'Scan terminé';
            const checkmark = document.createElement('span');
            checkmark.textContent = '✓';
            checkmark.className = 'success-checkmark';
            statusMessage.appendChild(checkmark);
            statusMessage.classList.add('success');

            // Affichage des résultats
            displayResults(processedData);
            resultTable.hidden = false;

        } catch (error) {
            console.error('Erreur détaillée:', error);
            statusMessage.classList.remove('loading-dots');
            statusMessage.textContent = 'Erreur lors du scan';
            statusMessage.classList.add('error');

            const errorMessage = `
                <tr>
                    <td colspan="2" style="text-align: center; color: red;">
                        <i class="fas fa-exclamation-circle"></i> 
                        Une erreur est survenue lors de l'analyse. Veuillez réessayer.
                    </td>
                </tr>
            `;
            
            generalInfo.innerHTML = errorMessage;
            medicalInfo.innerHTML = errorMessage;
            resultTable.hidden = false;
        }
    }

    // Fonction de gestion des erreurs
    function handleError(error) {
        console.error('Erreur détaillée:', error);
        statusMessage.classList.remove('loading-dots');
        statusMessage.textContent = 'Une erreur est survenue';
        statusMessage.classList.add('error');
    }

    // Ajout d'un gestionnaire d'erreurs global
    window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.error('Erreur globale:', {msg, url, lineNo, columnNo, error});
        return false;
    };

    function displayResults(data) {
        const generalInfo = document.getElementById('generalInfo');
        const medicalInfo = document.getElementById('medicalInfo');
        
        generalInfo.innerHTML = '';
        medicalInfo.innerHTML = '';
        
        // Informations générales
        const generalInfos = {
            'Nom commercial': data.name,
            'Laboratoire': data.laboratory,
            'Molécule (DCI)': data.molecule,
            'Forme pharmaceutique': data.form,
            'Dosage': data.dosage,
            'Conservation': data.storage,
            'Date de péremption': data.expiry,
            'Fabricant': data.manufacturer,
            'Statut': data.status
        };

        // Informations médicales
        const medicalInfos = {
            'Classe thérapeutique': data.category,
            'Indications principales': data.mainUse,
            'Posologie recommandée': data.posology,
            'Mode d\'administration': data.administration,
            'Contre-indications': data.contraindications,
            'Effets secondaires fréquents': data.sideEffects,
            'Interactions médicamenteuses': data.interactions,
            'Précautions particulières': data.precautions,
            'Population à risque': data.riskPopulation,
            'Surveillance particulière': data.monitoring
        };

        // Fonction pour créer les lignes du tableau
        const createTableRows = (infoObj, tableBody) => {
            for (const [key, value] of Object.entries(infoObj)) {
                if (value && value !== "Information non disponible") {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="info-label"><strong>${key}</strong></td>
                        <td class="info-value">${value}</td>
                    `;
                    tableBody.appendChild(row);
                }
            }
        };

        createTableRows(generalInfos, generalInfo);
        createTableRows(medicalInfos, medicalInfo);
    }

    function extractInfoFromNumberedList(text, number) {
        const regex = new RegExp(`${number}[.).\\s]+([^\\n]+)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }

    function convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Gestion des gestes tactiles
    let touchStartY = 0;
    let touchEndY = 0;

    document.addEventListener('touchstart', e => {
        touchStartY = e.changedTouches[0].screenY;
    });

    document.addEventListener('touchend', e => {
        touchEndY = e.changedTouches[0].screenY;
        handleSwipeGesture();
    });

    function handleSwipeGesture() {
        const swipeDistance = touchEndY - touchStartY;
        if (Math.abs(swipeDistance) > 50) {
            // Gestion du swipe
            if (swipeDistance > 0) {
                // Swipe vers le bas
            } else {
                // Swipe vers le haut
            }
        }
    }
}); 