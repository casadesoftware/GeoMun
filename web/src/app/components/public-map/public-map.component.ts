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
  styles: [`
    :host { display: block; height: 100vh; width: 100vw; }

    /* ===== Popup styling ===== */
    ::ng-deep .maplibregl-popup-content {
      background: rgba(15, 23, 42, 0.95) !important;
      backdrop-filter: blur(16px) !important;
      border: 1px solid rgba(255,255,255,0.12) !important;
      border-radius: 12px !important;
      padding: 0 !important;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important;
      max-width: 300px !important;
      overflow: hidden;
    }
    ::ng-deep .maplibregl-popup-close-button {
      color: rgba(255,255,255,0.5) !important;
      font-size: 18px !important;
      right: 6px !important;
      top: 4px !important;
      z-index: 2;
    }
    ::ng-deep .maplibregl-popup-close-button:hover {
      color: #fff !important;
      background: transparent !important;
    }
    ::ng-deep .maplibregl-popup-tip {
      border-top-color: rgba(15, 23, 42, 0.95) !important;
    }

    /* Popup inner styles */
    ::ng-deep .pm-popup { padding: 14px 16px 12px; }
    ::ng-deep .pm-popup-title {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
      padding-right: 16px;
      line-height: 1.3;
    }
    ::ng-deep .pm-popup-field {
      display: flex;
      gap: 6px;
      padding: 4px 0;
      font-size: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      align-items: flex-start;
    }
    ::ng-deep .pm-popup-field:last-child { border-bottom: none; }
    ::ng-deep .pm-popup-key {
      color: rgba(255,255,255,0.4);
      font-weight: 500;
      min-width: 0;
      flex-shrink: 0;
      text-transform: capitalize;
    }
    ::ng-deep .pm-popup-val {
      color: rgba(255,255,255,0.85);
      word-break: break-word;
      flex: 1;
      min-width: 0;
    }

    /* Image thumbnail */
    ::ng-deep .pm-popup-thumb {
      width: 100%;
      max-height: 140px;
      object-fit: cover;
      border-radius: 6px;
      cursor: pointer;
      transition: opacity 0.15s;
      margin-top: 2px;
    }
    ::ng-deep .pm-popup-thumb:hover { opacity: 0.85; }

    /* URL link */
    ::ng-deep .pm-popup-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #818cf8;
      text-decoration: none;
      font-size: 12px;
      transition: color 0.15s;
    }
    ::ng-deep .pm-popup-link:hover { color: #a5b4fc; text-decoration: underline; }
    ::ng-deep .pm-popup-link svg {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
    }

    /* Navigation control styling */
    ::ng-deep .maplibregl-ctrl-group {
      background: rgba(15, 23, 42, 0.9) !important;
      backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(255,255,255,0.12) !important;
      border-radius: 12px !important;
      overflow: hidden;
    }
    ::ng-deep .maplibregl-ctrl-group button {
      background-color: transparent !important;
      border-color: rgba(255,255,255,0.08) !important;
    }
    ::ng-deep .maplibregl-ctrl-group button span {
      filter: invert(1) !important;
    }

    /* Attribution */
    ::ng-deep .maplibregl-ctrl-attrib {
      background: rgba(15, 23, 42, 0.7) !important;
      backdrop-filter: blur(8px) !important;
      font-size: 10px !important;
    }
    ::ng-deep .maplibregl-ctrl-attrib a { color: rgba(255,255,255,0.4) !important; }
  `],
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
  sidebarOpen = signal(false);
  lightboxUrl = signal<string | null>(null);

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

    // Escuchar clicks de lightbox (delegado desde popups)
    document.addEventListener('click', this.handleGlobalClick);
  }

  ngOnDestroy() {
    if (this.glMap) { this.glMap.remove(); this.glMap = null; }
    document.removeEventListener('click', this.handleGlobalClick);
  }

  private handleGlobalClick = (e: Event) => {
    const target = e.target as HTMLElement;

    // Lightbox trigger
    if (target.classList.contains('pm-popup-thumb')) {
      e.preventDefault();
      e.stopPropagation();
      const url = target.getAttribute('data-full-url') || (target as HTMLImageElement).src;
      this.lightboxUrl.set(url);
    }
  };

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
    [`layer-fill-${layerId}`, `layer-line-${layerId}`, `layer-circle-${layerId}`, `layer-icon-${layerId}`].forEach((id) => {
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

    let reloaded = false;
    const reload = () => {
      if (reloaded || !this.glMap) return;
      reloaded = true;
      this.glMap.setCenter(center);
      this.glMap.setZoom(zoom);
      if (this.currentMapData) {
        this.addMapLayers(this.currentMapData);
        this.applyLayerVisibility();
      }
    };

    this.glMap.once('style.load', () => requestAnimationFrame(reload));
    setTimeout(reload, 1000); // fallback de seguridad
  }

  private applyLayerVisibility() {
    if (!this.glMap) return;
    const vis = this.layerVisibility();
    Object.keys(vis).forEach((layerId) => {
      const visible = vis[layerId] ? 'visible' : 'none';
      [`layer-fill-${layerId}`, `layer-line-${layerId}`, `layer-circle-${layerId}`, `layer-icon-${layerId}`].forEach((id) => {
        if (this.glMap!.getLayer(id)) this.glMap!.setLayoutProperty(id, 'visibility', visible);
      });
    });
  }

  geolocate() {
    if (!this.glMap || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.glMap!.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 15,
          duration: 1500,
        });
      },
      () => {},
      { enableHighAccuracy: true },
    );
  }

  fitToFeatures() {
    if (!this.glMap || !this.currentMapData) return;
    const bounds = new maplibregl.LngLatBounds();
    let hasFeatures = false;

    (this.currentMapData.layers || []).forEach((layer: any) => {
      (layer.features || []).forEach((f: any) => {
        const geom = f.geometry;
        if (geom.type === 'Point') bounds.extend(geom.coordinates);
        else if (geom.type === 'LineString') geom.coordinates.forEach((c: any) => bounds.extend(c));
        else if (geom.type === 'Polygon') geom.coordinates[0].forEach((c: any) => bounds.extend(c));
        hasFeatures = true;
      });
    });

    if (hasFeatures && !bounds.isEmpty()) {
      this.glMap.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 1000 });
    }
  }

  getTotalFeatures(): number {
    if (!this.map()) return 0;
    return (this.map().layers || []).reduce((sum: number, l: any) => sum + (l.features?.length || 0), 0);
  }

  private initPublicMap(data: any) {
    if (!this.mapEl?.nativeElement) return;

    this.glMap = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: this.mapStyles.find(s => s.id === this.currentStyle())!.style,
      center: [-99.13, 19.43],
      zoom: 12,
    });

    this.glMap.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

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
        paint: { 'fill-color': color, 'fill-opacity': 0.25 },
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
        paint: {
          'circle-radius': 7,
          'circle-color': color,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
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
            (this.glMap!.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
              type: 'FeatureCollection',
              features: rawFeatures.map((f: any) => {
                if (f.properties?.icon) f.properties.iconId = 'icon-' + f.properties.icon.replace(/[^a-z0-9]/gi, '_');
                return f;
              }),
            });
          }
        };
        img.src = url;
      });

      // Smart Popup
      [`layer-circle-${layer.id}`, `layer-icon-${layer.id}`, `layer-fill-${layer.id}`, `layer-line-${layer.id}`].forEach((layerMapId) => {
        this.glMap!.on('click', layerMapId, (e: any) => {
          const props = e.features[0].properties;
          const html = this.buildSmartPopup(props);
          new maplibregl.Popup({ maxWidth: '300px', closeButton: true })
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(this.glMap!);
        });
        this.glMap!.on('mouseenter', layerMapId, () => { this.glMap!.getCanvas().style.cursor = 'pointer'; });
        this.glMap!.on('mouseleave', layerMapId, () => { this.glMap!.getCanvas().style.cursor = ''; });
      });
    });

    if (hasFeatures && !bounds.isEmpty()) {
      this.glMap!.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
  }

  /** Detecta si un valor es URL de imagen */
  private isImageUrl(value: string): boolean {
    if (typeof value !== 'string') return false;
    const v = value.toLowerCase().trim();
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(v) ||
           v.includes('/images/') && v.startsWith('http');
  }

  /** Detecta si un valor es una URL */
  private isUrl(value: string): boolean {
    if (typeof value !== 'string') return false;
    const v = value.trim();
    return /^https?:\/\//i.test(v);
  }

  /** Genera truncamiento elegante de URL para display */
  private displayUrl(url: string): string {
    try {
      const u = new URL(url);
      let display = u.hostname.replace('www.', '');
      if (u.pathname.length > 1) {
        const path = u.pathname.length > 20 ? u.pathname.slice(0, 20) + '…' : u.pathname;
        display += path;
      }
      return display;
    } catch {
      return url.length > 35 ? url.slice(0, 35) + '…' : url;
    }
  }

  /** Construye HTML del popup con detección inteligente de contenido */
  private buildSmartPopup(props: any): string {
    const skip = ['name', 'icon', 'iconId'];
    let fieldsHtml = '';
    const images: string[] = [];

    Object.keys(props).forEach((k) => {
      if (skip.includes(k) || props[k] == null || props[k] === '') return;

      const val = String(props[k]);

      if (this.isImageUrl(val)) {
        // Acumular imágenes para mostrarlas al final
        images.push(val);
      } else if (this.isUrl(val)) {
        // Link externo con icono
        fieldsHtml += `
          <div class="pm-popup-field">
            <span class="pm-popup-key">${this.escapeHtml(k)}:</span>
            <span class="pm-popup-val">
              <a href="${this.escapeHtml(val)}" target="_blank" rel="noopener noreferrer" class="pm-popup-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                ${this.escapeHtml(this.displayUrl(val))}
              </a>
            </span>
          </div>`;
      } else {
        // Campo de texto normal
        fieldsHtml += `
          <div class="pm-popup-field">
            <span class="pm-popup-key">${this.escapeHtml(k)}:</span>
            <span class="pm-popup-val">${this.escapeHtml(val)}</span>
          </div>`;
      }
    });

    // Agregar thumbnails de imágenes
    let imagesHtml = '';
    if (images.length > 0) {
      imagesHtml = images.map((url) => `
        <img src="${this.escapeHtml(url)}"
             class="pm-popup-thumb"
             data-full-url="${this.escapeHtml(url)}"
             loading="lazy"
             alt="Foto"
             onerror="this.style.display='none'" />
      `).join('');
    }

    return `
      <div class="pm-popup">
        <div class="pm-popup-title">${this.escapeHtml(props.name || 'Sin nombre')}</div>
        ${fieldsHtml}
        ${imagesHtml}
      </div>
    `;
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
