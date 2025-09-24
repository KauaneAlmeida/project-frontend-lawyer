// chat.js - Sistema completo de Chat + Integração WhatsApp
(function(){
  // ============================================================================
  // CONFIGURAÇÃO E UTILITÁRIOS
  // ============================================================================
  
  // Pega URL do backend de várias fontes possíveis
  var thisScript = document.currentScript || (function(){ 
    var s = document.getElementsByTagName('script'); 
    return s[s.length-1]; 
  })();
  
  var API_BASE_URL = (thisScript && thisScript.getAttribute('data-api')) 
                     || (new URLSearchParams(window.location.search).get('api')) 
                     || localStorage.getItem('backend_url') 
                     || 'https://law-firm-backend-936902782519-936902782519.us-central1.run.app'; // fallback para desenvolvimento

  // SEU NÚMERO COMERCIAL DO WHATSAPP (ALTERE AQUI)
  var COMMERCIAL_WHATSAPP = "5511918368812"; // ⚠️ SUBSTITUA PELO SEU NÚMERO

  // ============================================================================
  // SISTEMA DE CHAT
  // ============================================================================

  // Monta a interface do chat
  function mountChatUI() {
    var root = document.getElementById('chat-root');
    if(!root){ 
      root = document.createElement('div'); 
      root.id = 'chat-root'; 
      document.body.appendChild(root); 
    }
    
    root.innerHTML = `
      <div class="chat-container" role="dialog" aria-label="Chat">
        <div class="chat-header">💬 Chat Advocacia — Escritório m.lima</div>
        <div id="chat-messages" class="messages"></div>
        <div class="input-area">
          <input id="chat-input" placeholder="Digite sua mensagem... ⚖️" aria-label="Mensagem"/>
          <button id="chat-send">Enviar</button>
        </div>
      </div>
    `;
    
    // Event listeners do chat
    document.getElementById('chat-send').addEventListener('click', sendChatMessage);
    document.getElementById('chat-input').addEventListener('keypress', function(e){ 
      if(e.key==='Enter') sendChatMessage(); 
    });
    
    // Mensagem inicial
    addChatMessage("Olá! Bem-vindo — pronto pra conversar?", 'bot');
  }

  // Adiciona mensagem na interface do chat
  function addChatMessage(text, sender){
    var messagesContainer = document.getElementById('chat-messages');
    if(!messagesContainer) return;
    
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (sender === 'user' ? 'user' : 'bot');

    var avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = sender === 'user' ? './assets/user.png' : './assets/bot.png';
    avatar.alt = sender;

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    if(sender === 'user'){ 
      messageDiv.appendChild(bubble); 
      messageDiv.appendChild(avatar); 
    } else { 
      messageDiv.appendChild(avatar); 
      messageDiv.appendChild(bubble); 
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Mostra indicador de "digitando" e depois a resposta
  function showBotTypingAndReply(message){
    const messagesContainer = document.getElementById('chat-messages');
    if(!messagesContainer) return;

    // Indicador de digitando
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('message', 'bot', 'typing-message');
    typingDiv.innerHTML = `
      <img src="./assets/bot.png" class="avatar" alt="bot">
      <div class="bubble typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Após 2 segundos, remove o "digitando" e mostra a resposta
    setTimeout(() => {
      typingDiv.remove();
      addChatMessage(message, 'bot');
    }, 2000);
  }

  // Gerenciamento de sessão do chat
  function setChatSessionId(id){ 
    try{ localStorage.setItem('chat_session_id', id); }catch(e){} 
  }
  
  function getChatSessionId(){ 
    try{ return localStorage.getItem('chat_session_id'); }catch(e){ return null; } 
  }

  // Envio de mensagens do chat
  async function sendChatMessage(){
    var input = document.getElementById('chat-input');
    var text = (input.value || '').trim();
    if(!text) return;
    
    addChatMessage(text, 'user');
    input.value = '';

    var payload = { 
      message: text, 
      session_id: getChatSessionId() || ('web_' + Date.now()) 
    };

    try {
      var response = await fetch(API_BASE_URL + '/api/v1/conversation/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if(!response.ok) throw new Error('Response not ok: ' + response.status);
      
      var data = await response.json();
      if(data.session_id) setChatSessionId(data.session_id);
      
      var botMessage = data.response || data.reply || data.question || '🤔 O bot não respondeu.';
      showBotTypingAndReply(botMessage);
      
    } catch(error) {
      console.warn('Chat API falhou, usando fallback:', error);
      showBotTypingAndReply("⚠️ Não consegui conectar com o servidor. Tente novamente em alguns minutos.");
    }
  }

  // Inicializa conversa com o backend
  async function initializeChatConversation(){
    try {
      var response = await fetch(API_BASE_URL + '/api/v1/conversation/start', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'} 
      });
      
      if(!response.ok) return;
      
      var data = await response.json();
      if(data.session_id) setChatSessionId(data.session_id);
      if(data.question) showBotTypingAndReply(data.question);
      
    } catch(error) { 
      console.log('Inicialização do chat falhou (normal em modo offline):', error);
    }
  }

  // ============================================================================
  // INTEGRAÇÃO WHATSAPP
  // ============================================================================

  // Função principal para autorizar sessão WhatsApp e abrir direto
  async function authorizeWhatsAppSession(source, userData = {}) {
    console.log('🚀 Iniciando autorização WhatsApp...', { source });
    
    // Gerar session_id único para WhatsApp
    var sessionId = 'whatsapp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Preparar dados completos para autorização
    var requestData = {
      session_id: sessionId,
      phone_number: null, // Será capturado pelo webhook quando usuário enviar mensagem
      source: source,
      user_data: {
        ...userData,
        page_url: window.location.href,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        referrer: document.referrer || 'direct'
      }
    };

    try {
      console.log('📡 Enviando pré-autorização...', requestData);
      
      // Chamar API de pré-autorização (registra a intenção)
      var response = await fetch(API_BASE_URL + '/api/v1/whatsapp/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        var data = await response.json();
        console.log('✅ Pré-autorização realizada:', data);
        
        // Abrir WhatsApp com mensagem personalizada baseada no contexto
        var message = generateWhatsAppMessage(userData, source);
        var whatsappUrl = 'https://wa.me/' + COMMERCIAL_WHATSAPP + '?text=' + encodeURIComponent(message);
        
        console.log('📱 Abrindo WhatsApp:', whatsappUrl);
        window.open(whatsappUrl, '_blank');
        
        return true;
        
      } else {
        throw new Error('Pré-autorização falhou: ' + response.status);
      }
      
    } catch (error) {
      console.error('❌ Erro na pré-autorização, abrindo WhatsApp direto:', error);
      
      // Fallback: abrir WhatsApp sem autorização prévia
      var fallbackMessage = generateWhatsAppMessage(userData, source);
      var fallbackUrl = 'https://wa.me/' + COMMERCIAL_WHATSAPP + '?text=' + encodeURIComponent(fallbackMessage);
      
      console.log('📱 Fallback - Abrindo WhatsApp direto:', fallbackUrl);
      window.open(fallbackUrl, '_blank');
      
      return false;
    }
  }

  // Gera mensagem simples - o fluxo do bot fará as perguntas
  function generateWhatsAppMessage(userData, source) {
    // Mensagem simples - o bot do WhatsApp fará as perguntas específicas
    return "Olá! Vim do site m.lima e gostaria de falar com um advogado.";
  }

  // Configuração do botão WhatsApp flutuante
  function getWhatsAppButtonsConfig() {
    return [
      // Apenas botão flutuante
      { 
        selector: '[data-testid="floating-whatsapp-button"]', 
        source: 'floating_button',
        userData: {
          origem: 'Botão Flutuante',
          site: 'm.lima'
        }
      }
    ];
  }

  // Intercepta apenas o botão flutuante do WhatsApp
  function interceptWhatsAppButtons() {
    var buttonConfig = {
      selector: '[data-testid="floating-whatsapp-button"]', 
      source: 'floating_button',
      userData: {
        origem: 'Botão Flutuante',
        site: 'm.lima'
      }
    };

    var button = document.querySelector(buttonConfig.selector);
    
    if (button) {
      console.log('📱 Interceptando botão WhatsApp flutuante:', buttonConfig.selector);
      
      // Clonar botão para remover listeners antigos
      var newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      // Adicionar novo listener
      newButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🔥 Botão WhatsApp flutuante clicado!');
        
        // Fazer pré-autorização e abrir WhatsApp
        authorizeWhatsAppSession(buttonConfig.source, buttonConfig.userData);
      });
      
      console.log('✅ Botão WhatsApp flutuante configurado com sucesso!');
      
    } else {
      console.warn('⚠️ Botão WhatsApp flutuante não encontrado:', buttonConfig.selector);
    }
  }

  // Observer para detectar o botão flutuante criado dinamicamente
  function setupWhatsAppObserver() {
    var observer = new MutationObserver(function(mutations) {
      var shouldReintercept = false;
      
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          // Verificar se o botão flutuante foi adicionado
          for(var i = 0; i < mutation.addedNodes.length; i++) {
            var node = mutation.addedNodes[i];
            if(node.nodeType === Node.ELEMENT_NODE) {
              var hasFloatingButton = node.querySelector && 
                                    node.querySelector('[data-testid="floating-whatsapp-button"]');
              if(hasFloatingButton) {
                shouldReintercept = true;
                break;
              }
            }
          }
        }
      });
      
      if(shouldReintercept) {
        console.log('🔄 Botão flutuante WhatsApp detectado, interceptando...');
        setTimeout(interceptWhatsAppButtons, 200);
      }
    });

    // Iniciar observação quando DOM estiver pronto
    if(document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      });
    }
  }

  // ============================================================================
  // INICIALIZAÇÃO E EXPOSIÇÃO PÚBLICA
  // ============================================================================

  // Inicialização principal
  function initialize() {
    console.log('🚀 Inicializando Chat + WhatsApp Integration...');
    console.log('🔧 Backend URL:', API_BASE_URL);
    console.log('📱 WhatsApp Comercial:', COMMERCIAL_WHATSAPP);
    console.log('🎯 Focado apenas no botão flutuante WhatsApp');
    
    // Inicializar chat
    mountChatUI();
    initializeChatConversation();
    
    // Configurar integração WhatsApp (apenas botão flutuante)
    setTimeout(function() {
      interceptWhatsAppButtons();
      setupWhatsAppObserver();
    }, 1000);
  }

  // Event listener para inicialização
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Configurar botão launcher do chat (se existir)
  document.addEventListener('DOMContentLoaded', function() {
    var launcher = document.getElementById('chat-launcher');
    if(launcher) {
      launcher.addEventListener('click', function() {
        var chatRoot = document.getElementById('chat-root');
        if(chatRoot) {
          chatRoot.classList.toggle('active');
        }
      });
    }
  });

  // ============================================================================
  // API PÚBLICA (window objects para debug e controle)
  // ============================================================================

  // Expor funcionalidades do Chat
  window.ChatWidget = {
    setBackend: function(url) { 
      API_BASE_URL = url; 
      localStorage.setItem('backend_url', url);
      console.log('🔧 Backend URL atualizada:', url);
    },
    sendMessage: sendChatMessage,
    addMessage: addChatMessage,
    clearSession: function() {
      localStorage.removeItem('chat_session_id');
      console.log('🧹 Sessão do chat limpa');
    }
  };

  // Expor funcionalidades do WhatsApp
  window.WhatsAppIntegration = {
    test: function(source) {
      console.log('🧪 Testando integração WhatsApp...');
      authorizeWhatsAppSession(source || 'test', { 
        test: true, 
        timestamp: new Date().toISOString() 
      });
    },
    reintercept: interceptWhatsAppButtons,
    setCommercialNumber: function(number) {
      COMMERCIAL_WHATSAPP = number;
      console.log('📱 Número comercial atualizado:', number);
    },
    setBackend: function(url) {
      API_BASE_URL = url;
      localStorage.setItem('backend_url', url);
      console.log('🔧 Backend URL atualizada para WhatsApp:', url);
    },
    openWhatsApp: function(source, userData) {
      console.log('🔄 Abrindo WhatsApp manualmente...');
      authorizeWhatsAppSession(source || 'manual', userData || {});
    }
  };

  console.log('✅ Chat.js carregado completamente!');
  console.log('💡 Use ChatWidget.* ou WhatsAppIntegration.* no console para debug');

})();