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
      // Create notification without DOM conflicts
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
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
      `;
      
      notification.textContent = message;
      
      // Safe insertion
      try {
        document.body.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
          notification.style.opacity = '1';
          notification.style.transform = 'translateX(0)';
        });
        
        // Auto remove
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transform = 'translateX(100%)';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 300);
        }, 5000);
      } catch (error) {
        console.error('Failed to show notification:', error);
      }
    }
  }

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
      this.authCooldown = 5000;
    }

    async openWhatsApp(phoneNumber, metadata = {}) {
      if (this.isAuthorizing) {
        console.log('WhatsApp authorization already in progress');
        return;
      }

      const now = Date.now();
      if (this.lastAuthAttempt && (now - this.lastAuthAttempt) < this.authCooldown) {
        console.log('WhatsApp authorization cooldown active');
        return;
      }

      this.isAuthorizing = true;
      this.lastAuthAttempt = now;

      try {
        console.log('🔗 Authorizing WhatsApp session...', { phoneNumber, metadata });
        
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
      if (window.chatBot && window.chatBot.sessionId) {
        return window.chatBot.sessionId;
      }
      
      const sessionManager = new SessionManager();
      return sessionManager.getSessionId();
    }

    showNotification(message) {
      ErrorHandler.showNotification(message, 'success');
    }
  }

  // ChatBot Class - COMPLETELY REWRITTEN TO AVOID DOM CONFLICTS
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
      this.hookedElements = new Set();
      this.chatContainerExists = false;
      
      this.init();
    }

    async init() {
      // Wait for page to be fully loaded
      await this.waitForPageLoad();
      
      // Create chat interface safely
      this.createChatInterfaceSafely();
      
      // Setup event listeners without conflicts
      this.setupEventListenersSafely();
      
      // Check API health
      await this.checkApiHealth();
      
      // Load conversation
      this.loadSavedConversation();
      
      // Hook into existing elements safely
      this.hookExistingElementsSafely();
    }

    waitForPageLoad() {
      return new Promise((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve, { once: true });
        }
      });
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

    createChatInterfaceSafely() {
      // Check if chat already exists
      if (document.getElementById('chat-root')) {
        console.log('Chat interface already exists');
        this.chatContainerExists = true;
        return;
      }

      try {
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

        // Insert safely without conflicts
        this.insertElementSafely(chatContainer);
        this.chatContainerExists = true;
        
        console.log('✅ Chat container created successfully');
      } catch (error) {
        console.error('❌ Failed to create chat container:', error);
      }
    }

    insertElementSafely(element) {
      try {
        // Use a safe insertion method that doesn't conflict with React
        const insertSafely = () => {
          try {
            // Double check element doesn't exist
            if (document.getElementById(element.id)) {
              return;
            }
            
            // Use appendChild instead of insertBefore to avoid reference issues
            document.body.appendChild(element);
            console.log(`✅ Safely inserted ${element.id}`);
          } catch (error) {
            console.error(`❌ Failed to insert ${element.id}:`, error);
          }
        };

        // Use multiple strategies to ensure insertion
        if (document.readyState === 'complete') {
          insertSafely();
        } else {
          window.addEventListener('load', insertSafely, { once: true });
        }

        // Also try with requestAnimationFrame for React compatibility
        requestAnimationFrame(insertSafely);
        
        // Fallback after a delay
        setTimeout(insertSafely, 1000);
      } catch (error) {
        console.error('❌ Error in insertElementSafely:', error);
      }
    }

    setupEventListenersSafely() {
      // Use event delegation to avoid missing elements
      document.addEventListener('click', (e) => {
        // Handle chat close button
        if (e.target && e.target.id === 'chat-close') {
          e.preventDefault();
          this.closeChat();
        }
        // Handle chat send button
        else if (e.target && e.target.id === 'chat-send') {
          e.preventDefault();
          this.sendMessage();
        }
        // Handle chat launcher - check both the container and its children
        else if (e.target && (
          e.target.id === 'chat-launcher' || 
          e.target.closest('#chat-launcher') ||
          e.target.classList.contains('chat-launcher-icon') ||
          e.target.classList.contains('chat-launcher-text')
        )) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleChat();
        }
      }, true); // Use capture phase

      document.addEventListener('keypress', (e) => {
        if (e.target.id === 'chat-input' && e.key === 'Enter') {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    hookExistingElementsSafely() {
      // Use a more gentle approach to hook existing elements
      const hookElements = () => {
        try {
          // Hook chat launcher
          const launcher = document.getElementById('chat-launcher');
          if (launcher && !this.hookedElements.has('chat-launcher')) {
            this.hookedElements.add('chat-launcher');
            
            // Add direct click handler as backup
            launcher.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🎯 Chat launcher clicked directly');
              this.toggleChat();
            });
            
            console.log('✅ Chat launcher detected');
          }

          // Hook WhatsApp buttons without DOM manipulation
          this.hookWhatsAppButtonsSafely();
        } catch (error) {
          console.error('❌ Error hooking elements:', error);
        }
      };

      // Hook immediately and periodically
      hookElements();
      setInterval(hookElements, 3000);
    }

    hookWhatsAppButtonsSafely() {
      try {
        // Use event delegation instead of direct manipulation
        document.addEventListener('click', (e) => {
          const target = e.target;
          const text = target.textContent?.toLowerCase() || '';
          
          // Check if it's a WhatsApp button
          if (target.matches('[data-testid="floating-whatsapp-button"]') || 
              text.includes('whatsapp') || 
              text.includes('falar com especialista')) {
            
            e.preventDefault();
            e.stopPropagation();
            
            // Handle different types of WhatsApp buttons
            if (target.matches('[data-testid="floating-whatsapp-button"]')) {
              this.handleWhatsAppFloatingButton();
            } else if (text.includes('whatsapp 24h')) {
              this.handleWhatsApp24h();
            } else if (text.includes('falar com especialista')) {
              this.handleTalkToSpecialist();
            } else {
              this.handleWhatsAppFloatingButton(); // Default
            }
          }
        }, true); // Use capture phase to intercept early
        
        console.log('✅ WhatsApp button event delegation setup');
      } catch (error) {
        console.error('❌ Error setting up WhatsApp button hooks:', error);
      }
    }

    async handleWhatsAppFloatingButton() {
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
      return '5511999999999';
    }

    toggleChat() {
      console.log('🔄 Toggle chat called, current state:', this.isOpen);
      if (this.isOpen) {
        this.closeChat();
      } else {
        this.openChat();
      }
    }

    openChat() {
      console.log('📂 Opening chat...');
      const chatRoot = document.getElementById('chat-root');
      if (chatRoot) {
        chatRoot.classList.add('active');
        this.isOpen = true;
        console.log('✅ Chat opened successfully');
        
        setTimeout(() => {
          const input = document.getElementById('chat-input');
          if (input) input.focus();
        }, 300);
      } else {
        console.error('❌ Chat root element not found');
        // Try to recreate the chat interface
        this.createChatInterfaceSafely();
        setTimeout(() => this.openChat(), 500);
      }
    }

    closeChat() {
      console.log('📁 Closing chat...');
      const chatRoot = document.getElementById('chat-root');
      if (chatRoot) {
        chatRoot.classList.remove('active');
        this.isOpen = false;
        console.log('✅ Chat closed successfully');
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
      if (!input) return;
      
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
      if (!messagesContainer) return;
      
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

    destroy() {
      this.hookedElements.clear();
      this.chatContainerExists = false;
      
      const chatRoot = document.getElementById('chat-root');
      if (chatRoot && chatRoot.parentNode) {
        chatRoot.parentNode.removeChild(chatRoot);
      }
    }
  }

  /**
   * Inicializa o chat de forma completamente segura
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
      // Wait a bit more for React to settle
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Initialize ChatBot
      chatBot = new ChatBot();
      window.chatBot = chatBot;
      
      console.log("✅ Chat integrado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao inicializar chat:", error);
      chatInitialized = false;
    }
  }

  // Initialize with multiple strategies
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initChat, 4000);
    });
  } else {
    setTimeout(initChat, 4000);
  }

  // Additional safety nets
  window.addEventListener('load', () => {
    setTimeout(initChat, 2000);
  });

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !chatInitialized) {
      setTimeout(initChat, 2000);
    }
  });
})();