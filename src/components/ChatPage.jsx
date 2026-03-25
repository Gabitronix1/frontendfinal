import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserCircle, FaTree, FaTrashAlt, FaFolder, FaTimes, FaPlus } from 'react-icons/fa';
import ChartFromSQL from '../components/ChartFromSQL';
import ChartInline from '../components/ChartInline';

// 🌐 ENDPOINT DEL AGENTE
const WEBHOOK_URL =
  'https://n8n-production-993e.up.railway.app/webhook-test/01103618-3424-4455-bde6-aa8d295157b2';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [frequentQuestions, setFrequentQuestions] = useState([]);
  const chatEndRef = useRef(null);

  // 🆕 Estados para el selector de categorías
  const [categories, setCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [currentChartToSave, setCurrentChartToSave] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: '📊',
    description: '',
    color: '#3B82F6'
  });

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /* --------------------------------------------------
   *  🔄  INIT – SESSION ID & PREGUNTAS FRECUENTES
   * -------------------------------------------------- */
  useEffect(() => {
    if (!sessionStorage.getItem('sessionId')) {
      sessionStorage.setItem('sessionId', crypto.randomUUID());
    }
  }, []);

  useEffect(scrollToBottom, [messages]);

  const fetchFrequentQuestions = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('preguntas_frecuentes')
      .select('*')
      .eq('user_id', user.id)
      .order('fecha_creacion', { ascending: false });

    if (!error) setFrequentQuestions(data);
  };

  // 🆕 Función para obtener categorías del usuario
  const fetchCategories = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Usuario no autenticado');
        return;
      }

      const { data, error } = await supabase.rpc('get_dashboard_categories_with_count', {
        user_uuid: user.id
      });

      if (error) {
        console.error('Error al obtener categorías:', error);
        return;
      }

      setCategories(data || []);
    } catch (err) {
      console.error('Error en fetchCategories:', err);
    }
  };

  // 🆕 Función para crear nueva categoría
  const createCategory = async () => {
    try {
      if (!newCategory.name.trim()) {
        alert('Por favor ingresa un nombre para la categoría');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Usuario no autenticado');
      }

      const { data, error } = await supabase.rpc('create_dashboard_category', {
        user_uuid: user.id,
        category_name: newCategory.name,
        category_icon: newCategory.icon,
        category_description: newCategory.description,
        category_color: newCategory.color
      });

      if (error) {
        throw new Error('Error al crear categoría: ' + error.message);
      }

      // Resetear formulario y recargar categorías
      setNewCategory({
        name: '',
        icon: '📊',
        description: '',
        color: '#3B82F6'
      });
      setShowCreateCategory(false);
      await fetchCategories();
      
    } catch (err) {
      console.error('Error al crear categoría:', err);
      alert('Error al crear categoría: ' + err.message);
    }
  };

  useEffect(() => {
    fetchFrequentQuestions();
    fetchCategories(); // 🆕 Cargar categorías al inicio
  }, []);

  /* --------------------------------------------------
   *  📤  ENVIAR MENSAJE AL AGENTE
   * -------------------------------------------------- */
  const handleSend = async () => {
    if (!input.trim()) return;

    const newUserMsg = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const { data: raw } = await axios.post(WEBHOOK_URL, {
        message: input,
        sessionId: sessionStorage.getItem('sessionId'),
      });

      // 🔍 Algunos n8n workflows devuelven { response: ... }
      const agentRaw = raw.response ?? raw;

      let parsed = agentRaw;

      // Si viene como array con .output (OpenAI tools) → tomar .output
      if (Array.isArray(agentRaw) && agentRaw[0]?.output) {
        parsed = agentRaw[0].output;
      }

      const agentMsg = {
        role: 'agent',
        content: parsed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      const errorMsg = {
        role: 'agent',
        content: `⚠️ Error al contactar con el agente: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setInput('');
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* --------------------------------------------------
   *  🖼️  PARSE & RENDER DE CADA MENSAJE
   * -------------------------------------------------- */
  const extractIframe = (text) => {
    const m = text.match(
      /!\[.*?\]\((https?:\/\/[^\s)]+\?grafico_id=([a-zA-Z0-9-]+))\)/,
    );
    return m
      ? { url: m[1], grafico_id: m[2], cleanedText: text.replace(m[0], '').trim() }
      : null;
  };

  // 🆕 FUNCIÓN PARA DETECTAR Y PROCESAR GRÁFICOS MIXTOS
  const processChartPayload = (parsedContent) => {
    // Verificar si es un gráfico mixto
    if (parsedContent.chart_type === 'mixed' && parsedContent.values) {
      // Validar estructura de gráfico mixto
      const isValidMixed = Array.isArray(parsedContent.values) && 
        parsedContent.values.every(serie => 
          serie.hasOwnProperty('type') && 
          serie.hasOwnProperty('data') && 
          (serie.hasOwnProperty('name') || serie.hasOwnProperty('label'))
        );

      if (isValidMixed) {
        console.log('🎯 Gráfico mixto detectado:', parsedContent);
        return parsedContent;
      }
    }

    // Procesar gráficos existentes (sin cambios)
    return parsedContent;
  };

  // 🆕 Función mejorada para iniciar el proceso de guardado
  const initiateChartSave = (chartData) => {
    setCurrentChartToSave(chartData);
    setShowCategoryModal(true);
  };

  // 🆕 Función para guardar el gráfico en la categoría seleccionada
  const saveChartToCategory = async () => {
    if (!selectedCategory || !currentChartToSave) {
      alert('Por favor selecciona una categoría');
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        alert('Debes iniciar sesión para guardar gráficos');
        return;
      }

      // 1. Guardar el gráfico
      const chartData = {
        title: currentChartToSave.title,
        chart_type: currentChartToSave.chart_type,
        labels: currentChartToSave.labels,
        values: currentChartToSave.values,
        sql: currentChartToSave.sql,
      };

      // Agregar configuración de ejes si es gráfico mixto
      if (currentChartToSave.chart_type === 'mixed' && currentChartToSave.axes) {
        chartData.axes = currentChartToSave.axes;
      }

      const { data: graficoData, error: graficoError } = await supabase
        .from('graficos')
        .insert(chartData)
        .select('id')
        .single();

      if (graficoError) {
        throw new Error('Error guardando gráfico: ' + graficoError.message);
      }

      // 2. Asociar al dashboard en la categoría seleccionada
      const { error: dashboardError } = await supabase
        .from('dashboard')
        .insert({
          grafico_id: graficoData.id,
          user_id: user.id,
          category_id: selectedCategory.id,
          name: currentChartToSave.title || 'Gráfico sin nombre'
        });

      if (dashboardError) {
        throw new Error('Error guardando en dashboard: ' + dashboardError.message);
      }

      alert(`✅ Gráfico guardado exitosamente en "${selectedCategory.name}"`);
      
      // Resetear estados
      setShowCategoryModal(false);
      setCurrentChartToSave(null);
      setSelectedCategory(null);
      
    } catch (err) {
      console.error('Error al guardar gráfico:', err);
      alert('Error: ' + err.message);
    }
  };

  const renderMessage = (msg, idx) => {
    // 1️⃣ Normalizamos el contenido → parsedContent
    let parsedContent = msg.content;

    // 1.a) Si viene como string, ¿contiene JSON embebido?
    if (typeof parsedContent === 'string') {
      const match = parsedContent.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsedContent = JSON.parse(match[0]);
        } catch (_) {/* ignora si no es JSON válido */}
      }
    }

    // 1.b) Si viene como objeto anidado (response_0.chart_payload)
    if (
      parsedContent?.response_0?.chart_payload?.labels &&
      parsedContent.response_0.chart_payload.labels.length
    ) {
      parsedContent = parsedContent.response_0.chart_payload;
    }

    // 🆕 1.c) Procesar gráficos mixtos
    parsedContent = processChartPayload(parsedContent);

    /* --------------------------------------------------
     *  🎨  DECIDIR QUÉ COMPONENTE USAR
     * -------------------------------------------------- */
    const asIframe =
      typeof parsedContent === 'string' ? extractIframe(parsedContent) : null;

    const isChartPayload =
      parsedContent &&
      typeof parsedContent === 'object' &&
      parsedContent.labels &&
      parsedContent.values;

    /* --------------------------------------------------
     *  🖌️  ESTILOS & METADATOS COMUNES
     * -------------------------------------------------- */
    const isUser = msg.role === 'user';
    const wrapperCls = isUser
      ? 'bg-[#D2C900] text-black rounded-l-3xl rounded-br-3xl'
      : 'bg-[#DFA258] text-black dark:text-white rounded-r-3xl rounded-bl-3xl';
    const icon = isUser ? (
      <FaUserCircle className="text-xl" />
    ) : (
      <FaTree className="text-xl text-[#5E564D]" />
    );

    /* --------------------------------------------------
     *  📦  RENDER
     * -------------------------------------------------- */
    return (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`w-full max-w-2xl p-4 shadow-lg ${wrapperCls}`}>
          <div className="flex items-center gap-2 mb-1">
            {icon}
            <span className="font-semibold">{isUser ? 'Tú' : 'Tronix'}</span>
          </div>

          {/* ----- 📈 Chart INLINE / Iframe / Texto ----- */}
          {asIframe ? (
            <>
              <div
                className="text-sm mt-2"
                dangerouslySetInnerHTML={{
                  __html: asIframe.cleanedText.replace(/\n/g, '<br/>'),
                }}
              />
              <ChartFromSQL grafico_id={asIframe.grafico_id} />
            </>
          ) : isChartPayload ? (
            <>
              {/* Explicación textual */}
              {parsedContent.respuesta && (
                <div className="text-sm mt-2">{parsedContent.respuesta}</div>
              )}
              
              {/* 🆕 Mostrar tipo de gráfico si es mixto */}
              {parsedContent.chart_type === 'mixed' && (
                <div className="text-xs mb-2 px-2 py-1 bg-purple-100 text-purple-800 rounded-full inline-block">
                  📊 Gráfico Mixto (Líneas + Barras)
                </div>
              )}
              
              {/* Gráfico inline */}
              <ChartInline data={parsedContent} />
              
              {/* 🆕 Botón mejorado para guardar */}
              <button
                onClick={() => initiateChartSave(parsedContent)}
                className="mt-3 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"  
              >
                <FaFolder />
                💾 Guardar en Dashboard
              </button>
            </>
          ) : (
            <div className="text-sm mt-2">
              {typeof parsedContent === 'string' ? (
                <div
                  className="prose max-w-full"
                  dangerouslySetInnerHTML={{
                    __html: parsedContent.replace(/\n/g, '<br/>'),
                  }}
                />
              ) : (
                <pre className="bg-gray-100 p-2 rounded overflow-x-auto text-xs">
                  {JSON.stringify(parsedContent, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* ----- ⭐ Acciones ----- */}
          {isUser && (
            <button
              onClick={async () => {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (!user) return alert('Debes iniciar sesión para guardar.');
                await supabase.from('preguntas_frecuentes').insert({
                  user_id: user.id,
                  pregunta: msg.content,
                  fecha_creacion: new Date(),
                });
                fetchFrequentQuestions();
              }}
              className="mt-3 bg-[#D2C900] hover:bg-[#bcae00] text-black px-3 py-1 rounded text-xs shadow"
            >
              💾 Guardar como favorita
            </button>
          )}

          <div className="text-xs text-right mt-2 text-gray-600 dark:text-gray-300">
            {new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </motion.div>
    );
  };

  /* --------------------------------------------------
   *  🌳  UI PRINCIPAL
   * -------------------------------------------------- */
  return (
    <div className="min-h-screen bg-[url('/camioncito.png')] bg-cover bg-fixed bg-bottom p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white/90 dark:bg-[#1c2e1f]/90 px-6 py-3 rounded-xl shadow mb-6 max-w-4xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <FaTree className="text-2xl text-[#D2C900]" />
          <span className="text-xl font-serif font-bold text-[#5E564D] dark:text-white">
            Tronix Forest Assistant
          </span>
        </div>
        <div className="flex gap-4 text-sm font-medium">
          <a href="/chat" className="text-[#D2C900] dark:text-[#D2C900] hover:underline font-bold">
            🌲 Chat Tronix
          </a>
          <a href="/dashboards" className="text-[#5E564D] dark:text-white hover:underline">
            📊 Mis Dashboards
          </a>
          <a href="/panel-ejecutivo" className="text-[#5E564D] dark:text-white hover:underline">
            📈 Panel Ejecutivo
          </a>
          <a
            href="/"
            onClick={() => supabase.auth.signOut()}
            className="text-[#5E564D] dark:text-red-400 hover:underline"
          >
            🚪 Cerrar sesión
          </a>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="bg-white/90 dark:bg-[#1c2e1f]/90 p-6 rounded-xl shadow-lg max-w-4xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        {/* Preguntas frecuentes */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-2">
            📌 Tus preguntas frecuentes:
          </h3>
          {frequentQuestions.length ? (
            <div className="flex flex-wrap gap-2">
              {frequentQuestions.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center bg-[#FDF3BF] text-[#5E564D] px-3 py-1 rounded text-xs font-medium"
                >
                  <button
                    onClick={() => setInput(q.pregunta)}
                    className="hover:underline mr-2"
                  >
                    {q.pregunta}
                  </button>
                  <button
                    onClick={() =>
                      supabase
                        .from('preguntas_frecuentes')
                        .delete()
                        .eq('id', q.id)
                        .then(fetchFrequentQuestions)
                    }
                    className="text-red-500 hover:text-red-700 ml-1"
                  >
                    <FaTrashAlt className="text-xs" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No tienes preguntas guardadas todavía.
            </p>
          )}
        </div>

        {/* Chat */}
        <div className="space-y-4 mb-4">
          <AnimatePresence>{messages.map(renderMessage)}</AnimatePresence>
          {loading && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              Tronix está pensando...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <textarea
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D2C900] dark:focus:ring-[#E5D9AB] focus:outline-none transition-all text-sm dark:bg-[#2e2b26] dark:text-white"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu mensaje... (Shift+Enter para salto de línea)"
          rows={3}
        />
        <button
          onClick={handleSend}
          className="bg-[#D2C900] hover:bg-[#bcae00] text-black font-semibold px-5 py-2 rounded-lg shadow mt-2 w-full"
        >
          📨 Enviar
        </button>
      </div>

      {/* 🆕 MODAL SELECTOR DE CATEGORÍAS */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            {/* Header del modal */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FaFolder />
                Seleccionar Dashboard
              </h2>
              <button 
                onClick={() => {
                  setShowCategoryModal(false);
                  setCurrentChartToSave(null);
                  setSelectedCategory(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
              >
                <FaTimes />
              </button>
            </div>

            {/* Lista de categorías */}
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                ¿En qué dashboard quieres guardar este gráfico?
              </p>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    onClick={() => setSelectedCategory(category)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedCategory?.id === category.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{category.icon}</div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 dark:text-white">
                          {category.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {category.chart_count} gráfico{category.chart_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botón para crear nueva categoría */}
              <button
                onClick={() => setShowCreateCategory(true)}
                className="w-full mt-4 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:border-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <FaPlus />
                Crear nueva categoría
              </button>
            </div>

            {/* Footer del modal */}
            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={() => {
                  setShowCategoryModal(false);
                  setCurrentChartToSave(null);
                  setSelectedCategory(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={saveChartToCategory}
                disabled={!selectedCategory}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                Guardar Gráfico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 MODAL PARA CREAR CATEGORÍA RÁPIDA */}
      {showCreateCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                ➕ Nueva Categoría
              </h3>
              <button 
                onClick={() => setShowCreateCategory(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  placeholder="Ej: Producción, Ventas..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Icono
                </label>
                <div className="flex gap-1 flex-wrap">
                  {['📊', '🏭', '💰', '📈', '👥', '🎯'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setNewCategory({...newCategory, icon: emoji})}
                      className={`p-2 text-lg rounded border transition-all ${
                        newCategory.icon === emoji 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={() => setShowCreateCategory(false)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={createCategory}
                disabled={!newCategory.name.trim()}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
