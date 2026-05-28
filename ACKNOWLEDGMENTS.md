# Acknowledgments

SatX would not exist without the open-source community and the public data providers below. Thank you to every project and maintainer whose work is bundled into or fetched by this application.

Repository: [https://github.com/bbuckle1959/SatX](https://github.com/bbuckle1959/SatX)

## Orbital data and catalogs

| Provider | Role in SatX |
|----------|----------------|
| [**CelesTrak**](https://celestrak.org/) | Primary source for active satellite TLEs and SATCAT metadata (browser/dev paths). Maintained by Dr. T. S. Kelso — thank you for making orbital data widely available. |
| [**TLE API**](https://tle.ivanstanojevic.me/) (Ivan Stanojevic) | Alternate paginated TLE catalog when other sources are unreachable. |
| [**ReTLEctor**](https://retlector.eu/) | Public TLE mirror used as a fallback endpoint. |
| [**satvisor-data**](https://github.com/satvisorcom/satvisor-data) | GitHub-hosted mirror of CelesTrak active TLEs used when direct fetches fail. |

Object-type grouping in the app follows CelesTrak-style naming conventions; classification is inferred locally from satellite names.

## Starlink ground infrastructure

| Provider | Role in SatX |
|----------|----------------|
| [**juliensimon/starlink-ground-stations**](https://huggingface.co/datasets/juliensimon/starlink-ground-stations) (Hugging Face) | Gateway earth stations and internet Points of Presence shown on the globe |
| [**Starlink Insider**](https://starlinkinsider.com/) | Gateway list and operational status (via the dataset pipeline) |
| [**FCC IBFS**](https://www.fcc.gov/international-bureau-filing-system) | US earth-station license coordinates |
| [**PeeringDB**](https://www.peeringdb.com/) | PoP facility locations for SpaceX ASNs |

SatX ships a bundled snapshot in `src/data/ground-stations.json`. Gateways and PoPs are shown on the globe when **Object type** is **Starlink**. Refresh the bundle with `npm run sync:ground-stations` before releases when you want the latest dataset.

## Desktop shell and backend (Rust)

| Project | Role in SatX |
|---------|----------------|
| [**Tauri**](https://tauri.app/) | Native desktop window, packaging, and IPC |
| [**reqwest**](https://github.com/seanmonstar/reqwest) | HTTP client for catalog and dish requests |
| [**Serde**](https://serde.rs/) | JSON and data (de)serialization |

## User interface and 3D globe (JavaScript / TypeScript)

| Project | Role in SatX |
|---------|----------------|
| [**React**](https://react.dev/) | Application UI |
| [**Three.js**](https://threejs.org/) | 3D globe rendering |
| [**React Three Fiber**](https://docs.pmnd.rs/react-three-fiber) & [**Drei**](https://github.com/pmndrs/drei) | React renderer and helpers for Three.js |
| [**satellite.js**](https://github.com/shashwatak/satellite-js) | SGP4 orbit propagation in the Web Worker |
| [**Vite**](https://vite.dev/) | Dev server and production frontend build |
| [**TypeScript**](https://www.typescriptlang.org/) | Typed application code |
| [**Tailwind CSS**](https://tailwindcss.com/) | Styling |
| [**Lucide**](https://lucide.dev/) | Sidebar and control icons |

## Starlink dish integration

Starlink alignment is read from the **local dish** on your network (`192.168.100.1`) using SpaceX’s device gRPC-web interface. SatX does not redistribute dish firmware or proprietary services; it only queries your terminal when you click **Fetch**. Thank you to SpaceX for the consumer dish API that makes local alignment queries possible.

## Earth imagery

The globe uses a bundled day-time Earth texture (`src/assets/earth_day.jpg`). If you redistribute SatX, retain any license or attribution that applies to that asset.

## Licenses

Dependencies are subject to their own licenses (MIT, Apache-2.0, ISC, and others). This repository’s license applies to SatX’s own code; it does not override third-party terms. See each package’s repository for full license text.
