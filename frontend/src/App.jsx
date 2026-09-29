import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

// Helper to generate a hexagon around clicked coordinate for 3D extrusion
function getHexagonCoordinates(centerLon, centerLat, radius = 0.00015) {
  const coords = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    coords.push([
      centerLon + Math.cos(angle) * radius * 1.05,
      centerLat + Math.sin(angle) * radius
    ]);
  }
  coords.push(coords[0]); // close loop
  return coords;
}

const INTERVENTIONS = {
  tree: { name: '1,000 Trees', cost: 10, color: '#22c55e', height: 12, icon: '🌳' },
  garden: { name: 'Vertical Garden', cost: 4, color: '#10b981', height: 18, icon: '🌿' },
  rcu: { name: 'Roadside RCU', cost: 15, color: '#00d2ff', height: 15, icon: '💨' },
  dac: { name: 'DAC Plant', cost: 120, color: '#a855f7', height: 28, icon: '🏭' }
};

function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [liveData, setLiveData] = useState(null);
  const [selectedTool, setSelectedTool] = useState('inspect'); // 'inspect', 'tree', 'garden', 'rcu', 'dac', 'clear'
  const [budget, setBudget] = useState(0);
  const [placedItems, setPlacedItems] = useState([]); // Array of { id, lon, lat, tool }
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Refs to prevent stale closure inside MapLibre click callback
  const selectedToolRef = useRef(selectedTool);
  const placedItemsRef = useRef(placedItems);

  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);

  useEffect(() => {
    placedItemsRef.current = placedItems;
    // Update map source whenever placed items state changes (only after style has loaded)
    if (mapRef.current && isMapLoaded && mapRef.current.getSource('interventions-src')) {
      const geojson = {
        type: 'FeatureCollection',
        features: placedItems.map(item => {
          const details = INTERVENTIONS[item.tool];
          return {
            type: 'Feature',
            id: item.id,
            properties: {
              id: item.id,
              tool: item.tool,
              color: details.color,
              height: details.height
            },
            geometry: {
              type: 'Polygon',
              coordinates: [getHexagonCoordinates(item.lon, item.lat)]
            }
          };
        })
      };
      mapRef.current.getSource('interventions-src').setData(geojson);
    }
  }, [placedItems, isMapLoaded]);

  useEffect(() => {
    // Fetch live weather & AQI on mount
    fetch('/api/live-data')
      .then(res => res.json())
      .then(data => setLiveData(data))
      .catch(err => console.error('Error fetching live BKC data:', err));
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize MapLibre GL centered on Bandra Kurla Complex (BKC)
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [72.864, 19.059],
      zoom: 14.5,
      pitch: 55,
      bearing: -20,
      antialias: true
    });

    mapRef.current = map;

    map.on('load', () => {
      // Define active bounds coordinates
      const minLon = 72.852;
      const maxLon = 72.880;
      const minLat = 19.050;
      const maxLat = 19.072;

      // Add boundary outline source
      map.addSource('bkc-boundary-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [minLon, minLat],
              [maxLon, minLat],
              [maxLon, maxLat],
              [minLon, maxLat],
              [minLon, minLat]
            ]]
          }
        }
      });

      // Draw the boundary line (refined gold/brass)
      map.addLayer({
        id: 'bkc-boundary-line',
        type: 'line',
        source: 'bkc-boundary-src',
        paint: {
          'line-color': '#c5a880',
          'line-width': 2,
          'line-opacity': 0.6
        }
      });

      // Add a subtle warm overlay inside the boundary
      map.addLayer({
        id: 'bkc-boundary-fill',
        type: 'fill',
        source: 'bkc-boundary-src',
        paint: {
          'fill-color': '#c5a880',
          'fill-opacity': 0.02
        }
      }, 'bkc-boundary-line');

      // Style the built-in CartoDB base map water layer to deep navy blue
      if (map.getLayer('water')) {
        map.setPaintProperty('water', 'fill-color', '#1f3a52');
        map.setPaintProperty('water', 'fill-opacity', 0.85);
      }

      // Fetch the real OSM 3D buildings GeoJSON via our Express Backend Proxy
      map.addSource('bkc-buildings-src', {
        type: 'geojson',
        data: '/api/buildings'
      });

      // Extrude buildings inside our active zone in elegant warm matte bronze/gold
      map.addLayer({
        id: 'bkc-buildings-layer',
        type: 'fill-extrusion',
        source: 'bkc-buildings-src',
        paint: {
          'fill-extrusion-color': '#c5a880',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.9
        }
      });

      // Fetch the real OSM Greenery / Parks / Trees data
      map.addSource('bkc-greenery-src', {
        type: 'geojson',
        data: '/api/greenery'
      });

      // Render ground parks & grass patches (soft moss green)
      map.addLayer({
        id: 'bkc-parks-layer',
        type: 'fill',
        source: 'bkc-greenery-src',
        filter: ['==', ['get', 'is_3d'], false],
        paint: {
          'fill-color': '#3a5a40',
          'fill-opacity': 0.5
        }
      }, 'bkc-buildings-layer');

      // Extrude individual trees in 3D (hexagon canopies in soft forest green)
      map.addLayer({
        id: 'bkc-trees-3d-layer',
        type: 'fill-extrusion',
        source: 'bkc-greenery-src',
        filter: ['==', ['get', 'is_3d'], true],
        paint: {
          'fill-extrusion-color': '#588157',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.95
        }
      });

      // Initialize source for placed 3D interventions
      map.addSource('interventions-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Extrude placed items in 3D
      map.addLayer({
        id: 'interventions-3d-layer',
        type: 'fill-extrusion',
        source: 'interventions-src',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.95
        }
      });

      setIsMapLoaded(true);
    });

    // Handle map clicks for placements
    map.on('click', (e) => {
      const lon = e.lngLat.lng;
      const lat = e.lngLat.lat;
      const minLon = 72.852;
      const maxLon = 72.880;
      const minLat = 19.050;
      const maxLat = 19.072;

      // Active zone check
      if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return;

      const tool = selectedToolRef.current;

      if (tool === 'inspect') {
        return;
      }

      if (tool === 'clear') {
        // Find closest placed item and remove it
        const currentItems = [...placedItemsRef.current];
        if (currentItems.length === 0) return;

        let closestIndex = -1;
        let minDistance = Infinity;

        currentItems.forEach((item, index) => {
          const dist = Math.sqrt(Math.pow(item.lon - lon, 2) + Math.pow(item.lat - lat, 2));
          if (dist < minDistance) {
            minDistance = dist;
            closestIndex = index;
          }
        });

        // Threshold distance to prevent clearing random items
        if (minDistance < 0.001) {
          const removedItem = currentItems[closestIndex];
          const cost = INTERVENTIONS[removedItem.tool].cost;
          setBudget(prev => Math.max(0, prev - cost));
          setPlacedItems(currentItems.filter((_, idx) => idx !== closestIndex));
        }
      } else {
        // Place new intervention
        const cost = INTERVENTIONS[tool].cost;
        setBudget(prev => prev + cost);
        setPlacedItems(prev => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            lon: lon,
            lat: lat,
            tool: tool
          }
        ]);
      }
    });

    return () => map.remove();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 📡 Live Telemetry Bar */}
      {liveData && (
        <div style={styles.telemetryBar}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={styles.telemetryDot} />
            <strong style={{ color: '#c5a880' }}>BKC Live Telemetry</strong>
          </span>
          <span>🌡️ {liveData.temp}°C</span>
          <span>💨 {liveData.windSpeed} km/h ({liveData.windDir}°)</span>
          <span style={{ color: liveData.aqi < 50 ? '#10b981' : (liveData.aqi < 100 ? '#f59e0b' : '#ef4444') }}>
            🍃 AQI: {liveData.aqi}
          </span>
        </div>
      )}

      {/* 💰 Budget Telemetry Card */}
      <div style={styles.budgetCard}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#8e9bb0' }}>Budget Expended</div>
        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#c5a880', fontFamily: 'monospace' }}>
          ₹{budget >= 100 ? `${(budget / 100).toFixed(2)} Cr` : `${budget} Lakhs`}
        </div>
        <div style={{ fontSize: '0.65rem', color: '#8e9bb0', marginTop: '4px' }}>
          Placed Items: {placedItems.length}
        </div>
      </div>

      {/* 🛠️ Floating Tools Toolbar */}
      <div style={styles.toolbar}>
        <button 
          onClick={() => setSelectedTool('inspect')} 
          style={{...styles.toolButton, ...(selectedTool === 'inspect' ? styles.toolButtonActive : {})}}
        >
          🔍 Inspect
        </button>
        {Object.entries(INTERVENTIONS).map(([key, details]) => (
          <button
            key={key}
            onClick={() => setSelectedTool(key)}
            style={{...styles.toolButton, ...(selectedTool === key ? styles.toolButtonActive : {})}}
          >
            <span style={{ marginRight: '5px' }}>{details.icon}</span>
            {details.name} (₹{details.cost}L)
          </button>
        ))}
        <button 
          onClick={() => setSelectedTool('clear')} 
          style={{...styles.toolButton, ...styles.clearBtn, ...(selectedTool === 'clear' ? styles.toolButtonActiveClear : {})}}
        >
          🗑️ Clear
        </button>
      </div>

      <div 
        ref={mapContainer} 
        style={{ width: '100%', height: '100%' }} 
      />
    </div>
  );
}

