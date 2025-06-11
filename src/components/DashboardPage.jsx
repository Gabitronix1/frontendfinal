
import React, { useEffect, useState } from 'react';
import { supabase } from '../App';

export default function DashboardPage() {
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboards = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Debes iniciar sesión para ver tus dashboards.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('user_id', user.id)
        .order('fecha', { ascending: false });

      if (error) {
        alert('Error al cargar dashboards: ' + error.message);
      } else {
        setDashboards(data);
      }
      setLoading(false);
    };

    fetchDashboards();
  }, []);

  if (loading) return <p className="text-center">Cargando dashboards...</p>;
  if (!dashboards.length) return <p className="text-center">No tienes gráficos guardados todavía.</p>;

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">📊 Mis Dashboards</h2>
      {dashboards.map((item) => (
        <div key={item.id} className="my-6 p-4 border rounded shadow">
          <h3 className="text-lg font-semibold mb-2">{item.titulo}</h3>
          <iframe
            src={item.url}
            style={{ width: '100%', height: '600px', border: '1px solid #ccc', borderRadius: '8px' }}
            allowFullScreen
          />
          <p className="text-sm text-gray-500 mt-2">Guardado el: {new Date(item.fecha).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
