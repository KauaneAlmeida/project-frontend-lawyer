const API_BASE_URL = 'https://law-firm-backend-936902782519-936902782519.us-central1.run.app';
import ErrorHandler from '../utils/errorHandler.js';

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

  // Health check
  async checkHealth() {
    return this.request('/health');
  }

  // Conversation endpoints
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

  // WhatsApp endpoints
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

export default new ApiService();