export interface MapStyleOption {
  id: string;
  name: string;
  icon: string;
  style: any;
}

export const MAP_STYLES: MapStyleOption[] = [
  {
    id: 'osm',
    name: 'Estándar',
    icon: '🗺️',
    style: {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap',
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
    },
  },
  {
    id: 'positron',
    name: 'Claro',
    icon: '☀️',
    style: {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
          tileSize: 256,
          attribution: '© CartoDB © OpenStreetMap',
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
    },
  },
  {
    id: 'dark',
    name: 'Oscuro',
    icon: '🌙',
    style: {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
          tileSize: 256,
          attribution: '© CartoDB © OpenStreetMap',
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
    },
  },
  {
    id: 'topo',
    name: 'Topográfico',
    icon: '⛰️',
    style: {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenTopoMap © OpenStreetMap',
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
    },
  },
  {
    id: 'satellite',
    name: 'Satélite',
    icon: '🛰️',
    style: {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '© Esri',
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
    },
  },
];