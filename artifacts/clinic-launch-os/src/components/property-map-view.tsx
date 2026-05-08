import "leaflet/dist/leaflet.css";
import { divIcon, latLngBounds as createLatLngBounds } from "leaflet";
import type { Map as LeafletMap } from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSearchProperties,
  useCreateProperty,
  getListPropertiesQueryKey,
} from "@workspace/api-client-react";
import type {
  ClinicProperty,
  PropertySearchResultItem,
  CreatePropertyBodyPipelineStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Loader2,
  MapPin,
  ChevronDown,
  ChevronUp,
  Plus,
  CheckCircle,
  AlertCircle,
  Info,
  CircleDot,
  Train,
  Car,
  Building2,
  ExternalLink,
  Users,
} from "lucide-react";

const PROJECT_ID = 1;

const PIPELINE_COLORS: Record<string, string> = {
  found: "#94a3b8",
  interesting: "#60a5fa",
  brochure_requested: "#818cf8",
  viewing_booked: "#a78bfa",
  viewed: "#c084fc",
  under_review: "#fb923c",
  due_diligence: "#fbbf24",
  heads_of_terms: "#facc15",
  negotiating: "#4ade80",
  selected: "#10b981",
  rejected: "#f87171",
};

function makePinIcon(color: string, size = 14, label?: string, ring?: boolean): ReturnType<typeof divIcon> {
  const ringStyle = ring
    ? `box-shadow:0 0 0 3px ${color}44;`
    : "box-shadow:0 2px 6px rgba(0,0,0,0.35);";
  return divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;${ringStyle}" title="${label ?? ""}"></div>`,
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
    iconSize: [size, size],
  });
}

function makeSearchPinIcon(score: number, size = 12): ReturnType<typeof divIcon> {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#fbbf24" : "#fb923c";
  return divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0.75;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.25);" title="Score: ${score}"></div>`,
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
    iconSize: [size, size],
  });
}

type Coords = [number, number];

interface OverpassNode {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

async function fetchOverpassFeatures(
  allCoords: Coords[],
  radiusMeters: number,
  tagFilters: string[],
): Promise<OverpassNode[]> {
  if (allCoords.length === 0) return [];
  const aroundClauses = allCoords
    .flatMap(([lat, lng]) =>
      tagFilters.map(f => `node(around:${radiusMeters},${lat},${lng})${f};`),
    )
    .join("");
  const query = `[out:json][timeout:20];(${aroundClauses});out;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    if (!res.ok) return [];
    const data = await res.json() as { elements: OverpassNode[] };
    const seen = new Set<number>();
    return (data.elements ?? []).filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  } catch {
    return [];
  }
}

const COMPETITOR_FILTERS = [
  '[amenity=beauty_salon]',
  '[amenity=clinic]["healthcare"~"cosmetics|aesthetics|skin"]',
  '[shop=beauty]',
  '[amenity=dentist]',
];
const TRAIN_FILTERS = ['[railway=station]', '[railway=halt]'];
const PARKING_FILTERS = ['[amenity=parking]["access"!="private"]'];

function makePOIIcon(color: string, emoji: string, size = 20): ReturnType<typeof divIcon> {
  return divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:${size * 0.5}px;line-height:1">${emoji}</div>`,
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
    iconSize: [size, size],
  });
}

async function batchGeocodePostcodes(postcodes: string[]): Promise<Record<string, Coords>> {
  const results: Record<string, Coords> = {};
  const valid = [...new Set(postcodes.filter(p => p && p.trim().length >= 5))];
  if (valid.length === 0) return results;
  try {
    const res = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: valid.slice(0, 100) }),
    });
    if (!res.ok) return results;
    const data = await res.json() as {
      result: Array<{ query: string; result: { latitude: number; longitude: number } | null }>;
    };
    for (const item of data.result ?? []) {
      if (item.result) {
        results[item.query.toUpperCase().replace(/\s/g, "")] = [item.result.latitude, item.result.longitude];
      }
    }
  } catch { /* network failure — degrade gracefully */ }
  return results;
}

