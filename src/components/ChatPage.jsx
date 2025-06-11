
import React, { useState } from 'react';
import axios from 'axios';
import { supabase } from '../App';

const WEBHOOK_URL = 'https://n8n-production-993e.up.railway.app/webhook/01103618-3424-4455-bde6-aa8d295157b2';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState(null);

  const handleSend = async () => {
    try {
      const res = await axios.post(WEBHOOK_URL, { message: input });
      setResponse(res.data);
    } catch (error) {
      console.error("Error al obtener respuesta:", error);
    }
  };

  const saveGraph = async (url) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      alert('Debe iniciar sesión primero.');
      return;
    }
    const { error } = await supabase
      .from('dashboards')
      .insert({
        user_id: user.id,
        titulo: 'Gráfico guardado',
        url: url,
        fecha: new Date()
      });
    if (error) {
      alert('Error al guardar gráfico:', error.message);
    } else {
      alert('Gráfico guardado correctamente.');
    }
  };

  const renderResponse = () => {
    if (!response) return null;

    if (typeof response === 'string') return <p>{response}</p>;

    if (response.url) {
      if (response.url.includes('?grafico_id=')) {
        return (
          <div>
            <iframe src={response.url} className="w-full h-96"></iframe>
            <button onClick={() => saveGraph(response.url)} className="mt-2 bg-blue-500 text-white px-4 py-2 rounded">Guardar Gráfico</button>
          </div>
        );
      } else {
        return <a href={response.url} target="_blank" rel="noopener noreferrer">{response.url}</a>;
      }
    }

    return <pre>{JSON.stringify(response, null, 2)}</pre>;
  };

  return (
    <div className="p-4">
      <textarea
        className="w-full p-2 border rounded"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Escribe tu consulta aquí..."
      />
      <button onClick={handleSend} className="mt-2 bg-green-500 text-white px-4 py-2 rounded">Enviar</button>
      <div className="mt-4">{renderResponse()}</div>
    </div>
  );
}
