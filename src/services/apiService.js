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

// Función para obtener contactos recientes desde el endpoint real
export const getRecentContacts = async () => {
  try {
    const endpoint = process.env.REACT_APP_GET_RECENT_LEADS_ENDPOINT;
    
    if (!endpoint) {
      console.warn('REACT_APP_GET_RECENT_LEADS_ENDPOINT no está configurado, usando datos locales');
      return getRecentContactsLocal();
    }

    console.log('📡 Obteniendo conversaciones recientes desde el backend...');
    
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
    
    console.log('✅ Conversaciones obtenidas desde el backend:', data.length, 'conversaciones');
    
    return {
      success: true,
      data: data,
      fromBackend: true
    };
  } catch (error) {
    console.error('❌ Error al obtener contactos desde backend:', error);
    return {
      success: false,
      error: 'Error al obtener contactos'
    };
  }
};

// Función auxiliar para formatear los datos del lead para mostrar en la UI
export const formatContactForUI = (lead, conversationMessages = {}) => {
  const getInitials = (name) => {
    return name ? name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') : ' ';
  };

  const getLastMessage = (lead, conversationMessages) => {
    // Verificar si ya se han cargado los mensajes de esta conversación
    const messages = conversationMessages[lead.id];
    
    if (messages && messages.length > 0) {
      // Si hay mensajes cargados, mostrar el último mensaje real
      const lastMessage = messages[messages.length - 1];
      
      // Truncar el mensaje si es muy largo
      const maxLength = 50;
      const truncatedText = lastMessage.text.length > maxLength 
        ? lastMessage.text.substring(0, maxLength) + '...'
        : lastMessage.text;
      
      // Agregar indicador de quién envió el mensaje
      const senderPrefix = lastMessage.sender === 'me' ? 'Tú: ' : '';
      
      return `${senderPrefix}${truncatedText}`;
    } else {
      // Si no se han cargado los mensajes, mostrar mensaje de invitación
      return 'Presione para visualizar...';
    }
  };

  const getTimestamp = (updatedAt) => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffInHours = Math.floor((now - updated) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Hace unos minutos';
    } else if (diffInHours < 24) {
      return `Hace ${diffInHours}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `Hace ${diffInDays}d`;
    }
  };



  return {
    id: lead.id,
    leadId: lead.lead_id,
    name: lead.state.nombre || 'Nuevo lead',
    phone: lead.state.telefono,
    lastMessage: getLastMessage(lead, conversationMessages),
    timestamp: getTimestamp(lead.updated_at),
    avatar: getInitials(lead.state.nombre),
    status: lead.state.completed ? 'completed' : 'active',
    conversationMode: lead.conversation_mode,
    completed: lead.state.completed,
    assignedAdvisor: lead.asignado_asesor,
    originalData: lead // Mantener datos originales para futuras funcionalidades
  };
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
