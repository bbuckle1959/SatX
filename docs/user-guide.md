# SatX user guide

This guide is for **everyday use** of SatX — no programming knowledge required. It explains what you see on screen and how to get useful results.

**Installing the app?** Download the archive for your computer from [SatX Releases](https://github.com/bbuckle1959/SatX/releases) — **Windows** `.zip`, **macOS** `.zip`, or **Linux** `.tar.gz`. Extract it; inside you will find the installer, plus `README.md` and `LICENSE`. If you received only the source code, ask a technical contact to build an installer using [Release builds](running/release-builds.md).

Project home: [https://github.com/bbuckle1959/SatX](https://github.com/bbuckle1959/SatX)

---

## What is SatX?

SatX shows **satellites and space debris** orbiting Earth on a **3D globe**, similar to a planetarium view. Positions update automatically so you can see what is overhead or nearby.

If you use **Starlink**, SatX can also show which Starlink satellite your dish is likely pointing at — when you are on the Starlink network and using the proper desktop app — and optionally map **gateway** earth stations and **PoP** (internet exchange) sites on the globe.

---

## First launch

1. Open **SatX** from your Start menu, Applications folder, or desktop shortcut.
2. The first time, the app may say it is **loading the satellite catalog**. This is normal and can take **up to a minute** on a slow connection.
3. If Windows, macOS, or Linux asks to use your **location**, choose **Allow** if you want:
   - A **red dot** on the globe where you are  
   - A list of satellites sorted by **distance from you**  
   - Starlink “servicing” satellite matching  
   - Distances to ground sites when you select them  

You can use SatX without location, but the nearest list and Starlink features work much better with it.

---

## The screen at a glance

```
┌──────────────────┬──────────────────────────────────────┐
│  SIDEBAR (left)  │  3D GLOBE                            │
│  metrics         │  · details panel (upper-left, when   │
│  search          │    something is selected)            │
│  filters         │  · satellites (small markers)        │
│  satellite list  │  · red dot = you (if allowed)        │
│  Pause / Play    │  · amber/cyan = gateways / PoPs      │
│                  │    (Starlink mode only)              │
│                  │  · orange line = Starlink link       │
│                  │  · overlay pills (top): Live, counts │
└──────────────────┴──────────────────────────────────────┘
```

**On the globe**

- **Drag** with the mouse to rotate Earth.  
- **Scroll** (or pinch on a trackpad) to zoom in and out.  
- **Click** a satellite marker to see its details in the **panel on the globe**.  
- **Click** a gateway (amber) or PoP (cyan) marker when those layers are on.  
- **Click** empty space on the globe to clear selection (if you are not clicking near a ground site).

**In the sidebar**

- Numbers at the top (Calc FPS, Active, etc.) are optional — they show that tracking is running.  
- **Search**, **filters**, and the **list** are what most people use daily.  
- **Details** for your selection appear on the **globe**, not in the sidebar.

---

## Pause and play

At the bottom of the sidebar:

- **Pause** — freezes satellite motion (positions stop updating).  
- **Play** — resumes live tracking.

Use this if you want to study one satellite without everything moving.

---

## Choose what kinds of objects to show

1. Find **Object type** in the sidebar.  
2. Open the dropdown. Examples:
   - **All objects** — everything in the catalog (busy, but complete).  
   - **Starlink** — only Starlink satellites (needed for dish features and ground map).  
   - **Space stations** — ISS and similar.  
   - **Navigation** — GPS and related constellations.  
   - **Debris & rocket bodies** — tracked debris.  

The globe and list update to match your choice.

---

## How many satellites to track (Globe set)

Below **Object type** is **Globe set**:

| Setting | When to use it |
|---------|----------------|
| **Optimized (globe cap)** | **Default.** Best speed. Shows up to about 16,000 objects and prefers ones near you when location is on. |
| **Full catalog** | When you need **every** satellite of the selected type in the database. Slower on older PCs; the globe may still only draw 16,000 dots at once. |

If the app feels slow, switch back to **Optimized**.

---

## Starlink gateways and PoPs (ground map)

These options appear only when **Object type** is **Starlink**.

1. Scroll to **Ground infrastructure** in the sidebar.  
2. **Gateways** (on by default) — amber markers at Starlink earth station sites. Brighter = operational; dimmer = planned.  
3. **PoPs** (off by default) — cyan markers at internet exchange points.  
4. Turn checkboxes on or off to show or hide each layer.  
5. **Click** a marker on the globe to open a details panel (name, type, status, coordinates, distance from you if location is on).  
6. Purple and cyan **count pills** at the top of the globe show how many sites are visible.

**Tip:** Many Starlink satellites are on screen at once. Click **on or very close to** the amber/cyan marker to select a ground site. To select a satellite instead, click a bit away from the ground marker.

---

## Search for a satellite

1. In **Search satellites**, type part of a **name** (e.g. `ISS`, `STARLINK`) or a **number** (NORAD ID).  
2. The list below shrinks to matches.  
3. Click a row to select it on the globe and open details on the globe panel.

---

## Nearest satellites list

When location is allowed, the list shows up to **50** satellites **closest to you**, with distance and height when available.

- Click any line to open **details** on the globe and highlight the satellite.  
- Scroll the list to browse what is passing near you.

Without location, the list is still usable but not sorted by distance — allow location for the best experience.

---

## Satellite and ground-station details

After you select something, a **details** box appears in the **upper-left of the globe** with:

**Satellites**

- Name and catalog id  
- Type of object  
- Height and distance from you (if location is on)  
- Launch date and launch site when catalog metadata has loaded  
- Extra notes when available  

**Ground sites (gateways / PoPs)**

- Name and type (gateway or PoP)  
- Operational / planned status (gateways)  
- Coordinates and distance from you (if location is on)  

Click **close** on the panel or click empty space on the globe (away from ground markers) to deselect.

**Tip:** Selecting most satellites (except Starlink) will **turn the globe** to face that object. Starlink satellite selections do not move the camera automatically.

---

## Starlink: which satellite is my dish using?

This only works when **all** of the following are true:

1. You run the **SatX desktop app** (installed version — not a random web page).  
2. Your computer is connected to **Starlink Wi‑Fi** (or can talk to the dish on your home network).  
3. You allowed **location**.  
4. **Object type** is set to **Starlink**.

### Steps

1. Set **Object type** → **Starlink**.  
2. A **Starlink** section appears. Click **Fetch** (or **Refresh** after the first time).  
3. Wait a few seconds. You should see:
   - **Az** and **El** — dish pointing angles  
   - **Aligned** or **Adjusting** — whether the dish considers itself locked on  
4. If a match is found:
   - **Servicing: …** names the satellite at the **top** of the list (red border).  
   - An **orange line** on the globe from your red dot to that satellite.  
5. Tap **Servicing: …** to select that satellite like any other.

SatX only considers Starlink satellites at least **25° above your horizon** at the dish, so low passes blocked by trees or buildings are not chosen as “servicing.”

### If Fetch fails or no servicing satellite

- Confirm you are on **Starlink’s Wi‑Fi**, not only “using Starlink internet” through another router.  
- Turn off **VPN** temporarily.  
- Wait a minute after powering the dish on and try again.  
- Make sure you opened the **SatX app**, not a developer test page in a browser.  
- If the panel says no satellite is ≥25° above the horizon, wait for a higher pass or check dish alignment.

Still stuck? See [Troubleshooting](#troubleshooting) below.

---

## Understanding the small labels on the globe

| Label | Meaning |
|-------|---------|
| **Live** / **Paused** | Tracking is running or frozen |
| **Your location …°** | Location is on; numbers are latitude/longitude |
| **Gateways … op / … planned** (purple pill) | Starlink filter + gateways on — operational/planned counts |
| **… PoPs** (cyan pill) | Starlink filter + PoPs on |
| **Click satellite or ground site for details** | Reminder when nothing is selected (desktop) |

---

## Troubleshooting

### “Loading satellite catalog…” never finishes

- Check your **internet** connection (the app downloads orbital data).  
- Wait at least **two minutes** on first run.  
- Restart the app.

### No red dot / list not sorted by distance

- Open system **Privacy / Location** settings and allow location for SatX.  
- Restart the app and choose **Allow** when asked.

### Globe is empty or very few dots

- **Object type** may be too narrow — try **All objects**.  
- Catalog may still be loading — wait for “parsed” text in the sidebar.  
- Try **Globe set** → **Full catalog** if you expect more objects.

### App is slow or stutters

- Set **Globe set** → **Optimized (globe cap)**.  
- Choose a narrower **Object type** (e.g. Starlink only).  
- Turn off **PoPs** or **Gateways** if you do not need the ground map.  
- Press **Pause** if you only need a still snapshot.

### Starlink Fetch does not work

- Use the **installed** SatX app on **Starlink Wi‑Fi**.  
- Enable **location**.  
- Set filter to **Starlink**.  
- Dish must be powered and online (check the Starlink app on your phone).

### Cannot select a gateway or PoP

- Set **Object type** to **Starlink** and enable **Gateways** or **PoPs**.  
- Click directly on the **amber** or **cyan** marker (or within a small margin around it).  
- Zoom in if many satellites crowd the same area.

### Selected satellite disappeared from the list

- It may have moved out of the “nearest 50” or out of the optimized set. Search by name or widen **Globe set** / filter.

---

## Privacy notes

- **Location** stays on your device for display and sorting; it is used to compute distances and Starlink matching.  
- **TLE / catalog data** is downloaded from public space-tracking sources over the internet.  
- **Starlink dish** data is read only on your local network from the dish; it is not sent to a SatX cloud (there is no SatX cloud service in this app).  
- **Ground station** locations come from a public community dataset (bundled and optionally refreshed from Hugging Face).

---

## Getting help from technical friends

If someone needs to rebuild or debug the app, point them to:

- [Application overview](application-overview.md) — what features exist  
- [Running SatX](running/README.md) — developers and installers  

---

## Quick reference card

| I want to… | Do this… |
|------------|----------|
| See what is near me | Allow location → read the list |
| Find ISS or a name | Search box → click result |
| Only Starlink | Object type → Starlink |
| Which Starlink serves me | Starlink filter → Fetch (on dish Wi‑Fi) |
| See gateways / PoPs | Starlink filter → Ground infrastructure toggles |
| Details for selection | Look at upper-left panel on the globe |
| Freeze the view | Pause |
| Less load on PC | Globe set → Optimized; turn off PoPs if not needed |

Enjoy the view.
