/**
 * Strict Indian Sovereign Territory Boundary Validator (Frontend JS).
 * Uses Ray-Casting Point-in-Polygon logic for mainland India and island bounding.
 */

const MAINLAND_INDIA_POLYGON = [
  [68.1, 23.7],   // Kori Creek / Kutch Coast
  [68.8, 24.2],   // Rann of Kutch
  [71.0, 24.8],   // Gujarat-Pakistan Border
  [70.5, 25.8],   // Rajasthan-Pakistan Border
  [69.6, 27.0],
  [70.5, 28.0],
  [72.0, 29.5],
  [73.8, 30.0],   // Punjab-Pakistan Border
  [74.5, 31.0],   // Amritsar / Wagah Border
  [74.6, 32.5],   // Jammu Border
  [74.0, 33.5],   // Line of Control (J&K)
  [74.0, 35.0],
  [75.5, 36.0],   // Northern Kashmir / Siachen
  [77.0, 35.8],
  [78.8, 35.5],   // Ladakh / Aksai Chin LAC
  [79.2, 34.5],
  [78.8, 33.0],
  [78.5, 32.0],   // Himachal Pradesh Border
  [78.5, 31.5],   // Uttarakhand Border
  [79.8, 31.0],
  [81.0, 30.2],   // Nepal Trijunction
  [80.3, 29.0],   // Nepal Border (Kali River)
  [80.1, 28.6],
  [81.5, 28.1],   // UP-Nepal Border
  [83.0, 27.5],
  [84.5, 27.3],   // Bihar-Nepal Border
  [86.0, 26.6],
  [88.0, 26.4],   // Siliguri Corridor
  [88.0, 27.2],   // Sikkim-Nepal Border
  [88.6, 28.1],   // Sikkim-Tibet Border
  [88.9, 27.3],   // Sikkim-Bhutan Border
  [89.5, 26.8],   // West Bengal-Bhutan Border
  [91.5, 26.8],   // Assam-Bhutan Border
  [92.0, 27.6],   // Arunachal Pradesh (McMahon Line)
  [94.0, 28.6],
  [96.0, 29.2],   // Eastern Arunachal
  [97.3, 28.2],   // Kibithu / Anjaw
  [97.0, 27.3],   // Arunachal-Myanmar Border
  [95.2, 26.0],   // Nagaland-Myanmar Border
  [94.5, 24.5],   // Manipur-Myanmar Border
  [93.5, 23.0],   // Mizoram-Myanmar Border
  [92.3, 21.9],   // Southern Mizoram
  [92.4, 23.0],   // Mizoram-Bangladesh Border
  [91.8, 23.0],   // Tripura-Bangladesh Border
  [91.2, 23.8],
  [92.2, 24.5],   // Assam-Bangladesh Border
  [92.5, 25.2],   // Meghalaya-Bangladesh Border
  [89.8, 25.2],
  [88.8, 26.2],   // West Bengal-Bangladesh Border
  [88.0, 25.0],
  [88.5, 22.8],
  [89.1, 21.6],   // Sundarbans Coast
  [87.0, 21.5],   // Odisha Coast
  [85.0, 19.8],
  [84.0, 19.0],
  [83.5, 17.5],   // Visakhapatnam Coast
  [80.6, 15.0],   // Andhra Pradesh Coast
  [80.5, 13.0],   // Chennai Coast
  [80.0, 11.5],   // Tamil Nadu Coast
  [79.8, 10.0],   // Palk Strait / Rameshwaram
  [77.5, 8.0],    // Kanyakumari (Cape Comorin)
  [76.8, 8.5],    // Kerala Coast
  [76.2, 9.8],    // Kochi
  [75.5, 11.8],   // Kozhikode
  [74.5, 14.0],   // Karnataka Coast
  [73.8, 15.5],   // Goa Coast
  [73.0, 18.0],   // Maharashtra Coast
  [72.8, 19.2],   // Mumbai Coast
  [72.7, 20.5],   // Daman & Diu
  [72.8, 21.2],   // Gulf of Khambhat
  [71.5, 21.0],   // Saurashtra Coast
  [70.0, 20.8],   // Veraval
  [69.0, 22.4],   // Dwarka
  [69.5, 23.0],   // Gulf of Kutch
  [68.1, 23.7]    // Kori Creek Loop End
];

const ISLAND_BOUNDS = [
  // Andaman & Nicobar Islands: [min_lon, min_lat, max_lon, max_lat]
  [92.0, 6.5, 94.2, 14.0],
  // Lakshadweep Islands: [min_lon, min_lat, max_lon, max_lat]
  [71.5, 8.0, 74.0, 12.5]
];

export function isPointInIndia(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  if (isNaN(lat) || isNaN(lon)) return false;

  // Check Island Bounds
  for (const [minLon, minLat, maxLon, maxLat] of ISLAND_BOUNDS) {
    if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
      return true;
    }
  }

  // Ray-Casting Algorithm for Mainland India Polygon
  const n = MAINLAND_INDIA_POLYGON.length;
  let inside = false;
  let [p1x, p1y] = MAINLAND_INDIA_POLYGON[0];

  for (let i = 0; i <= n; i++) {
    const [p2x, p2y] = MAINLAND_INDIA_POLYGON[i % n];
    if (lat > Math.min(p1y, p2y)) {
      if (lat <= Math.max(p1y, p2y)) {
        if (lon <= Math.max(p1x, p2x)) {
          let xinters = lon;
          if (p1y !== p2y) {
            xinters = ((lat - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x;
          }
          if (p1x === p2x || lon <= xinters) {
            inside = !inside;
          }
        }
      }
    }
    [p1x, p1y] = [p2x, p2y];
  }

  return inside;
}
