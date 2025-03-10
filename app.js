document.addEventListener('DOMContentLoaded', function() {
    // Elementos da UI
    const startButton = document.getElementById('start-audio');
    const audioSourceSelect = document.getElementById('audio-source');
    const themeSwitch = document.getElementById('theme-switch');
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
    
    // YouTube API
    let youtubePlayer;
    let youtubeApiReady = false;
    let youtubeVideoNodes = [];
    
    // Chave da API do YouTube (obtenha a sua em https://console.cloud.google.com/)
    const YOUTUBE_API_KEY = 'AIzaSyAKn4Vfy-hElGHFyUxuhkG_U_j6n2Metho'; // Substitua pela sua chave de API
    
    // Configurações de visualização
    const FFT_SIZE = 2048;
    const SMOOTHING = 0.8;
    
    // Inicializar tema
    initTheme();
    
    // Verificar se a YouTube API está pronta
    window.onYouTubeIframeAPIReady = function() {
        youtubeApiReady = true;
        initYouTubePlayer();
    };
    
    // Listeners de eventos
    startButton.addEventListener('click', toggleAudioCapture);
    audioSourceSelect.addEventListener('change', changeAudioSource);
    themeSwitch.addEventListener('change', toggleTheme);
    youtubeSearchBtn.addEventListener('click', searchYouTube);
    youtubeSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchYouTube();
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
        
        audioSourceSelect.disabled = false;
        
        // Exibir ou ocultar o player do YouTube dependendo da fonte de áudio selecionada
        updateYouTubeVisibility();
        
        // Iniciar animações em estado padrão
        startVisualization();
    }
    
    // Atualizar visibilidade da seção do YouTube
    function updateYouTubeVisibility() {
        const isYouTubeSource = audioSourceSelect.value === 'youtube';
        youtubePlayerContainer.style.display = isYouTubeSource ? 'block' : 'none';
        
        if (isYouTubeSource && !youtubePlayerContainer.classList.contains('active')) {
            youtubePlayerContainer.classList.add('active');
        } else if (!isYouTubeSource && youtubePlayerContainer.classList.contains('active')) {
            youtubePlayerContainer.classList.remove('active');
        }
    }
    
    // Alternar entre iniciar e parar a captura de áudio
    async function toggleAudioCapture() {
        if (isCapturing) {
            stopAudioCapture();
            startButton.textContent = 'Iniciar Captura';
            audioSourceSelect.disabled = false;
        } else {
            try {
                await startAudioCapture();
                startButton.textContent = 'Parar Captura';
                audioSourceSelect.disabled = true;
            } catch (error) {
                console.error('Erro ao iniciar captura:', error);
                alert('Não foi possível iniciar a captura de áudio: ' + error.message);
            }
        }
    }
    
    // Iniciar captura de áudio
    async function startAudioCapture() {
        const selectedSource = audioSourceSelect.value;
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = SMOOTHING;
        
        try {
            if (selectedSource === 'youtube') {
                if (!youtubePlayer || !youtubeApiReady) {
                    throw new Error('Player do YouTube não está pronto');
                }
                
                // Método 1: Usar um elemento de áudio conectado a um proxy de áudio
                // Crie um servidor proxy em seu backend ou use um serviço existente
                // que possa extrair o áudio do YouTube e fornecer como stream de áudio
                
                // Criando uma tag de áudio para conectar ao YouTube
                const audioElement = document.createElement('audio');
                audioElement.crossOrigin = "anonymous";
                
                // Uma abordagem alternativa é usar o YouTube-audio-stream ou 
                // outro serviço que possa fornecer apenas o áudio
                // Exemplo: /proxy-youtube-audio?videoId=VIDEO_ID
                const videoId = youtubePlayer.getVideoData().video_id;
                
                // Vamos usar uma estratégia diferente - como não podemos acessar 
                // o áudio diretamente, vamos usar a API Web Audio para capturar 
                // o som que sai dos alto-falantes
                
                // Método 2: Capturar áudio da saída do sistema
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
            } else {
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
    
    // Inicializar o espectrograma 3D
    function initSpectrogram() {
        const container = document.getElementById('spectrogram-container');
        
        // THREE.js setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);
        
        // Criar geometria para visualização
        const geometry = new THREE.BufferGeometry();
        const divisions = 128; // Número de barras
        
        // Posições iniciais
        const positions = new Float32Array(divisions * 3);
        const colors = new Float32Array(divisions * 3);
        
        for (let i = 0; i < divisions; i++) {
            // Posição X: distribuído uniformemente
            positions[i * 3] = (i / divisions) * 2 - 1;
            // Posição Y: todas começam em 0
            positions[i * 3 + 1] = 0;
            // Posição Z: profundidade fixa
            positions[i * 3 + 2] = 0;
            
            // Cores (gradiente do azul para o vermelho)
            colors[i * 3] = i / divisions; // R
            colors[i * 3 + 1] = 0.5 - Math.abs(i / divisions - 0.5); // G
            colors[i * 3 + 2] = 1 - i / divisions; // B
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 2
        });
        
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        
        // Posição da câmera
        camera.position.z = 2;
        camera.position.y = 0.5;
        camera.lookAt(0, 0, 0);
        
        // Redimensionar quando a janela mudar de tamanho
        window.addEventListener('resize', () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            
            renderer.setSize(width, height);
        });
        
        spectrogram = {
            visualize: function(analyser) {
                const positions = line.geometry.attributes.position.array;
                
                if (analyser) {
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    analyser.getByteFrequencyData(dataArray);
                    
                    // Atualizar a altura de cada barra com base nos dados de frequência
                    for (let i = 0; i < divisions; i++) {
                        // Mapeamento logarítmico para frequências para melhor visualização
                        const index = Math.floor(i / divisions * (bufferLength / 2));
                        const value = dataArray[index] / 255.0;
                        
                        // Atualizar posição Y (altura) da barra
                        positions[i * 3 + 1] = value * 1.5;
                    }
                } else {
                    // Estado padrão - barras com altura zero
                    for (let i = 0; i < divisions; i++) {
                        positions[i * 3 + 1] = 0;
                    }
                }
                
                line.geometry.attributes.position.needsUpdate = true;
                
                // Sempre gira suavemente mesmo em estado padrão
                line.rotation.y += 0.002;
                
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
        
        // Configurações
        const dbMin = -60; // Valor mínimo em dB
        const dbMax = 0;   // Valor máximo em dB
        
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
        
        function updateMeter(element, valueElement, dB) {
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
        
        vuMeter = {
            visualize: function(analyser) {
                if (analyser) {
                    const bufferLength = analyser.fftSize;
                    const dataArray = new Float32Array(bufferLength);
                    
                    analyser.getFloatTimeDomainData(dataArray);
                    
                    // Calcular RMS (Root Mean Square) para cada canal
                    let sumLeft = 0;
                    let sumRight = 0;
                    
                    for (let i = 0; i < bufferLength; i += 2) {
                        // Canal esquerdo (amostras pares)
                        sumLeft += dataArray[i] * dataArray[i];
                        
                        // Canal direito (amostras ímpares)
                        if (i + 1 < bufferLength) {
                            sumRight += dataArray[i + 1] * dataArray[i + 1];
                        }
                    }
                    
                    const rmsLeft = Math.sqrt(sumLeft / (bufferLength / 2));
                    const rmsRight = Math.sqrt(sumRight / (bufferLength / 2));
                    
                    // Converter para dB e atualizar os medidores
                    const dbLeft = calculateDB(rmsLeft);
                    const dbRight = calculateDB(rmsRight);
                    
                    updateMeter(leftMeterFill, leftMeterValue, dbLeft);
                    updateMeter(rightMeterFill, rightMeterValue, dbRight);
                } else {
                    // Estado padrão - medidores em -60dB (mínimo)
                    updateMeter(leftMeterFill, leftMeterValue, dbMin);
                    updateMeter(rightMeterFill, rightMeterValue, dbMin);
                }
            }
        };
    }
    
    // Configurações de tema (claro/escuro)
    function initTheme() {
        // Verificar preferência do sistema
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Verificar se há tema salvo
        const savedTheme = localStorage.getItem('theme');
        const isDarkMode = savedTheme === 'dark' || (savedTheme === null && prefersDarkMode);
        
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        themeSwitch.checked = isDarkMode;
    }
    
    function toggleTheme() {
        const isDarkMode = themeSwitch.checked;
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
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
        
        // Mostrar o player
        youtubePlayerContainer.classList.add('active');
    }
    
    function loadYouTubeVideo(videoId) {
        if (youtubePlayer && youtubeApiReady) {
            youtubePlayer.loadVideoById(videoId);
            
            // Se a captura de áudio já estiver ativa e a fonte for o YouTube
            if (isCapturing && audioSourceSelect.value === 'youtube') {
                youtubePlayer.playVideo();
            }
        }
    }
    
    // Inicializar visualizações
    init();
});