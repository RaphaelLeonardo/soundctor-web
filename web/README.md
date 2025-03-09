# Soundctor Web

Soundctor Web é um visualizador de áudio para navegador que permite capturar e visualizar o áudio de diferentes fontes em tempo real. Esta versão foi adaptada de uma extensão para Chrome para uma aplicação web independente.

## Funcionalidades

- **Captura de áudio** de diferentes fontes:
  - Microfone
  - Áudio do sistema 
  - Áudio da aba atual
  - **Áudio de vídeos do YouTube**

- **Visualizações** de áudio em tempo real:
  - **Osciloscópio**: Exibe a forma de onda do áudio
  - **Espectrograma 3D**: Visualização tridimensional do espectro de frequência
  - **VU Meters**: Medidores de volume para os canais esquerdo e direito

- **Integração com YouTube**:
  - Busca de vídeos diretamente na aplicação
  - Reprodução de vídeos do YouTube e visualização do áudio simultaneamente
  - Seleção de vídeos através de miniaturas

- **Tema claro/escuro**: Alterne entre temas para melhor visualização em diferentes ambientes

## Como usar

1. Abra o arquivo `index.html` no seu navegador
2. Para usar visualização com YouTube:
   - Digite um termo de busca e clique em "Buscar"
   - Clique em uma miniatura para carregar o vídeo
   - Clique em "Iniciar Captura" com a opção "YouTube" selecionada
3. Para usar outras fontes de áudio:
   - Selecione a fonte desejada no menu dropdown
   - Clique no botão "Iniciar Captura"
   - Conceda as permissões necessárias quando solicitado
4. Explore as diferentes visualizações através das abas

## Requisitos

- Navegador moderno com suporte às seguintes APIs:
  - Web Audio API
  - MediaDevices API (getUserMedia)
  - MediaDevices API (getDisplayMedia) para captura de áudio do sistema
  - YouTube IFrame API

## Configuração

Para usar a função de busca do YouTube, você precisa:

1. Obter uma chave da API do YouTube em https://console.cloud.google.com/
2. Abrir o arquivo `app.js` e substituir `YOUR_API_KEY` pela sua chave de API

## Observações

- A captura de áudio do sistema ou da aba pode requerer permissões adicionais do navegador
- Para melhor desempenho, recomenda-se o uso do Google Chrome, Firefox ou Microsoft Edge
- A visualização 3D utiliza a biblioteca Three.js
- A funcionalidade de áudio do YouTube usa uma solução alternativa, pois o YouTube não fornece acesso direto ao stream de áudio