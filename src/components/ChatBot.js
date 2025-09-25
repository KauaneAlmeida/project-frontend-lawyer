import ApiService from '../services/api.js';
import SessionManager from '../services/sessionManager.js';
import WhatsAppIntegration from '../services/whatsappIntegration.js';

class ChatBot {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.isTyping = false;
    this.sessionId = null;
    this.conversationState = {
      step: 'initial', // initial, name, legal_area, situation, meeting_preference, phone_number, completed
      userData: {}
    };
    
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
      const health = await ApiService.checkHealth();
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
    const savedMessages = SessionManager.getConversation();
    const savedSessionId = SessionManager.getSessionId();
    
    if (savedMessages.length > 0) {
      this.messages = savedMessages;
      this.sessionId = savedSessionId;
      this.renderMessages();
    } else {
      this.startInitialConversation();
    }
  }

  createChatInterface() {
    // Remove existing chat if present
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
    // Chat launcher
    const launcher = document.getElementById('chat-launcher');
    if (launcher) {
      launcher.addEventListener('click', () => this.toggleChat());
    }

    // Close button
    const closeBtn = document.getElementById('chat-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeChat());
    }

    // Send button
    const sendBtn = document.getElementById('chat-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Input enter key
    const input = document.getElementById('chat-input');
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.sendMessage();
        }
      });
    }

    // WhatsApp buttons integration
    this.setupWhatsAppButtons();
  }

  setupWhatsAppButtons() {
    // Hook into existing WhatsApp floating button
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

    // Hook into other WhatsApp buttons
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
    await WhatsAppIntegration.openWhatsApp(phoneNumber, {
      source: 'floating_button',
      page: window.location.pathname,
      timestamp: new Date().toISOString()
    });
  }

  async handleWhatsApp24h() {
    const phoneNumber = this.conversationState.userData.phone || '5511999999999';
    await WhatsAppIntegration.openWhatsApp(phoneNumber, {
      source: 'whatsapp_24h_button',
      service: '24h_support',
      page: window.location.pathname,
      timestamp: new Date().toISOString()
    });
  }

  async handleTalkToSpecialist() {
    const phoneNumber = this.conversationState.userData.phone || '5511999999999';
    await WhatsAppIntegration.openWhatsApp(phoneNumber, {
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
      
      // Focus input
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
      const response = await ApiService.startConversation();
      this.sessionId = response.session_id;
      SessionManager.setSessionId(this.sessionId);
      
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
    
    // Add user message
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
      
      const response = await ApiService.sendMessage(this.sessionId, message);
      
      this.hideTyping();
      
      // Add bot response
      if (response.response) {
        this.addMessage({
          type: 'bot',
          text: response.response,
          timestamp: new Date()
        });
      }
      
      // Update conversation state
      this.updateConversationState(response);
      
      // Check if phone was collected and redirect to WhatsApp
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
    // Update user data based on response
    if (response.user_data) {
      this.conversationState.userData = { ...this.conversationState.userData, ...response.user_data };
    }
    
    // Update conversation step based on current state
    if (response.step) {
      this.conversationState.step = response.step;
    }
  }

  async handlePhoneCollected(response) {
    const phoneNumber = response.user_data?.phone || this.conversationState.userData.phone;
    
    if (phoneNumber) {
      // Show confirmation message
      this.addMessage({
        type: 'bot',
        text: 'Perfeito! Agora vou te conectar com um de nossos especialistas via WhatsApp. Você será redirecionado em instantes...',
        timestamp: new Date()
      });
      
      // Wait a bit then redirect to WhatsApp
      setTimeout(async () => {
        await WhatsAppIntegration.openWhatsApp(phoneNumber, {
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
    
    // Scroll to bottom
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
    SessionManager.saveConversation(this.messages);
  }

  async getConversationStatus() {
    if (!this.sessionId) return null;
    
    try {
      return await ApiService.getConversationStatus(this.sessionId);
    } catch (error) {
      console.error('Failed to get conversation status:', error);
      return null;
    }
  }
}

// Initialize ChatBot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.chatBot = new ChatBot();
});

export default ChatBot;