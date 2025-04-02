// Funções auxiliares para captura de áudio no Electron

/**
 * Lista todas as fontes de áudio disponíveis no sistema
 * @returns {Promise<Array>} Array de fontes de áudio
 */
async function getAudioSources() {
    const { desktopCapturer } = require('electron');
    
    try {
        // Obtém todas as fontes disponíveis (tela, janelas, guias)
        const sources = await desktopCapturer.getSources({
            types: ['window', 'screen', 'audio'],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: true
        });
        
        return sources;
    } catch (error) {
        console.error('Erro ao buscar fontes de áudio:', error);
        return [];
    }
}

/**
 * Configura permissões de sistema para captura de áudio
 * @param {BrowserWindow} mainWindow - Instância da janela principal
 */
function setupCapturePermissions(mainWindow) {
    // Configura permissões para captura de mídia
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        // Permite sempre permissões de mídia para capturar áudio/vídeo
        if (permission === 'media' || 
            permission === 'audioCapture' || 
            permission === 'videoCapture' ||
            permission === 'mediaKeySystem') {
            return callback(true);
        }
        
        // Verifica outro tipo de permissão com base no URL
        const url = webContents.getURL();
        // Para URLs confiáveis, podemos permitir mais permissões
        if (url.startsWith('file://')) {
            return callback(true);
        }
        
        // Nega outras permissões por padrão
        callback(false);
    });
}

// Exporta as funções auxiliares
module.exports = {
    getAudioSources,
    setupCapturePermissions
};