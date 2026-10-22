import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, Package, AlertTriangle, Map as MapIcon, BarChart3, 
  ArrowRight, ArrowLeft, CheckCircle2, Truck, Radio, Download, 
  ShieldCheck, RefreshCw, Flame, Droplets, Wind, Mountain, Layers, Eye
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = "http://127.0.0.1:8000";

const DISASTER_NOTES = {
  "Wildfire": "Smoke inhalation and structural threats rapidly elevate drinking water and emergency medical demand.",
  "Flood": "Rapid inundation severs road access and contaminates municipal water pipelines.",
  "Earthquake": "Structural collapses cause severe trauma and immediate surgical hospital strain.",
  "Cyclone": "High winds and storm surge destroy coastal housing and disrupt regional power grids."
};

const BASEMAP_TILES = {
  osm: {
    name: "Geographical / Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  satellite: {
    name: "Satellite Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18
  },
  topo: {
    name: "Topographic / Terrain",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, METI, NRCAN',
    maxZoom: 18
  }
};

// Component to dynamically fit map bounds to the disaster zones or fly to selected zone
function DynamicMapController({ areas, selectedArea }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedArea) {
      map.flyTo([selectedArea.latitude, selectedArea.longitude], 13, { duration: 1.0 });
    } else if (areas && areas.length > 0) {
      const bounds = areas.map(a => [a.latitude, a.longitude]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [areas, selectedArea, map]);

  return null;
}

