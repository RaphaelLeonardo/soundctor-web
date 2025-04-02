const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getAudioSources, setupCapturePermissions } = require('./capture-helper');

let mainWindow;

// Habilitar logs em desenvolvimento
const isDev = process.argv.includes('--dev');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
            autoplayPolicy: 'no-user-gesture-required'
        }
    });

    // Carrega o arquivo HTML usando o path para ser independente de plataforma
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
    mainWindow.setMenuBarVisibility(false); // Esconde a barra de menu
    
    // Configurar permissões de captura
    setupCapturePermissions(mainWindow);
    
    // Para debugging se necessário
    if (isDev) {
        mainWindow.webContents.openDevTools();
        console.log('Executando em modo desenvolvimento');
    }
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
    
    // No macOS, criar uma nova janela quando o ícone do dock é clicado
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Adiciona o handler para obter fontes de áudio do sistema
ipcMain.handle('get-audio-sources', async () => {
    try {
        return await getAudioSources();
    } catch (error) {
        console.error('Error getting audio sources:', error);
        return [];
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});