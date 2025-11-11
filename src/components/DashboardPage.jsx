import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { FaTree, FaArrowLeft, FaPlus, FaFolder, FaChartBar, FaExpand, FaCompress, FaExpandArrowsAlt, FaEdit, FaSave, FaTimes, FaEye, FaCode } from 'react-icons/fa';

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

// 🎯 COMPONENTE EDITOR DE GRÁFICOS
const ChartEditor = ({ grafico, dashboard, onSave, onClose, supabase, processChartDataPreservingMixed, processForBarChart, processForLineChart, processForMultiLineChart, processForPieChart, processChartData }) => {
  // Estados del editor
  const [editData, setEditData] = useState({
    title: grafico.title || '',
    chart_type: grafico.chart_type || 'bar',
    sql: grafico.sql || '',
    description: dashboard.description || ''
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sqlError, setSqlError] = useState('');
  const [previewData, setPreviewData] = useState(null);

  // Tipos de gráfico disponibles
  const chartTypes = [
    { value: 'bar', label: '📊 Barras', description: 'Ideal para comparar categorías' },
    { value: 'line', label: '📈 Línea Simple', description: 'Para tendencias temporales' },
    { value: 'multi-line', label: '📊 Multi-línea', description: 'Múltiples series temporales' },
    { value: 'pie', label: '🥧 Circular', description: 'Para proporciones' },
    { value: 'mixed', label: '🎯 Mixto', description: 'Líneas y barras combinadas' }
  ];

  // Función para previsualizar SQL
  const previewSQL = async () => {
    if (!editData.sql.trim()) {
      setSqlError('Por favor ingresa una consulta SQL');
      return;
    }

    try {
      setPreviewMode(true);
      setSqlError('');
      
      const { data, error } = await supabase.rpc('execute_sql', { 
        query: editData.sql 
      });
      
      if (error) {
        throw new Error('Error en SQL: ' + error.message);
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('La consulta no devolvió datos válidos');
      }

      setPreviewData(data);
      console.log('✅ Preview SQL exitoso:', data);
      
    } catch (err) {
      console.error('❌ Error en preview:', err);
      setSqlError(err.message);
      setPreviewData(null);
    }
  };

  // Función para guardar cambios
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSqlError('');

      // Validaciones básicas
      if (!editData.title.trim()) {
        throw new Error('El título es obligatorio');
      }

      if (!editData.sql.trim()) {
        throw new Error('La consulta SQL es obligatoria');
      }

      // Ejecutar SQL para obtener nuevos datos
      const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', { 
        query: editData.sql 
      });
      
      if (sqlError) {
        throw new Error('Error en SQL: ' + sqlError.message);
      }

      if (!sqlData || !Array.isArray(sqlData) || sqlData.length === 0) {
        throw new Error('La consulta SQL no devolvió datos válidos');
      }

      // Procesar datos según el tipo de gráfico seleccionado
      let processedData;
      
      switch (editData.chart_type) {
        case 'mixed':
          processedData = processChartDataPreservingMixed(sqlData, editData.chart_type, grafico.axes);
          break;
        case 'bar':
          processedData = processForBarChart(sqlData);
          break;
        case 'line':
          processedData = processForLineChart(sqlData);
          break;
        case 'multi-line':
          processedData = processForMultiLineChart(sqlData);
          break;
        case 'pie':
          processedData = processForPieChart(sqlData);
          break;
        default:
          processedData = processChartData(sqlData);
      }

      // Preparar datos para actualizar
      const updateData = {
        title: editData.title.trim(),
        chart_type: editData.chart_type,
        sql: editData.sql.trim(),
        values: processedData.values,
        labels: processedData.labels,
        updated_at: new Date().toISOString()
      };

      // Si es gráfico mixto, preservar ejes
      if (editData.chart_type === 'mixed' && processedData.axes) {
        updateData.axes = processedData.axes;
      }

      // Actualizar gráfico en base de datos
      const { error: updateError } = await supabase
        .from('graficos')
        .update(updateData)
        .eq('id', grafico.id);

      if (updateError) {
        throw new Error('Error al actualizar gráfico: ' + updateError.message);
      }

      // Actualizar dashboard si cambió la descripción
      if (editData.description !== dashboard.description) {
        const { error: dashboardError } = await supabase
          .from('dashboards')
          .update({ 
            description: editData.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', dashboard.id);

        if (dashboardError) {
          console.warn('Error al actualizar descripción del dashboard:', dashboardError);
        }
      }

      console.log('✅ Gráfico actualizado exitosamente');
      onSave(); // Callback para refrescar la vista padre
      
    } catch (err) {
      console.error('❌ Error al guardar:', err);
      setSqlError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800">
          <div className="flex items-center gap-3">
            <FaEdit className="text-blue-600 dark:text-blue-400 text-xl" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              Editor de Gráfico
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            
            {/* Información básica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Título del Gráfico *
                </label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({...editData, title: e.target.value})}
                  placeholder="Ej: Volumen por Zona 2024"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Gráfico *
                </label>
                <select
                  value={editData.chart_type}
                  onChange={(e) => setEditData({...editData, chart_type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {chartTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {chartTypes.find(t => t.value === editData.chart_type)?.description}
                </p>
              </div>
            </div>

            {/* Descripción del dashboard */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descripción del Dashboard (opcional)
              </label>
              <input
                type="text"
                value={editData.description}
                onChange={(e) => setEditData({...editData, description: e.target.value})}
                placeholder="Descripción general del dashboard..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Editor SQL */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Consulta SQL *
                </label>
                <button
                  onClick={previewSQL}
                  disabled={!editData.sql.trim()}
                  className="px-3 py-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-1"
                >
                  <FaEye className="text-xs" />
                  Preview
                </button>
              </div>
              
              <div className="relative">
                <textarea
                  value={editData.sql}
                  onChange={(e) => setEditData({...editData, sql: e.target.value})}
                  placeholder="SELECT fecha, volumen FROM mi_tabla WHERE fecha >= '2024-01-01'"
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm resize-none"
                />
                <FaCode className="absolute top-3 right-3 text-gray-400" />
              </div>
              
              {/* Error de SQL */}
              {sqlError && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
                  <p className="text-red-800 dark:text-red-200 text-sm font-medium">
                    ❌ Error: {sqlError}
                  </p>
                </div>
              )}
            </div>

            {/* Preview de datos */}
            {previewMode && previewData && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <FaEye className="text-green-600" />
                  Preview de Datos ({previewData.length} registros)
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        {Object.keys(previewData[0] || {}).map(key => (
                          <th key={key} className="px-2 py-1 text-left text-gray-600 dark:text-gray-300 font-medium">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 5).map((row, index) => (
                        <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="px-2 py-1 text-gray-800 dark:text-gray-200">
                              {String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {previewData.length > 5 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    ... y {previewData.length - 5} registros más
                  </p>
                )}
              </div>
            )}

            {/* Consejos según tipo de gráfico */}
            <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                💡 Consejos para {chartTypes.find(t => t.value === editData.chart_type)?.label}:
              </h3>
              
              {editData.chart_type === 'bar' && (
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Usa 2 columnas: etiqueta (texto) y valor (número)</li>
                  <li>• Ejemplo: SELECT zona, SUM(volumen) FROM datos GROUP BY zona</li>
                </ul>
              )}
              
              {editData.chart_type === 'line' && (
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Usa 2 columnas: fecha/tiempo y valor</li>
                  <li>• Ejemplo: SELECT fecha, volumen FROM datos ORDER BY fecha</li>
                </ul>
              )}
              
              {editData.chart_type === 'multi-line' && (
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Opción 1: SELECT fecha, volumen_zona1, volumen_zona2 FROM datos</li>
                  <li>• Opción 2: SELECT fecha, zona, volumen FROM datos</li>
                </ul>
              )}
              
              {editData.chart_type === 'mixed' && (
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Incluye columna 'tipo' o 'type' con valores 'line' o 'bar'</li>
                  <li>• Ejemplo: SELECT fecha, serie, tipo, volumen FROM datos</li>
                  <li>• El tipo determina si se muestra como línea o barra</li>
                </ul>
              )}
              
              {editData.chart_type === 'pie' && (
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Usa 2 columnas: categoría y valor</li>
                  <li>• Ejemplo: SELECT especie, SUM(volumen) FROM datos GROUP BY especie</li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer con botones */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          
          <button 
            onClick={handleSave}
            disabled={isSaving || !editData.title.trim() || !editData.sql.trim()}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <FaSave />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  // Estados principales
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshingChart, setRefreshingChart] = useState(null);
  const [chartRenderKeys, setChartRenderKeys] = useState({});
  const [showCreateCategory, setShowCreateCategory] = useState(false);

  // Estados para el layout flexible
  const [chartSizes, setChartSizes] = useState({});
  const [editMode, setEditMode] = useState(false);

  // 🆕 Estados para el editor
  const [showEditor, setShowEditor] = useState(false);
  const [editingChart, setEditingChart] = useState(null);
  const [editingDashboard, setEditingDashboard] = useState(null);

  // Estados para crear categoría
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: '📊',
    description: '',
    color: '#3B82F6'
  });

  // 🆕 Funciones para el editor
  const openEditor = (grafico, dashboard) => {
    setEditingChart(grafico);
    setEditingDashboard(dashboard);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingChart(null);
    setEditingDashboard(null);
  };

  const handleEditorSave = async () => {
    closeEditor();
    // Refrescar los datos del dashboard actual
    if (currentCategory) {
      await fetchDashboardsByCategory(currentCategory.id);
    }
    alert('¡Gráfico actualizado exitosamente!');
  };

  // Paleta de colores unificada
  const generateColors = (count) => {
    const colors = [
      'rgba(255, 99, 132, 0.8)',    // Rosa vibrante
      'rgba(54, 162, 235, 0.8)',    // Azul cielo
      'rgba(255, 205, 86, 0.8)',    // Amarillo dorado
      'rgba(75, 192, 192, 0.8)',    // Verde agua
      'rgba(153, 102, 255, 0.8)',   // Púrpura
      'rgba(255, 159, 64, 0.8)',    // Naranja
      'rgba(199, 199, 199, 0.8)',   // Gris claro
      'rgba(83, 102, 255, 0.8)',    // Azul índigo
      'rgba(255, 99, 255, 0.8)',    // Magenta
      'rgba(99, 255, 132, 0.8)',    // Verde lima
      'rgba(255, 193, 7, 0.8)',     // Ámbar
      'rgba(156, 39, 176, 0.8)',    // Púrpura profundo
      'rgba(0, 188, 212, 0.8)',     // Cian
      'rgba(76, 175, 80, 0.8)',     // Verde
      'rgba(244, 67, 54, 0.8)',     // Rojo
    ];
    
    const borderColors = colors.map(color => color.replace('0.8', '1'));
    
    return {
      backgrounds: Array.from({ length: count }, (_, i) => colors[i % colors.length]),
      borders: Array.from({ length: count }, (_, i) => borderColors[i % borderColors.length])
    };
  };

  // Opciones base unificadas para gráficos
  const getUnifiedBaseOptions = (chartType = 'default') => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart',
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function(context) {
            const dataset = context.dataset;
            const value = context.parsed.y || context.parsed;
            
            if (chartType === 'mixed') {
              const serieType = dataset.type || 'line';
              return `${dataset.label} (${serieType}): ${value}`;
            }
            
            return `${dataset.label}: ${value}`;
          }
        }
      }
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 8,
        borderWidth: 2,
        hoverBorderWidth: 3
      },
      line: {
        tension: 0.4,
        borderWidth: 3
      },
      bar: {
        borderWidth: 2,
        borderSkipped: false,
        borderRadius: 4
      }
    },
    scales: chartType !== 'pie' ? {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    } : {}
  });

  // Función para obtener las clases de tamaño según el tipo
  const getChartSizeClasses = (chartId, size) => {
    const currentSize = size || chartSizes[chartId] || 'medium';
    
    switch (currentSize) {
      case 'small':
        return 'col-span-12 md:col-span-6 lg:col-span-4';
      case 'medium':
        return 'col-span-12 md:col-span-6';
      case 'large':
        return 'col-span-12';
      default:
        return 'col-span-12 md:col-span-6';
    }
  };

  // Función para obtener la altura según el tamaño
  const getChartHeight = (chartId, size) => {
    const currentSize = size || chartSizes[chartId] || 'medium';
    
    switch (currentSize) {
      case 'small':
        return 'h-64';
      case 'medium':
        return 'h-80';
      case 'large':
        return 'h-96';
      default:
        return 'h-80';
    }
  };

  // Función para cambiar el tamaño de un gráfico
  const changeChartSize = (chartId, newSize) => {
    setChartSizes(prev => ({
      ...prev,
      [chartId]: newSize
    }));
    
    // Forzar re-render del gráfico
    setChartRenderKeys(prev => ({
      ...prev,
      [chartId]: Date.now()
    }));
  };

  // Componente de selector de tamaño
  const SizeSelector = ({ chartId, currentSize }) => {
    if (!editMode) return null;
    
    const size = currentSize || chartSizes[chartId] || 'medium';
    
    return (
      <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-1 flex gap-1 z-10">
        <button
          onClick={() => changeChartSize(chartId, 'small')}
          className={`p-2 rounded ${size === 'small' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          title="Pequeño (1/3)"
        >
          <FaCompress className="text-xs" />
        </button>
        <button
          onClick={() => changeChartSize(chartId, 'medium')}
          className={`p-2 rounded ${size === 'medium' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          title="Mediano (1/2)"
        >
          <FaExpandArrowsAlt className="text-xs" />
        </button>
        <button
          onClick={() => changeChartSize(chartId, 'large')}
          className={`p-2 rounded ${size === 'large' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          title="Grande (completo)"
        >
          <FaExpand className="text-xs" />
        </button>
      </div>
    );
  };

  // Función para obtener categorías con contadores
  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw new Error('Error al obtener usuario: ' + userError.message);
      }

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const { data, error } = await supabase.rpc('get_dashboard_categories_with_count', {
        user_uuid: user.id
      });

      if (error) {
        throw new Error('Error al obtener categorías: ' + error.message);
      }

      console.log('Categorías obtenidas:', data);
      setCategories(data || []);
      
    } catch (err) {
      console.error('Error en fetchCategories:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener dashboards de una categoría específica
  const fetchDashboardsByCategory = async (categoryId) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw new Error('Error al obtener usuario: ' + userError.message);
      }

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const { data, error } = await supabase.rpc('get_dashboards_by_category', {
        user_uuid: user.id,
        category_uuid: categoryId
      });

      if (error) {
        throw new Error('Error al obtener dashboards: ' + error.message);
      }

      console.log('Dashboards de categoría obtenidos:', data);
      
      const processedData = data ? data.map(dashboard => ({
        ...dashboard,
        graficos: Array.isArray(dashboard.graficos) && dashboard.graficos[0] !== null 
          ? dashboard.graficos 
          : []
      })) : [];

      setDashboards(processedData);
      
    } catch (err) {
      console.error('Error en fetchDashboardsByCategory:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para crear nueva categoría
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

      console.log('Categoría creada:', data);
      
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

  // 🆕 FUNCIÓN ESPECIALIZADA PARA PROCESAR GRÁFICOS MIXTOS
  const processChartDataPreservingMixed = (data, originalChartType, originalAxes) => {
    if (!data || data.length === 0) {
      return { values: [], labels: [] };
    }

    console.log('🎯 Procesando datos mixtos con configuración original');

    const firstRow = data[0];
    const keys = Object.keys(firstRow);
    
    // Para gráficos mixtos, intentar detectar el patrón de series
    const hasMultipleColumns = keys.length >= 4; // fecha, serie, tipo, valor
    
    if (hasMultipleColumns) {
      // Buscar columnas clave
      const fechaKey = keys.find(k => k.toLowerCase().includes('fecha') || k.toLowerCase().includes('date')) || keys[0];
      const tipoKey = keys.find(k => k.toLowerCase().includes('tipo') || k.toLowerCase().includes('type'));
      const serieKey = keys.find(k => k.toLowerCase().includes('serie') || k.toLowerCase().includes('name') || k.toLowerCase().includes('label'));
      const valorKey = keys.find(k => k.toLowerCase().includes('volumen') || k.toLowerCase().includes('valor') || typeof data[0][k] === 'number');

      if (fechaKey && valorKey) {
        const labels = [...new Set(data.map(row => row[fechaKey]))].sort();
        
        // Si hay columna de tipo, usar para determinar tipo de serie
        if (tipoKey && serieKey) {
          const seriesMap = new Map();
          
          data.forEach(row => {
            const serieId = `${row[serieKey]}_${row[tipoKey]}`;
            if (!seriesMap.has(serieId)) {
              seriesMap.set(serieId, {
                name: row[serieKey],
                type: row[tipoKey] === 'bar' ? 'bar' : 'line',
                data: new Array(labels.length).fill(0),
                yAxisID: row[tipoKey] === 'bar' ? 'y1' : 'y'
              });
            }
            
            const labelIndex = labels.indexOf(row[fechaKey]);
            if (labelIndex !== -1) {
              seriesMap.get(serieId).data[labelIndex] = Number(row[valorKey]) || 0;
            }
          });

          return {
            labels,
            values: Array.from(seriesMap.values()),
            axes: originalAxes, // Preservar ejes originales
            chart_type: 'mixed'
          };
        }
        
        // Si hay múltiples series pero sin tipo explícito
        if (serieKey) {
          const series = [...new Set(data.map(row => row[serieKey]))];
          
          const values = series.map((serie, index) => {
            const serieData = data.filter(row => row[serieKey] === serie);
            
            return {
              name: serie,
              type: index % 2 === 0 ? 'line' : 'bar', // Alternar tipos para preservar carácter mixto
              data: labels.map(label => {
                const row = serieData.find(r => r[fechaKey] === label);
                return row ? Number(row[valorKey]) || 0 : 0;
              }),
              yAxisID: index % 2 === 0 ? 'y' : 'y1'
            };
          });

          return {
            labels,
            values,
            axes: originalAxes, // Preservar ejes originales
            chart_type: 'mixed'
          };
        }
      }
    }

    // Fallback: usar procesamiento estándar pero forzar tipo mixto
    const standardProcessed = processChartData(data);
    
    return {
      ...standardProcessed,
      chart_type: 'mixed',
      axes: originalAxes // Preservar ejes originales
    };
  };

// Estrategia conservadora: preservar el tipo original del gráfico
const refreshChart = async (chartId, sql, originalChartType, originalAxes) => {
  try {
    setRefreshingChart(chartId);
    console.log(`🔄 Actualizando gráfico ${chartId}`);
    console.log(`🎯 Tipo original: ${originalChartType}`);
    
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    
    if (error) {
      throw new Error('Error al ejecutar SQL: ' + error.message);
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      alert('La consulta SQL no devolvió datos válidos.');
      return;
    }

    console.log('📊 Datos del SQL:', data);
    console.log('🎯 Procesando con tipo original:', originalChartType);

    // PROCESAMIENTO BASADO EN EL TIPO ORIGINAL DEL GRÁFICO
    let processedData;
    
    switch (originalChartType) {
      case 'mixed':
        // Para gráficos mixtos, preservar configuración original
        processedData = processChartDataPreservingMixed(data, originalChartType, originalAxes);
        if (processedData && processedData.values && Array.isArray(processedData.values)) {
          processedData.values = fixMixedChartTypes(processedData.values, data, originalAxes);
        }
        break;
        
      case 'bar':
        // Para gráficos de barras, usar solo la columna principal
        processedData = processForBarChart(data);
        break;
      
        
      case 'line':
        // Para gráficos de línea simple
        processedData = processForLineChart(data);
        break;
        
      case 'multi-line':
        // Para gráficos multi-línea, detectar formato
        processedData = processForMultiLineChart(data);
        break;
        
      case 'pie':
        // Para gráficos de pie
        processedData = processForPieChart(data);
        break;
        
      default:
        // Fallback al procesamiento dinámico
        processedData = processChartDataDynamic(data);
    }
    

    console.log('🎯 Datos procesados:', processedData);

    // Actualizar en base de datos
    const updateData = {
      values: processedData.values,
      labels: processedData.labels,
      updated_at: new Date().toISOString()
    };

    if (originalChartType === 'mixed' && originalAxes) {
      updateData.axes = originalAxes;
    } else if (processedData.axes) {
      updateData.axes = processedData.axes;
    }

    const { error: updateError } = await supabase
      .from('graficos')
      .update(updateData)
      .eq('id', chartId);

    if (updateError) {
      throw new Error('Error al actualizar gráfico: ' + updateError.message);
    }

    setChartRenderKeys(prev => ({
      ...prev,
      [chartId]: Date.now()
    }));

    setTimeout(async () => {
      await fetchDashboardsByCategory(currentCategory.id);
      alert('¡Gráfico actualizado exitosamente!');
    }, 500);
    
  } catch (err) {
    console.error('❌ Error al actualizar gráfico:', err);
    alert('Error al actualizar gráfico: ' + err.message);
  } finally {
    setRefreshingChart(null);
  }
};

// Procesadores específicos por tipo de gráfico
const processForBarChart = (data) => {
  const keys = Object.keys(data[0]);
  const numericColumns = keys.filter(k => !isNaN(Number(data[0][k])));
  const textColumns = keys.filter(k => isNaN(Number(data[0][k])));
  
  const labelKey = textColumns[0] || keys[0];
  const valueKey = numericColumns.find(k => 
    k.toLowerCase().includes('volumen') || 
    k.toLowerCase().includes('total') || 
    k.toLowerCase().includes('transferido')
  ) || numericColumns[0];
  
  return {
    labels: data.map(row => row[labelKey]),
    values: data.map(row => Number(row[valueKey]) || 0)
  };
};

const processForLineChart = (data) => {
  const keys = Object.keys(data[0]);
  const labelKey = keys[0];
  const valueKey = keys[1];
  
  return {
    labels: data.map(row => row[labelKey]),
    values: data.map(row => Number(row[valueKey]) || 0)
  };
};

const processForMultiLineChart = (data) => {
  const keys = Object.keys(data[0]);
  const numericColumns = keys.filter(k => !isNaN(Number(data[0][k])));
  
  // Detectar formato: ancho vs largo
  if (numericColumns.length >= 2) {
    // Formato ancho: fecha | volumen_arauco | volumen_chillan
    return processWideFormat(data, keys, numericColumns);
  } else {
    // Formato largo: fecha | zona | especie | volumen
    return processLongFormat(data, keys);
  }
};

const processWideFormat = (data, keys, numericColumns) => {
  const labelKey = keys.find(k => 
    k.toLowerCase().includes('fecha') || k.toLowerCase().includes('date')
  ) || keys[0];
  
  const labels = data.map(row => row[labelKey]);
  const values = numericColumns.map(col => ({
    label: col.replace(/volumen_?/i, '').replace(/_/g, ' '),
    data: data.map(row => Number(row[col]) || 0)
  }));
  
  return { labels, values };
};

const processLongFormat = (data, keys) => {
  const labelKey = keys.find(k => 
    k.toLowerCase().includes('fecha') || k.toLowerCase().includes('date')
  );
  const valueKey = keys.find(k => !isNaN(Number(data[0][k])));
  const dimensionKeys = keys.filter(k => k !== labelKey && k !== valueKey);
  
  const labels = [...new Set(data.map(row => row[labelKey]))].sort();
  const combinations = [...new Set(data.map(row => 
    dimensionKeys.map(dim => row[dim]).join(' - ')
  ))];
  
  const values = combinations.map(combo => {
    const comboParts = combo.split(' - ');
    return {
      label: combo,
      data: labels.map(label => {
        const row = data.find(r => {
          const labelMatch = r[labelKey] === label;
          const comboMatch = dimensionKeys.every((dim, i) => r[dim] === comboParts[i]);
          return labelMatch && comboMatch;
        });
        return row ? Number(row[valueKey]) || 0 : 0;
      })
    };
  });
  
  return { labels, values };
};

const processForPieChart = (data) => {
  const keys = Object.keys(data[0]);
  const labelKey = keys[0];
  const valueKey = keys[1];
  
  return {
    labels: data.map(row => row[labelKey]),
    values: data.map(row => Number(row[valueKey]) || 0)
  };
};

const fixMixedChartTypes = (processedValues, originalData, originalAxes) => {
  console.log('🔧 [fixMixedChartTypes] === INICIO DEBUG V2 ===');
  console.log('🔧 [fixMixedChartTypes] Valores procesados:', processedValues);
  console.log('🔧 [fixMixedChartTypes] Ejes originales:', originalAxes);
  
  if (!processedValues || !Array.isArray(processedValues)) {
    console.log('🔧 [fixMixedChartTypes] processedValues no es array válido');
    return processedValues;
  }

  // ESTRATEGIA: Basarnos en el patrón conocido de tu gráfico
  // Volumen Real = línea rosa (y)
  // Volumen Proyectado = línea azul (y) 
  // Volumen Despachado = barras amarillas (y1)
  
  const fixedValues = processedValues.map((serie) => {
    const serieName = (serie.label || serie.name || '').toLowerCase();
    
    console.log(`🔧 [fixMixedChartTypes] Procesando serie: "${serie.label || serie.name}"`);
    console.log(`🔧 [fixMixedChartTypes] Nombre normalizado: "${serieName}"`);
    
    // Determinar tipo basado en el nombre de la serie
    let type = 'line';  // Default
    let yAxisID = 'y';  // Default
    
    if (serieName.includes('despachado') || serieName.includes('despacho')) {
      type = 'bar';
      yAxisID = 'y1';
      console.log(`🔧 [fixMixedChartTypes] ✅ "${serie.label || serie.name}" → BAR (eje y1)`);
    } else if (serieName.includes('real') || serieName.includes('proyectado')) {
      type = 'line';
      yAxisID = 'y';
      console.log(`🔧 [fixMixedChartTypes] ✅ "${serie.label || serie.name}" → LINE (eje y)`);
    } else {
      console.log(`🔧 [fixMixedChartTypes] ⚠️ "${serie.label || serie.name}" → LINE por defecto (eje y)`);
    }
    
    const result = {
      ...serie,
      type: type,
      yAxisID: yAxisID
    };
    
    console.log(`🔧 [fixMixedChartTypes] Serie procesada:`, {
      name: result.label || result.name,
      type: result.type,
      yAxisID: result.yAxisID
    });
    
    return result;
  });

  console.log('🔧 [fixMixedChartTypes] === RESULTADO FINAL V2 ===');
  console.log('🔧 [fixMixedChartTypes] Series originales:', processedValues.map(s => ({ 
    name: s.label || s.name, 
    type: s.type || 'undefined' 
  })));
  console.log('🔧 [fixMixedChartTypes] Series corregidas:', fixedValues.map(s => ({ 
    name: s.label || s.name, 
    type: s.type 
  })));
  
  return fixedValues;
};

// Función híbrida que mantiene compatibilidad total
const processChartData = (data) => {
  console.log('🔍 [processChartData] Iniciando procesamiento con data:', data);
  
  // Validaciones básicas
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error('❌ [processChartData] Datos inválidos:', data);
    return { values: [], labels: [] };
  }

  const firstRow = data[0];
  if (!firstRow || typeof firstRow !== 'object') {
    console.error('❌ [processChartData] Primer registro inválido:', firstRow);
    return { values: [], labels: [] };
  }

  const keys = Object.keys(firstRow);
  console.log('🔍 [processChartData] Keys:', keys);
  console.log('🔍 [processChartData] Primer registro:', firstRow);

  // Detectar tipos de columnas
  const dateColumns = keys.filter(k => 
    k.toLowerCase().includes('fecha') || 
    k.toLowerCase().includes('date') ||
    /^\d{4}-\d{2}-\d{2}/.test(String(firstRow[k]))
  );
  
  const numericColumns = keys.filter(k => {
    const value = firstRow[k];
    return (typeof value === "number" || 
           (!isNaN(Number(value)) && value !== null && value !== '')) &&
           !dateColumns.includes(k);
  });
  
  const textColumns = keys.filter(k => 
    !dateColumns.includes(k) && 
    !numericColumns.includes(k)
  );

  console.log('📊 [processChartData] Análisis:', { dateColumns, numericColumns, textColumns });

  // 1. CASO ESPECIAL: Gráficos mixtos con columna "type" o "tipo"
  const hasTypeColumn = keys.some(key => 
    key && (key.toLowerCase().includes('type') || key.toLowerCase().includes('tipo'))
  );
  
  if (hasTypeColumn) {
    console.log('🎯 [processChartData] Detectado gráfico mixto');
    return processChartDataForMixed(data, keys, dateColumns, numericColumns, textColumns);
  }

  // 2. CASO: Datos simples de 2 columnas (PRIORIDAD ALTA)
  if (keys.length === 2) {
    console.log('📊 [processChartData] Procesando gráfico simple de 2 columnas');
    
    const labelKey = textColumns[0] || dateColumns[0] || keys[0];
    const valueKey = numericColumns[0] || keys[1];
    
    const labels = data.map(row => row[labelKey] || 'Sin label');
    const values = data.map(row => Number(row[valueKey]) || 0);
    
    console.log('✅ [processChartData] Gráfico simple procesado');
    return { labels, values };
  }

  // 3. CASO: Múltiples columnas numéricas - ANÁLISIS INTELIGENTE
  if (numericColumns.length >= 2) {
    console.log('🔍 [processChartData] Múltiples columnas numéricas:', numericColumns);
    
    // DETECCIÓN INTELIGENTE: ¿Es multi-línea temporal o barras simples?
    const hasDateOrTimeColumn = dateColumns.length > 0;
    const hasVolumePattern = numericColumns.some(k => 
      k.toLowerCase().includes('volumen') && 
      k.includes('_') // volumen_arauco, volumen_chillan
    );
    
    // INDICADORES DE MULTI-LÍNEA:
    const isLikelyMultiLine = (
      hasDateOrTimeColumn ||  // Tiene fechas
      hasVolumePattern ||     // Patrón volumen_zona
      numericColumns.every(k => k.includes('_')) ||  // Todas las numéricas tienen underscore
      numericColumns.length > 2  // Más de 2 series
    );
    
    console.log('🎯 [processChartData] Análisis multi-línea:', {
      hasDateOrTimeColumn,
      hasVolumePattern, 
      isLikelyMultiLine,
      numericCount: numericColumns.length
    });

    if (isLikelyMultiLine) {
      console.log('📈 [processChartData] Procesando como multi-línea');
      
      const labelKey = dateColumns[0] || textColumns[0] || keys[0];
      
      const labels = data.map((row, index) => {
        const labelValue = row[labelKey];
        
        if (dateColumns.includes(labelKey) && labelValue) {
          try {
            const date = new Date(labelValue);
            return date.toISOString().split('T')[0];
          } catch (e) {
            return String(labelValue);
          }
        }
        
        return labelValue ? String(labelValue) : `Item ${index + 1}`;
      });

      const values = numericColumns.map(columnKey => {
        const serieData = data.map(row => Number(row[columnKey]) || 0);

        // Crear nombre de serie más amigable
        let serieName = columnKey;
        if (columnKey.toLowerCase().includes('volumen')) {
          serieName = columnKey.replace(/volumen_?/i, '').replace(/_/g, ' ');
          serieName = serieName.charAt(0).toUpperCase() + serieName.slice(1);
        }
        
        return {
          label: serieName,
          data: serieData
        };
      });

      console.log('✅ [processChartData] Multi-línea procesado');
      return { labels, values };
      
    } else {
      console.log('📊 [processChartData] Procesando como barras simples (columna principal)');
      
      // LÓGICA ORIGINAL PARA BARRAS: Usar columna principal
      const labelKey = textColumns[0] || dateColumns[0] || keys[0];
      
      // Buscar columna numérica principal
      const primaryValueKey = numericColumns.find(k => 
        k.toLowerCase().includes('volumen') || 
        k.toLowerCase().includes('total') || 
        k.toLowerCase().includes('valor') ||
        k.toLowerCase().includes('monto') ||
        k.toLowerCase().includes('transferido')  // Para tu caso específico
      ) || numericColumns[0];
      
      console.log('📊 [processChartData] Usando columna principal:', primaryValueKey);
      
      const labels = data.map(row => row[labelKey] || 'Sin label');
      const values = data.map(row => Number(row[primaryValueKey]) || 0);
      
      console.log('✅ [processChartData] Barras simples procesado');
      return { labels, values };
    }
  }

  // 4. CASO: Datos de 3 columnas con estructura serie
  if (keys.length === 3 && numericColumns.length === 1) {
    console.log('📊 [processChartData] Procesando datos de 3 columnas');
    
    const valueKey = numericColumns[0];
    const labelKey = dateColumns[0] || textColumns[0];
    const serieKey = keys.find(k => k !== valueKey && k !== labelKey);
    
    const labels = [...new Set(data.map(row => row[labelKey]))].sort();
    const series = [...new Set(data.map(row => row[serieKey]))];
    
    if (series.length === 1) {
      return {
        labels: labels,
        values: labels.map(label => {
          const row = data.find(r => r[labelKey] === label);
          return row ? Number(row[valueKey]) || 0 : 0;
        })
      };
    }
    
    const values = series.map(serie => ({
      label: serie,
      data: labels.map(label => {
        const row = data.find(r => r[labelKey] === label && r[serieKey] === serie);
        return row ? Number(row[valueKey]) || 0 : 0;
      })
    }));
    
    console.log('✅ [processChartData] Multi-serie procesado');
    return { labels, values };
  }

  // 5. FALLBACK
  console.log('📊 [processChartData] Usando fallback');
  const fallbackValueKey = numericColumns[0] || keys.find(k => !isNaN(Number(firstRow[k])));
  const fallbackLabelKey = keys.find(k => k !== fallbackValueKey) || keys[0];
  
  return {
    labels: data.map((row, i) => row[fallbackLabelKey] || `Item ${i + 1}`),
    values: data.map(row => Number(row[fallbackValueKey]) || 0)
  };
};

// Función auxiliar para gráficos mixtos
const processChartDataForMixed = (data, keys, dateColumns, numericColumns, textColumns) => {
  const typeKey = keys.find(key => 
    key.toLowerCase().includes('type') || key.toLowerCase().includes('tipo')
  );
  const valueKey = numericColumns.find(k => k !== typeKey);
  const labelKey = dateColumns[0] || textColumns[0];
  const nameKey = keys.find(k => k !== labelKey && k !== typeKey && k !== valueKey);

  if (typeKey && valueKey && labelKey) {
    const labels = [...new Set(data.map(row => row[labelKey]))].sort();
    const series = [...new Set(data.map(row => row[nameKey || 'serie']))];
    
    const values = series.map(serie => {
      const serieData = data.filter(row => row[nameKey || 'serie'] === serie);
      const serieType = serieData[0]?.[typeKey] || 'line';
      
      return {
        name: serie,
        type: serieType,
        data: labels.map(label => {
          const row = serieData.find(r => r[labelKey] === label);
          return row ? Number(row[valueKey]) : 0;
        }),
        yAxisID: serieType === 'bar' ? 'y1' : 'y'
      };
    });

    const axes = [
      { id: 'y', position: 'left', title: 'Líneas', beginAtZero: true },
      { id: 'y1', position: 'right', title: 'Barras', beginAtZero: true }
    ];

    return { labels, values, axes, chart_type: 'mixed' };
  }
  
  return { values: [], labels: [] };
};

  const safeJsonParse = (jsonString, fallback = null) => {
    if (!jsonString) return fallback;
    if (typeof jsonString !== 'string') return jsonString;
    
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error('Error parsing JSON:', e);
      return fallback;
    }
  };

  // Función para renderizar gráficos (mantenemos la misma lógica)
  const renderChart = (grafico) => {
    console.log('🎨 Renderizando gráfico:', {
      id: grafico.id,
      title: grafico.title,
      type: grafico.chart_type,
      values: grafico.values,
      labels: grafico.labels,
      axes: grafico.axes,
      updated_at: grafico.updated_at
    });

    if (!grafico.values || !grafico.labels) {
      return <div className="text-gray-500">No hay datos para mostrar</div>;
    }

    let values = safeJsonParse(grafico.values, []);
    let labels = safeJsonParse(grafico.labels, []);
    let axes = safeJsonParse(grafico.axes, null);

    console.log('📋 Datos parseados:', { values, labels, axes, type: grafico.chart_type });

    if (!values || !labels || (Array.isArray(values) && values.length === 0)) {
      return <div className="text-gray-500">No hay datos válidos para mostrar</div>;
    }

    const forceRenderKey = chartRenderKeys[grafico.id] || 0;
    const chartKey = `chart-${grafico.id}-${forceRenderKey}-${grafico.updated_at}`;
    
    console.log('🔑 Chart key:', chartKey);

    let chartData;

    // Función para crear escalas dinámicas para gráficos mixtos
    const createMixedScales = () => {
      const scales = {
        x: {
          type: 'category',
          labels: labels,
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 11
            }
          }
        }
      };

      if (axes && Array.isArray(axes)) {
        axes.forEach(axis => {
          scales[axis.id] = {
            type: 'linear',
            display: true,
            position: axis.position || 'left',
            title: {
              display: !!axis.title,
              text: axis.title,
              font: {
                size: 12,
                weight: '500'
              }
            },
            grid: {
              drawOnChartArea: axis.position !== 'right',
              color: 'rgba(0, 0, 0, 0.1)',
              drawBorder: false
            },
            beginAtZero: axis.beginAtZero !== false,
            ticks: {
              font: {
                size: 11
              }
            }
          };
        });
      }

      return scales;
    };

    // Renderizado según tipo de gráfico con estilos unificados
    switch (grafico.chart_type) {
      case 'bar':
        const barColors = generateColors(Array.isArray(values) ? values.length : 1);
        chartData = {
          labels: labels,
          datasets: [{
            label: 'Datos',
            data: values,
            backgroundColor: barColors.backgrounds,
            borderColor: barColors.borders,
            borderWidth: 2,
            borderSkipped: false,
            borderRadius: 4,
            hoverBackgroundColor: barColors.borders,
            hoverBorderWidth: 3
          }]
        };
        return (
          <div key={chartKey} style={{ position: 'relative', height: '100%' }}>
            <Bar 
              key={chartKey}
              data={chartData} 
              options={getUnifiedBaseOptions('bar')}
              redraw={true}
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
            borderWidth: 3,
            hoverBorderWidth: 4,
            hoverOffset: 8
          }]
        };
        return (
          <div key={chartKey} style={{ position: 'relative', height: '100%' }}>
            <Pie 
              key={chartKey}
              data={chartData} 
              options={getUnifiedBaseOptions('pie')}
              redraw={true}
            />
          </div>
        );

      case 'line':
        const lineColors = generateColors(1);
        chartData = {
          labels: labels,
          datasets: [{
            label: 'Datos',
            data: values,
            fill: false,
            borderColor: lineColors.borders[0],
            backgroundColor: lineColors.backgrounds[0],
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: lineColors.borders[0],
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointHoverBorderWidth: 3
          }]
        };
        return (
          <div key={chartKey} style={{ position: 'relative', height: '100%' }}>
            <Line 
              key={chartKey}
              data={chartData} 
              options={getUnifiedBaseOptions('line')}
              redraw={true}
            />
          </div>
        );

      // CASO PARA GRÁFICOS MIXTOS
      case 'mixed':
        let mixedDatasets = [];
        
        console.log('🎯 Procesando gráfico mixto con values:', values);
        
        if (Array.isArray(values) && values.length > 0) {
          const colors = generateColors(values.length);
          
          mixedDatasets = values.map((serie, index) => {
            const baseDataset = {
              label: serie.name || serie.label || `Serie ${index + 1}`,
              data: Array.isArray(serie.data) ? serie.data : [],
              borderColor: colors.borders[index],
              pointBackgroundColor: colors.borders[index],
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 8,
              pointHoverBorderWidth: 3
            };

            if (serie.type === 'bar') {
              return {
                ...baseDataset,
                type: 'bar',
                backgroundColor: colors.backgrounds[index],
                borderWidth: 2,
                borderSkipped: false,
                borderRadius: 4,
                hoverBackgroundColor: colors.borders[index],
                hoverBorderWidth: 3,
                yAxisID: serie.yAxisID || 'y1',
                order: 2
              };
            } else {
              return {
                ...baseDataset,
                type: 'line',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4,
                borderWidth: 3,
                yAxisID: serie.yAxisID || 'y',
                order: 1
              };
            }
          });
        }

        console.log('🎨 Mixed datasets generados:', mixedDatasets);

        if (mixedDatasets.length === 0) {
          return (
            <div className="text-red-500">
              <div>No se pudieron procesar los datos del gráfico mixto</div>
              <div className="text-xs mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-32">
                <div>Datos recibidos:</div>
                <pre className="text-xs">{JSON.stringify(values, null, 2)}</pre>
              </div>
            </div>
          );
        }

        chartData = {
          labels: labels,
          datasets: mixedDatasets
        };
        
        return (
          <div key={chartKey} style={{ position: 'relative', height: '100%' }}>
            <Line 
              key={chartKey}
              data={chartData} 
              options={{
                ...getUnifiedBaseOptions('mixed'),
                scales: createMixedScales()
              }}
              redraw={true}
            />
          </div>
        );

      case 'multi-line':
        let datasets = [];
        
        console.log('Procesando multi-line con values:', values);
        
        if (Array.isArray(values) && values.length > 0) {
          if (typeof values[0] === 'object' && values[0] !== null && 'name' in values[0] && 'data' in values[0]) {
            const colors = generateColors(values.length);
            datasets = values.map((series, index) => ({
              label: series.name,
              data: Array.isArray(series.data) ? series.data : [],
              borderColor: colors.borders[index],
              backgroundColor: colors.backgrounds[index],
              fill: false,
              tension: 0.4,
              borderWidth: 3,
              pointBackgroundColor: colors.borders[index],
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 8,
              pointHoverBorderWidth: 3
            }));
          }
          else if (typeof values[0] === 'object' && values[0] !== null && 'label' in values[0] && 'data' in values[0]) {
            const colors = generateColors(values.length);
            datasets = values.map((series, index) => ({
              label: series.label,
              data: Array.isArray(series.data) ? series.data : [],
              borderColor: colors.borders[index],
              backgroundColor: colors.backgrounds[index],
              fill: false,
              tension: 0.4,
              borderWidth: 3,
              pointBackgroundColor: colors.borders[index],
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 8,
              pointHoverBorderWidth: 3
            }));
          } 
          else if (Array.isArray(values[0])) {
            const colors = generateColors(values.length);
            datasets = values.map((series, index) => ({
              label: `Serie ${index + 1}`,
              data: series,
              borderColor: colors.borders[index],
              backgroundColor: colors.backgrounds[index],
              fill: false,
              tension: 0.4,
              borderWidth: 3,
              pointBackgroundColor: colors.borders[index],
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 8,
              pointHoverBorderWidth: 3
            }));
          }
          else if (typeof values[0] === 'number' || typeof values[0] === 'string') {
            const colors = generateColors(1);
            datasets = [{
              label: 'Datos',
              data: values,
              borderColor: colors.borders[0],
              backgroundColor: colors.backgrounds[0],
              fill: false,
              tension: 0.4,
              borderWidth: 3,
              pointBackgroundColor: colors.borders[0],
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 8,
              pointHoverBorderWidth: 3
            }];
          }
        }
        else if (values && typeof values === 'object' && !Array.isArray(values)) {
          const keys = Object.keys(values);
          console.log('Values es objeto con keys:', keys);
          
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
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: colors.borders[index],
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointHoverBorderWidth: 3
              };
            });
          }
        }
        else if (typeof values === 'string') {
          try {
            const reparsedValues = JSON.parse(values);
            console.log('Re-parsed values:', reparsedValues);
            
            if (Array.isArray(reparsedValues) && reparsedValues.length > 0) {
              if (typeof reparsedValues[0] === 'object' && reparsedValues[0] !== null && 'name' in reparsedValues[0] && 'data' in reparsedValues[0]) {
                const colors = generateColors(reparsedValues.length);
                datasets = reparsedValues.map((series, index) => ({
                  label: series.name,
                  data: Array.isArray(series.data) ? series.data : [],
                  borderColor: colors.borders[index],
                  backgroundColor: colors.backgrounds[index],
                  fill: false,
                  tension: 0.4,
                  borderWidth: 3,
                  pointBackgroundColor: colors.borders[index],
                  pointBorderColor: '#ffffff',
                  pointBorderWidth: 2,
                  pointRadius: 4,
                  pointHoverRadius: 8,
                  pointHoverBorderWidth: 3
                }));
              }
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
              options={getUnifiedBaseOptions('multi-line')}
              redraw={true}
            />
          </div>
        );
      
      default:
        return <div className="text-gray-500">Tipo de gráfico no soportado: {grafico.chart_type}</div>;
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

  // Función para obtener tipos únicos incluyendo 'mixed'
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

  // 🆕 Función para eliminar dashboard (añadida para completar funcionalidad)
const deleteDashboard = async (dashboardId) => {
  console.log('🗑️ [deleteDashboard] Iniciando eliminación de dashboard:', dashboardId);
  
  if (!confirm('¿Estás seguro de que quieres eliminar este gráfico? Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    // Verificar que el usuario esté autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Usuario no autenticado');
    }

    console.log('👤 Usuario autenticado:', user.id);
    console.log('🎯 Eliminando dashboard ID:', dashboardId);

    // Usar la función RPC limpia
    const { data, error } = await supabase.rpc('delete_dashboard_with_grafico', {
      dashboard_uuid: dashboardId
    });

    console.log('📡 Respuesta de RPC:', data);

    if (error) {
      console.error('❌ Error de RPC:', error);
      throw new Error('Error en función RPC: ' + error.message);
    }

    // Verificar si la función devolvió un error
    if (data && data.error) {
      console.error('❌ Error de función:', data);
      throw new Error(data.message || 'Error desconocido en función');
    }

    console.log('✅ Gráfico eliminado exitosamente:', data);

    // Refrescar la vista
    if (currentCategory) {
      console.log('🔄 Refrescando categoría:', currentCategory.id);
      await fetchDashboardsByCategory(currentCategory.id);
    }
    
    alert('¡Gráfico eliminado exitosamente!');
    
  } catch (err) {
    console.error('❌ Error completo al eliminar gráfico:', err);
    alert('Error al eliminar gráfico: ' + err.message);
  }
};

// 🔧 FUNCIÓN DE FALLBACK (Si la RPC no funciona)
const deleteDashboardFallback = async (dashboardId) => {
  console.log('🔄 [deleteDashboardFallback] Usando método fallback');
  
  if (!confirm('¿Estás seguro de que quieres eliminar este gráfico?')) {
    return;
  }

  try {
    // Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Usuario no autenticado');
    }

    // Obtener el grafico_id primero
    const { data: dashboardData, error: fetchError } = await supabase
      .from('dashboard')
      .select('grafico_id, user_id')
      .eq('id', dashboardId)
      .single();

    if (fetchError) {
      console.error('❌ Error al obtener dashboard:', fetchError);
      throw new Error('Error al obtener dashboard: ' + fetchError.message);
    }

    if (!dashboardData) {
      throw new Error('Dashboard no encontrado');
    }

    if (dashboardData.user_id !== user.id) {
      throw new Error('Sin permisos para eliminar este dashboard');
    }

    // 🔥 Eliminar el gráfico asociado
    const { error: deleteGraficoError } = await supabase
      .from('graficos')
      .delete()
      .eq('id', dashboardData.grafico_id);

    if (deleteGraficoError) {
      console.error('❌ Error al eliminar gráfico:', deleteGraficoError);
      throw new Error('Error al eliminar gráfico: ' + deleteGraficoError.message);
    }

    // 🧱 Eliminar el registro del dashboard
    const { error: deleteDashboardError } = await supabase
      .from('dashboard')
      .delete()
      .eq('id', dashboardId);

    if (deleteDashboardError) {
      console.error('❌ Error al eliminar dashboard:', deleteDashboardError);
      throw new Error('Error al eliminar dashboard: ' + deleteDashboardError.message);
    }

    alert('✅ Dashboard eliminado correctamente');
  } catch (error) {
    console.error('⚠️ Error en deleteDashboardFallback:', error.message);
    alert('Error: ' + error.message);
  }
};

// 🐛 FUNCIÓN PARA DEBUG (Usar temporalmente si algo falla)
const debugDeleteDashboard = async (dashboardId) => {
  console.log('🐛 [DEBUG] === INICIO DEBUG ELIMINACIÓN ===');
  
  try {
    // 1. Verificar usuario
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('👤 Usuario:', user?.id, 'Error:', userError);

    // 2. Verificar dashboard
    const { data: dashboardData, error: dashboardError } = await supabase
      .from('dashboard')
      .select('*')
      .eq('id', dashboardId);
    
    console.log('📊 Dashboard data:', dashboardData);
    console.log('📊 Dashboard error:', dashboardError);

    // 3. Verificar gráfico
    if (dashboardData && dashboardData[0]) {
      const graficoId = dashboardData[0].grafico_id;
      const { data: graficoData, error: graficoError } = await supabase
        .from('graficos')
        .select('*')
        .eq('id', graficoId);
      
      console.log('🎯 Gráfico data:', graficoData);
      console.log('🎯 Gráfico error:', graficoError);
    }

    // 4. Verificar políticas (simular eliminación)
    const { error: deleteTestError } = await supabase
      .from('dashboard')
      .delete()
      .eq('id', dashboardId)
      .select()
      .limit(0); // No ejecutar realmente

    console.log('🔒 Test políticas:', deleteTestError);

  } catch (err) {
    console.error('🐛 Error en debug:', err);
  }
  
  console.log('🐛 [DEBUG] === FIN DEBUG ELIMINACIÓN ===');
};

  useEffect(() => {
    fetchCategories();
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
              onClick={fetchCategories}
              className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dashboards.length === 0 && currentCategory) {
    return (
      <div className="min-h-screen bg-[url('/camioncito.png')] bg-cover bg-fixed bg-bottom p-6">
        {/* HEADER DE NAVEGACIÓN */}
        <div className="flex justify-between items-center bg-white/90 dark:bg-[#1c2e1f]/90 px-6 py-3 rounded-xl shadow mb-6 max-w-7xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
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
              No hay gráficos en esta categoría
            </div>
            <div className="text-gray-400">
              Crea gráficos con el agente de IA y guárdalos en esta categoría
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (categories.length === 0 && !currentCategory) {
    return (
      <div className="min-h-screen bg-[url('/camioncito.png')] bg-cover bg-fixed bg-bottom p-6">
        {/* HEADER DE NAVEGACIÓN */}
        <div className="flex justify-between items-center bg-white/90 dark:bg-[#1c2e1f]/90 px-6 py-3 rounded-xl shadow mb-6 max-w-7xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
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
            <div className="text-6xl mb-4">📁</div>
            <div className="text-gray-600 dark:text-white text-lg mb-2">
              No tienes categorías creadas
            </div>
            <div className="text-gray-400 mb-4">
              Crea tu primera categoría para organizar tus gráficos
            </div>
            <button 
              onClick={() => setShowCreateCategory(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
            >
              <FaPlus className="inline mr-2" /> Crear Categoría
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[url('/camioncito.png')] bg-cover bg-fixed bg-bottom p-6">
      {/* HEADER DE NAVEGACIÓN */}
      <div className="flex justify-between items-center bg-white/90 dark:bg-[#1c2e1f]/90 px-6 py-3 rounded-xl shadow mb-6 max-w-7xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
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
      <div className="bg-white/90 dark:bg-[#1c2e1f]/90 rounded-xl shadow-lg max-w-7xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        
        {/* VISTA DE CATEGORÍAS */}
        {!currentCategory && (
          <>
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">📁 Mis Dashboards</h1>
                <p className="text-gray-600 dark:text-gray-300">Organiza tus gráficos por categorías temáticas con layout flexible</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCreateCategory(true)}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
                >
                  <FaPlus /> Nueva Categoría
                </button>
                <button 
                  onClick={fetchCategories}
                  className="px-6 py-3 bg-gradient-to-r from-[#D2C900] to-[#bcae00] text-black rounded-lg hover:from-[#bcae00] hover:to-[#a89800] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  🔄 Refrescar
                </button>
              </div>
            </div>

            {/* Grid de Categorías */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((category) => (
                  <div 
                    key={category.id}
                    onClick={() => {
                      setCurrentCategory(category);
                      fetchDashboardsByCategory(category.id);
                    }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 hover:scale-105 overflow-hidden border border-gray-100 dark:border-gray-700 cursor-pointer group"
                  >
                    <div 
                      className="h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center border-b border-gray-200 dark:border-gray-600"
                      style={{ backgroundColor: category.color + '20' }}
                    >
                      <div className="text-4xl group-hover:scale-110 transition-transform duration-300">
                        {category.icon || '📁'}
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {category.name}
                      </h3>
                      
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 min-h-[40px]">
                        {category.description || 'Sin descripción'}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <FaChartBar />
                          <span>{category.chart_count} gráfico{category.chart_count !== 1 ? 's' : ''}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span>📅 {new Date(category.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex justify-end">
                        <div className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs rounded-full group-hover:from-blue-600 group-hover:to-blue-700 transition-all duration-300">
                          Ver Dashboard
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* VISTA DE DASHBOARD INDIVIDUAL CON LAYOUT FLEXIBLE */}
        {currentCategory && (
          <>
            {/* Header con breadcrumbs y controles de layout */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    setCurrentCategory(null);
                    setDashboards([]);
                    setEditMode(false);
                  }}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                  <FaArrowLeft className="text-xl" />
                </button>
                
                <div>
                  <nav className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    <span className="hover:underline cursor-pointer" onClick={() => setCurrentCategory(null)}>
                      Dashboards
                    </span> 
                    <span className="mx-2">/</span> 
                    <span className="text-gray-800 dark:text-white font-medium">
                      {currentCategory.name}
                    </span>
                  </nav>
                  
                  <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                    <span className="text-2xl">{currentCategory.icon}</span>
                    {currentCategory.name}
                  </h1>
                  
                  <p className="text-gray-600 dark:text-gray-300 mt-1">
                    {currentCategory.description || 'Dashboard con layout flexible y gráficos mixtos preservados'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                {/* Botón de modo edición */}
                <button 
                  onClick={() => setEditMode(!editMode)}
                  className={`px-6 py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2 ${
                    editMode 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700' 
                      : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                  }`}
                >
                  <FaExpandArrowsAlt />
                  {editMode ? 'Salir de Edición' : 'Editar Layout'}
                </button>
                
                <button 
                  onClick={() => fetchDashboardsByCategory(currentCategory.id)}
                  className="px-6 py-3 bg-gradient-to-r from-[#D2C900] to-[#bcae00] text-black rounded-lg hover:from-[#bcae00] hover:to-[#a89800] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  🔄 Refrescar
                </button>
              </div>
            </div>

            {/* Información del modo edición */}
            {editMode && (
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-b border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <FaExpandArrowsAlt />
                  <span className="font-medium">Modo Edición Activo</span>
                  <span className="text-sm">
                    - Usa los controles en la esquina superior derecha de cada gráfico para cambiar su tamaño
                  </span>
                </div>
              </div>
            )}

            {/* Grid flexible de gráficos */}
            <div className="p-6">
              <div className="grid grid-cols-12 gap-6">
                {dashboards.map((dashboard) => {
                  const grafico = dashboard.graficos && dashboard.graficos.length > 0 ? dashboard.graficos[0] : null;
                  
                  if (!grafico) return null;
                  
                  return (
                    <div 
                      key={dashboard.id} 
                      className={`${getChartSizeClasses(grafico.id)} relative`}
                    >
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 h-full">
                        {/* Selector de tamaño (solo en modo edición) */}
                        <SizeSelector chartId={grafico.id} currentSize={chartSizes[grafico.id]} />
                        
                        {/* Header compacto de la tarjeta */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                          <div className="flex justify-between items-center">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-bold text-gray-800 dark:text-white truncate">
                                {grafico.title || dashboard.name || 'Sin título'}
                              </h3>
                              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center bg-white dark:bg-gray-700 px-2 py-1 rounded-full">
                                  {grafico.chart_type === 'bar' && '📊'}
                                  {grafico.chart_type === 'pie' && '🥧'}
                                  {grafico.chart_type === 'line' && '📈'}
                                  {grafico.chart_type === 'multi-line' && '📊'}
                                  {grafico.chart_type === 'mixed' && '🎯'}
                                  <span className="ml-1 capitalize">
                                    {grafico.chart_type === 'mixed' ? 'Mixto' : grafico.chart_type}
                                  </span>
                                </span>
                                {/* Información de ejes para gráficos mixtos */}
                                {grafico.chart_type === 'mixed' && grafico.axes && (
                                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                                    {safeJsonParse(grafico.axes, []).length} ejes
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {!editMode && (
                              <div className="flex space-x-1 ml-2">
                                {/* 🆕 NUEVO BOTÓN DE EDITAR */}
                                <button
                                  onClick={() => openEditor(grafico, dashboard)}
                                  className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs rounded hover:from-blue-600 hover:to-blue-700 transition-all duration-300"
                                  title="Editar gráfico"
                                >
                                  ✏️
                                </button>
                                
                                <button
                                  onClick={() => refreshChart(
                                    grafico.id, 
                                    grafico.sql, 
                                    grafico.chart_type,
                                    grafico.axes
                                  )}
                                  disabled={refreshingChart === grafico.id}
                                  className="p-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs rounded hover:from-green-600 hover:to-green-700 disabled:opacity-50 transition-all duration-300"
                                  title="Actualizar datos"
                                >
                                  {refreshingChart === grafico.id ? '⏳' : '🔄'}
                                </button>
                                
                                <button
                                  onClick={() => deleteDashboard(dashboard.id)}
                                  className="p-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded hover:from-red-600 hover:to-red-700 transition-all duration-300"
                                  title="Eliminar gráfico"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Contenido del gráfico con altura dinámica */}
                        <div className="p-4">
                          <div className={`${getChartHeight(grafico.id)} relative bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-lg`}>
                            {renderChart(grafico)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL PARA CREAR CATEGORÍA */}
      {showCreateCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                ➕ Nueva Categoría
              </h2>
              <button 
                onClick={() => setShowCreateCategory(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre de la categoría *
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  placeholder="Ej: Producción, Ventas, Finanzas..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Icono
                </label>
                <div className="flex gap-2 flex-wrap">
                  {['📊', '🏭', '💰', '📈', '👥', '🎯', '📋', '⚙️', '🌟', '📦'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setNewCategory({...newCategory, icon: emoji})}
                      className={`p-2 text-2xl rounded-lg border-2 transition-all duration-200 ${
                        newCategory.icon === emoji 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' 
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                  placeholder="Describe el propósito de esta categoría..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color del tema
                </label>
                <div className="flex gap-2 flex-wrap">
                  {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCategory({...newCategory, color})}
                      className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                        newCategory.color === color 
                          ? 'border-gray-800 dark:border-white scale-110' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={() => setShowCreateCategory(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={createCategory}
                disabled={!newCategory.name.trim()}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                Crear Categoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 MODAL DEL EDITOR */}
      {showEditor && editingChart && editingDashboard && (
        <ChartEditor
          grafico={editingChart}
          dashboard={editingDashboard}
          onSave={handleEditorSave}
          onClose={closeEditor}
          supabase={supabase}
          processChartDataPreservingMixed={processChartDataPreservingMixed}
          processForBarChart={processForBarChart}
          processForLineChart={processForLineChart}
          processForMultiLineChart={processForMultiLineChart}
          processForPieChart={processForPieChart}
          processChartData={processChartData}
        />
      )}
    </div>
  );
};

export default DashboardPage;
