const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs selecionadas para uso no processo de renderização
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => {
            // Lista de canais permitidos
            const validChannels = ['get-audio-sources'];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
            return Promise.reject(new Error(`Canal não permitido: ${channel}`));
        },
        
        on: (channel, func) => {
            const validChannels = ['audio-source-selected'];
            if (validChannels.includes(channel)) {
                // Remover listeners para evitar múltiplos registros
                ipcRenderer.removeAllListeners(channel);
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    },
    
    // Adicione quaisquer outras APIs que deseja expor
    desktopCapturer: {
        getSources: async (options) => {
            return await ipcRenderer.invoke('get-audio-sources', options);
        }
    },
    
    // Informações do ambiente
    process: {
        platform: process.platform
    }
});