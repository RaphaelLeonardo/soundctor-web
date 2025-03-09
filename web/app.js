document.addEventListener('DOMContentLoaded', function() {
    // Elementos da UI
    const startButton = document.getElementById('start-audio');
    const audioSourceSelect = document.getElementById('audio-source');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
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
    const YOUTUBE_API_KEY = 'YOUR_API_KEY'; // Substitua pela sua chave de API
    
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
    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
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
                
                // Usar o contexto de áudio Web Audio API para capturar o áudio do YouTube
                // Isso requer um workaround já que o YouTube não expõe diretamente o stream de áudio
                
                // Conectar um MediaElementAudioSourceNode ao vídeo (simulado)
                const videoElement = document.createElement('video');
                videoElement.crossOrigin = 'anonymous';
                videoElement.src = 'data:video/mp4;base64,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';
                
                // Criar um nó de áudio para o YouTube
                youtubeAudioSource = audioContext.createMediaElementSource(videoElement);
                youtubeAudioSource.connect(analyser);
                
                // Inicie a reprodução do vídeo no YouTube
                youtubePlayer.playVideo();
                
                // Também podemos usar um stream de áudio vazio como fallback se necessário
                if (!youtubeAudioSource) {
                    const oscillator = audioContext.createOscillator();
                    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                    oscillator.connect(analyser);
                    oscillator.start();
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
            
            // Não conecte ao destination para evitar feedback
            // analyser.connect(audioContext.destination);
            
            startVisualization();
            isCapturing = true;
        } catch (error) {
            throw error;
        }
    }
    
    // Parar captura de áudio
    function stopAudioCapture() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
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
        const activeTab = document.querySelector('.tab-pane.active').id;
        
        function animate() {
            animationFrameId = requestAnimationFrame(animate);
            
            if (!analyser) return;
            
            switch (activeTab) {
                case 'oscilloscope':
                    oscilloscope.visualize(analyser);
                    break;
                case 'spectrogram':
                    spectrogram.visualize(analyser);
                    break;
                case 'vu-meter':
                    vuMeter.visualize(analyser);
                    break;
            }
        }
        
        animate();
    }
    
    // Alternar abas
    function switchTab(tabId) {
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === tabId);
        });
        
        // Reiniciar a visualização se estiver capturando
        if (isCapturing && animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            startVisualization();
        }
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
                const bufferLength = analyser.fftSize;
                const dataArray = new Float32Array(bufferLength);
                
                analyser.getFloatTimeDomainData(dataArray);
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.lineWidth = 2;
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
                ctx.beginPath();
                
                const sliceWidth = canvas.width / bufferLength;
                let x = 0;
                
                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] * 3;
                    const y = (v * canvas.height / 2) + canvas.height / 2;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                    
                    x += sliceWidth;
                }
                
                ctx.lineTo(canvas.width, canvas.height / 2);
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
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                
                analyser.getByteFrequencyData(dataArray);
                
                const positions = line.geometry.attributes.position.array;
                
                // Atualizar a altura de cada barra com base nos dados de frequência
                for (let i = 0; i < divisions; i++) {
                    // Mapeamento logarítmico para frequências para melhor visualização
                    const index = Math.floor(i / divisions * (bufferLength / 2));
                    const value = dataArray[index] / 255.0;
                    
                    // Atualizar posição Y (altura) da barra
                    positions[i * 3 + 1] = value * 1.5;
                }
                
                line.geometry.attributes.position.needsUpdate = true;
                
                // Rotacionar levemente para animar
                line.rotation.y += 0.005;
                
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