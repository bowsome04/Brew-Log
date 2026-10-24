// Flavour descriptors modelled on the SCA / WCR "Coffee Taster's Flavor Wheel" (2016).
// The wheel is (c) Specialty Coffee Association and World Coffee Research, licensed
// CC BY-NC-ND 4.0. This app uses the terminology for personal, non-commercial logging.

export const SEP = ' > ';

const RAW = [
  { name: 'Fruity', color: '#d6405a', children: [
    { name: 'Berry', children: ['Blackberry', 'Raspberry', 'Blueberry', 'Strawberry'] },
    { name: 'Dried Fruit', children: ['Raisin', 'Prune'] },
    { name: 'Other Fruit', children: ['Coconut', 'Cherry', 'Pomegranate', 'Pineapple', 'Grape', 'Apple', 'Peach', 'Pear'] },
    { name: 'Citrus Fruit', children: ['Grapefruit', 'Orange', 'Lemon', 'Lime'] },
  ] },
  { name: 'Sour/Fermented', color: '#e0b422', children: [
    { name: 'Sour', children: ['Sour Aromatics', 'Acetic Acid', 'Butyric Acid', 'Isovaleric Acid', 'Citric Acid', 'Malic Acid'] },
    { name: 'Alcohol/Fermented', children: ['Winey', 'Whiskey', 'Fermented', 'Overripe'] },
  ] },
  { name: 'Green/Vegetative', color: '#4f9a3f', children: [
    { name: 'Olive Oil', children: [] },
    { name: 'Raw', children: [] },
    { name: 'Green/Vegetative', children: ['Under-ripe', 'Peapod', 'Fresh', 'Dark Green', 'Vegetative', 'Hay-like', 'Herb-like'] },
    { name: 'Beany', children: [] },
  ] },
  { name: 'Other', color: '#3f8f9b', children: [
    { name: 'Papery/Musty', children: ['Stale', 'Cardboard', 'Papery', 'Woody', 'Moldy/Damp', 'Musty/Dusty', 'Musty/Earthy', 'Animalic', 'Meaty Brothy', 'Phenolic'] },
    { name: 'Chemical', children: ['Bitter', 'Salty', 'Medicinal', 'Petroleum', 'Skunky', 'Rubber'] },
  ] },
  { name: 'Roasted', color: '#a85a1c', children: [
    { name: 'Pipe Tobacco', children: [] },
    { name: 'Tobacco', children: [] },
    { name: 'Burnt', children: ['Acrid', 'Ashy', 'Smoky', 'Brown/Roast'] },
    { name: 'Cereal', children: ['Grain', 'Malt'] },
  ] },
  { name: 'Spices', color: '#a8322a', children: [
    { name: 'Pungent', children: [] },
    { name: 'Pepper', children: [] },
    { name: 'Brown Spice', children: ['Anise', 'Nutmeg', 'Cinnamon', 'Clove'] },
  ] },
  { name: 'Nutty/Cocoa', color: '#9a7350', children: [
    { name: 'Nutty', children: ['Peanuts', 'Hazelnut', 'Almond'] },
    { name: 'Cocoa', children: ['Chocolate', 'Dark Chocolate'] },
  ] },
  { name: 'Sweet', color: '#ec8a2a', children: [
    { name: 'Brown Sugar', children: ['Molasses', 'Maple Syrup', 'Caramelized', 'Honey'] },
    { name: 'Vanilla', children: [] },
    { name: 'Vanillin', children: [] },
    { name: 'Overall Sweet', children: [] },
    { name: 'Sweet Aromatics', children: [] },
  ] },
  { name: 'Floral', color: '#bf4f9c', children: [
    { name: 'Black Tea', children: [] },
    { name: 'Floral', children: ['Chamomile', 'Rose', 'Jasmine'] },
  ] },
];

export const NODE = new Map(); // id -> node

function build(name, level, parent, extra = {}) {
  const id = parent ? parent.id + SEP + name : name;
  const node = { id, name, level, cat: parent ? parent.cat : name, parent, children: [], ...extra };
  NODE.set(id, node);
  return node;
}

export const WHEEL = RAW.map((c) => {
  const cat = build(c.name, 1, null, { color: c.color });
  cat.color = c.color;
  for (const s of c.children) {
    const sub = build(s.name, 2, cat);
    sub.color = c.color;
    for (const l of s.children) {
      const leaf = build(l, 3, sub);
      leaf.color = c.color;
      sub.children.push(leaf);
    }
    cat.children.push(sub);
  }
  return cat;
});

export const CATEGORY_COLOR = Object.fromEntries(WHEEL.map((c) => [c.name, c.color]));

export function catOf(id) { return id.split(SEP)[0]; }
export function nameOf(id) { const n = NODE.get(id); return n ? n.name : id.split(SEP).pop(); }
export function pathOf(id) { return id.split(SEP).slice(1).join(' › ') || id; }
export function isSelectable(node) { return node.level >= 2; }
export function colorOf(id) { return CATEGORY_COLOR[catOf(id)] || '#888'; }
