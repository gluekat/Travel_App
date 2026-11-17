/** Small travel-oriented emoji dictionary used to suggest an emoji from an item's name. */
const EMOJI: [string, string][] = [
  ['🔌', 'charger plug adapter outlet power'], ['🔋', 'battery power bank'], ['📱', 'phone mobile cell'], ['💻', 'laptop computer'], ['🎧', 'headphones earbuds'],
  ['📷', 'camera'], ['🪪', 'id license card'], ['🛂', 'passport visa'], ['💳', 'credit card wallet'], ['👛', 'wallet purse'], ['💵', 'cash money'],
  ['💊', 'medication medicine pills meds vitamins'], ['🩹', 'bandage first aid band-aid'], ['🧴', 'sunscreen lotion toiletries shampoo conditioner moisturizer'], ['🪥', 'toothbrush toothpaste dental'],
  ['🧼', 'soap'], ['🪒', 'razor shaving'], ['🧻', 'toilet paper tissues'], ['💄', 'makeup cosmetics lipstick'], ['💇', 'hair brush comb'],
  ['🕶️', 'sunglasses shades'], ['👓', 'glasses'], ['🧢', 'hat cap'], ['🧣', 'scarf'], ['🧤', 'gloves mittens'], ['🧦', 'socks'], ['🩲', 'underwear'],
  ['🧥', 'jacket coat'], ['☂️', 'umbrella rain'], ['👙', 'swimsuit bikini'], ['🏖️', 'beach'], ['🧺', 'laundry'], ['🏕️', 'camping'], ['⛺', 'tent'],
  ['🔦', 'flashlight torch headlamp'], ['🎒', 'backpack daypack'], ['🧳', 'luggage suitcase bag'], ['🛏️', 'pillow blanket bedding sleeping'], ['😴', 'sleep mask earplugs'],
  ['📚', 'book books'], ['📖', 'guidebook journal notebook'], ['✏️', 'pen pencil'], ['🎫', 'ticket tickets boarding'], ['🗺️', 'map'], ['🧭', 'compass'],
  ['💧', 'water bottle'], ['🍎', 'snacks snack food fruit'], ['☕', 'coffee mug'], ['🔑', 'keys key'], ['🔒', 'lock padlock'], ['🧷', 'pin safety'],
  ['✂️', 'scissors'], ['🧵', 'sewing thread'], ['🩴', 'sandals flip-flops'], ['🥾', 'boots hiking'], ['👟', 'sneakers shoes'], ['⛷️', 'ski skiing'], ['🏂', 'snowboard'],
  ['🤿', 'snorkel mask diving'], ['🏊', 'swim goggles'], ['🎣', 'fishing'], ['⛱️', 'sun umbrella'], ['🧊', 'cooler ice'], ['🌡️', 'thermometer'],
  ['😷', 'mask masks covid'], ['🧽', 'sponge wipes'], ['🧯', 'extinguisher'], ['🪮', 'hairbrush'], ['🎮', 'game console games'], ['📶', 'wifi hotspot'],
  ['💼', 'briefcase business work'], ['👔', 'tie shirt dress'], ['👗', 'dress'], ['🎁', 'gift'], ['🐶', 'dog pet'], ['👶', 'baby diapers stroller'],
];

/** Emoji whose keywords match any word in `name` (prefix match either way), best matches first. */
export function suggestEmoji(name: string, limit = 6): string[] {
  const words = name.toLowerCase().split(/[^a-z-]+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  const scored: { emoji: string; score: number }[] = [];
  for (const [emoji, keywords] of EMOJI) {
    const keys = keywords.split(' ');
    let score = 0;
    for (const w of words) {
      for (const k of keys) {
        if (k === w) score += 3;
        else if (w.length >= 3 && (k.startsWith(w) || (k.length >= 3 && w.startsWith(k)))) score += 1;
      }
    }
    if (score > 0) scored.push({ emoji, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.emoji);
}
