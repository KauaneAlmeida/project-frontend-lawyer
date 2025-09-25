import ApiService from './api.js';

class WhatsAppIntegration {
  constructor() {
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
      
      const response = await ApiService.authorizeWhatsApp(phoneNumber, metadata);
      
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
      return await ApiService.checkWhatsAppAuth(phoneNumber);
    } catch (error) {
      console.error('Error checking WhatsApp auth status:', error);
      return null;
    }
  }

  async getStatus() {
    try {
      return await ApiService.getWhatsAppStatus();
    } catch (error) {
      console.error('Error getting WhatsApp status:', error);
      return null;
    }
  }

  showNotification(message) {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #6a00f4 0%, #8a2be2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(106, 0, 244, 0.3);
      z-index: 100000;
      font-family: 'Poppins', sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
}

export default new WhatsAppIntegration();