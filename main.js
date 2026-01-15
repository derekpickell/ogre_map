// ----------------------
// Cesium Viewer
// ----------------------
const viewer = new Cesium.Viewer("cesiumContainer", {
  timeline: false,
  animation: false,
  baseLayerPicker: true,
  geocoder: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  infoBox: true,
  selectionIndicator: false,    // I'm having issues with this
  homeButton: false,
  baseLayerPicker: false,
  fullscreenButton: false,       
  // creditContainer: "attribution-container"          
});

viewer.infoBox.frame.removeAttribute('sandbox');

// Remove default imagery
viewer.imageryLayers.removeAll();
viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
    credit: 'https://carto.com/basemaps under non commerical use'
  })
);

// Globe colors
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#f1f1f1ff");
// viewer.scene.globe.waterColor = Cesium.Color.fromCssColorString("#6bb9e6ff");
viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#ffffffff");
viewer.scene.globe.showGroundAtmosphere = false;
viewer.scene.skyBox.show = false;
viewer.scene.sun.show = false;
viewer.scene.moon.show = false;
viewer.scene.globe.enableLighting = false;
viewer.scene.skyAtmosphere.show = false;

// event listener
viewer.infoBox.frame.addEventListener('load', function() {
    const doc = viewer.infoBox.frame.contentDocument;
    const style = document.createElement('style');

    style.innerHTML = `
        /* Apply Avenir + black to all text in the infoBox */
        body, body * {
            font-family: "Avenir", "Helvetica", sans-serif !important;
            color: #333 !important;
        }

        /* Ensure bold labels stay bold + black */
        strong, b {
            font-family: "Avenir", "Helvetica", sans-serif !important;
            color: #333 !important;
            font-weight: bold !important;
        }

        /* Remove any inline styles Cesium might inject */
        span {
            color: black !important;
        }
    `;

    doc.head.appendChild(style);
});

// ----------------------
// Load TopoJSON Land (fills land vs ocean)
// // ----------------------
// fetch("https://unpkg.com/world-atlas@2.0.2/land-50m.json")
//   .then(res => res.json())
//   .then(topology => {
//     const geojsonLand = topojson.feature(topology, topology.objects.land);
//     return Cesium.GeoJsonDataSource.load(geojsonLand, {
//       stroke: Cesium.Color.fromCssColorString("#626262ff"),
//       strokeWidth: 1,
//       fill: Cesium.Color.fromCssColorString("#e5e5e5ff"),
//       clampToGround: true 
//     });
//   })
//   .then(dataSource => viewer.dataSources.add(dataSource))
//   .catch(err => console.error("TopoJSON load error:", err));


// ----------------------
// Category Colors
// ----------------------
const categoryColors = {
  "Ice Flow": Cesium.Color.fromCssColorString("#125ae1"),
  "Altimetry": Cesium.Color.fromCssColorString("#9852d9"),
  "Reflectometry": Cesium.Color.fromCssColorString("#f44e8a"),
  "Education": Cesium.Color.fromCssColorString("#f96502")
};

// Fallback color
const DEFAULT_COLOR = Cesium.Color.WHITE;

// ----------------------
// Size scaling
// ----------------------
const MIN_SIZE = 6;
const MAX_SIZE = 20;

// ----------------------
// Load CSV (TAB-delimited)
// ----------------------
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQCrUJH-IyyRMocINP2zOII0z2EQPa8qhEBidLSr2mjoW-EY5iSqunaSD_ZklMjoas0z7aUPim3JOfb/pub?output=csv";

fetch(SHEET_URL)
  .then(res => res.text())
  .then(csv => {
    const parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true
    });

    const points = parsed.data;
    addPoints(points);
    buildLegend(points);
  })
  .catch(err => console.error("Google Sheet load error:", err));


// Papa.parse("data/points.csv", {
//   download: true,
//   header: true,
//   delimiter: ",",
//   skipEmptyLines: true,
//   complete: function (results) {
//     const points = results.data;
//     addPoints(points);
//     buildLegend(points);
//   }
// });

// ----------------------
// Add Points
// ----------------------
function addPoints(points) {
  const sizes = points.map(p => Number(p["Size (Quantity)"])).filter(n => !isNaN(n));
  const minVal = Math.min(...sizes);
  const maxVal = Math.max(...sizes);

  points.forEach((p, idx) => {
    const lat = Number(p["Latitude"]);
    const lon = Number(p["Longitude"]);
    const sizeVal = Number(p["Size (Quantity)"]);

    if (isNaN(lat) || isNaN(lon)) return;

    // Normalize size
    const pixelSize = isNaN(sizeVal)
      ? MIN_SIZE
      : MIN_SIZE + (sizeVal - minVal) / (maxVal - minVal) * (MAX_SIZE - MIN_SIZE);

    // Handle multi-category entries
    const categories = p["Color (Category)"]
      ?.split(",")
      .map(s => s.trim());

    const color =
      categoryColors[categories?.[0]] || DEFAULT_COLOR;


    viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    ellipse: {
        semiMinorAxis: pixelSize * 10000.0, // in meters
        semiMajorAxis: pixelSize * 10000.0, // in meters
        material: color,
        outline: true,
        outlineColor: Cesium.Color.BLACK,
        extrudedHeight: 0,
        granularity: 0.002,
        height: idx*5,
    },
    name: p["Location"],
    description: buildDescription(p)
    });
  });

}

// ----------------------
// Popup content
// ----------------------
function buildDescription(p) {
    const url = p["Project or Data URL"];
  return `
    <b>Category:</b> ${p["Color (Category)"]}<br/>
    <b>Size:</b> ${p["Size (Quantity)"]}<br/>
    <b>Start Year:</b> ${p["Start Year"] || "—"}<br/>
    <b>End Year:</b> ${p["End Year"] || "—"}<br/><br/>
    ${p["Project"] || ""}
    ${url ? `<b>Link:</b> <a href="${url}" target="_blank" rel="noopener">${url}</a><br/><br/>` : ""}
  `;
}

function buildLegend(points) {
  const legend = document.getElementById("legend");
  legend.innerHTML = "";

  // Title
  const title = document.createElement("div");
  title.id = "legend-title";
  title.textContent = "Primary GNSS Application:";
  legend.appendChild(title);

  // Categories
  const categories = [
    ...new Set(
      points.flatMap(p =>
        p["Color (Category)"]
          ?.split(",")
          .map(s => s.trim())
      )
    )
  ].filter(Boolean);

  categories.forEach(cat => {
    const item = document.createElement("div");
    item.className = "legend-item";

    const colorBox = document.createElement("div");
    colorBox.className = "legend-color";
    colorBox.style.background =
      categoryColors[cat]?.toCssColorString() || "#ccc";

    const label = document.createElement("span");
    label.textContent = cat;

    item.appendChild(colorBox);
    item.appendChild(label);
    legend.appendChild(item);
  });
}
