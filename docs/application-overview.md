# What SatX does

SatX is a **desktop satellite tracker**. It shows where thousands of Earth-orbiting objects are **right now** on a 3D globe, and helps you explore the ones nearest to you. Optional **Starlink** integration links your dish’s pointing direction to the Starlink satellite that is likely serving your connection.

This document describes **functionality**. For step-by-step use without technical jargon, see the **[User guide](user-guide.md)**.

## Main window

The window has two parts:

| Area | Purpose |
|------|---------|
| **Globe** (large view) | Earth with satellite markers; drag to rotate, scroll to zoom |
| **Sidebar** (right) | Filters, search, list of satellites, details, and controls |

A small overlay on the globe shows **Live/Paused**, how many objects are on screen, and your location when available.

## Data sources

1. **Satellite catalog (TLEs)** — Two-line orbital elements for active objects, loaded from public sources (e.g. CelesTrak-style feeds). The app downloads this when it starts (first load can take a little while).
2. **Your location** — From the operating system when you allow location access. Shown as a **red dot** on the globe. Used to sort the “nearest” list and for Starlink matching.
3. **Starlink dish** (optional) — Only in the **installed desktop app**, and only when your PC can reach the dish at `192.168.100.1`. Provides azimuth and elevation of where the dish is pointing.

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

## Selecting a satellite

- **Click** a marker on the globe, or **click** a row in the list.
- A **details** panel appears with name, NORAD id, orbit type, height, distance (if location is on), and related catalog info when available.
- The selected marker is highlighted **yellow** on the globe.
- For most non-Starlink selections, the view **centres on that satellite**.
- Click empty space on the globe or **close** on the details panel to clear selection.

## Starlink mode (desktop app only)

Available when **Object type** is set to **Starlink** and you run the **installed** SatX app (not browser-only development mode).

1. **Fetch** reads the dish’s current **azimuth** and **elevation** (boresight).
2. SatX compares that direction to Starlink satellites in the catalog and picks the best match — the **servicing** satellite.
3. That satellite is **pinned at the top** of the list with a **red outline**.
4. An **orange line** on the globe runs from your location to that satellite.

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
- **Mobile apps** — not supported as a product yet.
- **Accuracy** — TLE-based positions are good for visualization, not for collision avoidance or professional operations.

## Who this is for

- Hobbyists and learners watching ISS, Starlink passes, or debris awareness  
- Starlink users curious which satellite their dish is using  
- Anyone who wants a local, private desktop view without relying on a particular website  

## See also

- **[User guide](user-guide.md)** — plain-language walkthrough  
- **[Running SatX](running/README.md)** — install and build for Windows, macOS, Linux  
