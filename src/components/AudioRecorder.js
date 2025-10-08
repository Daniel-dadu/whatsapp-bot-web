import React, { useState, useRef, useEffect } from 'react';
import MediaRecorder from 'opus-media-recorder';

const AudioRecorder = ({ onSend, onCancel, isVisible }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Función para formatear el tiempo en mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Función para iniciar la grabación
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // OpusMediaRecorder worker configuration
      const workerOptions = {
        encoderWorkerFactory: function () {
          return new Worker(process.env.PUBLIC_URL + '/opus-media-recorder/encoderWorker.umd.js')
        },
        OggOpusEncoderWasmPath: process.env.PUBLIC_URL + '/opus-media-recorder/OggOpusEncoder.wasm',
        WebMOpusEncoderWasmPath: process.env.PUBLIC_URL + '/opus-media-recorder/WebMOpusEncoder.wasm',
      };
      
      console.log('Worker options:', workerOptions);

      // Usar OpusMediaRecorder para garantizar formato OGG con Opus
      const options = {
        mimeType: 'audio/ogg; codecs=opus',
        audioBitsPerSecond: 128000 // 128 kbps
      };

      mediaRecorderRef.current = new MediaRecorder(stream, options, workerOptions);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        
        console.log(`✅ Audio grabado en formato OGG: ${audioBlob.type}, tamaño: ${audioBlob.size} bytes`);
        
        // Detener todas las pistas de audio
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.addEventListener('error', (event) => {
        console.error('Error en OpusMediaRecorder:', event.error);
        alert('Error al grabar audio. Inténtalo de nuevo.');
      });

      mediaRecorderRef.current.addEventListener('start', (event) => {
        console.log('OpusMediaRecorder started');
      });

      mediaRecorderRef.current.addEventListener('stop', (event) => {
        console.log('OpusMediaRecorder stopped');
      });

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Iniciar temporizador
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      alert('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  // Función para detener la grabación
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Función para cancelar la grabación
  const handleCancel = () => {
    stopRecording();
    setRecordingTime(0);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    onCancel();
  };

  // Función para enviar el audio
  const handleSend = () => {
    if (audioBlob) {
      console.log(`📤 Enviando audio OGG: ${audioBlob.type}, tamaño: ${audioBlob.size} bytes`);
      onSend(audioBlob);
      // Limpiar después de enviar
      setRecordingTime(0);
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    }
  };

  // Limpiar al desmontar el componente
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioUrl]);

  // Limpiar cuando se oculta el componente
  useEffect(() => {
    if (!isVisible) {
      handleCancel();
    }
  // eslint-disable-next-line 
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-80 max-w-sm mx-4 shadow-xl">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {isRecording ? 'Grabando audio...' : 'Audio grabado'}
          </h3>
          
          {/* Indicador de grabación */}
          <div className="mb-6">
            {isRecording ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-2xl font-mono text-red-500">
                  {formatTime(recordingTime)}
                </span>
              </div>
            ) : audioBlob ? (
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-lg font-mono text-green-500">
                  {formatTime(recordingTime)}
                </span>
              </div>
            ) : (
              <div className="text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p className="text-sm">Presiona el botón para comenzar a grabar</p>
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex space-x-3 justify-center">
            {!isRecording && !audioBlob ? (
              <button
                onClick={startRecording}
                className="bg-red-500 text-white px-6 py-3 rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Grabar</span>
              </button>
            ) : isRecording ? (
              <button
                onClick={stopRecording}
                className="bg-gray-500 text-white px-6 py-3 rounded-full hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span>Detener</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleSend}
                  className="bg-green-500 text-white px-6 py-3 rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Enviar</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-gray-500 text-white px-6 py-3 rounded-full hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancelar</span>
                </button>
              </>
            )}
          </div>

          {/* Botón de cancelar cuando está grabando */}
          {isRecording && (
            <button
              onClick={handleCancel}
              className="mt-4 text-gray-500 hover:text-gray-700 text-sm underline"
            >
              Cancelar grabación
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;