/**
 * Servicio para manejar archivos de audio de WhatsApp
 * Obtiene archivos de audio desde la API de WhatsApp Business
 */

/**
 * Obtiene la información del archivo multimedia desde WhatsApp API
 * @param {string} multimediaId - ID del archivo multimedia
 * @returns {Promise<Object>} - Información del archivo multimedia
 */
export const getWhatsAppMediaInfo = async (multimediaId) => {
  try {
    const token = process.env.REACT_APP_WHATSAPP_TOKEN;
    
    if (!token) {
      throw new Error('REACT_APP_WHATSAPP_TOKEN no está configurado');
    }

    const response = await fetch(`https://graph.facebook.com/v23.0/${multimediaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error al obtener información del archivo multimedia:', error);
    return {
      success: false,
      error: error.message || 'Error al obtener información del archivo multimedia'
    };
  }
};

/**
 * Obtiene el archivo de audio desde WhatsApp API
 * @param {string} mediaUrl - URL del archivo multimedia
 * @returns {Promise<Blob>} - Archivo de audio como Blob
 */
export const getWhatsAppAudioFile = async (mediaUrl) => {
  try {
    const token = process.env.REACT_APP_WHATSAPP_TOKEN;
    
    if (!token) {
      throw new Error('REACT_APP_WHATSAPP_TOKEN no está configurado');
    }

    const response = await fetch(mediaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    
    return {
      success: true,
      data: audioBlob
    };
  } catch (error) {
    console.error('Error al obtener archivo de audio:', error);
    return {
      success: false,
      error: error.message || 'Error al obtener archivo de audio'
    };
  }
};

/**
 * Obtiene un archivo de audio completo (información + archivo)
 * @param {string} multimediaId - ID del archivo multimedia
 * @returns {Promise<Object>} - Archivo de audio con URL para reproducción
 */
export const getWhatsAppAudio = async (multimediaId) => {
  try {
    // Primero obtener la información del archivo
    const mediaInfoResult = await getWhatsAppMediaInfo(multimediaId);
    
    if (!mediaInfoResult.success) {
      return mediaInfoResult;
    }

    const mediaInfo = mediaInfoResult.data;
    
    // Verificar que sea un archivo de audio
    if (!mediaInfo.mime_type || !mediaInfo.mime_type.startsWith('audio/')) {
      return {
        success: false,
        error: 'El archivo no es de tipo audio'
      };
    }

    // Obtener el archivo de audio
    const audioResult = await getWhatsAppAudioFile(mediaInfo.url);
    
    if (!audioResult.success) {
      return audioResult;
    }

    // Crear URL del objeto para reproducción
    const audioUrl = URL.createObjectURL(audioResult.data);
    
    return {
      success: true,
      data: {
        url: audioUrl,
        mimeType: mediaInfo.mime_type,
        fileSize: mediaInfo.file_size,
        duration: null, // Se puede calcular después si es necesario
        blob: audioResult.data
      }
    };
  } catch (error) {
    console.error('Error al obtener archivo de audio completo:', error);
    return {
      success: false,
      error: error.message || 'Error al obtener archivo de audio'
    };
  }
};

/**
 * Limpia las URLs de objetos creadas para liberar memoria
 * @param {string} audioUrl - URL del objeto a limpiar
 */
export const cleanupAudioUrl = (audioUrl) => {
  if (audioUrl && audioUrl.startsWith('blob:')) {
    URL.revokeObjectURL(audioUrl);
  }
};

/**
 * Formatea el tamaño del archivo en formato legible
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} - Tamaño formateado
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Formatea la duración del audio en formato legible
 * @param {number} seconds - Duración en segundos
 * @returns {string} - Duración formateada (mm:ss)
 */
export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
