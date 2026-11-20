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
5. [Planning a trip](#5-planning-a-trip) (incl. the Itinerary, §5.5)
6. [Choosing outfits for each day](#6-choosing-outfits-for-each-day)
7. [The Packing Checklist](#7-the-packing-checklist)
8. [Keeping your data safe](#8-keeping-your-data-safe)
9. [Settings](#9-settings)
10. [Using PackWise offline](#10-using-packwise-offline)
11. [Privacy](#11-privacy)
12. [Troubleshooting and FAQ](#12-troubleshooting-and-faq)
13. [The Trash](#13-the-trash)

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

The bar at the top has four sections:

| Section | What it's for |
|---|---|
| **Closet** | Your clothes, shoes, accessories, general packing items and saved outfits |
| **Trips** | Your trips, their daily outfits and packing checklists |
| **Trash** | Deleted trips and items, kept for 30 days (§13) |
| **Data & privacy** | Where your data is saved, backups, temperature unit, home location and airport, privacy |

**First time?** PackWise starts with a **sample wardrobe** of about 18 items, so you can try everything straight away. Remove the samples whenever you like with **Clear samples** in the Closet.

**The basic flow:**
1. Add your clothes to the **Closet**.
2. Create a **Trip** and pick activities for each day.
3. Choose an **outfit** for each day, by hand or with **Suggest outfit**.
4. Open the **Packing Checklist** and tick items off as you pack.

---

## 3. Your closet

Open **Closet**. Its tabs:

| Tab | What it shows |
|---|---|
| **Items** | Everything: clothing, shoes, accessories and general packing items. Has search, filters, sorting and **Group: Category** |
| **Clothing** | Clothing only: everything that isn't a shoe, an accessory or a general item |
| **Shoes** | Shoes only |
| **Accessories** | Hats, scarves, gloves, belts, purses, bags, jewelry… Filter by type or choose **Group: Type** |
| **General** | General packing items such as chargers and toiletries (§3.4) |
| **Outfits** | Saved outfits (§4) |

Each trip also has a **Closet** tab with the same views, so you can look through your clothes without leaving the trip.

### 3.1 Adding an item

Click **Add item** and fill in:

| Field | What to enter | Why it matters |
|---|---|---|
| **Photo** | **Upload photo**, or **Camera** on phones | Helps you recognise items. Photos are shrunk to save space and never leave your device |
| **Favorite score** | 0–5 stars | Higher-rated items are suggested more often |
| **Name** | e.g. "Navy crew tee" | |
| **Category** | top, bottom, dress, one-piece, outerwear, shoes, accessory, swimwear, activewear, underwear, pajamas, or **general** | Decides where the item goes in an outfit and which tab shows it. Choosing **general** switches to the general-item form (§3.4) |
| **Accessory type** (accessories) | hat, scarf, gloves, belt, purse, bag, jewelry, other | Lets you filter and group accessories |
| **Type** (pajamas, activewear, underwear) | top, bottom, one-piece; pajamas and activewear can also be **shoes** or **accessories** | Sleepwear suggestions and the Shoes / Accessories tabs use it |
| **Color** | e.g. "navy" | For your reference and search |
| **Warmth** | 1 (very light) to 5 (very warm), or tick **None / not applicable** (belts, jewelry…) | Matched to the temperature; items with no warmth are ignored for it |
| **Formality** | casual, smart casual, formal | Matched to activities (e.g. business → formal) |
| **Quantity owned** | How many identical ones you have, e.g. 5 pairs of white socks | Lets PackWise plan more wears and pack more copies |
| **Wears before washing** | e.g. tee 1, jeans 3, shoes or jacket 10 | Together with quantity, decides how many days an item can cover |
| **Weather tags** | rain-ready, sun, hot, warm, mild, cool, chilly, cold, snow, windy | Rain-ready items are chosen on rainy days, hot/warm items on hot days, and so on |
| **Good for** | sightseeing, hiking, beach, dinner out, business, work, travel day, nightlife, workout, lounging | Matched to each day's activities |
| **Details** (optional) | Size, material and notes | Shown on the item's card and searchable |
| **Custom tags** | Any word, e.g. *packable*, *wrinkle-free*. Type it and press **Enter** | Your own labels for searching and filtering |

Click **Add item** to save. To change an item, click its ✏️ pencil; closing the edit window with **X** saves your changes. Click the copy button to **duplicate** an item (the copy is named "… (duplicate)"). To delete an item, click its 🗑️ bin: it also leaves any outfits, and goes to the Trash for 30 days (§13).

The same **Add item** form is used on every tab. Pick the category and the item is saved on the matching tab.

> **Tip:** quantity × wears before washing = how many times an item can be worn on one trip. Three tees worn once each cover 3 days. One pair of jeans worn 3 times covers 3 days.

### 3.2 Rating favourites quickly

Tap the ★ stars directly on an item's card. Tap the same star again to clear the rating.

### 3.3 Finding items

- **Search** by name, color, size, material or tag.
- Filter by **category** (the row of buttons).
- Filter by a **tag**: weather, activity or one of your own tags. Click a **#tag** on any card to filter by it.
- **★ favorites (4+)** shows your best-loved items.
- **Sort** by date added, name, category, favorite, warmth, formality, tags; **Group** by category (or by type on the Accessories tab).

### 3.4 General packing items

The **General** tab is your reusable list of things that aren't clothes: chargers, toiletries, documents, medications…

- Each item has a **sub category** (Toiletries, Electronics, Medications, Make-Up, Hair Supplies, Documents & Money, Clothing Basics, Health & Safety, Entertainment, Outdoor & Gear, Other). PackWise suggests one from the name.
- Give it a **photo** or an **emoji** (PackWise suggests emoji that match the name). It shows next to the name here and in the Packing Checklist.
- **Quantity** is either a fixed amount per trip or *per day of the trip*.
- **Default** means "add to every new trip's Packing Checklist". **Trip types** (beach, business…) and your own **custom tags** (camping, outdoors…) help you remember what suits which kind of trip.
- Sort by category or name, and filter by tag.

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

### 5.2 Trip tabs

Each trip has four tabs under its name:
- **Trip Overview** (opens first): the days, weather, activities and outfits.
- **Packing Checklist**: what to pack (§7).
- **Itinerary**: transportation, lodging and scheduled activities (§5.5).
- **Closet**: your closet, for a quick look without leaving the trip.

Use **Edit** to change the destination or dates. Days are added or removed to match, and the first and last day get the **travel day** activity automatically. If lodging or transportation dates should move with the trip, PackWise lists the proposed changes and asks you to confirm each one; anything you decline is marked **Needs updating** on the Itinerary page. The 🗑️ button deletes the trip (it goes to the Trash, §13).

**Trip Notes** is a single box for anything you want to remember (weather, dress codes, reminders). **Laundry:** each day has **Plan laundry**; pick the items to wash, and wear counts restart after that day. Each outfit item shows which wear it is ("wear 2 of 3") and turns orange on the day it passes its allowance. If an item may not suit the forecast, a notice lists it; click × to clear a warning (or **Clear all**).

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

Weather follows where you are. If you add transportation on the Itinerary page, each day's place and weather come from it: days after you arrive show the destination, and a travel day shows **both** places (for example *New York → Rome*), each with its own forecast, its source badge and an **edit** link. Without transportation, the trip destination is used.

### 5.4 Activities

Under each day, tap the activities you have planned, e.g. *sightseeing*, *work* and *dinner out*. These decide how dressy or sporty the suggestions are.

### 5.5 The Itinerary

Open the trip's **Itinerary** tab. At the top is the trip's name, place and dates, then:

**Transportation.** A green summary shows your departure, final arrival and (for round trips) return departure and arrival. Below it, each direction lists **every leg in order** ("Leg 1, Leg 2…") with times, places, carrier and flight number.
- Click **Add transport** and choose **Outbound**, **Return** or **Round trip** (adds the outbound journey and the same route back on the last day). A trip can also be one-way.
- Choose the type: **Flight**, **Drive**, **Train** or **Cruise / Boat**. Fill in the departure (place, date and time, airline and flight number), any **layovers / stops** (each with arrival and departure date and time, airline and flight number) and the **final arrival**.
- For flights the place boxes **search airports** by code, name or city; your **home airport** (Data & privacy) is filled in for you.
- **Layover times** between flights, trains and cruise legs are worked out for you. **Drive** legs get an estimated distance (miles) and drive time. Times are the clock times you enter; time zones are not taken into account.
- When the type of travel changes (for example flight → drive) a divider separates the legs. **Cruises** appear together in their own block.

**Lodging.** Add each stay with its dates. If a stay ends before the trip does, PackWise offers **Extend**. Nights on a cruise need no lodging.

**Scheduled activities.** Each day lists its location and weather, a **Travel day** box summarising that day's departures and arrivals, and the activities you add (time, place search, notes). Cruise days are labelled **Cruise day**.

Click **Print** for a paper copy.

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

**Add outfit** opens a chooser: **New outfit**, **Sleepwear** (pre-filled with a pajama top and bottom, or a one-piece, from your Pajamas; *Suggest outfit* then also offers pajama shoes and accessories) or **Add from saved outfits** (with pictures of each outfit's items).

Click an item's picture or name in an outfit to open its details and edit it.

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

**Warnings and laundry.** The same wear warnings as the Trip Overview appear at the top (one per day), together with the forecast notice and a **Laundry planned** box. Fixing a problem on the Overview clears it here.

**General items (for the whole trip).** New trips start with every **Default**-tagged item from your Closet → General tab. Out of the box:

| Item | Default |
|---|---|
| Underwear | 1 per day |
| Socks | 1 per day |
| Jacket | 1 |
| Toiletries | 1 |

- Use **− / +** to change a quantity. **per day** items multiply by the number of days.
- Click **per day** / **fixed** to switch how an item is counted.
- General items are grouped by category and sorted by name.
- Add your own items by typing them in, or with the **+** suggestions from your General list (filter them by trip type). Tick **Also save to my general items list** to keep a new item for next time, or use **Save to my list** on a row. Remove an item with ✕.

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
| **Home location** | Your address or city; pre-fills where outbound travel starts |
| **Home airport** | Your 3-letter airport code (e.g. JFK); pre-fills flight departures |
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
- **Sent to Open-Meteo**, the free weather service:
  - the **destination name** you type, when you press **Find**;
  - the **coordinates and your trip dates** of the places you are in, to get the weather.
- **Sent to OpenStreetMap (Nominatim)**, a free map service, only when you search for an address, an activity place or an airport: the **text you typed**.
- Nothing else leaves your device.
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
Delete trips with their 🗑️ button, and closet items individually or with **Clear samples** (samples are removed permanently). Deleted trips and items stay in the Trash for 30 days (§13). To wipe everything, clear this site's data in your browser settings. PackWise then starts fresh with the sample wardrobe. If a data file is linked, click **Stop using file** first, or reopening the file would bring your data back.

---

## 13. The Trash

When you delete a **trip**, a **closet item** or a **general packing item**, it goes to the **Trash** (top bar) instead of disappearing. The bar shows how many things are waiting there.

- Each entry shows what it is, when it was deleted and **how many days are left**.
- **Restore** puts it back exactly as it was. A trip comes back with its days, outfits, packing list, transportation, lodging and activities. A closet item returns to the trip outfits, saved outfits and packing lists it was removed from.
- **Delete forever** removes one entry permanently, and **Empty trash** removes everything.
- After **30 days** entries are removed automatically.
- The Trash is not part of backups or the data file, and importing a backup empties it. **Clear samples** deletes sample items permanently.
