import { Component, Input, signal, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import maplibregl from 'maplibre-gl';
import { MAP_STYLES } from '../../shared/map-styles';

@Component({
  selector: 'app-public-map',
  standalone: true,
  imports: [CommonModule, KeyValuePipe],
  templateUrl: './public-map.component.html',
})
export class PublicMapComponent implements OnInit, OnDestroy {
  @Input() slug: string | null = null;
  @ViewChild('publicMapContainer', { static: false }) mapEl!: ElementRef;

  map = signal<any>(null);
  publicMaps = signal<any[]>([]);
  themes = signal<string[]>([]);
  selectedTheme = signal<string | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  layerVisibility = signal<Record<string, boolean>>({});

  private glMap: maplibregl.Map | null = null;

  mapStyles = MAP_STYLES;
  currentStyle = signal<string>('osm');
  private currentMapData: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    if (this.slug) {
      this.loadMap(this.slug);
    } else {
      this.loadPublicMaps();
    }
  }

  ngOnDestroy() {
    if (this.glMap) { this.glMap.remove(); this.glMap = null; }
  }

  loadMap(slug: string) {
    this.loading.set(true);
    this.http.get(`/api/maps/public/${slug}`).subscribe({
      next: (data: any) => {
        this.map.set(data);
        const vis: Record<string, boolean> = {};
        (data.layers || []).forEach((l: any) => { vis[l.id] = true; });
        this.layerVisibility.set(vis);
        this.loading.set(false);
        setTimeout(() => this.initPublicMap(data), 100);
      },
      error: () => {
        this.error.set('Mapa no encontrado');
        this.loading.set(false);
      },
    });
  }

  loadPublicMaps() {
    this.loading.set(true);
    this.http.get<any[]>('/api/maps/public').subscribe({
      next: (data) => {
        this.publicMaps.set(data);
        const uniqueThemes = [...new Set(data.map((m: any) => m.theme).filter(Boolean))];
        this.themes.set(uniqueThemes as string[]);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  filterByTheme(theme: string) {
    this.selectedTheme.set(theme === this.selectedTheme() ? null : theme);
  }

  filteredMaps() {
    const theme = this.selectedTheme();
    if (!theme) return this.publicMaps();
    return this.publicMaps().filter((m: any) => m.theme === theme);
  }

  openMap(slug: string) {
    window.location.href = `/mapa/${slug}`;
  }

  toggleLayer(layerId: string) {
    const vis = { ...this.layerVisibility() };
    vis[layerId] = !vis[layerId];
    this.layerVisibility.set(vis);

    if (!this.glMap) return;
    const visible = vis[layerId] ? 'visible' : 'none';
    [`layer-fill-${layerId}`, `layer-line-${layerId}`, `layer-circle-${layerId}`].forEach((id) => {
      if (this.glMap!.getLayer(id)) this.glMap!.setLayoutProperty(id, 'visibility', visible);
    });
  }

  changeMapStyle(styleId: string) {
    if (!this.glMap || styleId === this.currentStyle()) return;
    this.currentStyle.set(styleId);
    const style = this.mapStyles.find(s => s.id === styleId)?.style;
    if (!style) return;

    const center = this.glMap.getCenter();
    const zoom = this.glMap.getZoom();

    this.glMap.setStyle(style);
    this.glMap.once('style.load', () => {
      this.glMap!.setCenter(center);
      this.glMap!.setZoom(zoom);
      if (this.currentMapData) this.addMapLayers(this.currentMapData);
    });
  }

  private initPublicMap(data: any) {
    if (!this.mapEl?.nativeElement) return;

    this.glMap = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: this.mapStyles.find(s => s.id === this.currentStyle())!.style,
      center: [-99.13, 19.43],
      zoom: 12,
    });

    this.glMap.addControl(new maplibregl.NavigationControl(), 'top-right');

    this.glMap.on('load', () => {
      this.currentMapData = data;
      this.addMapLayers(data);
    });
  }

  private addMapLayers(data: any) {
    if (!this.glMap) return;
    const bounds = new maplibregl.LngLatBounds();
    let hasFeatures = false;

    (data.layers || []).forEach((layer: any) => {
      const color = layer.style?.color || '#3b82f6';
      const rawFeatures = (layer.features || []).map((f: any) => {
        const geom = f.geometry;
        if (geom.type === 'Point') bounds.extend(geom.coordinates);
        else if (geom.type === 'LineString') geom.coordinates.forEach((c: any) => bounds.extend(c));
        else if (geom.type === 'Polygon') geom.coordinates[0].forEach((c: any) => bounds.extend(c));
        hasFeatures = true;
        return {
          type: 'Feature',
          geometry: geom,
          properties: { name: f.name, ...f.properties },
        };
      });

      const sourceId = `src-${layer.id}`;
        this.glMap!.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: rawFeatures },
      });

      this.glMap!.addLayer({
        id: `layer-fill-${layer.id}`,
        type: 'fill',
        source: sourceId,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': color, 'fill-opacity': 0.3 },
      });

      this.glMap!.addLayer({
        id: `layer-line-${layer.id}`,
        type: 'line',
        source: sourceId,
        filter: ['in', '$type', 'LineString', 'Polygon'],
        paint: { 'line-color': color, 'line-width': layer.style?.weight || 2 },
      });

      this.glMap!.addLayer({
        id: `layer-circle-${layer.id}`,
        type: 'circle',
        source: sourceId,
        filter: ['all', ['==', '$type', 'Point'], ['!has', 'icon']],
        paint: { 'circle-radius': 7, 'circle-color': color, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
      });

      this.glMap!.addLayer({
        id: `layer-icon-${layer.id}`,
        type: 'symbol',
        source: sourceId,
        filter: ['all', ['==', '$type', 'Point'], ['has', 'icon']],
        layout: {
          'icon-image': ['get', 'iconId'],
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-anchor': 'center',
        },
      });

      // Load SVG icons
      const iconsToLoad = rawFeatures.filter((f: any) => f.properties?.icon);
      const uniqueUrls = [...new Set(iconsToLoad.map((f: any) => f.properties.icon))] as string[];
      uniqueUrls.forEach((url) => {
        const iconId = 'icon-' + url.replace(/[^a-z0-9]/gi, '_');
        const img = new Image(32, 32);
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!this.glMap!.hasImage(iconId)) {
            this.glMap!.addImage(iconId, img);
            (this.glMap!.getSource(sourceId) as maplibregl.GeoJSONSource).setData(
              { type: 'FeatureCollection', features: rawFeatures.map((f: any) => {
                if (f.properties?.icon) f.properties.iconId = 'icon-' + f.properties.icon.replace(/[^a-z0-9]/gi, '_');
                return f;
              })},
            );
          }
        };
        img.src = url;
      });

      // Popup
        [`layer-circle-${layer.id}`, `layer-icon-${layer.id}`, `layer-fill-${layer.id}`, `layer-line-${layer.id}`].forEach((layerMapId) => {
        this.glMap!.on('click', layerMapId, (e: any) => {
          const props = e.features[0].properties;
          let html = `<div style="font-size:13px"><strong style="font-size:14px">${props.name}</strong>`;
          Object.keys(props).forEach((k) => {
            if (!['name', 'icon', 'iconId'].includes(k) && props[k] != null && props[k] !== '') html += `<br><b>${k}:</b> ${props[k]}`;
          });
          html += '</div>';
          new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(this.glMap!);
        });
        this.glMap!.on('mouseenter', layerMapId, () => { this.glMap!.getCanvas().style.cursor = 'pointer'; });
        this.glMap!.on('mouseleave', layerMapId, () => { this.glMap!.getCanvas().style.cursor = ''; });
      });
    });

    if (hasFeatures && !bounds.isEmpty()) {
      this.glMap!.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
  }


}