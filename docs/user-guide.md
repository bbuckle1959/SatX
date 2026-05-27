# SatX user guide

This guide is for **everyday use** of SatX — no programming knowledge required. It explains what you see on screen and how to get useful results.

**Installing the app?** Download the installer for your computer (Windows, Mac, or Linux) from the [SatX Releases](https://github.com/bbuckle1959/SatX/releases) page, or use a copy shared by whoever gave you SatX. If you received only the source code, ask a technical contact to build an installer using [Release builds](running/release-builds.md).

Project home: [https://github.com/bbuckle1959/SatX](https://github.com/bbuckle1959/SatX)

---

## What is SatX?

SatX shows **satellites and space debris** orbiting Earth on a **3D globe**, similar to a planetarium view. Positions update automatically so you can see what is overhead or nearby.

If you use **Starlink**, SatX can also show which Starlink satellite your dish is likely pointing at — when you are on the Starlink network and using the proper desktop app.

---

## First launch

1. Open **SatX** from your Start menu, Applications folder, or desktop shortcut.
2. The first time, the app may say it is **loading the satellite catalog**. This is normal and can take **up to a minute** on a slow connection.
3. If Windows, macOS, or Linux asks to use your **location**, choose **Allow** if you want:
   - A **red dot** on the globe where you are  
   - A list of satellites sorted by **distance from you**  
   - Starlink “servicing” satellite matching  

You can use SatX without location, but the nearest list and Starlink features work much better with it.

---

## The screen at a glance

```
┌─────────────────────────────────────┬──────────────────┐
│                                     │  SatX Tracker    │
│         3D GLOBE (Earth)            │  metrics         │
│    · satellites (small markers)     │  search          │
│    · red dot = you (if allowed)     │  filters         │
│    · orange line = Starlink link    │  satellite list  │
│                                     │  details panel   │
└─────────────────────────────────────┴──────────────────┘
```

**On the globe**

- **Drag** with the mouse to rotate Earth.  
- **Scroll** (or pinch on a trackpad) to zoom in and out.  
- **Click** a satellite marker to see details.

**In the sidebar**

- Numbers at the top (Calc FPS, Active, etc.) are optional — they show that tracking is running.  
- **Search**, **filters**, and the **list** are what most people use daily.

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
   - **Starlink** — only Starlink satellites (needed for dish features).  
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

## Search for a satellite

1. In **Search satellites**, type part of a **name** (e.g. `ISS`, `STARLINK`) or a **number** (NORAD ID).  
2. The list below shrinks to matches.  
3. Click a row to select it on the globe.

---

## Nearest satellites list

When location is allowed, the list shows up to **50** satellites **closest to you**, with distance and height when available.

- Click any line to open **details** and highlight it on the globe.  
- Scroll the list to browse what is passing near you.

Without location, the list is still usable but not sorted by distance — allow location for the best experience.

---

## Satellite details

After you select a satellite, a **details** box appears above the search field with:

- Name and catalog id  
- Type of object  
- Height and distance from you (if location is on)  
- Extra catalog notes when available  

Click **close** or click empty space on the globe to deselect.

**Tip:** Selecting most satellites (except Starlink) will **turn the globe** to face that object. Starlink selections do not move the camera automatically.

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

### If Fetch fails

- Confirm you are on **Starlink’s Wi‑Fi**, not only “using Starlink internet” through another router.  
- Turn off **VPN** temporarily.  
- Wait a minute after powering the dish on and try again.  
- Make sure you opened the **SatX app**, not a developer test page in a browser.

Still stuck? See [Troubleshooting](#troubleshooting) below.

---

## Understanding the small labels on the globe

| Label | Meaning |
|-------|---------|
| **Live** | Tracking is running |
| **Paused** | You pressed Pause |
| **Your location …°** | Location is on; numbers are latitude/longitude |
| **Click object for details** | Reminder to click markers (desktop) |

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
- Press **Pause** if you only need a still snapshot.

### Starlink Fetch does not work

- Use the **installed** SatX app on **Starlink Wi‑Fi**.  
- Enable **location**.  
- Set filter to **Starlink**.  
- Dish must be powered and online (check the Starlink app on your phone).

### Selected satellite disappeared from the list

- It may have moved out of the “nearest 50” or out of the optimized set. Search by name or widen **Globe set** / filter.

---

## Privacy notes

- **Location** stays on your device for display and sorting; it is used to compute distances and Starlink matching.  
- **TLE / catalog data** is downloaded from public space-tracking sources over the internet.  
- **Starlink dish** data is read only on your local network from the dish; it is not sent to a SatX cloud (there is no SatX cloud service in this app).

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
| Freeze the view | Pause |
| Less load on PC | Globe set → Optimized |
| More satellites tracked | Globe set → Full catalog |

Enjoy the view.
