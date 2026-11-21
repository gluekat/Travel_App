# PackWise: summary of changes (November 2026 development session)

A brief overview of what was added or changed in this round of development (about 14 → 20 November 2026). Details are in the [User Manual](USER_MANUAL.md) and [Development Documentation](DEVELOPMENT.md).

## Closet
- **Tabs:** Items (everything), Clothing, Shoes, Accessories, General, Outfits. Items has sort, filter and *Group by category*; Accessories can group by type (hat, scarf, gloves, belt, purse, bag, jewelry).
- **One add/edit form for every kind of item.** Choosing the category *general* switches to the general-item form; items are saved where they belong. Closing an existing item with **X** saves it.
- **New item details:** warmth *none / not applicable*, size, material, notes, accessory type, one-piece category, more weather tags (cool, mild, warm, chilly, snow, windy), *Work* activity, pajama/activewear types for shoes and accessories.
- **General packing items:** categories (Toiletries, Electronics, …), emoji or photo with emoji suggestions, *Default* tag (added to every new trip), trip-type and custom tags.
- Click-to-reverse sorting (first click ascending, second reverses); saved outfits can be edited, duplicated and show a selected-items panel while you choose; location boxes select their text on focus; the Trash also holds saved outfits.
- Duplicate adds "(duplicate)"; photos no longer disappear after edits.

## Trips
- **Trip Overview:** per-day wear counts ("wear 2 of 3", orange only on the day the allowance is exceeded), laundry days, add-outfit chooser (new / sleepwear / saved outfits with previews), forecast warnings you can clear, a single trip-notes box, "Travel day" pre-selected on the first and last day, a Closet tab inside each trip.
- **Sleepwear:** pre-filled with a pajama top + bottom or a one-piece; shoes and accessories offered as variants, only from pajamas.
- **Weather and location follow the transportation:** each day's place comes from the transport legs; travel days show weather for both places, each with its source and an edit link.
- **Kinds of travel:** each destination and the way home has a chosen kind of travel (flight, drive, train, cruise), set when creating or editing a trip, which preloads the placeholder transportation.
- **Multi-stop trips are editable:** destinations can be changed, re-dated, added or removed; days, weather, day locations and placeholder transport follow.
- **Date changes:** editing a trip's dates proposes matching lodging and transport changes; anything declined is flagged "needs updating" on the Itinerary.

## Itinerary
- Travel summary header; overview of departure, final arrival and return.
- **Transportation rework:** every leg listed in order with automatic layover times, driving distance and time, one-way / return / round trip, airport search (built-in list + OpenStreetMap), per-connection airline and flight number, labelled fields, a single Cruise block with "Cruise day" instead of lodging warnings, dividers between types of travel, daily travel-day summaries.
- **Placeholder transportation** is created with each new trip (home → each destination → home, dates from the destinations) and kept in step with later destination/date edits until filled in.
- Lodging: extend suggestion, follows trip dates, cruise nights need no lodging.

## Packing checklist
- Shows the same wear and forecast warnings as the Overview, a laundry plan, general items sorted by category then name, with icons.

## Settings and data
- Home airport (pre-fills flights) next to home location.
- **Trash:** deleted trips, closet items, saved outfits and general items are kept 30 days and can be restored or deleted for good.
- Data schema moved from v5 to v8 (general items, trash, travel-day migration). Backups exclude the trash.

## Quality
- Test suite grew from 78 to 116 tests; build and type-check clean.
- Privacy note updated: address, place and airport searches now also go to OpenStreetMap Nominatim (text you type only).
