function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type NodeId = string;

interface Graph {
  coords: Map<NodeId, [number, number]>;
  edges: Map<NodeId, { id: NodeId; dist: number }[]>;
}

function buildGraph(elements: any[]): Graph {
  const coords = new Map<NodeId, [number, number]>();
  const edges = new Map<NodeId, { id: NodeId; dist: number }[]>();

  for (const way of elements) {
    if (!way.geometry || way.geometry.length < 2) continue;
    const geom: { lat: number; lon: number }[] = way.geometry;

    for (let i = 0; i < geom.length; i++) {
      const id: NodeId = `${geom[i].lat},${geom[i].lon}`;
      coords.set(id, [geom[i].lat, geom[i].lon]);
      if (!edges.has(id)) edges.set(id, []);

      if (i > 0) {
        const prevId: NodeId = `${geom[i - 1].lat},${geom[i - 1].lon}`;
        const dist = haversineM(geom[i].lat, geom[i].lon, geom[i - 1].lat, geom[i - 1].lon);
        edges.get(id)!.push({ id: prevId, dist });
        edges.get(prevId)!.push({ id, dist });
      }
    }
  }

  return { coords, edges };
}

function nearestNode(graph: Graph, lat: number, lng: number): NodeId | null {
  let minDist = Infinity;
  let nearest: NodeId | null = null;
  for (const [id, [nlat, nlng]] of graph.coords) {
    const d = haversineM(lat, lng, nlat, nlng);
    if (d < minDist) { minDist = d; nearest = id; }
  }
  return nearest;
}

// Dijkstra shortest path on the railway graph
function dijkstra(graph: Graph, startId: NodeId, endId: NodeId): [number, number][] | null {
  const dist = new Map<NodeId, number>();
  const prev = new Map<NodeId, NodeId | null>();
  const visited = new Set<NodeId>();

  for (const id of graph.coords.keys()) dist.set(id, Infinity);
  dist.set(startId, 0);
  prev.set(startId, null);

  // Simple priority queue using array (fine for a few thousand nodes)
  const pq: { id: NodeId; d: number }[] = [{ id: startId, d: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const { id } = pq.shift()!;

    if (visited.has(id)) continue;
    visited.add(id);

    if (id === endId) break;

    for (const { id: nbId, dist: edgeDist } of (graph.edges.get(id) || [])) {
      if (visited.has(nbId)) continue;
      const newDist = dist.get(id)! + edgeDist;
      if (newDist < dist.get(nbId)!) {
        dist.set(nbId, newDist);
        prev.set(nbId, id);
        pq.push({ id: nbId, d: newDist });
      }
    }
  }

  // Reconstruct path
  if (!prev.has(endId) && startId !== endId) return null;
  const path: [number, number][] = [];
  let cur: NodeId | null | undefined = endId;
  while (cur != null) {
    const c = graph.coords.get(cur);
    if (c) path.unshift(c);
    cur = prev.get(cur);
  }
  return path.length >= 2 ? path : null;
}

/**
 * Fetches real railway geometry from OSM via Overpass API and returns
 * the shortest path along the actual tracks from startPoint to endPoint.
 * Falls back to [] if no railway data found.
 */
export async function fetchRailwayGeometry(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<[number, number][][]> {
  const minLat = Math.min(startLat, endLat);
  const maxLat = Math.max(startLat, endLat);
  const minLng = Math.min(startLng, endLng);
  const maxLng = Math.max(startLng, endLng);

  const latPad = Math.max((maxLat - minLat) * 0.15, 0.01);
  const lngPad = Math.max((maxLng - minLng) * 0.15, 0.01);
  const bbox = `${(minLat - latPad).toFixed(6)},${(minLng - lngPad).toFixed(6)},${(maxLat + latPad).toFixed(6)},${(maxLng + lngPad).toFixed(6)}`;

  const query = `[out:json][timeout:30];
way[railway~"^(rail|light_rail|subway|tram|narrow_gauge|monorail)$"](${bbox});
out geom;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
    });
    const data = await res.json();
    const elements = data.elements || [];

    if (elements.length === 0) return [];

    const graph = buildGraph(elements);
    if (graph.coords.size === 0) return [];

    const startNode = nearestNode(graph, startLat, startLng);
    const endNode = nearestNode(graph, endLat, endLng);

    if (!startNode || !endNode) return [];

    const path = dijkstra(graph, startNode, endNode);
    if (path && path.length >= 2) return [path];

    // If pathfinding fails, return nothing (fallback to straight line in caller)
    return [];
  } catch {
    return [];
  }
}
