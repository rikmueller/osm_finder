# AlongGPX

**Find OpenStreetMap POIs along your GPX tracks. Plan smarter: campsites, water sources, shelters, restaurants—everything you need along your route.**

**🌐 Try it online: [along-gpx.de](https://along-gpx.de)**

---

## 1. How to Use 💡

### 1.1 Upload Your GPX Track

- Drag and drop your `.gpx` file onto the map
- Your track appears instantly (blue line with start/end markers)
- Map automatically centers on your route

### 1.2 Choose What to Find

**Quick presets:**
- 🏕️ Campsites
- 💧 Drinking water
- 🏠 Accommodation (hotels, hostels, B&Bs)
- 🍴 Food & restaurants
- 🏪 Shops & supermarkets
- 🚽 Public toilets
- ⛺ Shelters

**Custom filters:**
Build your own using OpenStreetMap tags (e.g., `amenity=restaurant`, `shop=bicycle`)

### 1.3 Generate Results

- Set your search radius (1-50 km from track)
- Click **Process**

### 1.4 Explore Results

- **Interactive map** - Click markers for details (name, distance, website, hours)
- **Excel export** - Sorted by distance from start, with all metadata
- **Multiple tile layers** - OpenStreetMap, OpenTopoMap, CyclOSM
- **Mobile-friendly** - Works on phones and tablets

---

## 2. Project Design & Architecture

### 2.1 Project Structure 🏗️ 

```
AlongGPX/
├── backend/              # Python backend
│   ├── api/             # Flask REST API
│   └── core/            # Processing pipeline (GPX, Overpass, filtering)
├── cli/                 # Command-line interface
├── frontend/            # React + TypeScript web UI
│   └── src/
│       ├── components/  # UI components (Map, Settings, Modals)
│       └── hooks/       # WebSocket integration
├── config/              # Configuration by usage mode
│   ├── cli/            # CLI standalone
│   ├── local-dev/      # Local development
│   ├── docker-dev/     # Docker with hot reload
│   └── docker-prod/    # Production Docker
├── deployment/          # Docker build files
└── data/
    ├── presets.yaml    # Filter presets
    ├── input/          # GPX files
    └── output/         # Generated results
```

### 2.2 Key Technologies

**Backend:**
- Python 3.x with Flask for REST API
- pandas + openpyxl for Excel export
- Folium for map generation
- pyproj for geodesic calculations
- Overpass API for OSM queries

**Frontend:**
- React 18 + TypeScript
- Vite for fast development
- Leaflet + React-Leaflet for interactive maps
- Socket.IO for real-time updates
- Axios for API communication

**Infrastructure:**
- Docker Compose for containerization
- Nginx for production reverse proxy


### 2.3 Key Features ✨ 

- **🗺️ Map-first interface** - See your track and POIs continuously
- **⚡ Real-time updates** - POIs appear as they're found
- **📱 Mobile responsive** - Collapsible settings, touch-friendly
- **🎨 Smart coloring** - Different colors for different POI types
- **🎯 Accurate distances** - WGS84 geodesic calculations
- **📦 Self-contained** - Runs offline after setup (uses public Overpass API)


### 2.4 Frontend Architecture
see **[FRONTEND.md](FRONTEND.md)** 


### 2.5 Configuration ⚙️

AlongGPX is configured via environment variables. See respective configuration directories for available options.

**Filter presets** are defined in [data/presets.yaml](data/presets.yaml). Add your own!

---

## 3.  Getting Started on your machine 🚀

You don't want to use along-gpx.de, but rather your own setup?
AlongGPX offers **four ways to run** the application on your machine, depending on your needs.

To start, clone the repository:
```bash
git clone https://github.com/rikmueller/along-gpx.git
```
And decide on a flavor:

### 3.1 Command-Line Interface ⌨️

For batch processing and automation: [config/cli/README.md](config/cli/README.md)

### 3.2 Local Development 💻

Run backend and frontend locally for development: [config/local-dev/README.md](config/local-dev/README.md)

### 3.3 Docker Development (Dev-Setup with hot reload) 🐳 

Development environment with hot reload: [config/docker-dev/README.md](config/docker-dev/README.md)

### 3.4 Docker Production 🌐

Production environment: [config/docker-prod/README.md](config/docker-prod/README.md)

---

## 4. Everything else

### 4.1 Contributing 🤝 

Contributions welcome! Please open an issue first to discuss major changes.

---

### 4.2 License 📜

MIT License - see [LICENSE](LICENSE) for details

---

### 4.3 Credits 🙏

Built with amazing open-source projects:

- **[OpenStreetMap](https://www.openstreetmap.org/)** - Community-driven map data
- **[Overpass API](https://overpass-api.de/)** - OSM query infrastructure
- **[React](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)** - Modern web framework
- **[Leaflet](https://leafletjs.com/)** - Interactive maps
- **[Flask](https://flask.palletsprojects.com/)** - Python web framework
- **[pandas](https://pandas.pydata.org/)** + **[openpyxl](https://openpyxl.readthedocs.io/)** - Data processing
- **[Folium](https://python-visualization.github.io/folium/)** - Python → Leaflet maps

Inspired by **[GPX Studio](https://gpx.studio/)** ❤️

---

### 4.5 Development Status ⚠️

This project is under active development. Features and APIs may change. Documentation may lag behind implementation. Use at your own risk for production workloads.



