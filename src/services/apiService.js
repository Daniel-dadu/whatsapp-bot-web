// Función utilitaria para obtener headers de autenticación
const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Función para manejar respuestas y detectar tokens expirados
const handleAuthResponse = async (response) => {
  if (response.status === 401) {
    // Token expirado o inválido, limpiar datos de autenticación
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_in');
    
    // Recargar la página para forzar re-login
    window.location.reload();
    return null;
  }
  
  return response;
};

// Función para iniciar sesión usando el endpoint real
export const loginRequest = async (username, password) => {
  try {
    const endpoint = process.env.REACT_APP_LOGIN_ENDPOINT;
    
    if (!endpoint) {
      throw new Error('REACT_APP_LOGIN_ENDPOINT no está configurado');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, password })
    });

    return response;
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    return {
      success: false,
      error: 'Error al iniciar sesión'
    };
  }
};

// Función para obtener contactos recientes desde el endpoint real
export const getRecentContacts = async () => {
  try {
    const endpoint = process.env.REACT_APP_GET_RECENT_LEADS_ENDPOINT;
    
    if (!endpoint) {
      console.warn('REACT_APP_GET_RECENT_LEADS_ENDPOINT no está configurado');
      return {
        success: false,
        error: 'Error al obtener contactos'
      };
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    const authResponse = await handleAuthResponse(response);
    if (!authResponse) return { success: false, error: 'Token expirado' };

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('❌ Error al obtener contactos desde backend:', error);
    return {
      success: false,
      error: 'Error al obtener contactos'
    };
  }
};

// Función para obtener la conversación completa desde el endpoint real
export const getConversation = async (waId) => {
  try {
    const endpoint = process.env.REACT_APP_GET_CONVERSATION_ENDPOINT;
    
    if (!endpoint) {
      throw new Error('REACT_APP_GET_CONVERSATION_ENDPOINT no está configurado');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        wa_id: waId
      })
    });

    const authResponse = await handleAuthResponse(response);
    if (!authResponse) return { success: false, error: 'Token expirado' };

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error al obtener conversación:', error);
    return {
      success: false,
      error: error.message || 'Error al obtener la conversación'
    };
  }
};

// Función para enviar mensaje del agente usando el endpoint real
export const sendAgentMessage = async (waId, message) => {
  try {
    const endpoint = process.env.REACT_APP_SEND_AGENT_MESSAGE_ENDPOINT;
    
    if (!endpoint) {
      throw new Error('REACT_APP_SEND_AGENT_MESSAGE_ENDPOINT no está configurado');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        wa_id: waId,
        message: message
      })
    });

    const authResponse = await handleAuthResponse(response);
    if (!authResponse) return { success: false, error: 'Token expirado' };

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error al enviar mensaje del agente:', error);
    return {
      success: false,
      error: error.message || 'Error al enviar el mensaje'
    };
  }
};

// Función para cambiar el modo de conversación usando el endpoint real
export const changeConversationMode = async (waId, mode) => {
  try {
    const endpoint = process.env.REACT_APP_CONVERSATION_MODE_ENDPOINT;
    
    if (!endpoint) {
      throw new Error('REACT_APP_CONVERSATION_MODE_ENDPOINT no está configurado');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        wa_id: waId,
        mode: mode
      })
    });

    const authResponse = await handleAuthResponse(response);
    if (!authResponse) return { success: false, error: 'Token expirado' };

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error al cambiar modo de conversación:', error);
    return {
      success: false,
      error: error.message || 'Error al cambiar el modo de conversación'
    };
  }
};

// Función para obtener mensajes recientes usando el endpoint de polling
export const getRecentMessages = async (waId, lastMessageId = null) => {
  try {
    const endpoint = process.env.REACT_APP_GET_RECENT_MESSAGES_ENDPOINT;
    
    if (!endpoint) {
      throw new Error('REACT_APP_GET_RECENT_MESSAGES_ENDPOINT no está configurado');
    }

    const body = { wa_id: waId };
    if (lastMessageId) {
      body.last_message_id = lastMessageId;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });

    // Para polling, manejar errores de autenticación sin recargar la página
    if (response.status === 401) {
      return { success: false, error: 'Token expirado' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error al obtener mensajes recientes:', error);
    return {
      success: false,
      error: error.message || 'Error al obtener mensajes recientes'
    };
  }
};

// Función para obtener contactos siguientes a partir de los IDs de las conversaciones actuales
export const getNextContacts = async (currentConversationIds) => {
  try {
    const endpoint = process.env.REACT_APP_NEXT_CONVERSATIONS_ENDPOINT;

    if (!endpoint) {
      throw new Error('REACT_APP_NEXT_CONVERSATIONS_ENDPOINT no está configurado');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        conversation_ids: currentConversationIds
      })
    });

    const authResponse = await handleAuthResponse(response);
    if (!authResponse) return { success: false, error: 'Token expirado' };

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error al obtener contactos siguientes:', error);
    return {
      success: false,
      error: error.message || 'Error al obtener contactos siguientes'
    };
  }
};