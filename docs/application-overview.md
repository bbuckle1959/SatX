# What SatX does

SatX is a **desktop satellite tracker**. It shows where thousands of Earth-orbiting objects are **right now** on a 3D globe, and helps you explore the ones nearest to you. Optional **Starlink** integration links your dish’s pointing direction to the Starlink satellite that is likely serving your connection, and can overlay **gateway** and **PoP** ground sites on the map.

This document describes **functionality**. For step-by-step use without technical jargon, see the **[User guide](user-guide.md)**.

## Main window

The window has two parts:

| Area | Purpose |
|------|---------|
| **Sidebar** (left) | Metrics, filters, search, satellite list, Pause/Play, and Starlink controls |
| **Globe** (main view) | Earth with satellite markers; drag to rotate, scroll to zoom |

**Details** for the selected satellite or ground site appear in a **panel over the globe** (upper-left), not in the sidebar. A small **overlay** (top of the globe) shows Live/Paused, object counts, your location when available, and (in Starlink mode) gateway/PoP summary pills.

## Data sources

1. **Satellite catalog (TLEs)** — Two-line orbital elements for active objects, loaded from public sources (e.g. CelesTrak-style feeds). The app downloads this when it starts (first load can take a little while). Optional **SATCAT** metadata (launch date, site, etc.) may load in the background after the catalog is ready.
2. **Your location** — From the operating system when you allow location access. Shown as a **red dot** on the globe. Used to sort the “nearest” list and for Starlink matching.
3. **Starlink dish** (optional) — Only in the **installed desktop app**, and only when your PC can reach the dish at `192.168.100.1`. Provides azimuth and elevation of where the dish is pointing.
4. **Ground stations** (optional) — Starlink **gateway** earth stations and **PoP** (internet exchange) locations from the public [juliensimon/starlink-ground-stations](https://huggingface.co/datasets/juliensimon/starlink-ground-stations) dataset. Bundled in `src/data/ground-stations.json` for offline use; the app may refresh from Hugging Face when online.

Positions are **computed continuously** from the TLEs (standard orbit math), not streamed from each satellite.

## Live tracking

- Satellites **move** on the globe in real time.
- **Pause / Play** in the sidebar stops or resumes orbit updates (the globe stops advancing with new computed positions).
- **Calc FPS** — how often positions are recalculated in the background.
- **Render FPS** — how smoothly the globe is drawing.

You do not need to refresh the page; the catalog is loaded once per session (with optional background enrichment for extra satellite metadata).

## Finding satellites

### Object type filter

Narrows which kinds of objects are tracked, for example:

- All objects  
- Space stations  
- Starlink  
- Navigation (GPS, Galileo, …)  
- Weather & Earth observation  
- Communications  
- Scientific  
- Amateur  
- Debris & rocket bodies  
- Military  
- Other  

The globe and lists only show objects that match the selected type (or everything for “All objects”).

### Search

Search by **name** or **NORAD ID** (the numeric catalog id). Search filters the sidebar list; it does not add new objects to the catalog.

### Nearest list

The sidebar shows up to **50** satellites sorted by **distance from you** (slant range), when location is enabled. Without location, you see the first slice of the current filtered set.

Click any row to select that satellite.

### Globe set

Controls how many objects are **calculated and tracked** at once:

| Mode | Behavior |
|------|----------|
| **Optimized (globe cap)** | Default. Up to **16,000** objects for best performance. When location is on, prefers satellites above your horizon. |
| **Full catalog** | Every object matching the current type filter is propagated. Heavier on large catalogs; the globe still draws at most 16,000 markers at a time. |

Use **Full catalog** when you need completeness; use **Optimized** for everyday browsing.

## Ground infrastructure (Starlink filter only)

When **Object type** is **Starlink**, the sidebar shows **Ground infrastructure** toggles:

| Toggle | Default | Globe markers |
|--------|---------|----------------|
| **Gateways** | On | Amber octahedrons at gateway sites (brighter = operational, dimmer = planned) |
| **PoPs** | Off | Cyan octahedrons at internet exchange points |

Counts in the checkbox labels reflect the bundled dataset. While gateways or PoPs are visible, overlay pills on the globe summarize counts (**purple** for gateways, **cyan** for PoPs). These pills appear only in Starlink mode.

**Selecting a site:** click a gateway or PoP marker on the globe (or click the globe near a marker). A details panel opens over the globe with name, type, status, coordinates, and distance from you when location is on. The selected site is highlighted **yellow** on the globe. Satellite and ground selections are mutually exclusive.

**Picking near satellites:** Starlink satellites often pass close to ground markers on screen. The app uses larger pick targets and screen-space priority so gateways and PoPs remain selectable; click slightly away from a marker if you intend to select a satellite instead.

Maintainers can update the bundled file with `npm run sync:ground-stations` (fetches the latest Hugging Face snapshot).

## Selecting a satellite

- **Click** a marker on the globe, or **click** a row in the list.
- A **details** panel appears **over the globe** (upper-left) with name, NORAD id, orbit type, height, distance (if location is on), launch date/site when SATCAT is available, and related catalog info.
- The selected marker is highlighted **yellow** on the globe.
- For most non-Starlink selections, the view **centres on that satellite**.
- Click empty space on the globe (away from ground sites) or **close** on the details panel to clear selection.

## Starlink mode (desktop app only)

Available when **Object type** is set to **Starlink** and you run the **installed** SatX app (not browser-only development mode).

1. **Fetch** reads the dish’s current **azimuth** and **elevation** (boresight).
2. SatX compares that direction to Starlink satellites in the catalog and picks the best match — the **servicing** satellite — among those at least **25° above your horizon** at the dish (low-elevation matches are ignored as likely blocked).
3. That satellite is **pinned at the top** of the list with a **red outline**.
4. An **orange line** on the globe runs from your location to that satellite.

If no satellite meets the elevation rule, the Starlink panel explains that no in-beam satellite qualifies.

Requirements:

- PC on Starlink Wi‑Fi (or a network that can reach the dish at `192.168.100.1`).
- Location allowed (same red marker as general tracking).

The Starlink strip shows alignment status (e.g. “Aligned” vs “Adjusting”) and lets you select the servicing satellite like any other object.

## Metrics (sidebar)

| Metric | Meaning |
|--------|---------|
| **Calc FPS** | Orbit calculation rate |
| **Active** | Number of objects currently propagated |
| **Render FPS** | Globe drawing rate |
| **On Globe** | Markers drawn this frame (capped at 16,000) |

Catalog line shows how many TLEs were parsed and which source was used.

## Limitations to know

- **Not every satellite in space** — only objects in the loaded active catalog with valid TLEs.
- **Globe marker cap** — at most **16,000** visible markers even in “Full catalog” mode.
- **Starlink** — dish API only on desktop; not in browser-only mode.
- **Ground stations** — only shown when the Starlink object filter is active; dataset is a community snapshot, not live SpaceX operations data.
- **Mobile apps** — not supported as a product yet (`MOBILE_UI_ENABLED` is off on desktop builds).
- **Accuracy** — TLE-based positions are good for visualization, not for collision avoidance or professional operations.

## Who this is for

- Hobbyists and learners watching ISS, Starlink passes, or debris awareness  
- Starlink users curious which satellite their dish is using  
- Anyone mapping gateways/PoPs alongside the live constellation  
- Anyone who wants a local, private desktop view without relying on a particular website  

## See also

- **[User guide](user-guide.md)** — plain-language walkthrough  
- **[Running SatX](running/README.md)** — install and build for Windows, macOS, Linux  
