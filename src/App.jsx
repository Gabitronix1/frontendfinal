import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import ChatPage from '@/components/ChatPage';
import DashboardPage from '@/components/DashboardPage';
import Login from '@/components/Login';

export const supabase = createClient(
  "https://kvenozirujsvjrsmpqhu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZW5vemlydWpzdmpyc21wcWh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTM1NDM0MiwiZXhwIjoyMDYwOTMwMzQyfQ.PHyDwgHefWFTQkNKPRZ-Xdj7v6cg6j9oZ3VWTbseKLc"
);

function App() {
  return (
    <BrowserRouter>
      <nav className="flex gap-4 p-4 bg-gray-100 justify-center">
        <a href="/chat" className="text-blue-600 font-semibold hover:underline">🤖 Chat Tronix</a>
        <a href="/dashboards" className="text-blue-600 font-semibold hover:underline">📊 Mis Dashboards</a>
      </nav>

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/dashboards" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
