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

import { Camera } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';

document.addEventListener('DOMContentLoaded', async () => {
    const uploadBtn = document.getElementById('uploadBtn');
    const captureBtn = document.getElementById('captureBtn');
    const fileInput = document.getElementById('fileInput');
    const preview = document.getElementById('preview');
    const imagePreview = document.getElementById('imagePreview');
    const resultTable = document.getElementById('resultTable');

    // Demander la permission d'utiliser la caméra au démarrage
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
        alert('Permission d\'accès à la caméra refusée');
        return;
    }

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

    async function handleImageUpload(e) {
        try {
            const file = e.target.files[0];
            if (file) {
                // Vérifier la taille du fichier (10MB max)
                if (file.size > 10 * 1024 * 1024) {
                    throw new Error('L\'image ne doit pas dépasser 10MB');
                }
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
            // Créer un élément Camera de React Native
            const cameraRef = React.createRef();
            const cameraContainer = document.createElement('div');
            cameraContainer.style.position = 'fixed';
            cameraContainer.style.top = '0';
            cameraContainer.style.left = '0';
            cameraContainer.style.width = '100%';
            cameraContainer.style.height = '100%';
            cameraContainer.style.zIndex = '1000';
            document.body.appendChild(cameraContainer);

            // Configurer la caméra
            const CameraComponent = () => {
                const [type, setType] = React.useState(Camera.Constants.Type.back);
                
                const takePicture = async () => {
                    if (cameraRef.current) {
                        const photo = await cameraRef.current.takePictureAsync({
                            quality: 0.7,
                            base64: true,
                        });

                        // Redimensionner l'image si nécessaire
                        const manipResult = await ImageManipulator.manipulateAsync(
                            photo.uri,
                            [{ resize: { width: 1024 } }],
                            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                        );

                        // Convertir en Blob pour la compatibilité avec le code existant
                        const response = await fetch(manipResult.uri);
                        const blob = await response.blob();

                        // Afficher l'aperçu
                        preview.src = URL.createObjectURL(blob);
                        imagePreview.hidden = false;

                        // Nettoyer
                        document.body.removeChild(cameraContainer);

                        // Analyser l'image
                        await analyzeMedication(blob);
                    }
                };

                return (
                    <Camera 
                        ref={cameraRef}
                        type={type}
                        style={{
                            flex: 1,
                            width: '100%',
                            height: '100%'
                        }}
                    >
                        <View style={{
                            position: 'absolute',
                            bottom: 20,
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '100%'
                        }}>
                            <TouchableOpacity
                                onPress={takePicture}
                                style={{
                                    width: 70,
                                    height: 70,
                                    borderRadius: 35,
                                    backgroundColor: '#fff',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <View style={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 30,
                                    backgroundColor: '#0066ff'
                                }} />
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                onPress={() => {
                                    setType(
                                        type === Camera.Constants.Type.back
                                            ? Camera.Constants.Type.front
                                            : Camera.Constants.Type.back
                                    );
                                }}
                                style={{
                                    position: 'absolute',
                                    right: 20,
                                    bottom: 20
                                }}
                            >
                                <Text style={{ fontSize: 20, color: 'white' }}>🔄</Text>
                            </TouchableOpacity>
                        </View>
                    </Camera>
                );
            };

            // Rendre le composant Camera
            ReactDOM.render(<CameraComponent />, cameraContainer);

        } catch (err) {
            console.error('Erreur lors de l\'accès à la caméra:', err);
            alert('Impossible d\'accéder à la caméra');
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
8. Posologie recommandée (doses et fréquence selon l'âge/poids)
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