const styles = {
  telemetryBar: {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(15, 18, 25, 0.88)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '30px',
    padding: '8px 24px',
    color: '#e5e9f0',
    fontSize: '0.82rem',
    fontWeight: '600',
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    zIndex: 10,
    whiteSpace: 'nowrap',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  telemetryDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#00d2ff',
    boxShadow: '0 0 8px #00d2ff'
  },
  budgetCard: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    backgroundColor: 'rgba(15, 18, 25, 0.88)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px 18px',
    color: '#e5e9f0',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    zIndex: 10,
    minWidth: '150px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  toolbar: {
    position: 'absolute',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(15, 18, 25, 0.9)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '8px 12px',
    display: 'flex',
    gap: '8px',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
    zIndex: 10,
    overflowX: 'auto',
    maxWidth: '90%',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  toolButton: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    color: '#8e9bb0',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    outline: 'none'
  },
  toolButtonActive: {
    background: 'rgba(197, 168, 128, 0.15)',
    border: '1px solid #c5a880',
    color: '#c5a880',
    boxShadow: '0 0 10px rgba(197, 168, 128, 0.2)'
  },
  clearBtn: {
    borderStyle: 'dashed'
  },
  toolButtonActiveClear: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#ef4444',
    boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)'
  }
};

export default App;
