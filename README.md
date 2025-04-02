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

### Versão Electron (Recomendada)

1. Instale as dependências:
   ```
   npm install
   ```

2. Execute a aplicação:
   ```
   npm start
   ```
   
   Ou para modo desenvolvimento com ferramentas de desenvolvedor:
   ```
   npm run dev
   ```

3. Para usar visualização com YouTube:
   - Digite um termo de busca e clique em "Buscar"
   - Clique em uma miniatura para carregar o vídeo
   - Clique em "Iniciar Captura" com a opção "YouTube" selecionada

4. Para usar outras fontes de áudio:
   - Selecione a fonte desejada no menu dropdown (incluindo opções exclusivas do Electron para captura de áudio do sistema)
   - Clique no botão "Iniciar Captura"
   - Conceda as permissões necessárias quando solicitado

5. Explore as diferentes visualizações

### Versão Web (Navegador)

1. Abra o arquivo `index.html` no seu navegador
2. Siga as mesmas instruções acima, porém com funcionalidades limitadas de captura de áudio do sistema

## Requisitos

### Versão Electron:
- Node.js (versão recomendada: 14.x ou superior)
- Electron (instalado como dependência)

### Versão Web:
- Navegador moderno com suporte às seguintes APIs:
  - Web Audio API
  - MediaDevices API (getUserMedia)
  - MediaDevices API (getDisplayMedia) para captura de áudio do sistema
  - YouTube IFrame API

## Configuração

1. Para usar a função de busca do YouTube, você precisa:
   - Obter uma chave da API do YouTube em https://console.cloud.google.com/
   - Abrir o arquivo `app.js` e substituir a chave de API existente pela sua chave

2. Para construir uma versão distribuível da aplicação:
   ```
   npm install electron-builder --save-dev
   npx electron-builder
   ```

## Observações

- Na versão Electron, a captura de áudio do sistema é mais robusta e não exige os diálogos de permissão
- Na versão Web, a captura de áudio do sistema ou da aba requer permissões adicionais do navegador
- Para melhor desempenho na versão Web, recomenda-se o uso do Google Chrome, Firefox ou Microsoft Edge
- A visualização 3D utiliza a biblioteca Three.js que já está incluída via CDN
- A funcionalidade de áudio do YouTube usa técnicas diferentes para captura, dependendo se está no Electron ou em um navegador