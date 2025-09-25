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

export default new SessionManager();