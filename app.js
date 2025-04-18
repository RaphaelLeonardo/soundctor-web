// Verificar se estamos no ambiente Electron
const electronAPI = window.electron;
let ipcRenderer = electronAPI ? electronAPI.ipcRenderer : null;

document.addEventListener('DOMContentLoaded', function() {
    // Elementos da UI
    const startButton = document.getElementById('start-audio');
    const audioSourceSelect = document.getElementById('audio-source');
    const themeSwitch = document.getElementById('theme-switch');
    const themeSelectorBtn = document.getElementById('theme-selector-btn');
    const themePalette = document.getElementById('theme-palette');
    const themePresets = document.querySelectorAll('.theme-preset');
    const applyCustomThemeBtn = document.getElementById('apply-custom-theme');
    const youtubeSearchInput = document.getElementById('youtube-search-input');
    const youtubeSearchBtn = document.getElementById('youtube-search-btn');
    const youtubeResults = document.getElementById('youtube-results');
    const youtubePlayerContainer = document.getElementById('youtube-player-container');
    
    // Contexto de áudio e analisadores
    let audioContext;
    let analyser;
    let audioSource;
    let mediaStream;
    let animationFrameId;
    let isCapturing = false;
    
    // Lista de fontes de áudio disponíveis
    let systemAudioSources = [];
    
    // YouTube API
    let youtubePlayer;
    let youtubeApiReady = false;
    let youtubeVideoNodes = [];
    
    // Chave da API do YouTube (obtenha a sua em https://console.cloud.google.com/)
    const YOUTUBE_API_KEY = 'AIzaSyAKn4Vfy-hElGHFyUxuhkG_U_j6n2Metho'; // Substitua pela sua chave de API
    
    // Configurações de visualização
    const FFT_SIZE = 2048;
    const SMOOTHING = 0.8;
    
    // Detecta se estamos executando em um ambiente Electron
    const isElectron = () => {
        return window.electron !== undefined || navigator.userAgent.indexOf('Electron') !== -1;
    };
    
    // Detecta se estamos no macOS (se estiver no Electron)
    const isMacOS = () => {
        return isElectron() && window.electron && window.electron.process.platform === 'darwin';
    };
    
    // Inicializar tema
    initTheme();
    
    // Inicializar cores do tema
    initColorPickers();
    
    // Verificar se a YouTube API está pronta
    window.onYouTubeIframeAPIReady = function() {
        youtubeApiReady = true;
        initYouTubePlayer();
    };
    
    // Listeners de eventos
    startButton.addEventListener('click', toggleAudioCapture);
    audioSourceSelect.addEventListener('change', changeAudioSource);
    themeSwitch.addEventListener('change', toggleTheme);
    themeSelectorBtn.addEventListener('click', toggleThemePalette);
    themePresets.forEach(preset => {
        preset.addEventListener('click', () => applyThemePreset(preset.dataset.theme));
    });
    applyCustomThemeBtn.addEventListener('click', applyCustomTheme);
    youtubeSearchBtn.addEventListener('click', searchYouTube);
    youtubeSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchYouTube();
        }
    });
    
    // Fechar o seletor de tema ao clicar fora
    document.addEventListener('click', function(e) {
        if (themePalette.classList.contains('show') && 
            !themePalette.contains(e.target) && 
            e.target !== themeSelectorBtn) {
            themePalette.classList.remove('show');
        }
    });
    
    // Funcionalidades de visualização
    let oscilloscope, spectrogram, vuMeter;
    
    // Inicializar
    function init() {
        initOscilloscope();
        initSpectrogram();
        initVuMeter();
        
        // Verificar se o navegador suporta as APIs necessárias
        if (!navigator.mediaDevices) {
            alert('Seu navegador não suporta as APIs de captura de áudio necessárias.');
            startButton.disabled = true;
            return;
        }
        
        // Se estiver no Electron, adiciona as opções de fonte de áudio do sistema
        if (isElectron()) {
            populateAudioSources();
            
            // Adicionar um novo item ao menu para cada aplicativo com áudio
            const systemOption = document.createElement('option');
            systemOption.value = 'system-electron';
            systemOption.text = 'Áudio do Sistema (Electron)';
            audioSourceSelect.add(systemOption, 1); // Adiciona após o microfone
        }
        
        audioSourceSelect.disabled = false;
        
        // Garantir que o player do YouTube esteja oculto inicialmente
        youtubePlayerContainer.classList.remove('active');
        
        // Iniciar animações em estado padrão
        startVisualization();
    }
    
    // Obter fontes de áudio disponíveis no Electron
    async function populateAudioSources() {
        if (!isElectron() || !electronAPI) return;
        
        try {
            // Obter fontes de áudio do processo principal do Electron
            const sources = await electronAPI.desktopCapturer.getSources({
                types: ['window', 'screen', 'audio'],
                thumbnailSize: { width: 0, height: 0 },
                fetchWindowIcons: true
            });
            
            systemAudioSources = sources;
            
            // Adicionar cada fonte como uma opção no menu dropdown
            systemAudioSources.forEach(source => {
                const option = document.createElement('option');
                option.value = source.id;
                option.text = source.name || 'Sistema: ' + source.id;
                audioSourceSelect.appendChild(option);
            });
            
            console.log('Fontes de áudio carregadas:', systemAudioSources.length);
        } catch (error) {
            console.error('Erro ao obter fontes de áudio:', error);
        }
    }
    
    // Atualizar visibilidade da seção do YouTube
    function updateYouTubeVisibility() {
        const isYouTubeSource = audioSourceSelect.value === 'youtube';
        
        if (!isYouTubeSource) {
            youtubePlayerContainer.classList.remove('active');
        }
        
        // Não mostramos o player automaticamente ao selecionar YouTube como fonte
        // Ele só aparecerá quando um vídeo for buscado e selecionado
    }
    
    // Alternar entre iniciar e parar a captura de áudio
    async function toggleAudioCapture() {
        if (isCapturing) {
            stopAudioCapture();
            startButton.textContent = 'Iniciar Captura';
            audioSourceSelect.disabled = false;
        } else {
            try {
                // Verificar se é macOS e selecionou instruções
                if (isMacOS() && audioSourceSelect.value === 'macos-instructions') {
                    showMacOSInstructions();
                    return;
                }
                
                await startAudioCapture();
                startButton.textContent = 'Parar Captura';
                audioSourceSelect.disabled = true;
            } catch (error) {
                console.error('Erro ao iniciar captura:', error);
                
                // Mensagens de erro mais amigáveis dependendo do ambiente
                let errorMessage = error.message;
                
                if (isElectron()) {
                    if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
                        errorMessage = 'Permissão para capturar áudio foi negada. Por favor, reinicie o aplicativo e tente novamente.';
                    } else if (error.message.includes('NotFoundError')) {
                        errorMessage = 'Dispositivo de áudio não encontrado. Verifique suas configurações de áudio.';
                    } else if (error.message.includes('NotReadableError')) {
                        errorMessage = 'O dispositivo de áudio está em uso por outro aplicativo ou não está acessível.';
                    }
                    
                    // Mensagens específicas para macOS
                    if (isMacOS() && error.message.includes('audio capture')) {
                        errorMessage = 'Captura de áudio no macOS requer uma ferramenta externa como Soundflower ou BlackHole. Consulte as instruções.';
                    }
                }
                
                alert('Não foi possível iniciar a captura de áudio: ' + errorMessage);
            }
        }
    }
    
    // Exibe instruções específicas para captura de áudio no macOS
    function showMacOSInstructions() {
        // Criar elemento de diálogo modal
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';
        
        const content = document.createElement('div');
        content.style.backgroundColor = 'var(--card-bg)';
        content.style.color = 'var(--text-color)';
        content.style.padding = '30px';
        content.style.borderRadius = 'var(--border-radius)';
        content.style.maxWidth = '600px';
        content.style.width = '80%';
        content.style.maxHeight = '80vh';
        content.style.overflowY = 'auto';
        content.style.boxShadow = 'var(--box-shadow)';
        
        content.innerHTML = `
            <h2 style="color: var(--primary-color); margin-top: 0;">Captura de Áudio no macOS</h2>
            <p>Devido a limitações do macOS, a captura de áudio do sistema requer um driver de áudio virtual como:</p>
            <ul>
                <li><strong>BlackHole</strong> - <a href="https://github.com/ExistentialAudio/BlackHole" target="_blank">Baixar</a></li>
                <li><strong>Soundflower</strong> - <a href="https://github.com/mattingalls/Soundflower" target="_blank">Baixar</a></li>
                <li><strong>Loopback</strong> - <a href="https://rogueamoeba.com/loopback/" target="_blank">Baixar (Pago)</a></li>
            </ul>
            
            <h3>Configuração:</h3>
            <ol>
                <li>Instale um dos drivers de áudio virtual mencionados acima</li>
                <li>Nas Preferências de Som do macOS, configure a saída para o dispositivo virtual</li>
                <li>No Soundctor, selecione o mesmo dispositivo virtual como fonte de entrada</li>
                <li>Todo áudio do sistema será roteado para o dispositivo virtual, permitindo a captura</li>
            </ol>
            
            <h3>Notas:</h3>
            <p>Para ouvir o áudio enquanto o captura, você pode:</p>
            <ul>
                <li>Usar um Dispositivo Agregado nas Preferências de Som</li>
                <li>Ou definir o monitor do aplicativo de áudio virtual para reproduzir áudio nos seus alto-falantes</li>
            </ul>
            
            <p style="margin-top: 20px;">Esta limitação é do macOS e requer uma extensão de kernel assinada para acessar o áudio do sistema, que o Electron não fornece.</p>
            
            <button id="close-macos-instructions" style="
                background-color: var(--primary-color);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: var(--border-radius);
                margin-top: 20px;
                cursor: pointer;
                font-weight: bold;
            ">Entendi</button>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Fechar ao clicar no botão
        document.getElementById('close-macos-instructions').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Também fechar ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    
    // Iniciar captura de áudio
    async function startAudioCapture() {
        const selectedSource = audioSourceSelect.value;
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = SMOOTHING;
        
        try {
            // Verificar fontes específicas para macOS
            if (isMacOS() && selectedSource.startsWith('macos-')) {
                return await startMacOSAudioCapture(selectedSource);
            }
            
            if (selectedSource === 'youtube') {
                if (!youtubePlayer || !youtubeApiReady) {
                    throw new Error('Player do YouTube não está pronto');
                }
                
                // No Electron, podemos capturar o áudio diretamente
                if (isElectron()) {
                    // Capturar a janela onde o YouTube está reproduzindo
                    const constraints = {
                        audio: {
                            mandatory: {
                                chromeMediaSource: 'desktop'
                            }
                        },
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                minWidth: 1280,
                                maxWidth: 1280,
                                minHeight: 720,
                                maxHeight: 720
                            }
                        }
                    };
                    
                    // No Electron, podemos usar desktopCapturer diretamente
                    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                    
                    // Verificar se temos faixas de áudio
                    const audioTracks = mediaStream.getAudioTracks();
                    if (audioTracks.length === 0) {
                        throw new Error('Sem faixas de áudio disponíveis');
                    }
                    
                    // Reproduzir o vídeo do YouTube
                    youtubePlayer.playVideo();
                    
                    audioSource = audioContext.createMediaStreamSource(mediaStream);
                    audioSource.connect(analyser);
                } else {
                    // Método para navegadores: Capturar áudio da saída do sistema via getDisplayMedia
                    if (navigator.mediaDevices.getDisplayMedia) {
                        mediaStream = await navigator.mediaDevices.getDisplayMedia({
                            video: true,
                            audio: true
                        });
                        
                        // Verificar se temos faixas de áudio
                        const audioTracks = mediaStream.getAudioTracks();
                        if (audioTracks.length === 0) {
                            throw new Error('Sem faixas de áudio disponíveis. Compartilhe o áudio do sistema ao compartilhar a tela.');
                        }
                        
                        // Mostrar instrução para o usuário
                        alert('Por favor, compartilhe a aba ou janela onde o YouTube está tocando E selecione "Compartilhar áudio"');
                        
                        // Pausar o vídeo até que o usuário configure o compartilhamento
                        youtubePlayer.pauseVideo();
                        
                        // Depois de alguns segundos, iniciar a reprodução
                        setTimeout(() => {
                            youtubePlayer.playVideo();
                        }, 3000);
                        
                        audioSource = audioContext.createMediaStreamSource(mediaStream);
                        audioSource.connect(analyser);
                    }
                    else {
                        // Fallback para navegadores que não suportam getDisplayMedia
                        // Criar um oscilador para testar a visualização
                        const oscillator = audioContext.createOscillator();
                        oscillator.type = 'sine';
                        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                        oscillator.connect(analyser);
                        oscillator.start();
                        
                        alert('Seu navegador não suporta compartilhamento de áudio. Usando tom de teste.');
                    }
                }
            } else if (selectedSource === 'system-electron' && isElectron()) {
                // Captura de áudio do sistema via Electron
                const constraints = {
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop'
                        }
                    },
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            minWidth: 1280,
                            maxWidth: 1280,
                            minHeight: 720,
                            maxHeight: 720
                        }
                    }
                };
                
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                
                // Verificar se temos faixas de áudio
                const audioTracks = mediaStream.getAudioTracks();
                if (audioTracks.length === 0) {
                    throw new Error('Sem faixas de áudio disponíveis');
                }
                
                // Pausar o YouTube se estiver reproduzindo
                if (youtubePlayer && youtubePlayer.getPlayerState() === 1) {
                    youtubePlayer.pauseVideo();
                }
                
                audioSource = audioContext.createMediaStreamSource(mediaStream);
                audioSource.connect(analyser);
            } else if (selectedSource.startsWith('screen:') && isElectron()) {
                // Capturar fonte de áudio específica selecionada no Electron
                const sourceId = selectedSource;
                
                // Configurar restrições para capturar apenas o áudio da fonte selecionada
                const constraints = {
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId
                        }
                    },
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId,
                            minWidth: 1280,
                            maxWidth: 1280,
                            minHeight: 720,
                            maxHeight: 720
                        }
                    }
                };
                
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                
                // Verificar se temos faixas de áudio
                const audioTracks = mediaStream.getAudioTracks();
                if (audioTracks.length === 0) {
                    throw new Error('Sem faixas de áudio disponíveis na fonte selecionada');
                }
                
                // Pausar o YouTube se estiver reproduzindo
                if (youtubePlayer && youtubePlayer.getPlayerState() === 1) {
                    youtubePlayer.pauseVideo();
                }
                
                audioSource = audioContext.createMediaStreamSource(mediaStream);
                audioSource.connect(analyser);
            } else {
                // Métodos padrão para navegadores
                switch (selectedSource) {
                    case 'microphone':
                        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        break;
                    case 'system':
                    case 'tab':
                        // Para áudio do sistema/tela, precisamos de getDisplayMedia com áudio
                        mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
                            video: true,
                            audio: true 
                        });
                        break;
                }
                
                // Pausar o YouTube se estiver reproduzindo
                if (youtubePlayer && youtubePlayer.getPlayerState() === 1) {
                    youtubePlayer.pauseVideo();
                }
                
                audioSource = audioContext.createMediaStreamSource(mediaStream);
                audioSource.connect(analyser);
            }
            
            isCapturing = true;
        } catch (error) {
            throw error;
        }
    }
    
    // Função específica para captura de áudio no macOS
    async function startMacOSAudioCapture(selectedSource) {
        // Se for o botão de instruções, mostrar diálogo
        if (selectedSource === 'macos-instructions') {
            showMacOSInstructions();
            return;
        }
        
        try {
            // Para captura via dispositivo virtual no macOS, usamos getUserMedia normal
            // mas com uma explicação específica para o usuário sobre como configurar
            
            // Primeiro, mostrar dicas sobre como configurar o dispositivo
            let toolName = "";
            switch(selectedSource) {
                case 'macos-soundflower':
                    toolName = "Soundflower";
                    break;
                case 'macos-blackhole':
                    toolName = "BlackHole";
                    break;
                case 'macos-loopback':
                    toolName = "Loopback";
                    break;
                case 'macos-aggregate-device':
                    toolName = "Aggregate Device";
                    break;
            }
            
            // Mostrar instruções específicas para o dispositivo selecionado
            alert(`Para capturar áudio usando ${toolName}:\n\n` +
                  `1. Verifique se o ${toolName} está instalado e configurado\n` +
                  `2. Nas Preferências de Som do macOS, configure a SAÍDA para o ${toolName}\n` +
                  `3. O áudio do sistema será roteado para o dispositivo virtual\n` +
                  `4. Soundctor vai capturar o áudio a partir deste dispositivo\n\n` +
                  `Prosseguindo com a captura...`);
            
            // Tentar capturar o áudio do dispositivo
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    // Algumas opções para melhorar a captura
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            
            // Pausar o YouTube se estiver reproduzindo
            if (youtubePlayer && youtubePlayer.getPlayerState() === 1) {
                youtubePlayer.pauseVideo();
            }
            
            audioSource = audioContext.createMediaStreamSource(mediaStream);
            audioSource.connect(analyser);
            
            isCapturing = true;
        } catch (error) {
            // Se falhar, mostre as instruções de configuração completas
            showMacOSInstructions();
            throw new Error(`Erro ao capturar áudio no macOS: ${error.message}. Verifique se o dispositivo virtual está configurado corretamente.`);
        }
    }
    
    // Parar captura de áudio
    function stopAudioCapture() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        
        // Pausar o YouTube se estiver reproduzindo
        if (youtubePlayer && youtubePlayer.getPlayerState() === 1) {
            youtubePlayer.pauseVideo();
        }
        
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        
        analyser = null;
        audioSource = null;
        isCapturing = false;
    }
    
    // Alternar fonte de áudio
    function changeAudioSource() {
        if (isCapturing) {
            stopAudioCapture();
            startButton.textContent = 'Iniciar Captura';
        }
        
        updateYouTubeVisibility();
    }
    
    // Iniciar visualização de áudio
    function startVisualization() {
        function animate() {
            animationFrameId = requestAnimationFrame(animate);
            
            // Atualizar todos os visualizadores simultaneamente
            oscilloscope.visualize(analyser);
            spectrogram.visualize(analyser);
            vuMeter.visualize(analyser);
        }
        
        animate();
    }
    
    // Inicializar o osciloscópio
    function initOscilloscope() {
        const canvas = document.getElementById('oscilloscope-canvas');
        const ctx = canvas.getContext('2d');
        
        // Garantir que o canvas tenha o tamanho correto
        function resizeCanvas() {
            const container = canvas.parentElement;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }
        
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        
        oscilloscope = {
            visualize: function(analyser) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.lineWidth = 2;
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
                ctx.beginPath();
                
                if (analyser) {
                    const bufferLength = analyser.fftSize;
                    const dataArray = new Float32Array(bufferLength);
                    analyser.getFloatTimeDomainData(dataArray);
                    
                    const sliceWidth = canvas.width / bufferLength;
                    let x = 0;
                    
                    for (let i = 0; i < bufferLength; i++) {
                        // Reduzir a sensibilidade diminuindo o fator de multiplicação
                        const v = dataArray[i] * 1.5;
                        const y = (v * canvas.height / 2) + canvas.height / 2;
                        
                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                        
                        x += sliceWidth;
                    }
                } else {
                    // Estado padrão - desenha uma linha reta no meio
                    ctx.moveTo(0, canvas.height / 2);
                    ctx.lineTo(canvas.width, canvas.height / 2);
                }
                
                ctx.stroke();
            }
        };
    }
    
    // Inicializar o espectrograma 3D estilo Chrome Music Lab com múltiplas visualizações
    function initSpectrogram() {
        const container = document.getElementById('spectrogram-container');
        const viewButtons = document.querySelectorAll('#spectrogram .view-btn');
        
        // THREE.js setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setClearColor(0x000000, 0.3);
        container.appendChild(renderer.domElement);
        
        // Inicializar controles de órbita para rotação livre
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.screenSpacePanning = false;
        controls.maxPolarAngle = Math.PI / 1.5;
        controls.enabled = false; // Inicialmente desativado
        
        // Configurações
        const frequencyBins = 128;  // Número de bins de frequência
        const historyLength = 60;   // Quantos quadros de história manter
        
        // Criar a malha de superfície para o espectrograma
        const geometry = new THREE.PlaneGeometry(2, 1, frequencyBins - 1, historyLength - 1);
        
        // Materiais e textura
        const vertexShader = `
            varying vec2 vUv;
            varying float vElevation;
            
            void main() {
                vUv = uv;
                vElevation = position.z;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            varying vec2 vUv;
            varying float vElevation;
            
            vec3 colorA = vec3(0.0, 0.0, 0.5);  // Azul escuro
            vec3 colorB = vec3(0.0, 1.0, 1.0);  // Ciano
            vec3 colorC = vec3(1.0, 1.0, 0.0);  // Amarelo
            vec3 colorD = vec3(1.0, 0.0, 0.0);  // Vermelho
            
            void main() {
                float t = vElevation * 2.0;
                
                vec3 color;
                if (t < 0.33) {
                    color = mix(colorA, colorB, t * 3.0);
                } else if (t < 0.66) {
                    color = mix(colorB, colorC, (t - 0.33) * 3.0);
                } else {
                    color = mix(colorC, colorD, (t - 0.66) * 3.0);
                }
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.DoubleSide,
            wireframe: false
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 3; // Rotação para vista isométrica
        mesh.position.y = -0.2;
        scene.add(mesh);
        
        // Malha wireframe para efeito de grade
        const wireMaterial = new THREE.MeshBasicMaterial({
            color: 0x444444,
            wireframe: true,
            transparent: true,
            opacity: 0.15
        });
        
        const wireMesh = new THREE.Mesh(geometry.clone(), wireMaterial);
        wireMesh.rotation.x = mesh.rotation.x;
        wireMesh.position.y = mesh.position.y;
        scene.add(wireMesh);
        
        // Adicionar eixos para referência
        const axesHelper = new THREE.AxesHelper(1);
        axesHelper.visible = false; // Inicialmente oculto
        scene.add(axesHelper);
        
        // Adicionar luzes
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 1);
        scene.add(directionalLight);
        
        // Posicionar câmera na visão isométrica padrão
        camera.position.set(0, 0.6, 1.6);
        camera.lookAt(0, 0, 0);
        
        // Salvar posições de câmera para as diferentes visões
        const cameraViews = {
            isometric: {
                position: new THREE.Vector3(0, 0.6, 1.6),
                target: new THREE.Vector3(0, 0, 0),
                rotation: { x: -Math.PI / 3, z: 0 }
            },
            top: {
                position: new THREE.Vector3(0, 2, 0.01), // Ligeiramente deslocado para evitar problemas de visualização
                target: new THREE.Vector3(0, 0, 0),
                rotation: { x: -Math.PI / 2, z: 0 } // Virado para baixo para ver de cima
            },
            side: {
                position: new THREE.Vector3(0, 0, 2),
                target: new THREE.Vector3(0, 0, 0),
                rotation: { x: -Math.PI / 2, z: 0 }
            },
            front: {
                position: new THREE.Vector3(2, 0, 0),
                target: new THREE.Vector3(0, 0, 0),
                rotation: { x: -Math.PI / 2, z: Math.PI / 2 }
            }
        };
        
        // Variável para armazenar o modo de visualização atual
        let currentView = 'isometric';
        let autoRotate = false; // Desligado por padrão
        
        // Classe para gerenciar dados de áudio
        class AudioDataHistory {
            constructor(length, binCount) {
                this.length = length;
                this.binCount = binCount;
                this.data = new Array(length);
                
                for (let i = 0; i < length; i++) {
                    this.data[i] = new Float32Array(binCount).fill(0);
                }
                
                this.currentIndex = 0;
            }
            
            addFrame(frequencyData) {
                this.data[this.currentIndex] = frequencyData.slice();
                this.currentIndex = (this.currentIndex + 1) % this.length;
            }
            
            getFrame(index) {
                // Obter quadro relativo ao atual (0 = mais recente, length-1 = mais antigo)
                const actualIndex = (this.currentIndex - 1 - index + this.length) % this.length;
                return this.data[actualIndex];
            }
        }
        
        // Criar histórico de dados
        const audioDataHistory = new AudioDataHistory(historyLength, frequencyBins);
        
        // Função para mapear logaritmicamente frequências de áudio
        function logScaleFrequencyData(frequencyData, binCount) {
            const nyquist = 22050; // Metade da taxa de amostragem padrão
            const resultData = new Float32Array(binCount);
            
            for (let i = 0; i < binCount; i++) {
                // Mapeamento logarítmico para obter o índice do buffer original
                // Dá mais espaço para frequências baixas
                const percent = i / binCount;
                const power = 2.0;
                const scaledPercent = Math.pow(percent, power);
                
                // Converter para índice no array original
                const index = Math.round(scaledPercent * (frequencyData.length - 1));
                
                resultData[i] = frequencyData[index] / 255.0; // Normalizar para 0-1
            }
            
            return resultData;
        }
        
        // Função para transição suave da câmera para uma nova visão
        function setCameraView(view) {
            if (view === 'free') {
                // Modo de rotação livre
                controls.enabled = true;
                axesHelper.visible = false; // Eixos ocultos por padrão na visão livre
                autoRotate = false;
                
                // Marcar o botão de rotação livre como ativo
                viewButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.view === 'free');
                });
                
                return;
            }
            
            // Desativar controles de órbita para as visões predefinidas
            controls.enabled = false;
            axesHelper.visible = false;
            autoRotate = false; // Desativado por padrão
            
            // Verificar se a visão existe
            const viewData = cameraViews[view];
            if (!viewData) return;
            
            // Atualizar posição e alvo da câmera
            camera.position.copy(viewData.position);
            camera.lookAt(viewData.target);
            
            // Atualizar rotação do mesh
            mesh.rotation.x = viewData.rotation.x;
            mesh.rotation.z = viewData.rotation.z;
            
            // Sincronizar rotação do wireframe
            wireMesh.rotation.x = mesh.rotation.x;
            wireMesh.rotation.z = mesh.rotation.z;
            
            // Atualizar visão atual
            currentView = view;
            
            // Atualizar classes dos botões
            viewButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
        }
        
        // Configurar listener para o botão toggle (para dispositivos touch)
        const toggleButton = document.querySelector('#spectrogram .control-toggle-btn');
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevenir que o clique feche o menu imediatamente
                const controls = document.querySelector('#spectrogram .visualizer-controls');
                controls.classList.toggle('show');
            });
            
            // Fechar o menu ao clicar fora dele
            document.addEventListener('click', () => {
                const controls = document.querySelector('#spectrogram .visualizer-controls');
                if (controls.classList.contains('show')) {
                    controls.classList.remove('show');
                }
            });
        }
        
        // Configurar listeners para os botões de visão
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevenir que o clique feche o menu imediatamente
                const view = btn.dataset.view;
                setCameraView(view);
            });
            
            // Deixar o botão isométrico ativo inicialmente
            if (btn.dataset.view === 'isometric') {
                btn.classList.add('active');
            }
        });
        
        // Redimensionar quando a janela mudar de tamanho
        window.addEventListener('resize', () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            
            renderer.setSize(width, height);
        });
        
        // Interface para visualização
        spectrogram = {
            visualize: function(analyser) {
                const positions = geometry.attributes.position.array;
                
                if (analyser) {
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    
                    // Obter dados de frequência
                    analyser.getByteFrequencyData(dataArray);
                    
                    // Processar e armazenar dados
                    const scaledData = logScaleFrequencyData(dataArray, frequencyBins);
                    audioDataHistory.addFrame(scaledData);
                    
                    // Atualizar a malha do espectrograma com novos dados
                    for (let z = 0; z < historyLength; z++) {
                        const frameData = audioDataHistory.getFrame(z);
                        
                        for (let x = 0; x < frequencyBins; x++) {
                            // Encontre o índice na geometria da malha
                            const vertIndex = (z * frequencyBins + x) * 3;
                            
                            // Definir altura (coordenada y na geometria, mas visual z devido à rotação)
                            positions[vertIndex + 2] = frameData[x] * 0.5; // Escala da amplitude
                        }
                    }
                    
                    // Marcar a geometria para atualização
                    geometry.attributes.position.needsUpdate = true;
                    
                } else {
                    // Estado padrão - superficie plana
                    for (let i = 0; i < positions.length; i += 3) {
                        positions[i + 2] = 0; // Zerar todas as alturas
                    }
                    geometry.attributes.position.needsUpdate = true;
                }
                
                // Animar a rotação da malha apenas se o autoRotate estiver ativo
                if (autoRotate) {
                    mesh.rotation.z += 0.001;
                    wireMesh.rotation.z = mesh.rotation.z;
                }
                
                // Atualizar controles de órbita se estiverem ativos
                if (controls.enabled) {
                    controls.update();
                }
                
                // Renderizar a cena
                renderer.render(scene, camera);
            }
        };
    }
    
    // Inicializar VU Meters
    function initVuMeter() {
        const leftMeterFill = document.querySelector('.vu-meter.left .meter-fill');
        const rightMeterFill = document.querySelector('.vu-meter.right .meter-fill');
        const leftMeterValue = document.querySelector('.vu-meter.left .meter-value');
        const rightMeterValue = document.querySelector('.vu-meter.right .meter-value');
        const leftNeedle = document.querySelector('.analog-meter.left .meter-needle');
        const rightNeedle = document.querySelector('.analog-meter.right .meter-needle');
        const leftAnalogValue = document.querySelector('.analog-meter.left .meter-value');
        const rightAnalogValue = document.querySelector('.analog-meter.right .meter-value');
        
        // Configurações
        const dbMin = -60; // Valor mínimo em dB
        const dbMax = 0;   // Valor máximo em dB
        const needleMinAngle = -90; // Ângulo mínimo da agulha (em graus)
        const needleMaxAngle = 0;   // Ângulo máximo da agulha (em graus)
        
        // Adicionar event listeners para os botões de estilo
        const toggleButton = document.querySelector('#vu-meter .control-toggle-btn');
        const viewButtons = document.querySelectorAll('#vu-meter .view-btn');
        
        // Configurar listener para o botão toggle
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevenir que o clique feche o menu imediatamente
                const controls = document.querySelector('#vu-meter .visualizer-controls');
                controls.classList.toggle('show');
            });
            
            // Fechar o menu ao clicar fora dele
            document.addEventListener('click', () => {
                const controls = document.querySelector('#vu-meter .visualizer-controls');
                if (controls.classList.contains('show')) {
                    controls.classList.remove('show');
                }
            });
        }
        
        // Configurar listeners para os botões de estilo
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevenir que o clique feche o menu imediatamente
                const style = btn.dataset.style;
                document.querySelectorAll('.vu-meters').forEach(meter => {
                    meter.style.display = 'none';
                });
                document.querySelector(`.vu-meters.${style}`).style.display = 'flex';
                
                viewButtons.forEach(btn => btn.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        function calculateDB(value) {
            // Evitar log(0)
            if (value < 0.000001) {
                return dbMin;
            }
            
            // Converter para dB (20 * log10(valor))
            const db = 20 * Math.log10(value);
            
            // Limitar ao intervalo dbMin a dbMax
            return Math.max(dbMin, Math.min(dbMax, db));
        }
        
        function updateDigitalMeter(element, valueElement, dB) {
            // Converter dB para porcentagem (0-100%)
            const percent = (dB - dbMin) / (dbMax - dbMin) * 100;
            
            // Definir altura do medidor
            element.style.height = `${percent}%`;
            
            // Atualizar valor em texto
            valueElement.textContent = `${dB.toFixed(1)} dB`;
            
            // Definir cores com base no nível
            if (dB > -3) {
                element.style.backgroundColor = 'var(--danger-color)';
            } else if (dB > -12) {
                element.style.backgroundColor = 'var(--warning-color)';
            } else {
                element.style.backgroundColor = 'var(--success-color)';
            }
        }
        
        function updateAnalogMeter(needle, valueElement, dB) {
            // Converter dB para ângulo da agulha
            const angle = ((dB - dbMin) / (dbMax - dbMin)) * (needleMaxAngle - needleMinAngle) + needleMinAngle;
            
            // Atualizar posição da agulha
            needle.style.transform = `rotate(${angle}deg)`;
            
            // Atualizar valor em texto
            valueElement.textContent = `${dB.toFixed(1)} dB`;
            
            // Definir cor da agulha com base no nível
            if (dB > -3) {
                needle.style.backgroundColor = 'var(--danger-color)';
            } else if (dB > -12) {
                needle.style.backgroundColor = 'var(--warning-color)';
            } else {
                needle.style.backgroundColor = 'var(--success-color)';
            }
        }
        
        vuMeter = {
            visualize: function(analyser) {
                if (analyser) {
                    const bufferLength = analyser.fftSize;
                    const dataArray = new Float32Array(bufferLength);
                    
                    analyser.getFloatTimeDomainData(dataArray);
                    
                    // Dividir os dados em canais separados (esquerdo e direito)
                    const leftChannelData = new Float32Array(bufferLength/2);
                    const rightChannelData = new Float32Array(bufferLength/2);
                    
                    // Separar os dados de forma adequada
                    // O WebAudio API usa dados intercalados: [L, R, L, R, L, R, ...]
                    for (let i = 0; i < bufferLength; i += 2) {
                        leftChannelData[i/2] = dataArray[i];
                        rightChannelData[i/2] = dataArray[i + 1];
                    }
                    
                    // Calcular RMS para cada canal
                    let sumLeft = 0;
                    let sumRight = 0;
                    
                    for (let i = 0; i < leftChannelData.length; i++) {
                        sumLeft += leftChannelData[i] * leftChannelData[i];
                    }
                    
                    for (let i = 0; i < rightChannelData.length; i++) {
                        sumRight += rightChannelData[i] * rightChannelData[i];
                    }
                    
                    // Calcular RMS final para cada canal
                    const rmsLeft = Math.sqrt(sumLeft / leftChannelData.length);
                    const rmsRight = Math.sqrt(sumRight / rightChannelData.length);
                    
                    // Converter para dB
                    const dbLeft = calculateDB(rmsLeft);
                    const dbRight = calculateDB(rmsRight);
                    
                    // Atualizar medidores digitais
                    updateDigitalMeter(leftMeterFill, leftMeterValue, dbLeft);
                    updateDigitalMeter(rightMeterFill, rightMeterValue, dbRight);
                    
                    // Atualizar medidores analógicos
                    updateAnalogMeter(leftNeedle, leftAnalogValue, dbLeft);
                    updateAnalogMeter(rightNeedle, rightAnalogValue, dbRight);
                } else {
                    // Estado padrão - medidores em -60dB (mínimo)
                    updateDigitalMeter(leftMeterFill, leftMeterValue, dbMin);
                    updateDigitalMeter(rightMeterFill, rightMeterValue, dbMin);
                    updateAnalogMeter(leftNeedle, leftAnalogValue, dbMin);
                    updateAnalogMeter(rightNeedle, rightAnalogValue, dbMin);
                }
            }
        };
    }
    
    // Configurações de tema (claro/escuro e cores)
    function initTheme() {
        // Verificar preferência do sistema
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Verificar se há tema salvo
        const savedTheme = localStorage.getItem('theme');
        const isDarkMode = savedTheme === 'dark' || (savedTheme === null && prefersDarkMode);
        const savedThemeType = localStorage.getItem('themeType') || 'default';
        
        // Aplicar tema salvo
        if (savedThemeType !== 'default' && savedThemeType !== 'dark') {
            document.documentElement.setAttribute('data-theme', savedThemeType);
            updateActiveThemeButton(savedThemeType);
        } else {
            document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'default');
            updateActiveThemeButton(isDarkMode ? 'dark' : 'default');
        }
        
        themeSwitch.checked = isDarkMode;
        
        // Aplicar cores personalizadas salvas
        const customColors = JSON.parse(localStorage.getItem('customColors'));
        if (customColors) {
            Object.keys(customColors).forEach(prop => {
                document.documentElement.style.setProperty(`--${prop}`, customColors[prop]);
                
                // Atualizar valores dos pickers
                const picker = document.getElementById(prop);
                if (picker) {
                    picker.value = customColors[prop];
                }
            });
        }
    }
    
    function initColorPickers() {
        // Valores iniciais para os pickers
        document.getElementById('primary-color').value = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
        document.getElementById('accent-color').value = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
        document.getElementById('background-color').value = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim();
        document.getElementById('text-color').value = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
    }
    
    function toggleTheme() {
        const isDarkMode = themeSwitch.checked;
        
        // Mantém o tema específico, só alternando entre claro/escuro
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const isCustomTheme = !['default', 'dark'].includes(currentTheme);
        
        if (!isCustomTheme) {
            const newTheme = isDarkMode ? 'dark' : 'default';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            localStorage.setItem('themeType', newTheme);
            updateActiveThemeButton(newTheme);
        }
    }
    
    function toggleThemePalette(e) {
        e.stopPropagation();
        themePalette.classList.toggle('show');
    }
    
    function applyThemePreset(theme) {
        // Remover tema atual
        document.documentElement.removeAttribute('data-theme');
        
        // Limpar cores personalizadas
        document.documentElement.style.removeProperty('--primary-color');
        document.documentElement.style.removeProperty('--accent-color');
        document.documentElement.style.removeProperty('--background-color');
        document.documentElement.style.removeProperty('--card-bg');
        document.documentElement.style.removeProperty('--border-color');
        document.documentElement.style.removeProperty('--text-color');
        document.documentElement.style.removeProperty('--text-secondary');
        document.documentElement.style.removeProperty('--meter-bg');
        
        // Aplicar novo tema
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('themeType', theme);
        
        // Atualizar switch claro/escuro
        if (theme === 'dark') {
            themeSwitch.checked = true;
            localStorage.setItem('theme', 'dark');
        } else if (theme === 'default') {
            themeSwitch.checked = false;
            localStorage.setItem('theme', 'light');
        }
        
        // Atualizar valores dos pickers para refletir o novo tema
        initColorPickers();
        
        // Atualizar botão ativo
        updateActiveThemeButton(theme);
        
        // Remover cores personalizadas salvas
        localStorage.removeItem('customColors');
    }
    
    function updateActiveThemeButton(theme) {
        themePresets.forEach(preset => {
            preset.classList.toggle('active', preset.dataset.theme === theme);
        });
    }
    
    function applyCustomTheme() {
        const primaryColor = document.getElementById('primary-color').value;
        const accentColor = document.getElementById('accent-color').value;
        const backgroundColor = document.getElementById('background-color').value;
        const textColor = document.getElementById('text-color').value;
        
        // Salvar valores personalizados
        const customColors = {
            'primary-color': primaryColor,
            'accent-color': accentColor,
            'background-color': backgroundColor,
            'text-color': textColor
        };
        
        // Aplicar cores diretamente nas variáveis CSS
        Object.keys(customColors).forEach(prop => {
            document.documentElement.style.setProperty(`--${prop}`, customColors[prop]);
        });
        
        // Salvar no localStorage
        localStorage.setItem('customColors', JSON.stringify(customColors));
        
        // Fechar a paleta
        themePalette.classList.remove('show');
        
        // Remover seleção de tema predefinido
        themePresets.forEach(preset => preset.classList.remove('active'));
    }
    
    // Funções relacionadas ao YouTube
    function initYouTubePlayer() {
        youtubePlayer = new YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: 'dQw4w9WgXcQ', // Vídeo padrão
            playerVars: {
                'autoplay': 0,
                'controls': 1,
                'rel': 0,
                'showinfo': 0
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    }
    
    function onPlayerReady(event) {
        console.log('YouTube Player pronto!');
    }
    
    function onPlayerStateChange(event) {
        // Quando o vídeo terminar, reiniciá-lo
        if (event.data === YT.PlayerState.ENDED) {
            youtubePlayer.playVideo();
        }
    }
    
    function searchYouTube() {
        const query = youtubeSearchInput.value.trim();
        
        if (!query) return;
        
        // Exibir mensagem de carregamento
        youtubeResults.innerHTML = '<div class="loading">Buscando vídeos...</div>';
        
        // Fazer chamada à API de busca do YouTube
        fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`)
            .then(response => response.json())
            .then(data => {
                if (data.items && data.items.length > 0) {
                    renderYouTubeResults(data.items);
                } else {
                    youtubeResults.innerHTML = '<div class="no-results">Nenhum vídeo encontrado.</div>';
                }
            })
            .catch(error => {
                console.error('Erro ao buscar vídeos do YouTube:', error);
                youtubeResults.innerHTML = '<div class="error">Ocorreu um erro ao buscar vídeos. <br>Verifique sua chave de API do YouTube.</div>';
            });
    }
    
    function renderYouTubeResults(videos) {
        youtubeResults.innerHTML = '';
        youtubeVideoNodes = [];
        
        videos.forEach(video => {
            const videoId = video.id.videoId;
            const title = video.snippet.title;
            const thumbnail = video.snippet.thumbnails.medium.url;
            const channelTitle = video.snippet.channelTitle;
            
            const videoElement = document.createElement('div');
            videoElement.className = 'youtube-result';
            videoElement.dataset.videoId = videoId;
            videoElement.innerHTML = `
                <img src="${thumbnail}" alt="${title}">
                <div class="youtube-result-info">
                    <div class="youtube-result-title">${title}</div>
                    <div class="youtube-result-channel">${channelTitle}</div>
                </div>
            `;
            
            videoElement.addEventListener('click', () => {
                loadYouTubeVideo(videoId);
            });
            
            youtubeResults.appendChild(videoElement);
            youtubeVideoNodes.push(videoElement);
        });
    }
    
    function loadYouTubeVideo(videoId) {
        if (youtubePlayer && youtubeApiReady) {
            youtubePlayer.loadVideoById(videoId);
            
            // Mostrar o player e esconder os resultados da busca
            youtubePlayerContainer.classList.add('active');
            youtubeResults.innerHTML = '';
            
            // Se a captura de áudio já estiver ativa e a fonte for o YouTube
            if (isCapturing && audioSourceSelect.value === 'youtube') {
                youtubePlayer.playVideo();
            }
        }
    }
    
    // Inicializar visualizações
    init();
});