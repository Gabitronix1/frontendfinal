import React, { useState } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert('Error en registro: ' + error.message);
    } else {
      alert('Registro exitoso! Revisa tu email para confirmar.');
    }
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('Error en login: ' + error.message);
    } else {
      navigate('/chat');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 border rounded shadow-lg mt-10">
      <h2 className="text-2xl font-bold mb-4">🔐 Login / Registro</h2>

      <input
        type="email"
        placeholder="Email"
        className="w-full mb-3 p-2 border rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Contraseña"
        className="w-full mb-3 p-2 border rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleLogin}
        className="bg-green-500 text-white px-4 py-2 rounded w-full mb-2"
      >
        Iniciar Sesión
      </button>

      <button
        onClick={handleRegister}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full"
      >
        Registrarse
      </button>
    </div>
  );
}
