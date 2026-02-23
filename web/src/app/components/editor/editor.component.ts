import { Component, signal, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import Swal from 'sweetalert2';
import maplibregl from 'maplibre-gl';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './editor.component.html',
})
export class EditorComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapEl!: ElementRef;

  activeTab = signal<'maps' | 'layers' | 'features'>('maps');

  // Maps
  maps = signal<any[]>([]);
  mapForm: FormGroup;
  showMapForm = signal(false);
  editingMap = signal<string | null>(null);

  // Layers
  selectedMap = signal<any>(null);
  layers = signal<any[]>([]);
  layerForm: FormGroup;
  showLayerForm = signal(false);
  editingLayer = signal<string | null>(null);
  fieldsArray: FormArray;

  // Features + Map
  selectedLayer = signal<any>(null);
  features = signal<any[]>([]);
  showFeatureForm = signal(false);
  featureForm: FormGroup;

  private map: maplibregl.Map | null = null;
  private markers: maplibregl.Marker[] = [];
  drawMode = signal<'none' | 'Point' | 'LineString' | 'Polygon'>('none');
  private drawCoords: [number, number][] = [];
  private drawSourceAdded = false;

  constructor(private fb: FormBuilder, private api: ApiService) {
    this.mapForm = this.fb.group({
      name: ['', Validators.required],
      theme: [''],
    });

    this.fieldsArray = this.fb.array([]);
    this.layerForm = this.fb.group({
      name: ['', Validators.required],
      style: this.fb.group({
        color: ['#3b82f6'],
        icon: ['marker'],
        weight: [2],
        opacity: [0.8],
      }),
      fields: this.fieldsArray,
    });

    this.featureForm = this.fb.group({
      name: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.loadMaps();
  }

  ngOnDestroy() {
    this.destroyMap();
  }

  // ==================== MAPA ====================

  private initMap() {
    setTimeout(() => {
      if (!this.mapEl?.nativeElement || this.map) return;
      this.map = new maplibregl.Map({
        container: this.mapEl.nativeElement,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [-96.9603559, 19.4544623],
        zoom: 12,
      });

      this.map.addControl(new maplibregl.NavigationControl(), 'top-right');

      this.map.on('load', () => {
        this.renderFeatures();
        this.setupDrawSource();
      });

      this.map.on('click', (e: maplibregl.MapMouseEvent) => {
        if (this.drawMode() === 'none') return;
        this.handleDrawClick(e.lngLat);
      });
    }, 100);
  }

  private destroyMap() {
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.drawSourceAdded = false;
    this.featuresListenersAdded = false;
  }

  private setupDrawSource() {
    if (!this.map || this.drawSourceAdded) return;
    this.map.addSource('draw', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    this.map.addLayer({
      id: 'draw-line',
      type: 'line',
      source: 'draw',
      paint: { 'line-color': '#f59e0b', 'line-width': 3 },
      filter: ['in', '$type', 'LineString', 'Polygon'],
    });
    this.map.addLayer({
      id: 'draw-points',
      type: 'circle',
      source: 'draw',
      paint: { 'circle-radius': 6, 'circle-color': '#f59e0b' },
      filter: ['==', '$type', 'Point'],
    });
    this.drawSourceAdded = true;
  }

  private handleDrawClick(lngLat: maplibregl.LngLat) {
    const coord: [number, number] = [lngLat.lng, lngLat.lat];
    const mode = this.drawMode();

    if (mode === 'Point') {
      this.drawCoords = [coord];
      this.finishDraw();
      return;
    }

    this.drawCoords.push(coord);
    this.updateDrawPreview();
  }

  private updateDrawPreview() {
    if (!this.map) return;
    const mode = this.drawMode();
    const features: any[] = this.drawCoords.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c },
      properties: {},
    }));

    if (this.drawCoords.length >= 2) {
      const coords = mode === 'Polygon'
        ? [...this.drawCoords, this.drawCoords[0]]
        : this.drawCoords;
      features.push({
        type: 'Feature',
        geometry: { type: mode === 'Polygon' ? 'Polygon' : 'LineString', coordinates: mode === 'Polygon' ? [coords] : coords },
        properties: {},
      });
    }

    (this.map.getSource('draw') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features,
    });
  }

  startDraw(mode: 'Point' | 'LineString' | 'Polygon') {
    this.drawMode.set(mode);
    this.drawCoords = [];
    this.clearDrawPreview();
    if (this.map) this.map.getCanvas().style.cursor = 'crosshair';
  }

  finishDraw() {
    const mode = this.drawMode();
    if (mode === 'none') return;

    if (mode === 'Point' && this.drawCoords.length === 1) {
      this.promptFeatureName(mode, { type: 'Point', coordinates: this.drawCoords[0] });
    } else if (mode === 'LineString' && this.drawCoords.length >= 2) {
      this.promptFeatureName(mode, { type: 'LineString', coordinates: this.drawCoords });
    } else if (mode === 'Polygon' && this.drawCoords.length >= 3) {
      const closed = [...this.drawCoords, this.drawCoords[0]];
      this.promptFeatureName(mode, { type: 'Polygon', coordinates: [closed] });
    } else {
      Swal.fire({ icon: 'warning', title: 'Insuficientes puntos', text: mode === 'LineString' ? 'Mínimo 2 puntos' : 'Mínimo 3 puntos', background: '#1e293b', color: '#fff' });
      return;
    }
  }

  cancelDraw() {
    this.drawMode.set('none');
    this.drawCoords = [];
    this.clearDrawPreview();
    if (this.map) this.map.getCanvas().style.cursor = '';
  }

  private clearDrawPreview() {
    if (!this.map || !this.drawSourceAdded) return;
    (this.map.getSource('draw') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
  }

  private promptFeatureName(geomType: string, geometry: any) {
    const layer = this.selectedLayer();
    const layerFields: any[] = layer?.fields || [];

    let fieldsHtml = '';
    layerFields.forEach((f: any) => {
      const inputType = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
      fieldsHtml += `<label class="block text-left text-sm text-gray-300 mt-2">${f.name}${f.required ? ' *' : ''}</label>
        <input id="field-${f.name}" type="${inputType}" class="swal2-input" placeholder="${f.name}" style="background:#1e293b;color:#fff;border:1px solid #334155">`;
    });

    Swal.fire({
      title: 'Nombre del elemento',
      html: `<input id="feat-name" class="swal2-input" placeholder="Nombre *" style="background:#1e293b;color:#fff;border:1px solid #334155">${fieldsHtml}`,
      background: '#0f172a',
      color: '#fff',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const name = (document.getElementById('feat-name') as HTMLInputElement).value.trim();
        if (!name) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
        const properties: any = {};
        layerFields.forEach((f: any) => {
          const el = document.getElementById(`field-${f.name}`) as HTMLInputElement;
          properties[f.name] = el?.value || null;
        });
        return { name, properties };
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const data = { name: result.value.name, geomType, geometry, properties: result.value.properties };
        this.api.post(`layers/${layer.id}/features`, data).subscribe({
          next: () => {
            this.loadFeatures(layer.id);
            this.cancelDraw();
          },
          error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message, background: '#1e293b', color: '#fff' }),
        });
      } else {
        this.cancelDraw();
      }
    });
  }

  private featuresListenersAdded = false;

  private renderFeatures() {
    if (!this.map) return;
    this.markers.forEach((m) => m.remove());
    this.markers = [];

    const layer = this.selectedLayer();
    const style = layer?.style || {};
    const color = style.color || '#3b82f6';
    const feats = this.features();

    const geojson: any = {
      type: 'FeatureCollection',
      features: feats.map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: { name: f.name, id: f.id, ...f.properties },
      })),
    };

    // Si la fuente ya existe, solo actualizar datos
    const existingSource = this.map.getSource('editor-features') as maplibregl.GeoJSONSource;
    if (existingSource) {
      existingSource.setData(geojson);
    } else {
      this.map.addSource('editor-features', { type: 'geojson', data: geojson });

      this.map.addLayer({
        id: 'editor-polygons',
        type: 'fill',
        source: 'editor-features',
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': color, 'fill-opacity': 0.3 },
      });

      this.map.addLayer({
        id: 'editor-lines',
        type: 'line',
        source: 'editor-features',
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': color, 'line-width': style.weight || 2 },
      });

      this.map.addLayer({
        id: 'editor-points',
        type: 'circle',
        source: 'editor-features',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 7, 'circle-color': color, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
      });
    }

    // Listeners solo una vez
    if (!this.featuresListenersAdded) {
      ['editor-points', 'editor-polygons', 'editor-lines'].forEach((layerId) => {
        this.map!.on('click', layerId, (e: any) => {
          if (this.drawMode() !== 'none') return;
          const props = e.features[0].properties;
          const popup = new maplibregl.Popup().setLngLat(e.lngLat).setHTML(this.buildPopupHtml(props)).addTo(this.map!);
          setTimeout(() => {
            const btn = document.querySelector(`[data-edit-id="${props.id}"]`);
            if (btn) btn.addEventListener('click', () => { popup.remove(); this.openEditFeature(props.id); });
          }, 50);
        });
      });
      this.featuresListenersAdded = true;
    }

    // Fit bounds
    if (feats.length) {
      const bounds = new maplibregl.LngLatBounds();
      feats.forEach((f) => {
        const g = f.geometry;
        if (g.type === 'Point') bounds.extend(g.coordinates);
        else if (g.type === 'LineString') g.coordinates.forEach((c: any) => bounds.extend(c));
        else if (g.type === 'Polygon') g.coordinates[0].forEach((c: any) => bounds.extend(c));
      });
      if (!bounds.isEmpty()) this.map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
  }

  private buildPopupHtml(props: any): string {
    let html = `<div style="color:#000;font-size:13px"><strong style="font-size:14px">${props.name}</strong>`;
    const skip = ['name', 'id'];
    Object.keys(props).forEach((k) => {
      if (!skip.includes(k) && props[k] != null && props[k] !== '') {
        html += `<br><b>${k}:</b> ${props[k]}`;
      }
    });
    html += `<br><button data-edit-id="${props.id}" style="margin-top:6px;padding:2px 10px;font-size:12px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer">Editar</button>`;
    html += '</div>';
    return html;
  }

  private openEditFeature(featureId: string) {
    const feat = this.features().find((f) => f.id === featureId);
    if (!feat) return;

    const layerFields: any[] = this.selectedLayer()?.fields || [];
    let html = `<input id="edit-name" class="swal2-input" placeholder="Nombre *" value="${feat.name || ''}" style="background:#1e293b;color:#fff;border:1px solid #334155">`;

    layerFields.forEach((f: any) => {
      const val = feat.properties?.[f.name] ?? '';
      const inputType = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
      html += `<input id="edit-field-${f.name}" type="${inputType}" class="swal2-input" placeholder="${f.name}" value="${val}" style="background:#1e293b;color:#fff;border:1px solid #334155">`;
    });

    Swal.fire({
      title: 'Editar elemento',
      html,
      background: '#0f172a',
      color: '#fff',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const name = (document.getElementById('edit-name') as HTMLInputElement).value.trim();
        if (!name) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
        const properties: any = {};
        layerFields.forEach((f: any) => {
          const el = document.getElementById(`edit-field-${f.name}`) as HTMLInputElement;
          properties[f.name] = el?.value || null;
        });
        return { name, properties };
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.api.put(`layers/features/${featureId}`, result.value).subscribe({
          next: () => this.loadFeatures(this.selectedLayer().id),
          error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message, background: '#1e293b', color: '#fff' }),
        });
      }
    });
  }

  // ==================== MAPS ====================

  loadMaps() {
    this.api.get<any[]>('maps').subscribe({ next: (d) => this.maps.set(d) });
  }

  openMapForm(map?: any) {
    this.showMapForm.set(true);
    if (map) {
      this.editingMap.set(map.id);
      this.mapForm.patchValue({ name: map.name, theme: map.theme || '' });
    } else {
      this.editingMap.set(null);
      this.mapForm.reset();
    }
  }

  saveMap() {
    if (this.mapForm.invalid) return;
    const id = this.editingMap();
    const req = id ? this.api.put(`maps/${id}`, this.mapForm.value) : this.api.post('maps', this.mapForm.value);
    req.subscribe({
      next: () => { this.loadMaps(); this.showMapForm.set(false); },
      error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message, background: '#1e293b', color: '#fff' }),
    });
  }

  selectMap(map: any) {
    this.selectedMap.set(map);
    this.activeTab.set('layers');
    this.loadLayers(map.id);
  }

  deleteMap(map: any) {
    Swal.fire({
      title: '¿Eliminar mapa?', text: map.name, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
      background: '#1e293b', color: '#fff',
    }).then((r) => {
      if (r.isConfirmed) this.api.delete(`maps/${map.id}`).subscribe({ next: () => this.loadMaps() });
    });
  }

  // ==================== LAYERS ====================

  loadLayers(mapId: string) {
    this.api.get<any[]>(`layers/map/${mapId}`).subscribe({ next: (d) => this.layers.set(d) });
  }

  addField() {
    this.fieldsArray.push(this.fb.group({
      name: ['', Validators.required],
      type: ['text'],
      length: [255],
      required: [false],
    }));
  }

  removeField(i: number) {
    this.fieldsArray.removeAt(i);
  }

  openLayerForm(layer?: any) {
    this.showLayerForm.set(true);
    this.fieldsArray.clear();
    if (layer) {
      this.editingLayer.set(layer.id);
      this.layerForm.patchValue({ name: layer.name, style: layer.style || {} });
      if (layer.fields) {
        (layer.fields as any[]).forEach((f: any) => {
          this.fieldsArray.push(this.fb.group({ name: [f.name], type: [f.type || 'text'], length: [f.length || 255], required: [f.required || false] }));
        });
      }
    } else {
      this.editingLayer.set(null);
      this.layerForm.reset({ style: { color: '#3b82f6', icon: 'marker', weight: 2, opacity: 0.8 } });
    }
  }

  saveLayer() {
    if (this.layerForm.invalid) return;
    const data = { ...this.layerForm.value, fields: this.fieldsArray.value, mapId: this.selectedMap()?.id };
    const id = this.editingLayer();
    const req = id ? this.api.put(`layers/${id}`, data) : this.api.post('layers', data);
    req.subscribe({
      next: () => { this.loadLayers(this.selectedMap().id); this.showLayerForm.set(false); },
      error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message, background: '#1e293b', color: '#fff' }),
    });
  }

  deleteLayer(layer: any) {
    Swal.fire({
      title: '¿Eliminar capa?', text: layer.name, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
      background: '#1e293b', color: '#fff',
    }).then((r) => {
      if (r.isConfirmed) this.api.delete(`layers/${layer.id}`).subscribe({ next: () => this.loadLayers(this.selectedMap().id) });
    });
  }

  selectLayer(layer: any) {
    this.destroyMap();
    this.selectedLayer.set(layer);
    this.activeTab.set('features');
    this.api.get<any[]>(`layers/${layer.id}/features`).subscribe({
      next: (d) => {
        this.features.set(d);
        this.initMap();
      },
    });
  }

  // ==================== FEATURES ====================

  loadFeatures(layerId: string) {
    this.api.get<any[]>(`layers/${layerId}/features`).subscribe({
      next: (d) => {
        this.features.set(d);
        if (this.map && this.map.loaded()) this.renderFeatures();
      },
    });
  }

  deleteFeature(feature: any) {
    Swal.fire({
      title: '¿Eliminar elemento?', text: feature.name, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
      background: '#1e293b', color: '#fff',
    }).then((r) => {
      if (r.isConfirmed) this.api.delete(`layers/features/${feature.id}`).subscribe({ next: () => this.loadFeatures(this.selectedLayer().id) });
    });
  }

  backToMaps() {
    this.destroyMap();
    this.activeTab.set('maps');
    this.selectedMap.set(null);
  }

  backToLayers() {
    this.destroyMap();
    this.activeTab.set('layers');
    this.selectedLayer.set(null);
  }
}