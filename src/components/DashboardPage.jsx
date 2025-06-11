import React, { useEffect, useState } from 'react';
import { supabase } from '../App';

export default function DashboardPage() {
  const [dashboards, setDashboards] = useState([]);

  useEffect(() => {
    const fetchDashboards = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Debes iniciar sesión primero.');
        return;
      }
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error("Error cargando dashboards:", error);
      } else {
        setDashboards(data);
      }
    };

    fetchDashboards();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">Mis Dashboards</h2>
      {dashboards.map((dash) => (
        <div key={dash.id} className="my-4 border p-4 rounded shadow">
          <h3 className="text-lg">{dash.titulo}</h3>
          <iframe src={dash.url} className="w-full h-96"></iframe>
          <p className="text-gray-500">Guardado el {new Date(dash.fecha).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
