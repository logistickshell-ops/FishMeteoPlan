export type WaterObjectType = "river" | "lake" | "reservoir";

export interface WaterObject {
  id: string;
  name: string;
  type: WaterObjectType;
  coords: { lat: number; lon: number };
  distanceKm: number;
  source: "OpenStreetMap";
  tags?: Record<string, string>;
}

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const radius = 6371;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nameFromTags(tags: Record<string, string> = {}) {
  return tags["name:ru"] || tags.name || tags["name:en"] || "Без названия";
}

function typeFromTags(tags: Record<string, string> = {}): WaterObjectType | null {
  if (tags.waterway === "river" || tags.waterway === "riverbank") return "river";
  if (tags.landuse === "reservoir" || tags.water === "reservoir") return "reservoir";
  if (tags.natural === "water" || tags.water === "lake") return "lake";
  return null;
}

function normalize(items: WaterObject[], origin: { lat: number; lon: number }) {
  const deduped = new Map<string, WaterObject>();
  for (const item of items) {
    const key = `${item.type}:${item.name.trim().toLocaleLowerCase("ru-RU")}`;
    const previous = deduped.get(key);
    if (!previous || item.distanceKm < previous.distanceKm) deduped.set(key, item);
  }
  return [...deduped.values()]
    .map((item) => ({ ...item, distanceKm: Number(distanceKm(origin, item.coords).toFixed(1)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 30);
}

export async function findNearbyWaterObjects(origin: { lat: number; lon: number }, radiusMeters = 30000): Promise<WaterObject[]> {
  const query = `[out:json][timeout:20];(
    way["waterway"="river"]["name"](around:${radiusMeters},${origin.lat},${origin.lon});
    relation["waterway"="river"]["name"](around:${radiusMeters},${origin.lat},${origin.lon});
    way["natural"="water"]["name"](around:${radiusMeters},${origin.lat},${origin.lon});
    relation["natural"="water"]["name"](around:${radiusMeters},${origin.lat},${origin.lon});
    way["landuse"="reservoir"]["name"](around:${radiusMeters},${origin.lat},${origin.lon});
    relation["landuse"="reservoir"]["name"](around:${radiusMeters},${origin.lat},${origin.lon});
  );out center tags;`;
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
  const data = await response.json();
  const items: WaterObject[] = (data.elements || []).flatMap((element: any) => {
    const tags = element.tags || {};
    const type = typeFromTags(tags);
    if (!type) return [];
    const lat = Number(element.center?.lat ?? element.lat);
    const lon = Number(element.center?.lon ?? element.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    return [{
      id: `osm-${element.type}-${element.id}`,
      name: nameFromTags(tags),
      type,
      coords: { lat, lon },
      distanceKm: distanceKm(origin, { lat, lon }),
      source: "OpenStreetMap" as const,
      tags,
    }];
  });
  return normalize(items, origin);
}

export async function searchWaterObjects(query: string, origin: { lat: number; lon: number }): Promise<WaterObject[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "12",
    addressdetails: "1",
    dedupe: "1",
    extratags: "1",
  });
  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  const data = await response.json();
  const items: WaterObject[] = data.flatMap((item: any) => {
    const tags = item.extratags || {};
    const type = item.type === "river" || tags.waterway === "river" ? "river" : item.type === "reservoir" || tags.water === "reservoir" ? "reservoir" : item.type === "lake" || tags.natural === "water" ? "lake" : null;
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!type || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    return [{ id: `nominatim-${item.osm_type}-${item.osm_id}`, name: item.display_name?.split(",")[0] || item.name || query, type, coords: { lat, lon }, distanceKm: distanceKm(origin, { lat, lon }), source: "OpenStreetMap" as const, tags }];
  });
  return normalize(items, origin);
}
