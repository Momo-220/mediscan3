const API_KEY = 'AIzaSyD00fZSXDsQBx60juOZxBdgT--jQKVvpl0';

document.addEventListener('DOMContentLoaded', () => {
    const uploadBtn = document.getElementById('uploadBtn');
    const captureBtn = document.getElementById('captureBtn');
    const fileInput = document.getElementById('fileInput');
    const camera = document.getElementById('camera');
    const preview = document.getElementById('preview');
    const imagePreview = document.getElementById('imagePreview');
    const resultTable = document.getElementById('resultTable');

    // Fonction pour le bouton de téléchargement
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Fonction pour le bouton de capture photo
    captureBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            camera.srcObject = stream;
            camera.hidden = false;
            camera.style.position = 'relative';
            camera.style.zIndex = '900';
            camera.play();

            // Créer un conteneur pour la caméra
            const cameraContainer = document.createElement('div');
            cameraContainer.style.position = 'fixed';
            cameraContainer.style.top = '0';
            cameraContainer.style.left = '0';
            cameraContainer.style.width = '100%';
            cameraContainer.style.height = '100%';
            cameraContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
            cameraContainer.style.display = 'flex';
            cameraContainer.style.flexDirection = 'column';
            cameraContainer.style.alignItems = 'center';
            cameraContainer.style.justifyContent = 'center';
            cameraContainer.style.zIndex = '800';
            
            // Ajouter la vidéo au conteneur
            camera.parentElement.removeChild(camera);
            cameraContainer.appendChild(camera);
            document.body.appendChild(cameraContainer);

            // Créer le bouton de capture
            const captureContainer = document.createElement('div');
            captureContainer.style.position = 'fixed';
            captureContainer.style.bottom = '20px';
            captureContainer.style.left = '0';
            captureContainer.style.right = '0';
            captureContainer.style.display = 'flex';
            captureContainer.style.justifyContent = 'center';
            captureContainer.style.gap = '20px';
            captureContainer.style.zIndex = '1000';
            
            // Bouton de capture
            const takePictureBtn = document.createElement('button');
            takePictureBtn.className = 'capture-button';
            takePictureBtn.innerHTML = '<i class="fas fa-camera"></i>';
            takePictureBtn.style.width = '70px';
            takePictureBtn.style.height = '70px';
            takePictureBtn.style.borderRadius = '35px';
            takePictureBtn.style.backgroundColor = '#0066ff';
            takePictureBtn.style.border = 'none';
            takePictureBtn.style.color = 'white';
            takePictureBtn.style.fontSize = '24px';
            
            // Bouton de fermeture
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.style.position = 'fixed';
            closeBtn.style.top = '20px';
            closeBtn.style.right = '20px';
            closeBtn.style.backgroundColor = 'transparent';
            closeBtn.style.border = 'none';
            closeBtn.style.color = 'white';
            closeBtn.style.fontSize = '24px';
            closeBtn.style.zIndex = '1000';
            
            closeBtn.onclick = () => {
                stream.getTracks().forEach(track => track.stop());
                document.body.removeChild(cameraContainer);
                captureContainer.remove();
            };
            
            captureContainer.appendChild(takePictureBtn);
            cameraContainer.appendChild(closeBtn);
            document.body.appendChild(captureContainer);

            // Fonction pour prendre la photo
            takePictureBtn.onclick = () => {
                const canvas = document.createElement('canvas');
                canvas.width = camera.videoWidth;
                canvas.height = camera.videoHeight;
                canvas.getContext('2d').drawImage(camera, 0, 0);
                
                canvas.toBlob(async (blob) => {
                    document.body.removeChild(cameraContainer);
                    captureContainer.remove();
                    preview.src = URL.createObjectURL(blob);
                    imagePreview.hidden = false;
                    
                    // Nettoyer
                    stream.getTracks().forEach(track => track.stop());
                    
                    await analyzeMedication(blob);
                }, 'image/jpeg', 0.95);
            };

        } catch (err) {
            console.error('Erreur lors de l\'accès à la caméra:', err);
            alert('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
        }
    });

    // Gestion du téléchargement d'image
    fileInput.addEventListener('change', async (e) => {
        try {
            const file = e.target.files[0];
            if (file) {
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
    });

    // Fonction d'analyse du médicament
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
            
            // Traitement et affichage des résultats
            displayResults(textResponse);
            
            // Mise à jour du statut
            statusMessage.classList.remove('loading-dots');
            statusMessage.textContent = 'Scan terminé';
            statusMessage.classList.add('success');
            resultTable.hidden = false;

        } catch (error) {
            console.error('Erreur:', error);
            statusMessage.classList.remove('loading-dots');
            statusMessage.textContent = 'Erreur lors du scan';
            statusMessage.classList.add('error');
            alert(error.message);
        }
    }

    // Fonction pour convertir l'image en base64
    function convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Fonction pour afficher les résultats
    function displayResults(textResponse) {
        const generalInfo = document.getElementById('generalInfo');
        const medicalInfo = document.getElementById('medicalInfo');
        
        // Extraction des informations
        const infos = {
            general: {
                'Nom commercial': extractInfo(textResponse, 1),
                'Laboratoire': extractInfo(textResponse, 2),
                'Molécule': extractInfo(textResponse, 3),
                'Forme': extractInfo(textResponse, 4),
                'Dosage': extractInfo(textResponse, 5),
                'Fabricant': extractInfo(textResponse, 18)
            },
            medical: {
                'Classe thérapeutique': extractInfo(textResponse, 6),
                'Indications': extractInfo(textResponse, 7),
                'Posologie': extractInfo(textResponse, 8),
                'Mode d\'administration': extractInfo(textResponse, 9),
                'Contre-indications': extractInfo(textResponse, 10),
                'Effets secondaires': extractInfo(textResponse, 11),
                'Interactions': extractInfo(textResponse, 12),
                'Précautions': extractInfo(textResponse, 13)
            }
        };

        // Affichage des informations générales
        generalInfo.innerHTML = Object.entries(infos.general)
            .map(([key, value]) => `
                <tr>
                    <td class="info-label"><strong>${key}</strong></td>
                    <td class="info-value">${value || 'Non spécifié'}</td>
                </tr>
            `).join('');

        // Affichage des informations médicales
        medicalInfo.innerHTML = Object.entries(infos.medical)
            .map(([key, value]) => `
                <tr>
                    <td class="info-label"><strong>${key}</strong></td>
                    <td class="info-value">${value || 'Non spécifié'}</td>
                </tr>
            `).join('');
    }

    // Fonction pour extraire les informations du texte
    function extractInfo(text, number) {
        const regex = new RegExp(`${number}[.).\\s]+([^\\n]+)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }
}); 