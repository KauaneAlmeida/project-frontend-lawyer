(function () {
  console.log("📩 Script chat.js carregado...");

  let chatInitialized = false;
  let chatBot = null;

  // API Service
  const API_BASE_URL = 'https://law-firm-backend-936902782519-936902782519.us-central1.run.app';

  class ErrorHandler {
    static handle(error, context = '') {
      console.error(`Error in ${context}:`, error);
      
      let userMessage = 'Ocorreu um erro inesperado. Tente novamente.';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        userMessage = 'Problema de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message.includes('404')) {
        userMessage = 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.';
      } else if (error.message.includes('500')) {
        userMessage = 'Erro interno do servidor. Nossa equipe foi notificada.';
      } else if (error.message.includes('timeout')) {
        userMessage = 'A requisição demorou muito para responder. Tente novamente.';
      }
      
      return userMessage;
    }
    
    static showNotification(message, type = 'error') {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ff4757' : '#2ed573'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        z-index: 100000;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
      `;
      
      notification.textContent = message;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    }
  }

  // Add CSS animations for notifications
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // API Service
  class ApiService {
    constructor() {
      this.baseURL = API_BASE_URL;
    }

    async request(endpoint, options = {}) {
      const url = `${this.baseURL}${endpoint}`;
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`API request failed: ${endpoint}`, error);
        ErrorHandler.showNotification(ErrorHandler.handle(error, `API ${endpoint}`));
        throw error;
      }
    }

    async checkHealth() {
      return this.request('/health');
    }

    async startConversation() {
      return this.request('/api/v1/conversation/start', {
        method: 'POST',
      });
    }

    async sendMessage(sessionId, message) {
      return this.request('/api/v1/conversation/respond', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          message: message,
        }),
      });
    }

    async getConversationStatus(sessionId) {
      return this.request(`/api/v1/conversation/status/${sessionId}`);
    }

    async authorizeWhatsApp(phoneNumber, metadata = {}) {
      return this.request('/api/v1/whatsapp/authorize', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: phoneNumber,
          session_id: metadata.session_id,
          user_data: metadata.user_data || {},
          source: metadata.source || 'chat',
          page: metadata.page || window.location.pathname,
          timestamp: metadata.timestamp || new Date().toISOString(),
          legal_area: metadata.legal_area || null,
          service: metadata.service || null
        }),
      });
    }

    async checkWhatsAppAuth(phoneNumber) {
      return this.request(`/api/v1/whatsapp/check-auth/${phoneNumber}`);
    }

    async getWhatsAppStatus() {
      return this.request('/api/v1/whatsapp/status');
    }
  }

  // Session Manager
  class SessionManager {
    constructor() {
      this.SESSION_KEY = 'law_firm_session_id';
      this.CONVERSATION_KEY = 'law_firm_conversation';
    }

    getSessionId() {
      return localStorage.getItem(this.SESSION_KEY);
    }

    setSessionId(sessionId) {
      localStorage.setItem(this.SESSION_KEY, sessionId);
    }

    clearSession() {
      localStorage.removeItem(this.SESSION_KEY);
      localStorage.removeItem(this.CONVERSATION_KEY);
    }

    saveConversation(messages) {
      localStorage.setItem(this.CONVERSATION_KEY, JSON.stringify(messages));
    }

    getConversation() {
      const saved = localStorage.getItem(this.CONVERSATION_KEY);
      return saved ? JSON.parse(saved) : [];
    }

    hasActiveSession() {
      return !!this.getSessionId();
    }
  }

  // WhatsApp Integration
  class WhatsAppIntegration {
    constructor(apiService) {
      this.apiService = apiService;
      this.isAuthorizing = false;
      this.lastAuthAttempt = null;
      this.authCooldown = 5000; // 5 seconds cooldown between attempts
    }

    async openWhatsApp(phoneNumber, metadata = {}) {
      if (this.isAuthorizing) {
        console.log('WhatsApp authorization already in progress');
        return;
      }

      // Prevent rapid successive calls
      const now = Date.now();
      if (this.lastAuthAttempt && (now - this.lastAuthAttempt) < this.authCooldown) {
        console.log('WhatsApp authorization cooldown active');
        return;
      }

      this.isAuthorizing = true;
      this.lastAuthAttempt = now;

      try {
        console.log('🔗 Authorizing WhatsApp session...', { phoneNumber, metadata });
        
        // Ensure we have a valid session ID
        const sessionId = this.getValidSessionId();
        if (!sessionId) {
          throw new Error('No valid session ID available');
        }

        const response = await this.apiService.authorizeWhatsApp(phoneNumber, {
          ...metadata,
          session_id: sessionId
        });
        
        if (response.whatsapp_url) {
          console.log('✅ WhatsApp URL received:', response.whatsapp_url);
          window.open(response.whatsapp_url, '_blank');
        } else if (response.message) {
          console.log('📱 WhatsApp response:', response.message);
          this.showNotification(response.message);
        }
      } catch (error) {
        console.error('❌ WhatsApp authorization failed:', error);
        this.showNotification('Erro ao conectar com WhatsApp. Tente novamente em alguns segundos.');
      } finally {
        this.isAuthorizing = false;
      }
    }

    getValidSessionId() {
      // Try to get session ID from chatBot instance or session manager
      if (window.chatBot && window.chatBot.sessionId) {
        return window.chatBot.sessionId;
      }
      
      const sessionManager = new SessionManager();
      return sessionManager.getSessionId();
    }

    async checkAuthStatus(phoneNumber) {
      try {
        return await this.apiService.checkWhatsAppAuth(phoneNumber);
      } catch (error) {
        console.error('Error checking WhatsApp auth status:', error);
        return null;
      }
    }

    async getStatus() {
      try {
        return await this.apiService.getWhatsAppStatus();
      } catch (error) {
        console.error('Error getting WhatsApp status:', error);
        return null;
      }
    }

    showNotification(message) {
      ErrorHandler.showNotification(message, 'success');
    }
  }

  // ChatBot Class
  class ChatBot {
    constructor() {
      this.isOpen = false;
      this.messages = [];
      this.isTyping = false;
      this.sessionId = null;
      this.conversationState = {
        step: 'initial',
        userData: {}
      };
      
      this.apiService = new ApiService();
      this.sessionManager = new SessionManager();
      this.whatsappIntegration = new WhatsAppIntegration(this.apiService);
      this.hookedElements = new Set(); // Track hooked elements to prevent duplicates
      this.domObserver = null; // MutationObserver for DOM changes
      this.chatContainerCreated = false; // Track if chat container exists
      
      this.init();
    }

    async init() {
      this.createChatInterface();
      this.setupEventListeners();
      await this.checkApiHealth();
      this.loadSavedConversation();
    }

    async checkApiHealth() {
      try {
        const health = await this.apiService.checkHealth();
        console.log('✅ API Health Check:', health);
      } catch (error) {
        console.warn('⚠️ API Health Check failed:', error);
        this.showErrorFallback();
      }
    }

    showErrorFallback() {
      const fallbackMessage = {
        type: 'bot',
        text: 'Nosso sistema está temporariamente indisponível. Por favor, entre em contato diretamente pelo WhatsApp ou tente novamente em alguns minutos.',
        timestamp: new Date()
      };
      this.addMessage(fallbackMessage);
    }

    loadSavedConversation() {
      const savedMessages = this.sessionManager.getConversation();
      const savedSessionId = this.sessionManager.getSessionId();
      
      if (savedMessages.length > 0) {
        this.messages = savedMessages;
        this.sessionId = savedSessionId;
        this.renderMessages();
      } else {
        this.startInitialConversation();
      }
    }

    createChatInterface() {
      // Prevent multiple chat containers
      if (this.chatContainerCreated) {
        const existingChat = document.getElementById('chat-root');
        if (existingChat) {
          return; // Chat already exists, don't create another
        }
        this.chatContainerCreated = false; // Reset flag if element was removed
      }

      try {
        // Create chat container safely
        const chatContainer = document.createElement('div');
        chatContainer.id = 'chat-root';
        chatContainer.innerHTML = `
          <div class="chat-container">
            <div class="chat-header">
              <span>Assistente Jurídico</span>
              <button class="chat-close-btn" id="chat-close">×</button>
            </div>
            <div class="messages" id="chat-messages"></div>
            <div class="input-area">
              <input type="text" id="chat-input" placeholder="Digite sua mensagem..." />
              <button id="chat-send">Enviar</button>
            </div>
          </div>
        `;

        // Use safe DOM insertion
        this.safeAppendToBody(chatContainer);
        this.chatContainerCreated = true;
        
        console.log('✅ Chat container created successfully');
      } catch (error) {
        console.error('❌ Failed to create chat container:', error);
      }
    }

    safeAppendToBody(element) {
      // Wait for React to finish rendering before inserting
      const insertElement = () => {
        try {
          // Check if element already exists
          if (document.getElementById(element.id)) {
            console.log(`Element ${element.id} already exists, skipping insertion`);
            return;
          }

          // Use requestAnimationFrame to ensure DOM is stable
          requestAnimationFrame(() => {
            try {
              // Double-check the element doesn't exist after RAF
              if (!document.getElementById(element.id)) {
                document.body.appendChild(element);
                console.log(`✅ Successfully appended ${element.id} to body`);
              }
            } catch (error) {
              console.error(`❌ Failed to append ${element.id}:`, error);
              // Fallback: try again after a short delay
              setTimeout(() => {
                try {
                  if (!document.getElementById(element.id)) {
                    document.body.appendChild(element);
                  }
                } catch (retryError) {
                  console.error(`❌ Retry failed for ${element.id}:`, retryError);
                }
              }, 100);
            }
          });
        } catch (error) {
          console.error('❌ Error in insertElement:', error);
        }
      };

      // If DOM is ready, insert immediately, otherwise wait
      if (document.readyState === 'complete') {
        insertElement();
      } else {
        window.addEventListener('load', insertElement, { once: true });
      }
    }

    setupEventListeners() {
      // Wait for React to render, then hook into existing elements
      this.waitForReactElements();

      const closeBtn = document.getElementById('chat-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeChat());
      }

      const sendBtn = document.getElementById('chat-send');
      if (sendBtn) {
        sendBtn.addEventListener('click', () => this.sendMessage());
      }

      const input = document.getElementById('chat-input');
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.sendMessage();
          }
        });
      }
    }

    waitForReactElements() {
      // Use MutationObserver for more efficient DOM monitoring
      if (this.domObserver) {
        this.domObserver.disconnect();
      }

      this.domObserver = new MutationObserver((mutations) => {
        let shouldCheck = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            shouldCheck = true;
          }
        });
        
        if (shouldCheck) {
          // Debounce the check to avoid excessive calls
          clearTimeout(this.checkTimeout);
          this.checkTimeout = setTimeout(() => {
            this.checkForElements();
          }, 500);
        }
      });

      // Start observing
      this.domObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Initial check
      this.checkForElements();
      
      // Fallback periodic check (less frequent)
      this.elementCheckInterval = setInterval(() => {
        this.checkForElements();
      }, 5000);
    }

    checkForElements() {
      try {
        // Hook into chat launcher (our custom element)
        const launcher = document.getElementById('chat-launcher');
        if (launcher && !this.hookedElements.has('chat-launcher')) {
          this.hookedElements.add('chat-launcher');
          launcher.setAttribute('data-hooked', 'true');
          launcher.addEventListener('click', () => this.toggleChat());
          console.log('✅ Hooked chat launcher');
        }

        // Hook into existing WhatsApp buttons from React
        this.hookExistingWhatsAppButtons();
      } catch (error) {
        console.error('❌ Error checking for elements:', error);
      }
    }

    hookExistingWhatsAppButtons() {
      try {
        // Hook into React's floating WhatsApp button
        const floatingButtons = document.querySelectorAll('[data-testid="floating-whatsapp-button"]');
        
        // Remove duplicates if they exist
        if (floatingButtons.length > 1) {
          console.log(`🔧 Removing ${floatingButtons.length - 1} duplicate WhatsApp buttons`);
          for (let i = 1; i < floatingButtons.length; i++) {
            this.safeRemoveElement(floatingButtons[i]);
          }
        }
        
        const floatingButton = floatingButtons[0];
        if (floatingButton && !this.hookedElements.has('floating-whatsapp-button')) {
          this.hookedElements.add('floating-whatsapp-button');
          
          // Safely replace the button to remove existing event listeners
          this.safeReplaceElement(floatingButton, (newButton) => {
            newButton.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.handleWhatsAppFloatingButton();
            });
          });
          
          console.log('✅ Hooked into React WhatsApp floating button');
        }

        // Hook into other WhatsApp buttons by text content
        const buttons = document.querySelectorAll('button, a');
        buttons.forEach(button => {
          const buttonId = button.id || button.textContent?.trim() || Math.random().toString(36);
          if (this.hookedElements.has(buttonId)) return;
          
          const text = button.textContent?.toLowerCase() || '';
          
          if (text.includes('whatsapp 24h') || text.includes('whatsapp')) {
            this.hookedElements.add(buttonId);
            button.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.handleWhatsApp24h();
            });
          } else if (text.includes('falar com especialista') || text.includes('talk to specialist')) {
            this.hookedElements.add(buttonId);
            button.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.handleTalkToSpecialist();
            });
          }
        });
      } catch (error) {
        console.error('❌ Error hooking WhatsApp buttons:', error);
      }
    }

    safeRemoveElement(element) {
      try {
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      } catch (error) {
        console.error('❌ Error removing element:', error);
      }
    }

    safeReplaceElement(oldElement, setupCallback) {
      try {
        if (!oldElement || !oldElement.parentNode) {
          console.warn('⚠️ Cannot replace element: invalid element or no parent');
          return;
        }

        const parent = oldElement.parentNode;
        const newElement = oldElement.cloneNode(true);
        
        // Setup the new element
        if (setupCallback) {
          setupCallback(newElement);
        }
        
        // Use replaceChild instead of insertBefore to avoid reference issues
        parent.replaceChild(newElement, oldElement);
        
      } catch (error) {
        console.error('❌ Error replacing element:', error);
        // Fallback: just add event listener to existing element
        if (setupCallback && oldElement) {
          try {
            setupCallback(oldElement);
          } catch (fallbackError) {
            console.error('❌ Fallback setup failed:', fallbackError);
          }
        }
      }
    }

    async handleWhatsAppFloatingButton() {
      // Ensure we have a session before attempting WhatsApp integration
      if (!this.sessionId) {
        await this.startInitialConversation();
      }
      
      const phoneNumber = this.conversationState.userData.phone || this.getDefaultPhoneNumber();
      await this.whatsappIntegration.openWhatsApp(phoneNumber, {
        source: 'floating_button',
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
        user_data: this.conversationState.userData,
        session_id: this.sessionId
      });
    }

    async handleWhatsApp24h() {
      if (!this.sessionId) {
        await this.startInitialConversation();
      }
      
      const phoneNumber = this.conversationState.userData.phone || this.getDefaultPhoneNumber();
      await this.whatsappIntegration.openWhatsApp(phoneNumber, {
        source: 'whatsapp_24h_button',
        service: '24h_support',
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
        user_data: this.conversationState.userData,
        session_id: this.sessionId
      });
    }

    async handleTalkToSpecialist() {
      if (!this.sessionId) {
        await this.startInitialConversation();
      }
      
      const phoneNumber = this.conversationState.userData.phone || this.getDefaultPhoneNumber();
      await this.whatsappIntegration.openWhatsApp(phoneNumber, {
        source: 'specialist_button',
        service: 'specialist_consultation',
        legal_area: this.conversationState.userData.legal_area,
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
        user_data: this.conversationState.userData,
        session_id: this.sessionId
      });
    }

    getDefaultPhoneNumber() {
      // Return a default phone number - this should be configured based on your business
      return '5511999999999'; // Replace with your actual WhatsApp business number
    }

    toggleChat() {
      if (this.isOpen) {
        this.closeChat();
      } else {
        this.openChat();
      }
    }

    openChat() {
      const chatRoot = document.getElementById('chat-root');
      if (chatRoot) {
        chatRoot.classList.add('active');
        this.isOpen = true;
        
        setTimeout(() => {
          const input = document.getElementById('chat-input');
          if (input) input.focus();
        }, 300);
      }
    }

    closeChat() {
      const chatRoot = document.getElementById('chat-root');
      if (chatRoot) {
        chatRoot.classList.remove('active');
        this.isOpen = false;
      }
    }

    async startInitialConversation() {
      try {
        const response = await this.apiService.startConversation();
        this.sessionId = response.session_id;
        this.sessionManager.setSessionId(this.sessionId);
        
        const welcomeMessage = {
          type: 'bot',
          text: response.response || 'Olá! Sou seu assistente jurídico. Vou te ajudar a encontrar o advogado ideal para seu caso. Para começar, qual é o seu nome?',
          timestamp: new Date()
        };
        
        this.addMessage(welcomeMessage);
        this.conversationState.step = 'name';
      } catch (error) {
        console.error('Failed to start conversation:', error);
        this.showErrorFallback();
      }
    }

    async sendMessage() {
      const input = document.getElementById('chat-input');
      const message = input.value.trim();
      
      if (!message || this.isTyping) return;
      
      this.addMessage({
        type: 'user',
        text: message,
        timestamp: new Date()
      });
      
      input.value = '';
      this.showTyping();
      
      try {
        if (!this.sessionId) {
          await this.startInitialConversation();
          return;
        }
        
        const response = await this.apiService.sendMessage(this.sessionId, message);
        
        this.hideTyping();
        
        if (response.response) {
          this.addMessage({
            type: 'bot',
            text: response.response,
            timestamp: new Date()
          });
        }
        
        this.updateConversationState(response);
        
        if (response.phone_collected) {
          setTimeout(() => {
            this.handlePhoneCollected(response);
          }, 1000);
        }
        
      } catch (error) {
        console.error('Failed to send message:', error);
        this.hideTyping();
        this.addMessage({
          type: 'bot',
          text: 'Desculpe, ocorreu um erro. Tente novamente ou entre em contato diretamente pelo WhatsApp.',
          timestamp: new Date()
        });
      }
    }

    updateConversationState(response) {
      if (response.user_data) {
        this.conversationState.userData = { ...this.conversationState.userData, ...response.user_data };
      }
      
      if (response.step) {
        this.conversationState.step = response.step;
      }
    }

    async handlePhoneCollected(response) {
      const phoneNumber = response.user_data?.phone || this.conversationState.userData.phone;
      
      if (phoneNumber) {
        this.addMessage({
          type: 'bot',
          text: 'Perfeito! Agora vou te conectar com um de nossos especialistas via WhatsApp. Você será redirecionado em instantes...',
          timestamp: new Date()
        });
        
        setTimeout(async () => {
          await this.whatsappIntegration.openWhatsApp(phoneNumber, {
            source: 'chat_completion',
            user_data: this.conversationState.userData,
            session_id: this.sessionId,
            timestamp: new Date().toISOString()
          });
        }, 2000);
      }
    }

    addMessage(message) {
      this.messages.push(message);
      this.renderMessages();
      this.saveConversation();
    }

    renderMessages() {
      const messagesContainer = document.getElementById('chat-messages');
      if (!messagesContainer) return;
      
      messagesContainer.innerHTML = '';
      
      this.messages.forEach(message => {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.type}`;
        
        const avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.src = message.type === 'user' ? './assets/user.png' : './assets/bot.png';
        avatar.alt = message.type === 'user' ? 'Usuário' : 'Assistente';
        
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = message.text;
        
        if (message.type === 'user') {
          messageEl.appendChild(bubble);
          messageEl.appendChild(avatar);
        } else {
          messageEl.appendChild(avatar);
          messageEl.appendChild(bubble);
        }
        
        messagesContainer.appendChild(messageEl);
      });
      
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTyping() {
      if (this.isTyping) return;
      
      this.isTyping = true;
      const messagesContainer = document.getElementById('chat-messages');
      
      const typingEl = document.createElement('div');
      typingEl.className = 'message bot typing-message';
      typingEl.innerHTML = `
        <img class="avatar" src="./assets/bot.png" alt="Assistente" />
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;
      
      messagesContainer.appendChild(typingEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTyping() {
      this.isTyping = false;
      const typingMessage = document.querySelector('.typing-message');
      if (typingMessage) {
        typingMessage.remove();
      }
    }

    saveConversation() {
      this.sessionManager.saveConversation(this.messages);
    }

    async getConversationStatus() {
      if (!this.sessionId) return null;
      
      try {
        return await this.apiService.getConversationStatus(this.sessionId);
      } catch (error) {
        console.error('Failed to get conversation status:', error);
        return null;
      }
    }

    // Cleanup method to prevent memory leaks
    destroy() {
      if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
      }
      
      if (this.elementCheckInterval) {
        clearInterval(this.elementCheckInterval);
      }
      
      if (this.checkTimeout) {
        clearTimeout(this.checkTimeout);
      }
      
      this.hookedElements.clear();
      this.chatContainerCreated = false;
      
      // Remove chat container if it exists
      const chatRoot = document.getElementById('chat-root');
      if (chatRoot) {
        this.safeRemoveElement(chatRoot);
      }
    }
  }

  /**
   * Inicializa o chat customizado de forma estratégica
   */
  async function initChat() {
    if (chatInitialized) return;
    chatInitialized = true;

    console.log("🚀 Inicializando integração do chat...");
    
    // Clean up any existing chat instance
    if (window.chatBot && typeof window.chatBot.destroy === 'function') {
      window.chatBot.destroy();
    }
    
    try {
      // Initialize ChatBot
      chatBot = new ChatBot();
      window.chatBot = chatBot;
      
      console.log("✅ Chat integrado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao inicializar chat:", error);
      chatInitialized = false; // Reset flag to allow retry
    }
  }

  // Wait for DOM and React to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initChat, 2000); // Give React more time to render
    });
  } else {
    setTimeout(initChat, 2000); // Give React more time to render
  }

  // Safety: try to run after a few more seconds as well
  setTimeout(initChat, 5000);
  
  // Handle page visibility changes to reinitialize if needed
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !chatInitialized) {
      setTimeout(initChat, 1000);
    }
  });
})();