export default function App() {
  const [activeStep, setActiveStep] = useState("1 Describe");

  // Step 1 Form Inputs
  const [disasterType, setDisasterType] = useState("Wildfire");
  const [severity, setSeverity] = useState("High");
  const [durationHours, setDurationHours] = useState(72);
  const [foodSupply, setFoodSupply] = useState(40000);
  const [waterSupply, setWaterSupply] = useState(40000);
  const [medSupply, setMedSupply] = useState(2500);

  // Exact 7 areas from user requirement & screenshot
  const [areaPops, setAreaPops] = useState({
    "Area A": 1850,
    "Area B": 2900,
    "Area C": 3300,
    "Area D": 4300,
    "Area E": 3200,
    "Area F": 3800,
    "Area G": 2429
  });

  // Track unsaved modifications to inform user or trigger dynamic auto-refresh
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Map Basemap Selector
  const [basemapKey, setBasemapKey] = useState("osm");
  const [selectedMapArea, setSelectedMapArea] = useState(null);

  // Pipeline Data from Backend
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Convoy Dispatch State
  const [dispatchedConvoys, setDispatchedConvoys] = useState(new Set());

  // Step 4 Simulation State
  const [shockWater, setShockWater] = useState(-30);
  const [shockPop, setShockPop] = useState(0);
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);

  // Audit Log State
  const [auditLog, setAuditLog] = useState([]);

  // Calculate live total population of the 7 areas
  const totalPop = Object.values(areaPops).reduce((acc, curr) => acc + (Number(curr) || 0), 0);

  // Handle live changes to area population
  const handlePopChange = (area, rawVal) => {
    setHasUnsavedChanges(true);
    const val = rawVal === '' ? '' : Math.max(0, parseInt(rawVal, 10) || 0);
    setAreaPops(prev => ({ ...prev, [area]: val }));
  };

  // Run AI Analysis Pipeline
  const runAnalysis = async (navigateToStep2 = false) => {
    setLoading(true);
    setError(null);
    try {
      // Ensure all populations are clean integers
      const sanitizedPops = {};
      Object.entries(areaPops).forEach(([k, v]) => {
        sanitizedPops[k] = Math.max(1, parseInt(v, 10) || 100);
      });

      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disaster_type: disasterType,
          severity: severity,
          duration_hours: durationHours,
          food_supply: Number(foodSupply),
          water_supply: Number(waterSupply),
          med_supply: Number(medSupply),
          area_populations: sanitizedPops
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Failed to execute AI optimization pipeline");
      }

      const json = await res.json();
      setAnalysisData(json);
      setHasUnsavedChanges(false);

      if (navigateToStep2) {
        setActiveStep("2 AI analysis");
      }
    } catch (err) {
      console.error(err);
      setError(`Backend Error: ${err.message}. Ensure FastAPI server is running on port 8000.`);
    } finally {
      setLoading(false);
    }
  };

  // Pre-load analysis on initial mount so Step 2 is ready right away
  useEffect(() => {
    runAnalysis(false);
  }, []);

  // Handle Stepper Navigation
  const handleStepClick = (step) => {
    if (step === "1 Describe") {
      setActiveStep(step);
      return;
    }
    // If user moves to step 2/3/4 and inputs were changed, refresh dynamically
    if (hasUnsavedChanges || !analysisData) {
      runAnalysis(false).then(() => {
        setActiveStep(step);
      });
    } else {
      setActiveStep(step);
    }
  };

  // Run Simulation in Step 4
  const runSimulation = async () => {
    setSimLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shock_water_pct: Number(shockWater),
          shock_pop_pct: Number(shockPop),
          disaster_type: disasterType,
          severity: severity
        })
      });
      const json = await res.json();
      setSimResult(json);
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimLoading(false);
    }
  };

  // Fetch Audit Log
  const fetchAuditLog = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/audit`);
      const json = await res.json();
      setAuditLog(json);
    } catch (err) {
      console.error("Audit log error:", err);
    }
  };

  useEffect(() => {
    if (activeStep === "4 What-if") {
      fetchAuditLog();
    }
  }, [activeStep]);

  const toggleDispatch = (convoyId) => {
    setDispatchedConvoys(prev => {
      const next = new Set(prev);
      if (next.has(convoyId)) next.delete(convoyId);
      else next.add(convoyId);
      return next;
    });
  };

  const getPriorityBadgeClass = (level) => {
    switch (level) {
      case 'CRITICAL': return 'badge-crit';
      case 'HIGH': return 'badge-high';
      case 'MEDIUM': return 'badge-med';
      default: return 'badge-low';
    }
  };

  const getMarkerColor = (level) => {
    switch (level) {
      case 'CRITICAL': return '#ef4444'; // Red
      case 'HIGH': return '#f97316';     // Orange
      case 'MEDIUM': return '#eab308';   // Amber
      default: return '#10b981';         // Emerald
    }
  };

  return (
    <div className="app-container">
      {/* Top Header & 4-Step Stepper */}
      <header className="top-nav">
        <div className="brand-block">
          <h1 className="brand-title">EMERGENCY DECISION SUPPORT</h1>
          <p className="brand-subtitle">AI-assisted disaster resource allocation</p>
        </div>

        <nav className="stepper-nav">
          {["1 Describe", "2 AI analysis", "3 Response plan", "4 What-if"].map((step, idx) => {
            const isActive = activeStep === step;
            return (
              <button
                key={step}
                onClick={() => handleStepClick(step)}
                className={`step-pill ${isActive ? 'active' : ''}`}
              >
                <span className="step-num">{idx + 1}</span>
                <span className="step-label">{step.split(' ')[1]}</span>
                {idx === 1 && hasUnsavedChanges && (
                  <span className="dot-updated" title="Inputs modified" />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button onClick={() => runAnalysis(false)} className="btn-retry">
            Retry Connection
          </button>
        </div>
      )}

      {/* STEP 1: DESCRIBE DISASTER */}
      {activeStep === "1 Describe" && (
        <main className="step-content">
          <div className="page-intro">
            <h2>Describe the disaster</h2>
            <p>Define the crisis parameters and available stockpiles. The AI dynamically calculates priority and LP allocations.</p>
          </div>

          <div className="grid-two-col">
            {/* 1. What Happened? */}
            <div className="glass-panel">
              <h3 className="panel-title">1. WHAT HAPPENED?</h3>
              
              <div className="chip-group">
                {[
                  { name: "Flood", icon: Droplets },
                  { name: "Earthquake", icon: Mountain },
                  { name: "Cyclone", icon: Wind },
                  { name: "Wildfire", icon: Flame }
                ].map(({ name, icon: Icon }) => (
                  <button
                    key={name}
                    className={`choice-chip ${disasterType === name ? 'selected' : ''}`}
                    onClick={() => {
                      setDisasterType(name);
                      setHasUnsavedChanges(true);
                    }}
                  >
                    <Icon size={16} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>

              <div className="context-callout">
                {DISASTER_NOTES[disasterType]}
              </div>

              <h4 className="sub-title">HOW SEVERE?</h4>
              <div className="chip-group">
                {["Low", "Moderate", "High", "Extreme"].map(lvl => (
                  <button
                    key={lvl}
                    className={`choice-chip ${severity === lvl ? 'selected' : ''}`}
                    onClick={() => {
                      setSeverity(lvl);
                      setHasUnsavedChanges(true);
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <div className="slider-row" style={{ marginTop: '1.5rem' }}>
                <div className="slider-header">
                  <span>Expected duration</span>
                  <span className="slider-val">{durationHours} hours</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="120"
                  step="12"
                  value={durationHours}
                  onChange={(e) => {
                    setDurationHours(Number(e.target.value));
                    setHasUnsavedChanges(true);
                  }}
                  className="modern-range"
                />
              </div>
            </div>

            {/* 2. What Do You Have? */}
            <div className="glass-panel">
              <h3 className="panel-title">2. WHAT DO YOU HAVE?</h3>

              <div className="slider-row">
                <div className="slider-header">
                  <span>Food available (units)</span>
                  <span className="slider-val">{foodSupply.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="5000"
                  value={foodSupply}
                  onChange={(e) => {
                    setFoodSupply(Number(e.target.value));
                    setHasUnsavedChanges(true);
                  }}
                  className="modern-range"
                />
              </div>

              <div className="slider-row">
                <div className="slider-header">
                  <span>Water available (liters)</span>
                  <span className="slider-val">{waterSupply.toLocaleString()} L</span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="5000"
                  value={waterSupply}
                  onChange={(e) => {
                    setWaterSupply(Number(e.target.value));
                    setHasUnsavedChanges(true);
                  }}
                  className="modern-range"
                />
              </div>

              <div className="slider-row">
                <div className="slider-header">
                  <span>Medical kits</span>
                  <span className="slider-val">{medSupply.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="15000"
                  step="500"
                  value={medSupply}
                  onChange={(e) => {
                    setMedSupply(Number(e.target.value));
                    setHasUnsavedChanges(true);
                  }}
                  className="modern-range"
                />
              </div>
            </div>
          </div>

          {/* 3. Area Populations - Live & Dynamic */}
          <div className="glass-panel full-width">
            <div className="panel-header-with-action">
              <h3 className="panel-title">
                3. HOW MANY PEOPLE ARE AFFECTED IN EACH AREA? (TOTAL {totalPop.toLocaleString()})
              </h3>
              <span className="panel-badge-live">Live Reactive Inputs</span>
            </div>
            
            <div className="pop-inputs-grid">
              {Object.entries(areaPops).map(([area, count]) => (
                <div key={area} className="pop-field">
                  <label>{area}</label>
                  <input
                    type="number"
                    min="0"
                    max="50000"
                    step="50"
                    value={count}
                    onChange={(e) => handlePopChange(area, e.target.value)}
                    className="pop-input"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="cta-row">
            <button
              onClick={() => runAnalysis(true)}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="spin" />
                  <span>Computing AI Strategy...</span>
                </>
              ) : (
                <>
                  <span>RUN AI ANALYSIS</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </main>
      )}

      {/* STEP 2: AI ANALYSIS */}
      {activeStep === "2 AI analysis" && (
        <main className="step-content">
          <div className="page-intro" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>AI Risk & Demand Assessment</h2>
              <p>
                Scenario: <strong>{disasterType} ({severity})</strong> · {durationHours} hours mission · Total Affected: <strong>{totalPop.toLocaleString()}</strong>
              </p>
            </div>
            <button
              onClick={() => runAnalysis(false)}
              disabled={loading}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="Re-run AI model and LP solver with current inputs"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Re-calculating...' : 'Re-calculate AI'}</span>
            </button>
          </div>

          {hasUnsavedChanges && (
            <div className="unsaved-alert-banner">
              <span>⚠️ Inputs were modified in Step 1.</span>
              <button onClick={() => runAnalysis(false)} className="btn-alert-sync">
                Click to Sync AI Analysis ({totalPop.toLocaleString()} affected)
              </button>
            </div>
          )}

          {/* 4 Stat Cards */}
          {analysisData && (
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-label">TOTAL AFFECTED</span>
                <span className="stat-num">{analysisData.overview.total_affected.toLocaleString()}</span>
                <span className="stat-sub">Across 7 zones</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">CRITICAL / HIGH</span>
                <span className="stat-num highlight-red">
                  {analysisData.overview.critical_areas} / {analysisData.overview.high_areas}
                </span>
                <span className="stat-sub">Urgent intervention</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">WATER COVERAGE</span>
                <span className={`stat-num ${analysisData.overview.coverages.Water < 60 ? 'highlight-red' : 'highlight-green'}`}>
                  {analysisData.overview.coverages.Water}%
                </span>
                <span className="stat-sub">{waterSupply.toLocaleString()} L reserve</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">OPTIMIZER STATUS</span>
                <span className="stat-num highlight-blue">{analysisData.overview.solver_status}</span>
                <span className="stat-sub">HiGHS LP Solver</span>
              </div>
            </div>
          )}

          {/* Real Geographical Map & Area Priority List */}
          {analysisData && (
            <div className="grid-map-and-list">
              <div className="glass-panel map-panel">
                <div className="map-panel-header">
                  <h3 className="panel-title"><MapIcon size={18} /> REAL GEOGRAPHICAL RISK MAP</h3>
                  
                  {/* Basemap Switcher */}
                  <div className="basemap-selector">
                    <span className="selector-label"><Layers size={14} /> Basemap:</span>
                    {Object.entries(BASEMAP_TILES).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => setBasemapKey(key)}
                        className={`btn-basemap ${basemapKey === key ? 'active' : ''}`}
                      >
                        {key === 'osm' ? '🗺️ Streets' : key === 'satellite' ? '🛰️ Satellite' : '🏔️ Terrain'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="leaflet-box">
                  <MapContainer 
                    center={[29.76, -95.36]} 
                    zoom={11} 
                    style={{ height: '420px', width: '100%', borderRadius: '10px' }}
                  >
                    <TileLayer
                      key={basemapKey}
                      url={BASEMAP_TILES[basemapKey].url}
                      attribution={BASEMAP_TILES[basemapKey].attribution}
                      maxZoom={BASEMAP_TILES[basemapKey].maxZoom}
                    />

                    {/* Auto bounds & flyTo controller */}
                    <DynamicMapController 
                      areas={analysisData.areas} 
                      selectedArea={selectedMapArea} 
                    />

                    {analysisData.areas.map(a => {
                      const color = getMarkerColor(a.priority_level);
                      const isSelected = selectedMapArea && selectedMapArea.area_name === a.area_name;

                      return (
                        <CircleMarker
                          key={a.area_name}
                          center={[a.latitude, a.longitude]}
                          radius={isSelected ? 18 : Math.max(10, Math.min(18, 10 + Math.round(a.population / 400)))}
                          pathOptions={{ 
                            color: isSelected ? '#ffffff' : color, 
                            fillColor: color, 
                            fillOpacity: isSelected ? 0.95 : 0.75,
                            weight: isSelected ? 3 : 2
                          }}
                          eventHandlers={{
                            click: () => setSelectedMapArea(a)
                          }}
                        >
                          <LeafletTooltip permanent direction="top" offset={[0, -12]} className="geo-map-label">
                            <strong>{a.area_name}</strong> ({a.population.toLocaleString()})
                          </LeafletTooltip>

                          <Popup>
                            <div className="map-popup-card">
                              <div className="popup-header">
                                <strong>{a.area_name}</strong>
                                <span className={`badge ${getPriorityBadgeClass(a.priority_level)}`}>
                                  {a.priority_level}
                                </span>
                              </div>
                              <div className="popup-body">
                                <div><strong>Affected Population:</strong> {a.population.toLocaleString()}</div>
                                <div><strong>Priority Score:</strong> {a.priority_score}</div>
                                <div><strong>Predicted Damage:</strong> {a.predicted_severity}</div>
                                <hr style={{ margin: '6px 0', borderColor: '#e2e8f0' }} />
                                <div><strong>Allocated Water:</strong> {a.allocation.Water.toLocaleString()} L</div>
                                <div><strong>Allocated Food:</strong> {a.allocation.Food.toLocaleString()} units</div>
                                <div><strong>Allocated Med Kits:</strong> {a.allocation.Medical_Kit.toLocaleString()}</div>
                                {a.shortage.Water > 0 && (
                                  <div style={{ color: '#dc2626', fontWeight: 600, marginTop: '4px' }}>
                                    ⚠️ Water Shortage: {a.shortage.Water.toLocaleString()} L
                                  </div>
                                )}
                              </div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
                <div className="map-legend-row">
                  <span className="legend-item"><span className="legend-dot crit" /> Critical Priority</span>
                  <span className="legend-item"><span className="legend-dot high" /> High Priority</span>
                  <span className="legend-item"><span className="legend-dot med" /> Medium Priority</span>
                  <span className="legend-item"><span className="legend-dot low" /> Low Priority</span>
                </div>
              </div>

              {/* Priority Ranking with Direct Map Selection */}
              <div className="glass-panel">
                <div className="panel-header-with-action">
                  <h3 className="panel-title">PRIORITY RANKING</h3>
                  <span className="sub-helper">Click area to focus on map</span>
                </div>

                <div className="area-rankings-scroll">
                  {analysisData.areas.map((a, idx) => {
                    const isSelected = selectedMapArea && selectedMapArea.area_name === a.area_name;

                    return (
                      <div 
                        key={a.area_name} 
                        className={`rank-row interactive-row ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedMapArea(a)}
                      >
                        <div className="rank-left">
                          <span className="rank-idx">#{idx + 1}</span>
                          <div>
                            <strong className="rank-name">{a.area_name}</strong>
                            <div className="rank-pop">{a.population.toLocaleString()} affected</div>
                          </div>
                        </div>
                        <div className="rank-right">
                          <span className={`badge ${getPriorityBadgeClass(a.priority_level)}`}>
                            {a.priority_level}
                          </span>
                          <span className="rank-score">{a.priority_score}</span>
                          <Eye size={14} className="icon-view" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="nav-actions-row">
            <button onClick={() => setActiveStep("1 Describe")} className="btn-secondary">
              <ArrowLeft size={16} />
              <span>Back to Describe</span>
            </button>
            <button onClick={() => setActiveStep("3 Response plan")} className="btn-primary">
              <span>Proceed to Response Plan</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </main>
      )}

      {/* STEP 3: RESPONSE PLAN */}
      {activeStep === "3 Response plan" && analysisData && (
        <main className="step-content">
          <div className="page-intro">
            <h2>Tactical Response Plan</h2>
            <p>Authorize AI-optimized relief convoys and review impact metrics.</p>
          </div>

          {/* Impact Banner */}
          <div className="impact-callout">
            <div className="impact-badge">
              <ShieldCheck size={20} />
              <span>OPTIMIZATION IMPACT: -{analysisData.overview.impact.reduction_pct}% UNMET SHORTAGE</span>
            </div>
            <p>
              In critical and high zones, unmet need is cut from <strong>{analysisData.overview.impact.baseline_shortage.toLocaleString()}</strong> (equal share baseline) 
              to <strong>{analysisData.overview.impact.optimized_shortage.toLocaleString()}</strong> under the AI plan. Every community receives at least a <strong>25% survival floor</strong>.
            </p>
          </div>

          <h3 className="panel-title" style={{ margin: '1.5rem 0 1rem 0' }}>AUTHORIZE CONVOY DISPATCHES</h3>
          
          <div className="convoys-grid">
            {analysisData.actions.slice(0, 3).map((act) => {
              const convoyId = `Convoy_${act.area_id}`;
              const isDispatched = dispatchedConvoys.has(convoyId);

              return (
                <div key={act.area_id} className={`convoy-card ${isDispatched ? 'dispatched' : ''}`}>
                  <div className="convoy-top">
                    <div className="convoy-title">
                      <Truck size={20} />
                      <strong>{act.area_name} Relief Convoy</strong>
                    </div>
                    <span className="badge badge-crit">SEND NOW</span>
                  </div>

                  <div className="convoy-payload">
                    Send <strong>{act.quantity.toLocaleString()} {act.unit}</strong> of {act.resource}
                  </div>

                  <p className="convoy-reason">
                    <strong>Why:</strong> {act.reason}
                  </p>
                  <p className="convoy-effect">
                    <strong>Effect:</strong> {act.expected_effect}
                  </p>

                  <button
                    onClick={() => toggleDispatch(convoyId)}
                    className={`btn-dispatch ${isDispatched ? 'en-route' : ''}`}
                  >
                    {isDispatched ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span>EN ROUTE (ETA: 45m)</span>
                      </>
                    ) : (
                      <>
                        <Truck size={16} />
                        <span>AUTHORIZE DISPATCH</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="nav-actions-row">
            <button onClick={() => setActiveStep("2 AI analysis")} className="btn-secondary">
              <ArrowLeft size={16} />
              <span>Back to AI Analysis</span>
            </button>
            <button onClick={() => setActiveStep("4 What-if")} className="btn-primary">
              <span>Test What-If Scenarios</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </main>
      )}

      {/* STEP 4: WHAT-IF & BROADCAST */}
      {activeStep === "4 What-if" && (
        <main className="step-content">
          <div className="page-intro">
            <h2>Crisis Simulation & Citizen Alert</h2>
            <p>Stress-test supply disruptions and broadcast emergency public warnings.</p>
          </div>

          <div className="grid-two-col">
            {/* Supply Shock Simulator */}
            <div className="glass-panel">
              <h3 className="panel-title">SUPPLY SHOCK SIMULATOR</h3>
              
              <div className="slider-row">
                <div className="slider-header">
                  <span>Simulate Water Supply Drop (%)</span>
                  <span className="slider-val">{shockWater}%</span>
                </div>
                <input
                  type="range"
                  min="-80"
                  max="20"
                  step="5"
                  value={shockWater}
                  onChange={(e) => setShockWater(Number(e.target.value))}
                  className="modern-range"
                />
              </div>

              <div className="slider-row">
                <div className="slider-header">
                  <span>Simulate Population Surge (%)</span>
                  <span className="slider-val">+{shockPop}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="5"
                  value={shockPop}
                  onChange={(e) => setShockPop(Number(e.target.value))}
                  className="modern-range"
                />
              </div>

              <button 
                onClick={runSimulation} 
                disabled={simLoading}
                className="btn-primary" 
                style={{ marginTop: '1rem', width: '100%' }}
              >
                {simLoading ? <span>Running Stress Test...</span> : <span>RUN STRESS TEST</span>}
              </button>

              {simResult && (
                <div className="sim-feedback">
                  <AlertTriangle size={18} />
                  <span>{simResult.warning}</span>
                </div>
              )}
            </div>

            {/* Citizen Broadcast */}
            <div className="glass-panel">
              <h3 className="panel-title"><Radio size={18} /> CITIZEN EMERGENCY BULLETIN</h3>
              <textarea
                readOnly
                className="broadcast-textarea"
                rows="5"
                value={`🚨 URGENT PUBLIC NOTICE [${disasterType.toUpperCase()}]: High-priority water and medical convoys are en route to critical zones. Residents across affected communities (${totalPop.toLocaleString()} total population) are advised to boil tap water, stay clear of blocked roadways, and dial 112 for acute evacuations.`}
              />

              <div className="cta-inline">
                <button
                  onClick={() => setBroadcastSent(true)}
                  className={`btn-primary ${broadcastSent ? 'sent' : ''}`}
                >
                  <Radio size={16} />
                  <span>{broadcastSent ? "BROADCAST ACTIVE ON NETWORKS" : "BROADCAST TO CITIZENS"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Audit History */}
          <div className="glass-panel full-width" style={{ marginTop: '1.5rem' }}>
            <div className="panel-header-with-action">
              <h3 className="panel-title">📋 OFFICIAL DECISION AUDIT LOG</h3>
              <a
                href={`${API_BASE}/api/audit`}
                target="_blank"
                rel="noreferrer"
                className="btn-download"
              >
                <Download size={14} />
                <span>DOWNLOAD AUDIT JSON</span>
              </a>
            </div>

            <div className="audit-table-wrapper">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>TIMESTAMP</th>
                    <th>SCENARIO</th>
                    <th>MODEL</th>
                    <th>SOLVER STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      <td>{row.timestamp || "2026-10-08 10:12"}</td>
                      <td>{row.scenario_name || "Crisis_Simulation"}</td>
                      <td>{row.model_name || "XGBoost"}</td>
                      <td><span className="badge badge-low">{row.solver_status || "OPTIMAL"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="nav-actions-row">
            <button onClick={() => setActiveStep("3 Response plan")} className="btn-secondary">
              <ArrowLeft size={16} />
              <span>Back to Response Plan</span>
            </button>
          </div>
        </main>
      )}

      {/* Mandatory Footer */}
      <footer className="footer-disclaimer">
        Decision-support tool; final decisions rest with emergency managers. 
        Sample numbers are illustrative and are replaced by your data and model output.
      </footer>
    </div>
  );
}
