# PackWise User Manual

**PackWise helps you decide what to wear on a trip and what to pack, using only clothes you own.**
It checks the weather at your destination, suggests outfits for each day, and builds a packing checklist without duplicates.

Your closet, photos and trips stay on your device. PackWise has no account, no sign-in and no cloud storage.

---

## Contents

1. [Getting PackWise](#1-getting-packwise)
2. [A quick tour](#2-a-quick-tour)
3. [Your closet](#3-your-closet)
4. [Saved outfits](#4-saved-outfits)
5. [Planning a trip](#5-planning-a-trip)
6. [Choosing outfits for each day](#6-choosing-outfits-for-each-day)
7. [The Packing Checklist](#7-the-packing-checklist)
8. [Keeping your data safe](#8-keeping-your-data-safe)
9. [Settings](#9-settings)
10. [Using PackWise offline](#10-using-packwise-offline)
11. [Privacy](#11-privacy)
12. [Troubleshooting and FAQ](#12-troubleshooting-and-faq)

---

## 1. Getting PackWise

You can use PackWise in three ways. They all look and work the same.

| Option | Best for | How to start |
|---|---|---|
| **Website** | Trying it out, any device | Open **https://gluekat.github.io/Travel_App/** |
| **Installed app (from the website)** | Phones, tablets and computers; works offline | See §1.1 |
| **Desktop app** | Computers; saves your data to a file automatically | See §1.2 |

> There is also a **preview version** at https://gluekat.github.io/Travel_App/dev/, marked with an amber **DEV** badge. It has the newest features but may change or break. It keeps its own separate data. For normal use, choose the version without the badge.

### 1.1 Install from the website

- **iPhone / iPad (Safari):** open the website → tap **Share** → **Add to Home Screen**.
- **Android (Chrome):** open the website → tap **⋮** → **Install app** (or **Add to Home screen**).
- **Computer (Chrome or Edge):** open the website → click the install icon in the address bar (or **⋮ → Install PackWise**).

PackWise then opens like a regular app, even with no internet connection.

### 1.2 Desktop app (Windows, Mac, Linux)

Ask the project owner for the installer, or download it from GitHub (*Actions → Desktop app → latest run → Artifacts*).

- **Windows:** run the `.msi` or `.exe`. If you see "Windows protected your PC", click **More info → Run anyway**.
- **Mac:** open the `.dmg` and drag PackWise to Applications. The first time, **right-click PackWise → Open → Open**.
- **Linux:** install the `.deb` or `.rpm`, or run the `.AppImage`.

The desktop app saves everything automatically to **Documents/PackWise/packwise-data.json** (§8.3).

---

## 2. A quick tour

The bar at the top has three sections:

| Section | What it's for |
|---|---|
| **Closet** | Your clothes and your saved outfits |
| **Trips** | Your trips, their daily outfits and packing checklists |
| **Data & privacy** | Where your data is saved, backups, temperature unit, privacy |

**First time?** PackWise starts with a **sample wardrobe** of 18 items, so you can try everything straight away. Remove the samples whenever you like with **Clear samples** in the Closet.

**The basic flow:**
1. Add your clothes to the **Closet**.
2. Create a **Trip** and pick activities for each day.
3. Choose an **outfit** for each day, by hand or with **Suggest outfit**.
4. Open the **Packing Checklist** and tick items off as you pack.

---

## 3. Your closet

Open **Closet**. It has two tabs: **Items** (your clothes) and **Outfits** (saved outfits, §4).

### 3.1 Adding an item

Click **Add item** and fill in:

| Field | What to enter | Why it matters |
|---|---|---|
| **Photo** | **Upload photo**, or **Camera** on phones | Helps you recognise items. Photos are shrunk to save space and never leave your device |
| **Favorite score** | 0–5 stars | Higher-rated items are suggested more often |
| **Name** | e.g. "Navy crew tee" | |
| **Category** | top, bottom, dress, outerwear, shoes, accessory, swimwear, activewear | Decides where the item goes in an outfit |
| **Color** | e.g. "navy" | For your reference and search |
| **Warmth** | 1 (very light) to 5 (very warm) | Matched to the temperature |
| **Formality** | casual, smart casual, formal | Matched to activities (e.g. business → formal) |
| **Quantity owned** | How many identical ones you have, e.g. 5 pairs of white socks | Lets PackWise plan more wears and pack more copies |
| **Wears before washing** | e.g. tee 1, jeans 3, shoes or jacket 10 | Together with quantity, decides how many days an item can cover |
| **Weather tags** | rain-ready, sun, cold, hot | Rain-ready items are chosen on rainy days, and so on |
| **Good for** | sightseeing, hiking, beach, dinner out, business, travel day, nightlife, workout, lounging | Matched to each day's activities |
| **Custom tags** | Any word, e.g. *packable*, *wrinkle-free*. Type it and press **Enter** | Your own labels for searching and filtering |

Click **Add item** to save. To change an item, click its ✏️ pencil. To delete it, click its 🗑️ bin. Deleting an item also removes it from any outfits.

> **Tip:** quantity × wears before washing = how many times an item can be worn on one trip. Three tees worn once each cover 3 days. One pair of jeans worn 3 times covers 3 days.

### 3.2 Rating favourites quickly

Tap the ★ stars directly on an item's card. Tap the same star again to clear the rating.

### 3.3 Finding items

- **Search** by name, color or tag.
- Filter by **category** (the row of buttons).
- Filter by a **tag**: weather, activity or one of your own tags. Click a **#tag** on any card to filter by it.
- **★ favorites (4+)** shows your best-loved items.

---

## 4. Saved outfits

Outfits you like can be saved in the closet and reused on any trip.

- **Create one:** *Closet → Outfits → **New outfit***. Tick the items, click **Create outfit**, then give it a name.
- **Save one from a trip:** on any outfit in a trip, click **Save to closet**.
- **Favourite:** tap the ★ next to the outfit name. Use **★ favorites only** to filter.
- **Edit:** rename it by clicking the name, **Add items**, or remove an item with ✕.

When you ask for suggestions on a trip day, PackWise also shows your **saved outfits that suit that day**, with favourites first (§6.3).

---

## 5. Planning a trip

### 5.1 Create a trip

1. Go to **Trips → New trip**.
2. Type the destination and press **Find**. Pick the right place from the list. Only the name you typed is sent to the weather service (§11).
3. Choose the **Start date** and **End date**. A trip can be up to 30 days.
4. Click **Create trip**.

No internet? You can still save the trip and type the weather in yourself (§5.3).

### 5.2 Trip Overview and Packing Checklist tabs

Each trip has two tabs under its name:
- **Trip Overview** (opens first): the days, weather, activities and outfits.
- **Packing Checklist**: what to pack (§7).

Use **Edit** to change the destination or dates. Days are added or removed to match. The 🗑️ button deletes the trip.

### 5.3 Weather

PackWise fetches the weather automatically when you open a trip. Each day shows the high and low temperature, 💧 chance of rain, the conditions and a label saying where the numbers came from:

| Label | Meaning |
|---|---|
| **Live forecast** | Up-to-date forecast. Available for the next 16 days |
| **Cached forecast** | The last forecast PackWise saved. Shown when offline or after a few hours |
| **Historical average** | Typical weather for those dates, from the past 3 years. Used for trips more than 16 days away |
| **Manual entry** | Numbers you typed in |

- Click **Refresh weather** to fetch the latest forecast.
- Click **edit** next to a day's weather to type your own numbers.
- If a day has no weather at all, a small form asks for the high, low and rain %.

### 5.4 Activities

Under each day, tap the activities you have planned, e.g. *sightseeing* and *dinner out*. These decide how dressy or sporty the suggestions are.

---

## 6. Choosing outfits for each day

Each day shows its weather, activities and **the outfit(s) you've chosen**. New days start with an empty **Outfit 1**.

### 6.1 Building an outfit yourself

- **Add items:** pick items from your closet. Each one shows how many clean wears it has left.
- 🔒 **Lock:** keep this item when you ask for suggestions.
- ⇄ **Swap:** choose a replacement. The best matches for that day's weather and activities are listed first.
- ✕ **Remove:** take the item out of the outfit.
- Click the outfit's **name** to rename it, e.g. "Hiking" or "Dinner".

Under each item you'll see, for example, *"2 of 3 wears planned"*. If an item is planned more times than you have clean copies, you'll see a warning.

### 6.2 More than one outfit per day

Click **Add outfit** under the day, e.g. one for daytime and one for dinner. Delete an outfit with its 🗑️ button.

### 6.3 Getting suggestions

Click **Suggest outfit** on any outfit. A panel opens. Nothing changes until you choose something.

- **Outfit for:** the activities this outfit is for. Change them to get different ideas.
- **Option 1 / Option 2:** two suggestions from your closet, each with a short **Why** (e.g. *"Cool day, 80% chance of rain. Packable rain jacket keeps you dry. Includes your favorite: white sneakers."*).
- **⚠️ warnings** point out gaps, e.g. *"No rain-ready outerwear for Day 3"* or *"No clean navy crew tee left"*.
- **From your saved outfits:** your saved outfits that best fit the day.
- **Use this outfit** applies your choice. **Show other options** gives fresh ideas. Locked items are always kept.

**What PackWise considers:** temperature (warmer clothes on cold days), rain (rain-ready gear when the chance is over 50%), how dressy each activity is, your favourite ratings, how many clean wears each item has left, and not repeating yesterday's exact outfit.

### 6.4 Filling the whole trip at once

On the Trip Overview, **Suggest outfits for empty days** picks outfits for every day you haven't planned yet. Days with mixed plans, such as hiking and then dinner, get one outfit for each. Days you've already planned are left alone. Afterwards, review and adjust each day as you like.

If an item ends up planned for more wears than you have clean copies, a warning at the top suggests packing more, swapping some days, or planning laundry.

---

## 7. The Packing Checklist

Open the trip's **Packing Checklist** tab.

**At the top:**
- **Pieces total:** everything to pack, and how many lines you've ticked.
- **"N outfits from M clothing pieces"** and **mix-and-match:** how hard each piece is working. Higher means packing lighter.

**General items (for the whole trip).** Every trip starts with:

| Item | Default |
|---|---|
| Underwear | 1 per day |
| Socks | 1 per day |
| Jacket | 1 |
| Toiletries | 1 |

- Use **− / +** to change a quantity. **per day** items multiply by the number of days.
- Click **per day** / **fixed** to switch how an item is counted.
- Add your own items (chargers, passport, medications…) by typing them in, or with the **+** suggestions. Remove an item with ✕.

**Clothes** are grouped by category, with **×2**, **×3** etc. when you need several copies of the same item, worked out from your outfits and *wears before washing*. Each line also shows how many times the item will be worn.

**Tick items off as you pack.** Your ticks are saved, and they stay even if you change outfits later.

**Print:** click **Print** for a clean paper checklist.

---

## 8. Keeping your data safe

**Important:** your data is stored on your device, not in the cloud. Choose one of the protections below, or you could lose your closet if you clear your browser's data.

### 8.1 Linked data file (Chrome or Edge on a computer). Recommended.

1. Go to **Data & privacy → Where your data is saved**.
2. Click **Create data file…** and save it somewhere easy to find, e.g. *Documents/PackWise/packwise-data.json*.
3. Done. Every change is now saved to that file automatically. The panel shows ✅ *Saving automatically to your data file*.

**After clearing browser data, or on another computer:** open PackWise → **Data & privacy → Open existing data file…** → choose the same file. Everything comes back.

**If you see "Reconnect to your data file":** click **Reconnect** and allow access. Browsers ask for this again after a restart.

**If PackWise asks "Use the file" or "Keep this browser's data":** both the file and this browser changed since they were last in sync. Choose the one with the data you want to keep; the other is replaced.

### 8.2 Backups (all browsers, including phones)

- **Data & privacy → Export / save a backup (JSON)** saves everything, photos included, in one file.
  - On a **phone or tablet** the share sheet opens. Choose **Save to Files**.
  - On a **computer** the file downloads.
- **Data & privacy → Import backup…** restores a backup. It **replaces** everything currently in PackWise, so you'll be asked to confirm.

If you use a browser without the data-file option, PackWise reminds you when you have changes that haven't been backed up for a week. Choose **Save a backup**, or **Later** to be reminded in 3 days.

### 8.3 Desktop app

The desktop app needs no setup. It always saves to **Documents/PackWise/packwise-data.json**. If you reinstall the app, your data is loaded from that file.

**Moving from the website to the desktop app:** on the website, **Export / save a backup**. In the desktop app, **Data & privacy → Import backup…**.

---

## 9. Settings

On **Data & privacy**:

| Setting | Options |
|---|---|
| **Temperature unit** | °F or °C |
| **Persistent storage** | Shows whether your browser has agreed not to clear PackWise's data on its own when space runs low |
| **Where your data is saved** | Data file options (§8.1) |
| **Backup & restore** | Export and import (§8.2) |

---

## 10. Using PackWise offline

After your first visit, or once installed, PackWise opens without internet. Your closet, trips, outfits and checklist all work.

While offline:
- A yellow banner shows that you're offline.
- Weather shows as **Cached forecast** from the last time you were online.
- **Refresh weather** and destination search are paused until you're back online.

---

## 11. Privacy

- **Stays on your device:** your closet, photos, saved outfits, trips, activities, outfits and checklists. They are never uploaded anywhere.
- **Sent to Open-Meteo**, the free weather service, and nothing more:
  - the **destination name** you type, when you press **Find**;
  - the destination's **coordinates and your trip dates**, to get the weather.
- No accounts, no tracking, no ads, no analytics.
- When using the website, GitHub (which hosts the site) sees that someone loaded the page, as for any website, but never your data.

---

## 12. Troubleshooting and FAQ

**The website shows a blank page.**
Reload with **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac). On a phone, close the tab and open the link again.

**I don't see my data.**
- Are you on the right version? The **DEV** preview keeps separate data from the regular version.
- Did you clear browser data? Use **Open existing data file…** (§8.1) or **Import backup…** (§8.2).
- Data in one browser or device is not shared with another automatically. Move it with a data file or backup.

**There's no weather for a day.**
Check you're online and the trip has a location (**Edit** → find the destination), then click **Refresh weather**. You can always type the weather in with **edit**.

**Suggestions keep picking the same item.**
That's on purpose, to keep your bag light, until the item runs out of clean wears. To change it: lower its ★ rating, lock other items, swap it, or set **Wears before washing** to match how you really wear it.

**A suggestion says "No clean … left".**
You've planned that item more times than quantity × wears before washing. Raise the quantity, swap it on some days, or plan to do laundry.

**Why don't I see "Create data file" on my phone, or in Safari or Firefox?**
Those browsers don't allow websites to save to a file on your device. Use **Export / save a backup** regularly, or the desktop app on a computer.

**The desktop app shows a security warning when I open it.**
The app isn't signed by Microsoft or Apple yet. See §1.2 for how to open it safely.

**How do I start over?**
Delete trips with their 🗑️ button, and closet items individually or with **Clear samples**. To wipe everything, clear this site's data in your browser settings. PackWise then starts fresh with the sample wardrobe. If a data file is linked, click **Stop using file** first, or reopening the file would bring your data back.
