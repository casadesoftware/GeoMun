import { Component, signal, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import Swal from 'sweetalert2';
import maplibregl from 'maplibre-gl';
import { MAP_STYLES, MapStyleOption } from '../../shared/map-styles';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DecimalPipe],
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

  editMode = signal(false);
  icons = signal<{ name: string; url: string }[]>([]);
  selectedIcon = signal<string | null>(null);

  editingFeature = signal<any>(null);
  editVertices = signal<[number, number][]>([]);

  private map: maplibregl.Map | null = null;
  private markers: maplibregl.Marker[] = [];
  drawMode = signal<'none' | 'Point' | 'LineString' | 'Polygon'>('none');
  private drawCoords: [number, number][] = [];
  private drawSourceAdded = false;

  mapStyles = MAP_STYLES;
  currentStyle = signal<string>('osm');

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
        geomType: ['Point'],
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
        style: this.mapStyles.find(s => s.id === this.currentStyle())!.style,
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
    this.loadedIcons.clear();
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
      html: `<input id="feat-name" class="swal2-input" placeholder="Nombre *" style="background:#1e293b;color:#fff;border:1px solid #334155">
            <input type="hidden" id="selected-icon-url" value="${this.selectedIcon() || ''}">
            ${fieldsHtml}`,
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
        return { name, properties, icon: (document.getElementById('selected-icon-url') as HTMLInputElement)?.value || null };
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const data = {
          name: result.value.name,
          geomType,
          geometry,
          properties: { ...result.value.properties, icon: result.value.icon },
        };
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

    const geojsonFeatures = feats.map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: { name: f.name, id: f.id, ...f.properties },
    }));

    const geojson: any = { type: 'FeatureCollection', features: geojsonFeatures };

    // Load SVG icons into map
    const iconFeats = geojsonFeatures.filter((f: any) => f.properties.icon);
    const uniqueIcons = [...new Set(iconFeats.map((f: any) => f.properties.icon))];

    // Si la fuente no existe, crearla con data vacía + capas
    const existingSource = this.map.getSource('editor-features') as maplibregl.GeoJSONSource;
    if (!existingSource) {
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
        filter: ['all', ['==', '$type', 'Point'], ['!has', 'icon']],
        paint: { 'circle-radius': 7, 'circle-color': color, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
      });

      this.map.addLayer({
        id: 'editor-icons',
        type: 'symbol',
        source: 'editor-features',
        filter: ['all', ['==', '$type', 'Point'], ['has', 'icon']],
        layout: {
          'icon-image': ['get', 'iconId'],
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-anchor': 'center',
        },
      });
    }

    // Cargar íconos y LUEGO setData (una sola vez, con iconId resuelto)
    Promise.all(uniqueIcons.map((url: string) => this.loadIconToMap(url))).then((iconIds) => {
      const iconMap: Record<string, string> = {};
      uniqueIcons.forEach((url: string, i: number) => { iconMap[url] = iconIds[i]; });

      geojsonFeatures.forEach((f: any) => {
        if (f.properties.icon && iconMap[f.properties.icon]) {
          f.properties.iconId = iconMap[f.properties.icon];
        }
      });

      const source = this.map?.getSource('editor-features') as maplibregl.GeoJSONSource;
      if (source) source.setData(geojson);
    });

    // Listeners solo una vez
    if (!this.featuresListenersAdded) {
      ['editor-points', 'editor-icons', 'editor-polygons', 'editor-lines'].forEach((layerId) => {
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

    // Edit mode: drag points
    if (this.editMode()) {
      let dragFeatureId: string | null = null;
      this.map!.on('mousedown', 'editor-points', (e: any) => {
        if (!this.editMode() || this.drawMode() !== 'none') return;
        dragFeatureId = e.features[0].properties.id;
        this.map!.getCanvas().style.cursor = 'grabbing';
        e.preventDefault();

        const onMove = (ev: maplibregl.MapMouseEvent) => {
          if (!dragFeatureId) return;
          const feats = this.features().map((f) => {
            if (f.id === dragFeatureId) {
              return { ...f, geometry: { type: 'Point', coordinates: [ev.lngLat.lng, ev.lngLat.lat] } };
            }
            return f;
          });
          this.features.set(feats);
          this.renderFeatures();
        };

        const onUp = () => {
          if (!dragFeatureId) return;
          const feat = this.features().find((f) => f.id === dragFeatureId);
          if (feat) {
            this.api.put(`layers/features/${dragFeatureId}`, { geometry: feat.geometry }).subscribe();
          }
          dragFeatureId = null;
          this.map!.getCanvas().style.cursor = 'grab';
          this.map!.off('mousemove', onMove);
          this.map!.off('mouseup', onUp);
        };

        this.map!.on('mousemove', onMove);
        this.map!.on('mouseup', onUp);
      });
    }

    // Fit bounds
    if (feats.length && !this.editMode()) {
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
    const skip = ['name', 'id', 'icon', 'iconId'];
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
        return { name, properties: { ...properties, icon: feat.properties?.icon || null } };
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
      this.layerForm.patchValue({
        name: layer.name,
        style: {
          color: layer.style?.color || '#3b82f6',
          geomType: layer.style?.geomType || 'Point',
          weight: layer.style?.weight || 2,
          opacity: layer.style?.opacity || 0.8,
        },
      });
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
    if (layer.style?.geomType === 'Point') this.loadIcons();    
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

  toggleEditMode() {
    if (this.editMode()) {
      this.exitEditMode();
    } else {
      this.cancelDraw();
      this.editMode.set(true);
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
      this.setupEditListeners();
    }
  }

  private editClickHandler: ((e: any) => void) | null = null;
  private vertexDragHandler: ((e: any) => void) | null = null;

  private setupEditListeners() {
    if (!this.map) return;

    this.editClickHandler = (e: maplibregl.MapMouseEvent) => {
      if (!this.editMode()) return;

      // Check if clicking a vertex
      const vertexFeats = this.map!.queryRenderedFeatures(e.point, { layers: ['edit-vertices'] });
      if (vertexFeats.length) return; // handled by vertex drag

      // Check if clicking a midpoint
      const midFeats = this.map!.queryRenderedFeatures(e.point, { layers: ['edit-midpoints'] });
      if (midFeats.length) {
        const idx = midFeats[0].properties!['idx'] as number;
        this.addVertex(idx);
        return;
      }

      // Check if clicking a feature to select
      const layers = ['editor-points', 'editor-lines', 'editor-polygons'].filter(l => this.map!.getLayer(l));
      const feats = this.map!.queryRenderedFeatures(e.point, { layers });
      if (feats.length) {
        const id = feats[0].properties!['id'];
        const feat = this.features().find(f => f.id === id);
        if (feat) this.selectFeatureForEdit(feat);
      } else {
        this.deselectFeature();
      }
    };

    this.map.on('click', this.editClickHandler);
    this.setupVertexDrag();
  }

  private selectFeatureForEdit(feat: any) {
    this.editingFeature.set(feat);
    const geom = feat.geometry;
    let coords: [number, number][] = [];

    if (geom.type === 'Point') {
      coords = [geom.coordinates];
    } else if (geom.type === 'LineString') {
      coords = [...geom.coordinates];
    } else if (geom.type === 'Polygon') {
      // Exclude closing vertex (last = first)
      coords = geom.coordinates[0].slice(0, -1);
    }

    this.editVertices.set(coords);
    this.renderEditVertices();
  }

  deselectFeature() {
    this.editingFeature.set(null);
    this.editVertices.set([]);
    this.clearEditLayers();
  }

  private renderEditVertices() {
    if (!this.map) return;
    const verts = this.editVertices();

    const vertexFeatures = verts.map((c, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: c },
      properties: { idx: i },
    }));

    // Midpoints (for LineString/Polygon only)
    const midFeatures: any[] = [];
    const feat = this.editingFeature();
    if (feat && feat.geometry.type !== 'Point' && verts.length >= 2) {
      for (let i = 0; i < verts.length - 1; i++) {
        midFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [(verts[i][0] + verts[i + 1][0]) / 2, (verts[i][1] + verts[i + 1][1]) / 2],
          },
          properties: { idx: i + 1 },
        });
      }
      if (feat.geometry.type === 'Polygon' && verts.length >= 3) {
        const last = verts.length - 1;
        midFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [(verts[last][0] + verts[0][0]) / 2, (verts[last][1] + verts[0][1]) / 2],
          },
          properties: { idx: verts.length },
        });
      }
    }

    const vertexSource = this.map.getSource('edit-vertices') as maplibregl.GeoJSONSource;
    const midSource = this.map.getSource('edit-midpoints') as maplibregl.GeoJSONSource;

    if (vertexSource) {
      vertexSource.setData({ type: 'FeatureCollection', features: vertexFeatures });
    } else {
      this.map.addSource('edit-vertices', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: vertexFeatures },
      });
      this.map.addLayer({
        id: 'edit-vertices',
        type: 'circle',
        source: 'edit-vertices',
        paint: {
          'circle-radius': 7,
          'circle-color': '#f59e0b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
    }

    if (midSource) {
      midSource.setData({ type: 'FeatureCollection', features: midFeatures });
    } else {
      this.map.addSource('edit-midpoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: midFeatures },
      });
      this.map.addLayer({
        id: 'edit-midpoints',
        type: 'circle',
        source: 'edit-midpoints',
        paint: {
          'circle-radius': 5,
          'circle-color': '#f59e0b',
          'circle-opacity': 0.4,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      });
    }
  }

  private setupVertexDrag() {
    if (!this.map) return;
    let draggingIdx: number | null = null;

    this.map.on('mousedown', 'edit-vertices', (e: any) => {
      if (!this.editMode()) return;
      e.preventDefault();
      draggingIdx = e.features[0].properties.idx;
      this.map!.getCanvas().style.cursor = 'grabbing';
      this.map!.dragPan.disable();

      const onMove = (ev: maplibregl.MapMouseEvent) => {
        if (draggingIdx === null) return;
        const verts = [...this.editVertices()];
        verts[draggingIdx] = [ev.lngLat.lng, ev.lngLat.lat];
        this.editVertices.set(verts);
        this.renderEditVertices();
        this.updateFeatureGeometry(verts, false);
      };

      const onUp = () => {
        if (draggingIdx !== null) {
          this.updateFeatureGeometry(this.editVertices(), true);
          draggingIdx = null;
        }
        this.map!.getCanvas().style.cursor = 'pointer';
        this.map!.dragPan.enable();
        this.map!.off('mousemove', onMove);
        this.map!.off('mouseup', onUp);
      };

      this.map!.on('mousemove', onMove);
      this.map!.on('mouseup', onUp);
    });

    // Cursor hints
    this.map.on('mouseenter', 'edit-vertices', () => {
      if (this.editMode()) this.map!.getCanvas().style.cursor = 'grab';
    });
    this.map.on('mouseleave', 'edit-vertices', () => {
      if (this.editMode()) this.map!.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseenter', 'edit-midpoints', () => {
      if (this.editMode()) this.map!.getCanvas().style.cursor = 'cell';
    });
    this.map.on('mouseleave', 'edit-midpoints', () => {
      if (this.editMode()) this.map!.getCanvas().style.cursor = 'pointer';
    });
  }

  private addVertex(insertAt: number) {
    const feat = this.editingFeature();
    if (!feat || feat.geometry.type === 'Point') return;
    const verts = [...this.editVertices()];
    const prev = insertAt - 1;
    const next = insertAt < verts.length ? insertAt : 0;
    const mid: [number, number] = [
      (verts[prev][0] + verts[next][0]) / 2,
      (verts[prev][1] + verts[next][1]) / 2,
    ];
    verts.splice(insertAt, 0, mid);
    this.editVertices.set(verts);
    this.renderEditVertices();
    this.updateFeatureGeometry(verts, true);
  }

  deleteVertex(idx: number) {
    const feat = this.editingFeature();
    if (!feat) return;
    const verts = [...this.editVertices()];
    const type = feat.geometry.type;

    if (type === 'Point') return;
    if (type === 'LineString' && verts.length <= 2) {
      Swal.fire({ icon: 'warning', title: 'Mínimo 2 vértices para línea', background: '#1e293b', color: '#fff' });
      return;
    }
    if (type === 'Polygon' && verts.length <= 3) {
      Swal.fire({ icon: 'warning', title: 'Mínimo 3 vértices para polígono', background: '#1e293b', color: '#fff' });
      return;
    }

    verts.splice(idx, 1);
    this.editVertices.set(verts);
    this.renderEditVertices();
    this.updateFeatureGeometry(verts, true);
  }

  private updateFeatureGeometry(verts: [number, number][], save: boolean) {
    const feat = this.editingFeature();
    if (!feat) return;

    let geometry: any;
    if (feat.geometry.type === 'Point') {
      geometry = { type: 'Point', coordinates: verts[0] };
    } else if (feat.geometry.type === 'LineString') {
      geometry = { type: 'LineString', coordinates: verts };
    } else if (feat.geometry.type === 'Polygon') {
      geometry = { type: 'Polygon', coordinates: [[...verts, verts[0]]] };
    }

    // Update local
    const updated = this.features().map(f =>
      f.id === feat.id ? { ...f, geometry } : f
    );
    this.features.set(updated);
    this.editingFeature.set({ ...feat, geometry });
    this.renderFeatures();

    if (save) {
      this.api.put(`layers/features/${feat.id}`, { geometry }).subscribe();
    }
  }

  private clearEditLayers() {
    if (!this.map) return;
    ['edit-vertices', 'edit-midpoints'].forEach(id => {
      if (this.map!.getLayer(id)) this.map!.removeLayer(id);
      if (this.map!.getSource(id)) this.map!.removeSource(id);
    });
  }

  exitEditMode() {
    this.deselectFeature();
    this.editMode.set(false);
    if (this.map) {
      if (this.editClickHandler) {
        this.map.off('click', this.editClickHandler);
        this.editClickHandler = null;
      }
      this.map.getCanvas().style.cursor = '';
    }
  }

  loadIcons() {
    this.api.get<any[]>('storage/icons').subscribe({
      next: (d) => this.icons.set(d),
      error: () => this.icons.set([]),
    });
  }

  uploadIcon(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.name.endsWith('.svg')) {
      Swal.fire({ icon: 'warning', title: 'Solo archivos SVG', background: '#1e293b', color: '#fff' });
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    this.api.postFormData<any>('storage/icons/upload', formData).subscribe({
      next: () => { this.loadIcons(); input.value = ''; },
      error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message, background: '#1e293b', color: '#fff' }),
    });
  }

  selectIcon(iconUrl: string) {
    this.selectedIcon.set(this.selectedIcon() === iconUrl ? null : iconUrl);
  }

  changeMapStyle(styleId: string) {
    if (!this.map || styleId === this.currentStyle()) return;
    this.currentStyle.set(styleId);
    const style = this.mapStyles.find(s => s.id === styleId)?.style;
    if (!style) return;

    const center = this.map.getCenter();
    const zoom = this.map.getZoom();

    this.map.setStyle(style);
    this.drawSourceAdded = false;
    this.featuresListenersAdded = false;
    this.loadedIcons.clear();

    this.map.once('style.load', () => {
      this.map!.setCenter(center);
      this.map!.setZoom(zoom);
      this.renderFeatures();
      this.setupDrawSource();
    });
  }

  private loadedIcons = new Set<string>();

  private async loadIconToMap(iconUrl: string): Promise<string> {
    const iconId = 'icon-' + iconUrl.replace(/[^a-z0-9]/gi, '_');
    if (this.loadedIcons.has(iconId) && this.map!.hasImage(iconId)) return iconId;

    return new Promise((resolve) => {
      const img = new Image(32, 32);
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!this.map!.hasImage(iconId)) {
          this.map!.addImage(iconId, img);
        }
        this.loadedIcons.add(iconId);
        resolve(iconId);
      };
      img.onerror = () => resolve('');
      img.src = iconUrl;
    });
  }

}