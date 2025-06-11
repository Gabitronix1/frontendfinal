
import React, { useState } from 'react';
import axios from 'axios';
import { supabase } from '../App';

const WEBHOOK_URL = 'https://n8n-production-993e.up.railway.app/webhook/01103618-3424-4455-bde6-aa8d295157b2';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newUserMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const res = await axios.post(WEBHOOK_URL, { message: input });
      const raw = res.data.response || res.data;

      let parsed;
      if (Array.isArray(raw) && raw[0]?.output) {
        parsed = raw[0].output;
      } else {
        parsed = raw;
      }

      const agentReply = { role: 'agent', content: parsed };
      setMessages((prev) => [...prev, agentReply]);
    } catch (error) {
      const errorReply = { role: 'agent', content: '⚠️ Error al contactar con el agente.' };
      setMessages((prev) => [...prev, errorReply]);
    }

    setInput('');
  };

  const saveGraph = async (url) => {
    const titulo = prompt("Ingresa un título para este gráfico:");
    if (!titulo) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      alert('Debe iniciar sesión primero.');
      return;
    }

    const { error } = await supabase
      .from('dashboards')
      .insert({
        user_id: user.id,
        titulo,
        url,
        fecha: new Date()
      });

    if (error) {
      alert('Error al guardar gráfico: ' + error.message);
    } else {
      alert('Gráfico guardado correctamente.');
    }
  };

  const extractIframe = (text) => {
    const match = text.match(/!\[.*?\]\((https?:\/\/[^\s)]+\?grafico_id=[^\s)]+)\)/);
    if (match) {
      const url = match[1];
      const cleanedText = text.replace(match[0], '').trim();
      return { url, cleanedText };
    }
    return null;
  };

  const renderMessage = (msg, index) => {
    const baseStyle = msg.role === 'user' ? 'bg-gray-100 text-right' : 'bg-green-50 text-left';

    if (typeof msg.content === 'string') {
      const iframeMatch = extractIframe(msg.content);
      if (iframeMatch) {
        return (
          <div key={index} className={`p-4 my-2 rounded-lg shadow ${baseStyle}`}>
            <div dangerouslySetInnerHTML={{ __html: iframeMatch.cleanedText.replace(/\n/g, '<br/>') }} />
            <iframe
              src={iframeMatch.url}
              style={{ width: '100%', height: '600px', border: '1px solid #ccc', borderRadius: '8px', marginTop: '10px' }}
              allowFullScreen
            />
            <button onClick={() => saveGraph(iframeMatch.url)} className="mt-2 bg-blue-600 text-white px-3 py-1 rounded">
              Guardar gráfico
            </button>
          </div>
        );
      }
    }

    const isLink = typeof msg.content === 'string' && msg.content.startsWith('http');
    return (
      <div key={index} className={`p-4 my-2 rounded-lg shadow ${baseStyle}`}>
        {isLink ? (
          <a href={msg.content} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
            {msg.content}
          </a>
        ) : typeof msg.content === 'object' ? (
          <pre className="bg-white p-2 rounded overflow-x-auto">{JSON.stringify(msg.content, null, 2)}</pre>
        ) : (
          <div className="prose max-w-full" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }}></div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">💬 Chat con Tronix</h2>
      <div className="space-y-4 mb-4">{messages.map(renderMessage)}</div>
      <textarea
        className="w-full p-2 border rounded mb-2"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Escribe tu mensaje..."
        rows={3}
      />
      <button
        onClick={handleSend}
        className="bg-green-600 text-white px-4 py-2 rounded w-full hover:bg-green-700 transition"
      >
        Enviar mensaje
      </button>
    </div>
  );
}
