// Chat Widget JavaScript
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    botName: 'Assistente Jurídico',
    welcomeMessage: 'Olá! Sou seu assistente jurídico. Como posso ajudá-lo hoje?',
    botAvatar: './assets/bot.png',
    userAvatar: './assets/user.png',
    typingDelay: 1000,
    maxRetries: 3
  };

  // State management
  let chatState = {
    isOpen: false,
    isTyping: false,
    messageHistory: [],
    retryCount: 0
  };

  // DOM elements - usar os elementos que já existem
  let elements = {};

  // Initialize chat widget
  function initChat() {
    // Buscar elementos existentes no DOM
    elements = {
      launcher: document.getElementById('chat-launcher'),
      chatRoot: document.getElementById('chat-root'),
      closeBtn: document.querySelector('.chat-close-btn'),
      messages: document.getElementById('chat-messages'),
      input: document.getElementById('chat-input'),
      sendBtn: document.getElementById('chat-send')
    };

    // Se os elementos não existirem, criar apenas o necessário
    if (!elements.chatRoot) {
      createChatElements();
    }

    bindEvents();
    showWelcomeMessage();
  }

  // Create chat DOM structure apenas se não existir
  function createChatElements() {
    const chatRoot = document.createElement('div');
    chatRoot.id = 'chat-root';
    chatRoot.innerHTML = `
      <div class="chat-container">
        <div class="chat-header">
          ${CONFIG.botName}
          <button class="chat-close-btn" aria-label="Fechar chat">×</button>
        </div>
        <div class="messages" id="chat-messages"></div>
        <div class="input-area">
          <input type="text" id="chat-input" placeholder="Digite sua mensagem..." maxlength="500">
          <button id="chat-send" aria-label="Enviar mensagem">Enviar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(chatRoot);

    // Atualizar referências dos elementos
    elements.chatRoot = chatRoot;
    elements.closeBtn = chatRoot.querySelector('.chat-close-btn');
    elements.messages = document.getElementById('chat-messages');
    elements.input = document.getElementById('chat-input');
    elements.sendBtn = document.getElementById('chat-send');
  }

  // Bind event listeners
  function bindEvents() {
    // Launcher click
    if (elements.launcher) {
      elements.launcher.addEventListener('click', toggleChat);
    }
    
    // Close button
    if (elements.closeBtn) {
      elements.closeBtn.addEventListener('click', closeChat);
    }
    
    // Send button
    if (elements.sendBtn) {
      elements.sendBtn.addEventListener('click', handleSendMessage);
    }
    
    // Enter key in input
    if (elements.input) {
      elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      });
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chatState.isOpen) {
        closeChat();
      }
    });
  }

  // Toggle chat visibility
  function toggleChat() {
    if (chatState.isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  // Open chat
  function openChat() {
    chatState.isOpen = true;
    if (elements.chatRoot) {
      elements.chatRoot.classList.add('active');
    }
    if (elements.input) {
      elements.input.focus();
    }
    
    // Hide launcher
    if (elements.launcher) {
      elements.launcher.style.display = 'none';
    }
  }

  // Close chat
  function closeChat() {
    chatState.isOpen = false;
    if (elements.chatRoot) {
      elements.chatRoot.classList.remove('active');
    }
    
    // Show launcher
    if (elements.launcher) {
      elements.launcher.style.display = 'flex';
    }
  }

  // Show welcome message
  function showWelcomeMessage() {
    setTimeout(() => {
      addMessage(CONFIG.welcomeMessage, 'bot');
    }, 500);
  }

  // Handle send message
  function handleSendMessage() {
    if (!elements.input) return;
    
    const message = elements.input.value.trim();
    if (!message || chatState.isTyping) return;

    // Add user message
    addMessage(message, 'user');
    elements.input.value = '';

    // Show typing indicator and respond
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      handleBotResponse(message);
    }, CONFIG.typingDelay);
  }

  // Add message to chat
  function addMessage(text, sender, isTyping = false) {
    if (!elements.messages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}${isTyping ? ' typing' : ''}`;
    
    const avatar = sender === 'bot' ? CONFIG.botAvatar : CONFIG.userAvatar;
    const bubbleClass = isTyping ? 'bubble typing' : 'bubble';
    
    messageDiv.innerHTML = `
      ${sender === 'bot' ? `<img src="${avatar}" alt="${sender}" class="avatar" onerror="this.style.display='none'">` : ''}
      <div class="${bubbleClass}">${text}</div>
      ${sender === 'user' ? `<img src="${avatar}" alt="${sender}" class="avatar" onerror="this.style.display='none'">` : ''}
    `;

    elements.messages.appendChild(messageDiv);
    scrollToBottom();

    // Store in history
    if (!isTyping) {
      chatState.messageHistory.push({ text, sender, timestamp: Date.now() });
    }

    return messageDiv;
  }

  // Show typing indicator
  function showTypingIndicator() {
    chatState.isTyping = true;
    const typingDiv = addMessage(
      '<div class="typing-indicator">Digitando<span></span><span></span><span></span></div>', 
      'bot', 
      true
    );
    if (typingDiv) {
      typingDiv.id = 'typing-indicator';
    }
  }

  // Hide typing indicator
  function hideTypingIndicator() {
    chatState.isTyping = false;
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) {
      typingDiv.remove();
    }
  }

  // Handle bot response
  function handleBotResponse(userMessage) {
    const response = generateBotResponse(userMessage);
    addMessage(response, 'bot');
  }

  // Generate bot response
  function generateBotResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Legal keywords and responses
    const responses = {
      // Greetings
      'oi': 'Olá! Como posso ajudá-lo com questões jurídicas hoje?',
      'olá': 'Oi! Estou aqui para ajudar com suas dúvidas jurídicas.',
      'bom dia': 'Bom dia! Em que posso auxiliá-lo?',
      'boa tarde': 'Boa tarde! Como posso ajudar?',
      'boa noite': 'Boa noite! Estou aqui para esclarecer suas dúvidas jurídicas.',
      
      // Legal areas
      'trabalhista': 'Questões trabalhistas são nossa especialidade! Posso conectá-lo com um advogado especializado em direito do trabalho. Qual é sua situação específica?',
      'penal': 'Para questões de direito penal, temos advogados experientes. Você precisa de defesa criminal ou tem dúvidas sobre um processo?',
      'civil': 'Direito civil abrange muitas áreas. Você tem questões sobre contratos, família, sucessões ou responsabilidade civil?',
      'previdenciário': 'Posso ajudar com questões previdenciárias. Você precisa de auxílio com aposentadoria, benefícios ou revisão do INSS?',
      
      // Common legal issues
      'demissão': 'Questões sobre demissão são comuns. Você foi demitido sem justa causa? Recebeu todas as verbas rescisórias? Posso conectá-lo com um especialista.',
      'acidente': 'Acidentes podem gerar direitos a indenização. Foi acidente de trabalho, trânsito ou outro tipo? Vou direcioná-lo ao advogado adequado.',
      'divórcio': 'Para questões de divórcio, temos advogados especializados em direito de família. É consensual ou litigioso?',
      'herança': 'Questões sucessórias podem ser complexas. Você é herdeiro, inventariante ou tem dúvidas sobre testamento?',
      
      // Default responses
      'default': [
        'Entendo sua preocupação. Para melhor atendê-lo, vou conectá-lo com um de nossos advogados especialistas.',
        'Essa é uma questão importante. Nossos advogados podem orientá-lo adequadamente. Vou direcioná-lo agora.',
        'Para dar a melhor orientação jurídica, preciso conectá-lo com um especialista. Um momento, por favor.',
        'Sua situação merece atenção especializada. Vou encaminhá-lo para um advogado que pode ajudá-lo melhor.'
      ]
    };

    // Check for specific keywords
    for (const [keyword, response] of Object.entries(responses)) {
      if (keyword !== 'default' && lowerMessage.includes(keyword)) {
        return response;
      }
    }

    // Return random default response
    const defaultResponses = responses.default;
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  }

  // Scroll to bottom of messages
  function scrollToBottom() {
    if (elements.messages) {
      elements.messages.scrollTop = elements.messages.scrollHeight;
    }
  }

  // Error handling
  function handleError(error) {
    console.error('Chat Error:', error);
    addMessage('Desculpe, ocorreu um erro. Tente novamente em alguns instantes.', 'bot');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
  } else {
    initChat();
  }

  // Expose public API
  window.ChatWidget = {
    open: openChat,
    close: closeChat,
    toggle: toggleChat,
    addMessage: addMessage,
    getHistory: () => chatState.messageHistory
  };

})();