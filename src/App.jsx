import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import ChatPage from '@/components/ChatPage';
import DashboardPage from '@/components/DashboardPage';
import Login from '@/components/Login';
import PanelEjecutivo from '@/components/PanelEjecutivo';


export const supabase = createClient(
  "https://fcjembkiuilkvxqvftmo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjamVtYmtpdWlsa3Z4cXZmdG1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4MjI4NiwiZXhwIjoyMDg5ODU4Mjg2fQ.GTXcLSE8kA7Md5gsUWVsFl5skaoUvs7LOc6PYeYAa1s"
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/dashboards" element={<DashboardPage />} />
        <Route path="/panel-ejecutivo" element={<PanelEjecutivo />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
