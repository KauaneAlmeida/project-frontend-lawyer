// chat.js - Sistema completo de Chat + Integração WhatsApp CORRIGIDO
(function(){
  // ============================================================================
  // CONFIGURAÇÃO E UTILITÁRIOS
  // ============================================================================
  
  // Pega URL do backend de várias fontes possíveis
  var thisScript = document.currentScript || (function(){ 
    var s = document.getElementsByTagName('script'); 
    return s[s.length-1]; 
  })();
  
  // CORRIGIDO: URL do backend para produção
  var API_BASE_URL = (thisScript && thisScript.getAttribute('data-api')) 
                     || (new URLSearchParams(window.location.search).get('api')) 
                     || localStorage.getItem('backend_url') 
                     || 'https://law-firm-backend-936902782519-936902782519.us-central1.run.app'; // URL correta

  // SEU NÚMERO COMERCIAL DO WHATSAPP (ALTERE AQUI)
  var COMMERCIAL_WHATSAPP = "5511918368812"; // ⚠️ SUBSTITUA PELO SEU NÚMERO

  // Estado do chat para controlar fluxos
  var chatState = {
    isCompleted: false,
    userData: {},
    sessionId: null,
    flowType: null // 'landing_chat' ou 'whatsapp_button'
  };

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
    addChatMessage("Olá! Bem-vindo ao m.lima Advocacia. Como posso ajudá-lo?", 'bot');
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
    avatar.onerror = function() {
      // Fallback se imagens não existirem
      this.style.display = 'none';
    };

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
      <div class="avatar-placeholder"></div>
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
      
      // Verificar se o chat foi completado
      checkChatCompletion(message);
    }, 2000);
  }

  // Verifica se o chat foi completado baseado na resposta
  function checkChatCompletion(botMessage) {
    // Indicadores de que o fluxo foi completado
    var completionIndicators = [
      'nossa equipe entrará em contato',
      'advogado entrará em contato', 
      'você está em excelentes mãos',
      'obrigado pelas informações',
      'seus dados foram registrados',
      'nossa equipe foi notificada'
    ];
    
    var isCompleted = completionIndicators.some(function(indicator) {
      return botMessage.toLowerCase().includes(indicator);
    });
    
    if (isCompleted && !chatState.isCompleted) {
      console.log('🎯 Chat completado - dados sendo enviados automaticamente para WhatsApp');
      chatState.isCompleted = true;
      chatState.flowType = 'landing_chat';
      
      // Processar automaticamente para WhatsApp (sem botão)
      setTimeout(function() {
        handleChatCompletionWhatsApp();
      }, 1000);
    }
  }

  // Processa conclusão do chat e autorização WhatsApp AUTOMATICAMENTE
  function handleChatCompletionWhatsApp() {
    console.log('🚀 Chat completado - processando automaticamente para WhatsApp...');
    
    // Extrair dados do usuário da sessão atual
    var sessionData = getChatSessionData();
    
    // Preparar dados para autorização WhatsApp
    var whatsappAuthData = {
      name: sessionData.name || sessionData.identification || '',
      area: sessionData.area || sessionData.area_qualification || '',
      situation: sessionData.case_details || sessionData.situation || '',
      phone: sessionData.phone || '',
      email: sessionData.email || ''
    };
    
    console.log('📋 Dados extraídos para WhatsApp:', whatsappAuthData);
    
    // Autorizar sessão WhatsApp com dados do chat completado
    // O bot enviará mensagem diretamente para o WhatsApp do usuário
    authorizeWhatsAppSession('landing_chat', whatsappAuthData);
  }

  // Obtém dados da sessão do chat
  function getChatSessionData() {
    try {
      var sessionId = getChatSessionId();
      var storedData = localStorage.getItem('chat_session_data_' + sessionId);
      return storedData ? JSON.parse(storedData) : chatState.userData;
    } catch (e) {
      return chatState.userData;
    }
  }

  // Salva dados da sessão do chat
  function saveChatSessionData(data) {
    try {
      var sessionId = getChatSessionId();
      chatState.userData = { ...chatState.userData, ...data };
      localStorage.setItem('chat_session_data_' + sessionId, JSON.stringify(chatState.userData));
    } catch (e) {
      console.warn('Não foi possível salvar dados da sessão:', e);
    }
  }

  // Gerenciamento de sessão do chat
  function setChatSessionId(id){ 
    try{ 
      localStorage.setItem('chat_session_id', id);
      chatState.sessionId = id;
    }catch(e){} 
  }
  
  function getChatSessionId(){ 
    try{ 
      return chatState.sessionId || localStorage.getItem('chat_session_id'); 
    }catch(e){ 
      return null; 
    } 
  }

  // Envio de mensagens do chat
  async function sendChatMessage(){
    var input = document.getElementById('chat-input');
    var text = (input.value || '').trim();
    if(!text) return;
    
    addChatMessage(text, 'user');
    input.value = '';

    var sessionId = getChatSessionId() || ('web_' + Date.now());
    var payload = { 
      message: text, 
      session_id: sessionId
    };

    try {
      var response = await fetch(API_BASE_URL + '/api/v1/conversation/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if(!response.ok) throw new Error('Response not ok: ' + response.status);
      
      var data = await response.json();
      
      // Atualizar session ID se necessário
      if(data.session_id) {
        setChatSessionId(data.session_id);
      }
      
      // Extrair e salvar dados do lead se disponível
      if(data.lead_data) {
        saveChatSessionData(data.lead_data);
      }
      
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
    console.log('🚀 Iniciando autorização WhatsApp...', { source, userData });
    
    // Gerar session_id único para WhatsApp
    var sessionId = 'whatsapp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // CORRIGIDO: phone_number pode ser null para fluxo landing_chat
    var phoneNumber = userData.phone || null;
    
    // Preparar dados completos para autorização
    var requestData = {
      session_id: sessionId,
      phone_number: phoneNumber,
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
      console.log('📡 Enviando autorização WhatsApp...', requestData);
      
      // CORRIGIDO: Usar endpoint correto
      var response = await fetch(API_BASE_URL + '/api/v1/whatsapp/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        var data = await response.json();
        console.log('✅ Autorização WhatsApp realizada:', data);
        
        // Abrir WhatsApp com mensagem baseada no fluxo
        var message = generateWhatsAppMessage(userData, source);
        var whatsappUrl = 'https://wa.me/' + COMMERCIAL_WHATSAPP + '?text=' + encodeURIComponent(message);
        
        console.log('📱 Abrindo WhatsApp:', whatsappUrl);
        window.open(whatsappUrl, '_blank');
        
        return true;
        
      } else {
        throw new Error('Autorização falhou: ' + response.status);
      }
      
    } catch (error) {
      console.error('❌ Erro na autorização, abrindo WhatsApp direto:', error);
      
      // Fallback: abrir WhatsApp sem autorização prévia
      var fallbackMessage = generateWhatsAppMessage(userData, source);
      var fallbackUrl = 'https://wa.me/' + COMMERCIAL_WHATSAPP + '?text=' + encodeURIComponent(fallbackMessage);
      
      console.log('📱 Fallback - Abrindo WhatsApp direto:', fallbackUrl);
      window.open(fallbackUrl, '_blank');
      
      return false;
    }
  }

  // CORRIGIDO: Gera mensagem baseada no tipo de fluxo
  function generateWhatsAppMessage(userData, source) {
    if (source === 'landing_chat' && userData.name) {
      // Fluxo: Chat completado na landing
      return `Olá! Sou ${userData.name}, completei o chat no site m.lima sobre ${userData.area || 'meu caso jurídico'} e gostaria de continuar o atendimento.`;
    } else if (source === 'floating_button') {
      // Fluxo: Botão WhatsApp direto
      return "Olá! Vim do site m.lima e gostaria de falar com um advogado.";
    } else {
      // Fallback
      return "Olá! Vim do site m.lima e preciso de orientação jurídica.";
    }
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
        
        // CORRIGIDO: Usar source correto
        authorizeWhatsAppSession('whatsapp_button', buttonConfig.userData);
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
    console.log('🎯 Fluxos: Chat completado → WhatsApp | Botão flutuante → WhatsApp');
    
    // Inicializar chat
    mountChatUI();
    initializeChatConversation();
    
    // Configurar integração WhatsApp
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
      chatState.isCompleted = false;
      chatState.userData = {};
      console.log('🧹 Sessão do chat limpa');
    },
    completeChat: function(userData) {
      console.log('🎯 Forçando conclusão do chat...');
      handleChatCompletionWhatsApp();
    },
    getChatState: function() {
      return chatState;
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
    },
    // NOVO: Teste do fluxo landing_chat
    testLandingChatFlow: function() {
      console.log('🧪 Testando fluxo landing_chat...');
      var testData = {
        name: 'João Teste',
        area: 'Direito Penal',
        situation: 'Preciso de orientação sobre processo criminal',
        phone: '11999999999',
        email: 'joao@teste.com'
      };
      authorizeWhatsAppSession('landing_chat', testData);
    }
  };

  console.log('✅ Chat.js carregado completamente!');
  console.log('💡 Use ChatWidget.* ou WhatsAppIntegration.* no console para debug');

})();