function normalizePostcode(pc: string): string {
  return pc.toUpperCase().replace(/\s/g, "");
}

interface SearchForm {
  location: string;
  radiusKm: number;
  minSqft: string;
  maxSqft: string;
  minRentGbp: string;
  maxRentGbp: string;
  useClass: string;
  parkingRequired: boolean;
  highStreetOnly: boolean;
}

const DEFAULT_FORM: SearchForm = {
  location: "",
  radiusKm: 5,
  minSqft: "",
  maxSqft: "",
  minRentGbp: "",
  maxRentGbp: "",
  useClass: "",
  parkingRequired: false,
  highStreetOnly: false,
};

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (score >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
}

export default function PropertyMapView({
  properties,
  onOpen,
}: {
  properties: ClinicProperty[];
  onOpen: (p: ClinicProperty) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [geoCache, setGeoCache] = useState<Record<string, Coords>>({});
  const [showRadiusOverlay, setShowRadiusOverlay] = useState(false);
  const [radiusKm, setRadiusKm] = useState(1.5);
  const [showCompetitorOverlay, setShowCompetitorOverlay] = useState(false);
  const [showTrainOverlay, setShowTrainOverlay] = useState(false);
  const [showParkingOverlay, setShowParkingOverlay] = useState(false);
  const [competitorPins, setCompetitorPins] = useState<OverpassNode[]>([]);
  const [trainPins, setTrainPins] = useState<OverpassNode[]>([]);
  const [parkingPins, setParkingPins] = useState<OverpassNode[]>([]);
  const [overlayLoading, setOverlayLoading] = useState<string | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [searchForm, setSearchForm] = useState<SearchForm>(DEFAULT_FORM);
  const [searchResults, setSearchResults] = useState<PropertySearchResultItem[]>([]);
  const [savedResultAddresses, setSavedResultAddresses] = useState<Set<string>>(new Set());
  const [formExpanded, setFormExpanded] = useState(true);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const searchMutation = useSearchProperties();
  const createProperty = useCreateProperty();

  useEffect(() => {
    const postcodes = properties
      .map(p => p.postcode)
      .filter((pc): pc is string => !!pc && pc.trim().length >= 5);
    if (postcodes.length === 0) return;
    batchGeocodePostcodes(postcodes).then(newCache => {
      setGeoCache(prev => ({ ...prev, ...newCache }));
    });
  }, [properties]);

  const geocodedCoords: Coords[] = properties
    .map(p => p.postcode ? geoCache[normalizePostcode(p.postcode)] : undefined)
    .filter((c): c is Coords => !!c);

  useEffect(() => {
    if (!showCompetitorOverlay || geocodedCoords.length === 0) return;
    setOverlayLoading("competitors");
    setOverlayError(null);
    fetchOverpassFeatures(geocodedCoords, 1200, COMPETITOR_FILTERS).then(nodes => {
      setCompetitorPins(nodes);
      setOverlayLoading(null);
      if (nodes.length === 0) setOverlayError("No nearby competitors found in OpenStreetMap data.");
    });
  }, [showCompetitorOverlay, geocodedCoords.length]);

  useEffect(() => {
    if (!showTrainOverlay || geocodedCoords.length === 0) return;
    setOverlayLoading("trains");
    setOverlayError(null);
    fetchOverpassFeatures(geocodedCoords, 1500, TRAIN_FILTERS).then(nodes => {
      setTrainPins(nodes);
      setOverlayLoading(null);
    });
  }, [showTrainOverlay, geocodedCoords.length]);

  useEffect(() => {
    if (!showParkingOverlay || geocodedCoords.length === 0) return;
    setOverlayLoading("parking");
    setOverlayError(null);
    fetchOverpassFeatures(geocodedCoords, 800, PARKING_FILTERS).then(nodes => {
      setParkingPins(nodes);
      setOverlayLoading(null);
    });
  }, [showParkingOverlay, geocodedCoords.length]);

  const getPropertyCoords = useCallback((prop: ClinicProperty): Coords | null => {
    if (!prop.postcode) return null;
    return geoCache[normalizePostcode(prop.postcode)] ?? null;
  }, [geoCache]);

  const geocodedCount = properties.filter(p => p.postcode && normalizePostcode(p.postcode) in geoCache).length;

  const allCoords: Coords[] = [
    ...properties.map(p => getPropertyCoords(p)).filter((c): c is Coords => c !== null),
    ...searchResults.map(r => [r.lat, r.lng] as Coords),
  ];

  const defaultCenter: Coords = allCoords.length > 0
    ? [
        allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length,
        allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length,
      ]
    : [51.5074, -0.1278];

  function fitMapBounds() {
    if (!mapRef.current || allCoords.length === 0) return;
    const bounds = createLatLngBounds(allCoords.map(c => [c[0], c[1]] as [number, number]));
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }

  useEffect(() => {
    if (allCoords.length > 0) {
      setTimeout(fitMapBounds, 200);
    }
  }, [geoCache, searchResults]);

  function handleSearch() {
    const data = {
      location: searchForm.location,
      radiusKm: searchForm.radiusKm,
      minSqft: searchForm.minSqft ? Number(searchForm.minSqft) : undefined,
      maxSqft: searchForm.maxSqft ? Number(searchForm.maxSqft) : undefined,
      minRentGbp: searchForm.minRentGbp ? Number(searchForm.minRentGbp) : undefined,
      maxRentGbp: searchForm.maxRentGbp ? Number(searchForm.maxRentGbp) : undefined,
      useClass: searchForm.useClass || undefined,
      parkingRequired: searchForm.parkingRequired || undefined,
      highStreetOnly: searchForm.highStreetOnly || undefined,
    };
    searchMutation.mutate({ projectId: PROJECT_ID, data }, {
      onSuccess: (res) => {
        setSearchResults(res.results);
        setFormExpanded(false);
        setSavedResultAddresses(new Set());
        toast({ title: `Found ${res.results.length} potential locations`, description: `Searching near ${res.location}` });
      },
      onError: (err: Error) => {
        const msg = err.message.includes("AI service") ? err.message : "Search failed. Please try again.";
        toast({ title: "Search failed", description: msg, variant: "destructive" });
      },
    });
  }

  function handleSaveToPipeline(result: PropertySearchResultItem) {
    createProperty.mutate({
      projectId: PROJECT_ID,
      data: {
        address: result.address,
        postcode: result.postcode,
        monthlyRentGbp: result.estimatedMonthlyRentGbp ?? undefined,
        sqFootage: result.estimatedSqft ?? undefined,
        useClass: result.useClass ?? undefined,
        status: "viewing" as const,
        pipelineStatus: "found" as CreatePropertyBodyPipelineStatus,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
        setSavedResultAddresses(prev => new Set([...prev, result.address]));
        toast({ title: "Saved to pipeline", description: result.address });
      },
    });
  }

  function flyTo(coords: Coords, zoom = 15) {
    mapRef.current?.flyTo([coords[0], coords[1]], zoom, { duration: 0.8 });
  }

  return (
    <div className="flex gap-3" style={{ height: "calc(100vh - 290px)", minHeight: 480 }}>
      {/* ─── Left Sidebar ─────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Search Form */}
        <div className="rounded-xl border bg-card p-3 space-y-3">
          <button
            className="w-full flex items-center justify-between text-sm font-semibold"
            onClick={() => setFormExpanded(e => !e)}
          >
            <span className="flex items-center gap-1.5"><Search className="w-3.5 h-3.5 text-primary" />Property Search</span>
            {formExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>

          {formExpanded && (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Location *</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="e.g. Guildford, Surrey"
                  value={searchForm.location}
                  onChange={e => setSearchForm(f => ({ ...f, location: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && searchForm.location && handleSearch()}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Radius: {searchForm.radiusKm} km</Label>
                <Slider
                  min={1} max={25} step={1}
                  value={[searchForm.radiusKm]}
                  onValueChange={([v]) => setSearchForm(f => ({ ...f, radiusKm: v }))}
                  className="h-4"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-1">
                  <Label className="text-xs">Min sq ft</Label>
                  <Input className="h-7 text-xs" placeholder="500" value={searchForm.minSqft} onChange={e => setSearchForm(f => ({ ...f, minSqft: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max sq ft</Label>
                  <Input className="h-7 text-xs" placeholder="2000" value={searchForm.maxSqft} onChange={e => setSearchForm(f => ({ ...f, maxSqft: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-1">
                  <Label className="text-xs">Min rent £/mo</Label>
                  <Input className="h-7 text-xs" placeholder="1000" value={searchForm.minRentGbp} onChange={e => setSearchForm(f => ({ ...f, minRentGbp: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max rent £/mo</Label>
                  <Input className="h-7 text-xs" placeholder="4000" value={searchForm.maxRentGbp} onChange={e => setSearchForm(f => ({ ...f, maxRentGbp: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Use class</Label>
                <Input className="h-7 text-xs" placeholder="E, A1, D1, any…" value={searchForm.useClass} onChange={e => setSearchForm(f => ({ ...f, useClass: e.target.value }))} />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs cursor-pointer">Parking required</Label>
                <Switch
                  checked={searchForm.parkingRequired}
                  onCheckedChange={v => setSearchForm(f => ({ ...f, parkingRequired: v }))}
                  className="scale-75"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs cursor-pointer">High street only</Label>
                <Switch
                  checked={searchForm.highStreetOnly}
                  onCheckedChange={v => setSearchForm(f => ({ ...f, highStreetOnly: v }))}
                  className="scale-75"
                />
              </div>

              <Button
                size="sm"
                className="w-full gap-1.5 text-xs h-8"
                disabled={!searchForm.location || searchMutation.isPending}
                onClick={handleSearch}
              >
                {searchMutation.isPending ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Searching…</>
                ) : (
                  <><Search className="w-3 h-3" />Search Locations</>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Map legend / status */}
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Map Info</p>
          <p className="text-xs text-muted-foreground">
            {geocodedCount} / {properties.length} properties geocoded
            {properties.length > geocodedCount && " — add postcodes to show pins"}
          </p>
          {searchResults.length > 0 && (
            <p className="text-xs text-muted-foreground">{searchResults.length} search result pins on map</p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { color: "#10b981", label: "Selected" },
              { color: "#4ade80", label: "Negotiating" },
              { color: "#fb923c", label: "In Review" },
              { color: "#94a3b8", label: "Found" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span style={{ background: color }} className="inline-block w-2.5 h-2.5 rounded-full border border-white shadow-sm" />
                {label}
              </span>
            ))}
            {showCompetitorOverlay && competitorPins.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span style={{ background: "#f43f5e" }} className="inline-block w-2.5 h-2.5 rounded-full border border-white shadow-sm" />
                Competitor ({competitorPins.length})
              </span>
            )}
            {showTrainOverlay && trainPins.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span style={{ background: "#8b5cf6" }} className="inline-block w-2.5 h-2.5 rounded-full border border-white shadow-sm" />
                Train ({trainPins.length})
              </span>
            )}
            {showParkingOverlay && parkingPins.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span style={{ background: "#f59e0b" }} className="inline-block w-2.5 h-2.5 rounded-full border border-white shadow-sm" />
                Parking ({parkingPins.length})
              </span>
            )}
          </div>
        </div>

        {/* Overlays toggle */}
        <div className="rounded-xl border bg-card p-3 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overlays</p>

          {/* Drive-time radius */}
          <div className="flex items-center justify-between">
            <span className="text-xs flex items-center gap-1.5">
              <CircleDot className="w-3 h-3 text-blue-500" />Drive radius ({radiusKm} km)
            </span>
            <Switch checked={showRadiusOverlay} onCheckedChange={setShowRadiusOverlay} className="scale-75" />
          </div>
          {showRadiusOverlay && (
            <Slider min={0.5} max={5} step={0.5} value={[radiusKm]} onValueChange={([v]) => setRadiusKm(v)} className="h-4" />
          )}

          {/* Competitors */}
          <div className="flex items-center justify-between">
            <span className="text-xs flex items-center gap-1.5">
              <Users className="w-3 h-3 text-rose-500" />Nearby competitors
            </span>
            <Switch
              checked={showCompetitorOverlay}
              onCheckedChange={v => {
                setShowCompetitorOverlay(v);
                if (!v) { setCompetitorPins([]); setOverlayError(null); }
              }}
              className="scale-75"
            />
          </div>

          {/* Train stations */}
          <div className="flex items-center justify-between">
            <span className="text-xs flex items-center gap-1.5">
              <Train className="w-3 h-3 text-purple-500" />Train stations
            </span>
            <Switch
              checked={showTrainOverlay}
              onCheckedChange={v => {
                setShowTrainOverlay(v);
                if (!v) setTrainPins([]);
              }}
              className="scale-75"
            />
          </div>

          {/* Parking */}
          <div className="flex items-center justify-between">
            <span className="text-xs flex items-center gap-1.5">
              <Car className="w-3 h-3 text-amber-500" />Parking
            </span>
            <Switch
              checked={showParkingOverlay}
              onCheckedChange={v => {
                setShowParkingOverlay(v);
                if (!v) setParkingPins([]);
              }}
              className="scale-75"
            />
          </div>

          {/* Loading / error states */}
          {overlayLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />Loading {overlayLoading} data…
            </p>
          )}
          {overlayError && !overlayLoading && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{overlayError}</p>
          )}
          {(showCompetitorOverlay || showTrainOverlay || showParkingOverlay) && geocodedCoords.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Add postcodes to properties to enable overlay data.</p>
          )}
          <p className="text-xs text-muted-foreground/60 italic">Overlay data sourced from OpenStreetMap.</p>
        </div>

        {/* Search Results List */}
        {searchResults.length > 0 && (
          <div className="rounded-xl border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Search Results</p>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setSearchResults([]); setHighlightIdx(null); }}
              >Clear</button>
            </div>
            <div className="space-y-2">
              {searchResults.map((result, idx) => {
                const saved = savedResultAddresses.has(result.address);
                const isHighlighted = highlightIdx === idx;
                return (
                  <div
                    key={idx}
                    className={`rounded-lg border p-2 cursor-pointer transition-colors ${isHighlighted ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                    onClick={() => {
                      setHighlightIdx(idx);
                      flyTo([result.lat, result.lng]);
                    }}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <p className="text-xs font-medium leading-snug flex-1">{result.address}</p>
                      <Badge className={`text-xs px-1.5 py-0 shrink-0 ${scoreColor(result.suitabilityScore)}`}>
                        {result.suitabilityScore}
                      </Badge>
                    </div>
                    {result.estimatedMonthlyRentGbp != null && (
                      <p className="text-xs text-muted-foreground">~£{result.estimatedMonthlyRentGbp.toLocaleString()}/mo</p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{result.rationale}</p>

                    {result.strengths.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {result.strengths.slice(0, 2).map((s, i) => (
                          <p key={i} className="text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-1">
                            <CheckCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" />{s}
                          </p>
                        ))}
                      </div>
                    )}
                    {result.concerns.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {result.concerns.slice(0, 1).map((c, i) => (
                          <p key={i} className="text-xs text-orange-600 dark:text-orange-400 flex items-start gap-1">
                            <AlertCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" />{c}
                          </p>
                        ))}
                      </div>
                    )}

                    {result.listingUrl && (
                      <a
                        href={result.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />View listings
                      </a>
                    )}

                    <Button
                      size="sm"
                      variant={saved ? "outline" : "default"}
                      className="w-full mt-2 h-6 text-xs gap-1"
                      disabled={saved || createProperty.isPending}
                      onClick={e => { e.stopPropagation(); if (!saved) handleSaveToPipeline(result); }}
                    >
                      {saved ? (
                        <><CheckCircle className="w-2.5 h-2.5" />Saved to Pipeline</>
                      ) : (
                        <><Plus className="w-2.5 h-2.5" />Save to Pipeline</>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Map ──────────────────────────────────────────────────── */}
      <div className="flex-1 rounded-xl overflow-hidden border relative">
        {properties.length > 0 && geocodedCount === 0 && searchResults.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-muted/30">
            <MapPin className="w-10 h-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-semibold text-sm">No postcodes to geocode</p>
              <p className="text-xs text-muted-foreground mt-1">Add UK postcodes to your properties to see them on the map.</p>
              <p className="text-xs text-muted-foreground">Or use the search panel to find new locations.</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={allCoords.length > 0 ? 12 : 7}
            style={{ height: "100%", width: "100%" }}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Saved property pins */}
            {properties.map(prop => {
              const coords = getPropertyCoords(prop);
              if (!coords) return null;
              const color = PIPELINE_COLORS[prop.pipelineStatus ?? "found"] ?? "#94a3b8";
              const isSelected = !!prop.isActiveForProject;
              return (
                <Marker
                  key={prop.id}
                  position={coords}
                  icon={makePinIcon(color, isSelected ? 18 : 14, prop.address ?? "", isSelected)}
                >
                  <Popup className="leaflet-popup-content-wrapper-custom" maxWidth={240}>
                    <div className="space-y-1.5 p-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          style={{ background: color }}
                          className="inline-block w-2.5 h-2.5 rounded-full border border-white shadow-sm shrink-0"
                        />
                        <p className="font-semibold text-sm leading-snug">{prop.address ?? "Unnamed property"}</p>
                      </div>
                      {prop.postcode && <p className="text-xs text-gray-500">{prop.postcode}</p>}
                      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                        {prop.monthlyRentGbp != null && <span>£{prop.monthlyRentGbp.toLocaleString()}/mo</span>}
                        {prop.sqFootage != null && <span>{prop.sqFootage.toFixed(0)} sq ft</span>}
                        {prop.parkingSpaces != null && <span>{prop.parkingSpaces} parking</span>}
                      </div>
                      <p className="text-xs capitalize text-gray-500">{(prop.pipelineStatus ?? "found").replace(/_/g, " ")}</p>
                      {prop.manualCompetitors && prop.manualCompetitors.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5 text-rose-500" />Noted competitors ({prop.manualCompetitors.length})
                          </p>
                          {prop.manualCompetitors.slice(0, 3).map((c, i) => (
                            <p key={i} className="text-xs text-gray-500 pl-3.5 leading-snug">{c.name} <span className="text-gray-400">({c.type})</span></p>
                          ))}
                          {prop.manualCompetitors.length > 3 && (
                            <p className="text-xs text-gray-400 pl-3.5">+{prop.manualCompetitors.length - 3} more</p>
                          )}
                        </div>
                      )}
                      <button
                        className="text-xs text-blue-600 hover:underline font-medium"
                        onClick={() => onOpen(prop)}
                      >
                        View Details →
                      </button>
                    </div>
                  </Popup>

                  {showRadiusOverlay && (
                    <Circle
                      center={coords}
                      radius={radiusKm * 1000}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.06, weight: 1.5, dashArray: "4 4" }}
                    />
                  )}
                </Marker>
              );
            })}

            {/* Search result pins */}
            {searchResults.map((result, idx) => (
              <Marker
                key={`sr-${idx}`}
                position={[result.lat, result.lng]}
                icon={makeSearchPinIcon(result.suitabilityScore, highlightIdx === idx ? 16 : 12)}
              >
                <Popup maxWidth={220}>
                  <div className="space-y-1 p-1">
                    <div className="flex items-center gap-1.5 justify-between">
                      <p className="font-semibold text-sm leading-snug flex-1">{result.address}</p>
                      <span className="text-xs font-bold text-emerald-700">{result.suitabilityScore}</span>
                    </div>
                    {result.estimatedMonthlyRentGbp != null && (
                      <p className="text-xs text-gray-500">~£{result.estimatedMonthlyRentGbp.toLocaleString()}/mo est.</p>
                    )}
                    {result.estimatedSqft != null && (
                      <p className="text-xs text-gray-500">~{result.estimatedSqft.toLocaleString()} sq ft est.</p>
                    )}
                    <p className="text-xs text-gray-600 line-clamp-2">{result.rationale}</p>
                    {result.listingUrl && (
                      <a href={result.listingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                        <ExternalLink className="w-2.5 h-2.5" />View listings
                      </a>
                    )}
                    <button
                      className="text-xs text-blue-600 hover:underline font-medium mt-1"
                      onClick={() => handleSaveToPipeline(result)}
                    >
                      {savedResultAddresses.has(result.address) ? "✓ Saved" : "+ Save to Pipeline"}
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Competitor pins (OSM) */}
            {showCompetitorOverlay && competitorPins.map(node => (
              <Marker
                key={`comp-${node.id}`}
                position={[node.lat, node.lon]}
                icon={makePOIIcon("#f43f5e", "💇", 18)}
              >
                <Popup maxWidth={200}>
                  <div className="space-y-0.5 p-1">
                    <p className="font-semibold text-sm">{node.tags.name ?? "Beauty/Aesthetics"}</p>
                    <p className="text-xs text-gray-500 capitalize">{node.tags.amenity ?? node.tags.shop ?? "competitor"}</p>
                    {node.tags["addr:street"] && (
                      <p className="text-xs text-gray-400">{node.tags["addr:street"]}{node.tags["addr:housenumber"] ? `, ${node.tags["addr:housenumber"]}` : ""}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Train station pins (OSM) */}
            {showTrainOverlay && trainPins.map(node => (
              <Marker
                key={`train-${node.id}`}
                position={[node.lat, node.lon]}
                icon={makePOIIcon("#8b5cf6", "🚉", 18)}
              >
                <Popup maxWidth={200}>
                  <div className="space-y-0.5 p-1">
                    <p className="font-semibold text-sm">{node.tags.name ?? "Railway Station"}</p>
                    <p className="text-xs text-gray-500 capitalize">{node.tags.railway ?? "station"}</p>
                    {node.tags.operator && <p className="text-xs text-gray-400">{node.tags.operator}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Parking pins (OSM) */}
            {showParkingOverlay && parkingPins.map(node => (
              <Marker
                key={`park-${node.id}`}
                position={[node.lat, node.lon]}
                icon={makePOIIcon("#f59e0b", "🅿", 16)}
              >
                <Popup maxWidth={200}>
                  <div className="space-y-0.5 p-1">
                    <p className="font-semibold text-sm">{node.tags.name ?? "Parking"}</p>
                    {node.tags.capacity && <p className="text-xs text-gray-500">{node.tags.capacity} spaces</p>}
                    {node.tags.fee && <p className="text-xs text-gray-400">Fee: {node.tags.fee}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}

        {/* Fit bounds button */}
        {allCoords.length > 0 && (
          <button
            onClick={fitMapBounds}
            className="absolute bottom-3 right-3 z-[1000] bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-md hover:bg-gray-50 transition-colors"
          >
            Fit All
          </button>
        )}

        {/* Empty state overlay */}
        {properties.length === 0 && searchResults.length === 0 && (
          <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl p-5 text-center space-y-2 shadow-lg border max-w-xs">
              <Info className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="font-semibold text-sm">No properties yet</p>
              <p className="text-xs text-muted-foreground">Use the search panel to find clinic locations, or add properties manually from the Pipeline tab.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
