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

    // Send to backend
    sendToBackend(message);
  }

  // Send message to backend
  async function sendToBackend(message) {
    try {
      showTypingIndicator();
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Hide typing indicator
      hideTypingIndicator();
      
      // Add bot response
      if (data.message) {
        addMessage(data.message, 'bot');
      }
      
      chatState.retryCount = 0; // Reset retry count on success
      
    } catch (error) {
      console.error('Error sending message to backend:', error);
      hideTypingIndicator();
      
      // Retry logic
      if (chatState.retryCount < CONFIG.maxRetries) {
        chatState.retryCount++;
        setTimeout(() => {
          sendToBackend(message);
        }, 2000 * chatState.retryCount); // Exponential backoff
      } else {
        addMessage('Desculpe, não foi possível conectar com nosso sistema no momento. Tente novamente em alguns instantes.', 'bot');
        chatState.retryCount = 0;
      }
    }
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
    
    if (!elements.messages) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typing-indicator';
    
    typingDiv.innerHTML = `
      <img src="${CONFIG.botAvatar}" alt="bot" class="avatar" onerror="this.style.display='none'">
      <div class="typing-indicator">
        <span class="typing-text">Digitando</span>
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    
    elements.messages.appendChild(typingDiv);
    scrollToBottom();
  }

  // Hide typing indicator
  function hideTypingIndicator() {
    chatState.isTyping = false;
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) {
      typingDiv.remove();
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
    showTyping: showTypingIndicator,
    hideTyping: hideTypingIndicator,
    getHistory: () => chatState.messageHistory
  };

})();