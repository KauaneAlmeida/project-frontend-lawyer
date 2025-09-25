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
          metadata: metadata,
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
    }

    async openWhatsApp(phoneNumber, metadata = {}) {
      if (this.isAuthorizing) {
        console.log('WhatsApp authorization already in progress');
        return;
      }

      this.isAuthorizing = true;

      try {
        console.log('🔗 Authorizing WhatsApp session...', { phoneNumber, metadata });
        
        const response = await this.apiService.authorizeWhatsApp(phoneNumber, metadata);
        
        if (response.whatsapp_url) {
          console.log('✅ WhatsApp URL received:', response.whatsapp_url);
          window.open(response.whatsapp_url, '_blank');
        } else if (response.message) {
          console.log('📱 WhatsApp response:', response.message);
          this.showNotification(response.message);
        }
      } catch (error) {
        console.error('❌ WhatsApp authorization failed:', error);
        this.showNotification('Erro ao conectar com WhatsApp. Tente novamente.');
      } finally {
        this.isAuthorizing = false;
      }
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
      const existingChat = document.getElementById('chat-root');
      if (existingChat) {
        existingChat.remove();
      }

      const chatHTML = `
        <div id="chat-root">
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
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', chatHTML);
    }

    setupEventListeners() {
      const launcher = document.getElementById('chat-launcher');
      if (launcher) {
        launcher.addEventListener('click', () => this.toggleChat());
      }

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

      this.setupWhatsAppButtons();
    }

    setupWhatsAppButtons() {
      setTimeout(() => {
        const whatsappButton = document.querySelector('[data-testid="floating-whatsapp-button"]');
        if (whatsappButton) {
          const newButton = whatsappButton.cloneNode(true);
          whatsappButton.parentNode.replaceChild(newButton, whatsappButton);
          
          newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleWhatsAppFloatingButton();
          });
        }
      }, 1000);

      document.addEventListener('click', (e) => {
        const target = e.target.closest('button, a');
        if (!target) return;

        const text = target.textContent?.toLowerCase() || '';
        
        if (text.includes('whatsapp 24h') || text.includes('whatsapp')) {
          e.preventDefault();
          e.stopPropagation();
          this.handleWhatsApp24h();
        } else if (text.includes('falar com especialista') || text.includes('talk to specialist')) {
          e.preventDefault();
          e.stopPropagation();
          this.handleTalkToSpecialist();
        }
      });
    }

    async handleWhatsAppFloatingButton() {
      const phoneNumber = this.conversationState.userData.phone || '5511999999999';
      await this.whatsappIntegration.openWhatsApp(phoneNumber, {
        source: 'floating_button',
        page: window.location.pathname,
        timestamp: new Date().toISOString()
      });
    }

    async handleWhatsApp24h() {
      const phoneNumber = this.conversationState.userData.phone || '5511999999999';
      await this.whatsappIntegration.openWhatsApp(phoneNumber, {
        source: 'whatsapp_24h_button',
        service: '24h_support',
        page: window.location.pathname,
        timestamp: new Date().toISOString()
      });
    }

    async handleTalkToSpecialist() {
      const phoneNumber = this.conversationState.userData.phone || '5511999999999';
      await this.whatsappIntegration.openWhatsApp(phoneNumber, {
        source: 'specialist_button',
        service: 'specialist_consultation',
        legal_area: this.conversationState.userData.legal_area,
        page: window.location.pathname,
        timestamp: new Date().toISOString()
      });
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
  }

  /**
   * Função para "plugar" no botão flutuante já existente do React
   */
  function hookExistingWhatsAppButton() {
    const button = document.querySelector('[data-testid="floating-whatsapp-button"]');
    if (!button) {
      console.warn("⚠️ Botão do WhatsApp não encontrado ainda.");
      return;
    }

    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);

    newButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log("🔥 Botão WhatsApp clicado!");
      
      if (chatBot) {
        chatBot.handleWhatsAppFloatingButton();
      }
    });

    console.log("✅ Botão WhatsApp existente reaproveitado!");
  }

  /**
   * Inicializa o chat customizado
   */
  async function initChat() {
    if (chatInitialized) return;
    chatInitialized = true;

    console.log("🚀 Inicializando integração do chat...");
    
    // Initialize ChatBot
    chatBot = new ChatBot();
    window.chatBot = chatBot;
    
    // Hook existing WhatsApp button
    hookExistingWhatsAppButton();
  }

  // Wait for DOM to be ready
  document.addEventListener("DOMContentLoaded", initChat);

  // Safety: try to run after a few seconds as well
  setTimeout(initChat, 3000);
})();