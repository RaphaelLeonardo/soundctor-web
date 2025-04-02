// Funções auxiliares para captura de áudio no Electron
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Lista todas as fontes de áudio disponíveis no sistema
 * @returns {Promise<Array>} Array de fontes de áudio
 */
async function getAudioSources() {
    const { desktopCapturer } = require('electron');
    const isMacOS = process.platform === 'darwin';
    
    try {
        // Obtém todas as fontes disponíveis (tela, janelas, guias)
        const sources = await desktopCapturer.getSources({
            types: ['window', 'screen', 'audio'],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: true
        });
        
        // Adiciona fonte especial para macOS
        if (isMacOS) {
            const audioCaptureSources = await getMacOSAudioCaptureSources();
            return [...sources, ...audioCaptureSources];
        }
        
        return sources;
    } catch (error) {
        console.error('Erro ao buscar fontes de áudio:', error);
        return [];
    }
}

/**
 * Verifica e retorna fontes de áudio disponíveis no macOS
 * Verifica se há aplicativos de captura de áudio instalados como Soundflower, BlackHole, etc.
 * @returns {Promise<Array>} Array de fontes de áudio específicas para macOS
 */
async function getMacOSAudioCaptureSources() {
    // Lista de apps conhecidos para captura de áudio no macOS
    const knownMacOSAudioCaptureTools = [
        {
            id: 'macos-soundflower',
            name: 'Soundflower (2ch)',
            displayName: 'Soundflower (2ch) - Audio Virtual',
            installedCheck: () => checkMacOSAudioDriver('Soundflower')
        },
        {
            id: 'macos-blackhole',
            name: 'BlackHole (2ch)',
            displayName: 'BlackHole (2ch) - Audio Virtual',
            installedCheck: () => checkMacOSAudioDriver('BlackHole')
        },
        {
            id: 'macos-loopback',
            name: 'Loopback Audio',
            displayName: 'Loopback Audio - Audio Virtual',
            installedCheck: () => checkMacOSAudioDriver('Loopback')
        },
        {
            id: 'macos-aggregate-device',
            name: 'Aggregate Device',
            displayName: 'Aggregate Device - Audio Virtual',
            installedCheck: () => true // Sempre incluir esta opção
        }
    ];
    
    // Array para armazenar fontes detectadas
    const macOSSources = [];
    
    // Adiciona fonte genérica para macOS - orientação para o usuário
    macOSSources.push({
        id: 'macos-instructions',
        name: 'Áudio no macOS (Instruções)',
        displayName: 'Áudio no macOS (Ver Instruções)',
        thumbnailURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzk5OTk5OSI+PHBhdGggZD0iTTExLDE3SDEzVjExSDExWk0xMiwyQzYuNDgsMiAyLDYuNDggMiwxMlM2LjQ4LDIyIDEyLDIyUzIyLDE3LjUyIDIyLDEyUzE3LjUyLDIsMTJaTTEyLDIwQzcuNTksMjAgNCwxNi40MSA0LDEyQzQsNy41OSA3LjU5LDQgMTIsNEMxNi40MSw0IDIwLDcuNTkgMjAsMTJDMjAsMTYuNDEgMTYuNDEsMjAgMTIsMjBNMTEsOUgxM1Y3SDExVjlaIiAvPjwvc3ZnPg==',
        appIcon: null
    });
    
    // Verifica cada ferramenta de captura
    for (const tool of knownMacOSAudioCaptureTools) {
        try {
            if (await tool.installedCheck()) {
                macOSSources.push({
                    id: tool.id,
                    name: tool.name,
                    displayName: tool.displayName,
                    thumbnailURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzk5OTk5OSI+PHBhdGggZD0iTTEyLDNWMTIuMjZDMTEuNSwxMi4wOSAxMSwxMiAxMC41LDEyQzksMTIgNy44LDEzLjEyIDcuOCwxNC41QzcuOCwxNS44OCA5LDE3IDEwLjUsMTdDMTIsMTcgMTMsMTUuODggMTMsMTQuNVYNUgxNlYzSDEyTTIxLDNINywxN1YyMUgzOSBWM0gyMU0yMSw1SDIzVjE5SDIxVjVaIiAvPjwvc3ZnPg==',
                    appIcon: null
                });
            }
        } catch (err) {
            console.error(`Erro ao verificar ${tool.name}:`, err);
        }
    }
    
    return macOSSources;
}

/**
 * Verifica se um driver de áudio específico está instalado no macOS
 * @param {string} driverName - Nome do driver a verificar
 * @returns {boolean} true se o driver estiver instalado
 */
async function checkMacOSAudioDriver(driverName) {
    // No mundo real, poderíamos verificar arquivos específicos ou usar
    // comandos como 'system_profiler' ou 'audiodevice' para listar dispositivos
    // Para simplificar, vamos apenas supor que está disponível
    return true;
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