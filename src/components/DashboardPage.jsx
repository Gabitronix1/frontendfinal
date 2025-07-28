import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { FaTree } from 'react-icons/fa';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const DashboardPage = () => {
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshingChart, setRefreshingChart] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // Nueva state para pestañas
  const [chartRenderKeys, setChartRenderKeys] = useState({});

  // Función para obtener los dashboards del usuario
  const fetchDashboards = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener el usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw new Error('Error al obtener usuario: ' + userError.message);
      }

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Consulta para obtener dashboards con sus gráficos
      const { data, error } = await supabase
        .from('dashboard')
        .select(`
          id,
          created_at,
          user_id,
          graficos (
             id,
            title,
            chart_type,
            values,
            labels,
            sql,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error('Error al obtener dashboards: ' + error.message);
      }

      console.log('Dashboards obtenidos:', data);
      // Forzar una nueva referencia para que React detecte cambios
      const processedData = data ? data.map(dashboard => ({
        ...dashboard,
        graficos: Array.isArray(dashboard.graficos) 
          ? dashboard.graficos.map(grafico => ({ ...grafico }))
          : dashboard.graficos ? [{ ...dashboard.graficos }] : []
      })) : [];

      setDashboards(processedData);
      } catch (err) {
        console.error('Error en fetchDashboards:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

  // Función para actualizar un gráfico ejecutando su SQL
// Función mejorada para actualizar un gráfico ejecutando su SQL
const refreshChart = async (chartId, sql) => {
  try {
    setRefreshingChart(chartId);
    console.log(`🔄 Actualizando gráfico ${chartId} con SQL:`, sql);
    
    // Ejecutar la query SQL
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    
    if (error) {
      throw new Error('Error al ejecutar SQL: ' + error.message);
    }

    console.log('📊 Datos obtenidos del SQL:', data);

    if (!data || data.length === 0) {
      alert('La consulta SQL no devolvió datos. Verifica tu consulta.');
      return;
    }

    // Procesar los datos del SQL
    const processedData = processChartData(data);
    console.log('🎯 Datos procesados:', processedData);

    // Actualizar el gráfico en la base de datos
    const { error: updateError } = await supabase
      .from('graficos')
      .update({
        values: JSON.stringify(processedData.values),
        labels: JSON.stringify(processedData.labels),
        updated_at: new Date().toISOString()
      })
      .eq('id', chartId);

    if (updateError) {
      throw new Error('Error al actualizar gráfico: ' + updateError.message);
    }

    console.log('✅ Gráfico actualizado en BD');

    // CLAVE: Forzar re-render del gráfico específico
    setChartRenderKeys(prev => ({
      ...prev,
      [chartId]: Date.now() // Nueva key única para este gráfico
    }));

    // Esperar un momento y luego refrescar datos
    setTimeout(async () => {
      await fetchDashboards();
      alert('¡Gráfico actualizado exitosamente!');
    }, 500);
    
  } catch (err) {
    console.error('❌ Error al actualizar gráfico:', err);
    alert('Error al actualizar gráfico: ' + err.message);
  } finally {
    setRefreshingChart(null);
  }
};

  // Función mejorada para procesar datos del SQL
  const processChartData = (data) => {
    if (!data || data.length === 0) {
      return { values: [], labels: [] };
    }

    const firstRow = data[0];
    const keys = Object.keys(firstRow);
    
    console.log('Processing chart data:', { data, keys });
    
    // Si hay exactamente 2 columnas, usar una como labels y otra como values (para gráficos simples)
    if (keys.length === 2) {
      return {
        labels: data.map(row => row[keys[0]]),
        values: data.map(row => row[keys[1]])
      };
    }
    
    // Para gráficos multi-line: primera columna como labels, resto como series de datos
    if (keys.length > 2) {
      const labelKey = keys[0];
      const valueKeys = keys.slice(1);
      
      // CORRECCIÓN: Crear estructura compatible con multi-line
      const multiLineData = valueKeys.map(key => ({
        label: key,
        data: data.map(row => row[key])
      }));
      
      console.log('Multi-line data processed:', multiLineData);
      
      return {
        labels: data.map(row => row[labelKey]),
        values: multiLineData // Array de objetos con {label, data}
      };
    }
    
    // Fallback para una sola columna
    return {
      labels: data.map((_, index) => `Item ${index + 1}`),
      values: data.map(row => row[keys[0]])
    };
  };

  // Función para generar colores automáticamente
  const generateColors = (count) => {
    const colors = [
      'rgba(255, 99, 132, 0.8)',
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 205, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
      'rgba(199, 199, 199, 0.8)',
      'rgba(83, 102, 255, 0.8)',
    ];
    
    const borderColors = [
      'rgba(255, 99, 132, 1)',
      'rgba(54, 162, 235, 1)',
      'rgba(255, 205, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
      'rgba(199, 199, 199, 1)',
      'rgba(83, 102, 255, 1)',
    ];
    
    return {
      backgrounds: Array.from({ length: count }, (_, i) => colors[i % colors.length]),
      borders: Array.from({ length: count }, (_, i) => borderColors[i % borderColors.length])
    };
  };

  // Función para limpiar y parsear datos JSON de forma segura
  const safeJsonParse = (jsonString, fallback = null) => {
    if (!jsonString) return fallback;
    
    if (typeof jsonString !== 'string') {
      return jsonString; // Ya es un objeto/array
    }
    
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error('Error parsing JSON:', e, 'Original string:', jsonString);
      return fallback;
    }
  };

  // Función mejorada para renderizar un gráfico
  const renderChart = (grafico) => {
    console.log('🎨 Renderizando gráfico:', {
      id: grafico.id,
      title: grafico.title,
      type: grafico.chart_type,
      values: grafico.values,
      labels: grafico.labels,
      updated_at: grafico.updated_at
  });

  if (!grafico.values || !grafico.labels) {
    return <div className="text-gray-500">No hay datos para mostrar</div>;
  }

  // Parsear datos de forma segura
  let values = safeJsonParse(grafico.values, []);
  let labels = safeJsonParse(grafico.labels, []);

  console.log('📋 Datos parseados:', { values, labels, type: grafico.chart_type });

  if (!values || !labels || (Array.isArray(values) && values.length === 0)) {
    return <div className="text-gray-500">No hay datos válidos para mostrar</div>;
  }

  // Key única que GARANTIZA re-render
  const forceRenderKey = chartRenderKeys[grafico.id] || 0;
  const chartKey = `chart-${grafico.id}-${forceRenderKey}-${grafico.updated_at}`;
  
  console.log('🔑 Chart key:', chartKey);

  let chartData;

  // Función para crear opciones base con destrucción completa
  const getBaseOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    // FORZAR destrucción completa del canvas
    animation: {
      duration: 0, // Sin animación para evitar conflictos
      onComplete: function() {
        console.log('🎬 Chart render completed for:', grafico.id);
      }
    },
    // Forzar redibujado
    plugins: {
      legend: {
        display: true
      }
    },
    // IMPORTANTE: Evitar cache de Chart.js
    elements: {
      point: {
        radius: function(context) {
          // Cambiar radius dinámicamente para forzar redibujado
          return 3 + (forceRenderKey % 2);
        }
      }
    }
  });

  // Configurar datos según el tipo de gráfico
  switch (grafico.chart_type) {
    case 'bar':
      chartData = {
        labels: labels,
        datasets: [{
          label: 'Datos',
          data: values,
          backgroundColor: `rgba(54, 162, 235, ${0.5 + (forceRenderKey % 100) * 0.001})`, // Cambio sutil para forzar update
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      };
      return (
        <div key={chartKey} style={{ position: 'relative', height: '100%' }}>
          <Bar 
            key={chartKey} // Key también en el componente Chart
            data={chartData} 
            options={getBaseOptions()}
            redraw={true} // Forzar redibujado
          />
        </div>
      );

    case 'pie':
      const pieColors = generateColors(Array.isArray(values) ? values.length : 1);
      chartData = {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: pieColors.backgrounds,
          borderColor: pieColors.borders,
          borderWidth: 1
        }]
      };
      return (
        <div key={chartKey} style={{ position: 'relative', height: '100%' }}>
          <Pie 
            key={chartKey}
            data={chartData} 
            options={getBaseOptions()}
            redraw={true}
          />
        </div>
      );

    case 'line':
      chartData = {
        labels: labels,
        datasets: [{
          label: 'Datos',
          data: values,
          fill: false,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }]
      };
      return (
        <div key={chartKey} style={{ position: 'relative', height: '100%' }}>
          <Line 
            key={chartKey}
            data={chartData} 
            options={getBaseOptions()}
            redraw={true}
          />
        </div>
      );

      case 'multi-line':
        let datasets = [];
        
        console.log('Procesando multi-line con values:', values);
        
        // CORRECCIÓN ESPECÍFICA: Manejar el formato real de los datos
        if (Array.isArray(values) && values.length > 0) {
          // Caso 1: Array de objetos con estructura {name, data} (formato real)
          if (typeof values[0] === 'object' && values[0] !== null && 'name' in values[0] && 'data' in values[0]) {
            const colors = generateColors(values.length);
            datasets = values.map((series, index) => ({
              label: series.name, // Usar 'name' en lugar de 'label'
              data: Array.isArray(series.data) ? series.data : [],
              borderColor: colors.borders[index],
              backgroundColor: colors.backgrounds[index],
              fill: false,
              tension: 0.1
            }));
          }
          // Caso 2: Array de objetos con estructura {label, data} (formato esperado anteriormente)
          else if (typeof values[0] === 'object' && values[0] !== null && 'label' in values[0] && 'data' in values[0]) {
            const colors = generateColors(values.length);
            datasets = values.map((series, index) => ({
              label: series.label,
              data: Array.isArray(series.data) ? series.data : [],
              borderColor: colors.borders[index],
              backgroundColor: colors.backgrounds[index],
              fill: false,
              tension: 0.1
            }));
          } 
          // Caso 3: Array de arrays [[data1], [data2], ...]
          else if (Array.isArray(values[0])) {
            const colors = generateColors(values.length);
            datasets = values.map((series, index) => ({
              label: `Serie ${index + 1}`,
              data: series,
              borderColor: colors.borders[index],
              backgroundColor: colors.backgrounds[index],
              fill: false,
              tension: 0.1
            }));
          }
          // Caso 4: Array simple de valores [1, 2, 3, ...] - convertir a dataset único
          else if (typeof values[0] === 'number' || typeof values[0] === 'string') {
            datasets = [{
              label: 'Datos',
              data: values,
              borderColor: 'rgba(75, 192, 192, 1)',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              fill: false,
              tension: 0.1
            }];
          }
        }
        // Si values es un objeto (no array), intentar procesarlo
        else if (values && typeof values === 'object' && !Array.isArray(values)) {
          const keys = Object.keys(values);
          console.log('Values es objeto con keys:', keys);
          
          // Si las keys son nombres de series y los valores son arrays
          if (keys.length > 0) {
            const colors = generateColors(keys.length);
            datasets = keys.map((key, index) => {
              const seriesData = values[key];
              return {
                label: key,
                data: Array.isArray(seriesData) ? seriesData : [seriesData],
                borderColor: colors.borders[index],
                backgroundColor: colors.backgrounds[index],
                fill: false,
                tension: 0.1
              };
            });
          }
        }
        // Si values es un string que parece JSON, intentar parsearlo nuevamente
        else if (typeof values === 'string') {
          try {
            const reparsedValues = JSON.parse(values);
            console.log('Re-parsed values:', reparsedValues);
            
            if (Array.isArray(values) && values.length > 0) {
              if (typeof values[0] === 'object' && values[0] !== null && 'name' in values[0] && 'data' in values[0]) {
                const colors = generateColors(values.length);
                datasets = values.map((series, index) => ({
                  label: series.name,
                  data: Array.isArray(series.data) ? series.data : [],
                  borderColor: colors.borders[index],
                  backgroundColor: colors.backgrounds[index],
                  fill: false,
                  tension: 0.1
                }));
              }
          } catch (e) {
            console.error('Error re-parsing values:', e);
          }
        }

        console.log('Datasets generados:', datasets);

        if (datasets.length === 0) {
          return (
            <div className="text-red-500">
              <div>No se pudieron procesar los datos del gráfico multi-línea</div>
              <div className="text-xs mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-32">
                <div>Datos recibidos:</div>
                <pre className="text-xs">{JSON.stringify(values, null, 2)}</pre>
              </div>
            </div>
          );
        }

        chartData = {
          labels: labels,
          datasets: datasets
        };
        
        return (
          <div key={chartKey} style={{ position: 'relative', height: '100%' }}>
            <Line 
              key={chartKey}
              data={chartData} 
              options={{ 
                ...getBaseOptions(),
              plugins: {
                legend: {
                  display: true,
                  position: 'top'
                }
              },
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }} 
          />
        </div>
      );
      default:
        return <div className="text-gray-500">Tipo de gráfico no soportado: {grafico.chart_type}</div>;
    }
  };

  // Función para eliminar un dashboard
  const deleteDashboard = async (dashboardId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este gráfico del dashboard?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('dashboard')
        .delete()
        .eq('id', dashboardId);

      if (error) {
        throw new Error('Error al eliminar dashboard: ' + error.message);
      }

      // Refrescar la lista
      await fetchDashboards();
    } catch (err) {
      console.error('Error al eliminar dashboard:', err);
      alert('Error al eliminar dashboard: ' + err.message);
    }
  };

  // Función para obtener gráficos filtrados por pestaña
  const getFilteredCharts = () => {
    const allCharts = [];
    
    dashboards.forEach((dashboard) => {
      const graficos = Array.isArray(dashboard.graficos) ? dashboard.graficos : [dashboard.graficos];
      graficos.forEach((grafico) => {
        if (grafico) {
          allCharts.push({ dashboard, grafico });
        }
      });
    });

    if (activeTab === 'all') {
      return allCharts;
    }
    
    return allCharts.filter(({ grafico }) => grafico.chart_type === activeTab);
  };

  // Función para obtener tipos únicos de gráficos
  const getUniqueChartTypes = () => {
    const types = new Set();
    dashboards.forEach((dashboard) => {
      const graficos = Array.isArray(dashboard.graficos) ? dashboard.graficos : [dashboard.graficos];
      graficos.forEach((grafico) => {
        if (grafico && grafico.chart_type) {
          types.add(grafico.chart_type);
        }
      });
    });
    return Array.from(types);
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[url('/camioncito.png')] bg-cover bg-fixed bg-bottom p-6">
        <div className="flex justify-center items-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">Cargando dashboards...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[url('/camioncito.png')] bg-cover bg-fixed bg-bottom p-6">
        <div className="max-w-md mx-auto mt-20">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-lg">
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
            <button 
              onClick={fetchDashboards}
              className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <div className="min-h-screen bg-[url('/camioncito.png')] bg-cover bg-fixed bg-bottom p-6">
        {/* HEADER DE NAVEGACIÓN */}
        <div className="flex justify-between items-center bg-white/90 dark:bg-[#1c2e1f]/90 px-6 py-3 rounded-xl shadow mb-6 max-w-4xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <FaTree className="text-2xl text-[#D2C900]" />
            <span className="text-xl font-serif font-bold text-[#5E564D] dark:text-white">
              Tronix Forest Assistant
            </span>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <a href="/chat" className="text-[#5E564D] dark:text-white hover:underline">
              🌲 Chat Tronix
            </a>
            <a href="/dashboards" className="text-[#D2C900] dark:text-[#D2C900] hover:underline font-bold">
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

        <div className="flex justify-center items-center h-screen">
          <div className="text-center bg-white/90 dark:bg-[#1c2e1f]/90 rounded-lg shadow-lg p-8 max-w-md mx-auto backdrop-blur-sm">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-gray-600 dark:text-white text-lg mb-2">
              No tienes gráficos guardados en tus dashboards
            </div>
            <div className="text-gray-400">
              Crea gráficos con el agente de IA y guárdalos para verlos aquí
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredCharts = getFilteredCharts();
  const chartTypes = getUniqueChartTypes();

  return (
    <div className="min-h-screen bg-[url('/camioncito.png')] bg-cover bg-fixed bg-bottom p-6">
      {/* HEADER DE NAVEGACIÓN */}
      <div className="flex justify-between items-center bg-white/90 dark:bg-[#1c2e1f]/90 px-6 py-3 rounded-xl shadow mb-6 max-w-6xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <FaTree className="text-2xl text-[#D2C900]" />
          <span className="text-xl font-serif font-bold text-[#5E564D] dark:text-white">
            Tronix Forest Assistant
          </span>
        </div>
        <div className="flex gap-4 text-sm font-medium">
          <a href="/chat" className="text-[#5E564D] dark:text-white hover:underline">
            🌲 Chat Tronix
          </a>
          <a href="/dashboards" className="text-[#D2C900] dark:text-[#D2C900] hover:underline font-bold">
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
      <div className="bg-white/90 dark:bg-[#1c2e1f]/90 rounded-xl shadow-lg max-w-6xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">📊 Mis Dashboards</h1>
            <p className="text-gray-600 dark:text-gray-300">Visualiza y gestiona tus gráficos de datos</p>
          </div>
          <button 
            onClick={fetchDashboards}
            className="px-6 py-3 bg-gradient-to-r from-[#D2C900] to-[#bcae00] text-black rounded-lg hover:from-[#bcae00] hover:to-[#a89800] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            🔄 Refrescar
          </button>
        </div>

        {/* Pestañas de navegación */}
        <div className="p-6 pb-0">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow-lg p-1 inline-flex space-x-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                activeTab === 'all'
                  ? 'bg-gradient-to-r from-[#D2C900] to-[#bcae00] text-black shadow-lg'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              📈 Todos ({filteredCharts.length})
            </button>
            
            {chartTypes.map((type) => {
              const count = getFilteredCharts().filter(({ grafico }) => grafico.chart_type === type).length;
              const icon = {
                'bar': '📊',
                'pie': '🥧',
                'line': '📈',
                'multi-line': '📊'
              }[type] || '📊';
              
              const label = {
                'bar': 'Barras',
                'pie': 'Circular',
                'line': 'Líneas',
                'multi-line': 'Multi-Líneas'
              }[type] || type;

              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                    activeTab === type
                      ? 'bg-gradient-to-r from-[#D2C900] to-[#bcae00] text-black shadow-lg'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {icon} {label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid de gráficos */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCharts.map(({ dashboard, grafico }) => (
              <div 
                key={`${dashboard.id}-${grafico.id}`} 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border border-gray-100 dark:border-gray-700"
              >
                {/* Header de la tarjeta */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-1">
                        {grafico.title || 'Sin título'}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center">
                          {grafico.chart_type === 'bar' && '📊'}
                          {grafico.chart_type === 'pie' && '🥧'}
                          {grafico.chart_type === 'line' && '📈'}
                          {grafico.chart_type === 'multi-line' && '📊'}
                          <span className="ml-1 capitalize">{grafico.chart_type}</span>
                        </span>
                        <span className="flex items-center">
                          📅 {new Date(grafico.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => refreshChart(grafico.id, grafico.sql)}
                        disabled={refreshingChart === grafico.id}
                        className="px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg"
                        title="Actualizar datos"
                      >
                        {refreshingChart === grafico.id ? '⏳' : '🔄'}
                      </button>
                      <button
                        onClick={() => deleteDashboard(dashboard.id)}
                        className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-all duration-300 shadow-md hover:shadow-lg"
                        title="Eliminar gráfico"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>

                {/* Contenido del gráfico */}
                <div className="p-6">
                  <div className="h-64 relative">
                    {renderChart(grafico)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        {/* Mensaje cuando no hay gráficos en la pestaña activa */}
        {filteredCharts.length === 0 && activeTab !== 'all' && (
          <div className="text-center py-16">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto">
              <div className="text-6xl mb-4">🔍</div>
              <div className="text-gray-600 text-lg mb-2">
                No hay gráficos de tipo "{activeTab}"
              </div>
              <div className="text-gray-400">
                Crea más gráficos o cambia a otra pestaña
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
export default DashboardPage;
