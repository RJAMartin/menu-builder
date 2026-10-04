export type AllergenState = 'unknown' | 'contains' | 'may' | 'absent';
export type DietaryState = 'unknown' | 'yes' | 'no';
export type Diet = 'glutenFree' | 'dairyFree' | 'vegetarian' | 'vegan';
export type Dish = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  ingredients: string;
  price: string;
  available: boolean;
  allergens: Record<string, AllergenState>;
  diets: Record<Diet, DietaryState>;
  notes: string;
};
export type Menu = {
  version: 1;
  demo: boolean;
  restaurant: {
    name: string;
    tagline: string;
    description: string;
    address: string;
    phone: string;
    website: string;
    hours: string;
    notes: string;
    currency: string;
    accent: string;
    font: 'serif' | 'sans';
    layout: 'cards' | 'list';
    logo: string;
  };
  categories: { id: string; name: string }[];
  dishes: Dish[];
};
export type Filters = { allergens: string[]; diets: Diet[] };
/** Self-contained factory shared with the standalone export. Keep all runtime dependencies inside. */
export function createMenuEngine() {
  const allergens = [
    {
      id: 'gluten',
      label: 'Cereals containing gluten',
      short: 'Gluten cereals',
      detail:
        'Wheat, rye, barley, oats and their hybrid varieties. Name the specific cereal in ingredients.',
    },
    {
      id: 'crustaceans',
      label: 'Crustaceans',
      short: 'Crustaceans',
      detail: 'For example prawns, crab and lobster.',
    },
    {
      id: 'eggs',
      label: 'Eggs',
      short: 'Eggs',
      detail: 'Eggs and egg products.',
    },
    {
      id: 'fish',
      label: 'Fish',
      short: 'Fish',
      detail: 'Fish and fish products.',
    },
    {
      id: 'peanuts',
      label: 'Peanuts',
      short: 'Peanuts',
      detail: 'Peanuts are separate from tree nuts.',
    },
    {
      id: 'soy',
      label: 'Soybeans',
      short: 'Soy',
      detail: 'Soybeans and soy products.',
    },
    {
      id: 'milk',
      label: 'Milk',
      short: 'Milk',
      detail:
        'Milk and milk products, including lactose. Lactose-free does not mean milk-allergen-free.',
    },
    {
      id: 'nuts',
      label: 'Tree nuts',
      short: 'Tree nuts',
      detail:
        'Almonds, hazelnuts, walnuts, cashews, pecans, Brazil nuts, pistachios and macadamias. Name the specific nut in ingredients.',
    },
    {
      id: 'celery',
      label: 'Celery',
      short: 'Celery',
      detail: 'Celery and celery products.',
    },
    {
      id: 'mustard',
      label: 'Mustard',
      short: 'Mustard',
      detail: 'Mustard and mustard products.',
    },
    {
      id: 'sesame',
      label: 'Sesame',
      short: 'Sesame',
      detail: 'Sesame seeds and sesame products.',
    },
    {
      id: 'sulphites',
      label: 'Sulphur dioxide & sulphites',
      short: 'Sulphites',
      detail:
        'Regulated above 10 mg/kg or 10 mg/L as total SO₂. Check supplier specifications.',
    },
    {
      id: 'lupin',
      label: 'Lupin',
      short: 'Lupin',
      detail: 'Lupin and lupin products.',
    },
    {
      id: 'molluscs',
      label: 'Molluscs',
      short: 'Molluscs',
      detail: 'For example mussels, oysters, squid and snails.',
    },
  ];
  const diets: { id: Diet; label: string }[] = [
    { id: 'glutenFree', label: 'Gluten-free' },
    { id: 'dairyFree', label: 'Dairy-free' },
    { id: 'vegetarian', label: 'Vegetarian' },
    { id: 'vegan', label: 'Vegan' },
  ];
  const safety =
    'Filters use information supplied by the restaurant, not a guarantee of suitability. Tell the restaurant about your allergy or intolerance before ordering, including any not listed here. Recipes and shared preparation can change.';
  function evaluate(dish: Dish, filters: Filters) {
    const exclusions: string[] = [],
      unknowns: string[] = [];
    for (const id of filters.allergens) {
      const a = allergens.find((a) => a.id === id);
      if (!a) {
        unknowns.push('Unrecognised allergen selection');
        continue;
      }
      const value = dish.allergens[id];
      if (value === 'contains')
        exclusions.push(`Contains ${a.short.toLowerCase()}`);
      else if (value === 'may')
        exclusions.push(`May contain ${a.short.toLowerCase()}`);
      else if (value !== 'absent') unknowns.push(`${a.short}: not reviewed`);
    }
    for (const id of filters.diets) {
      const label = diets.find((d) => d.id === id)?.label;
      if (!label) {
        unknowns.push('Unrecognised dietary selection');
        continue;
      }
      if (dish.diets[id] === 'no')
        exclusions.push(`Not declared ${label.toLowerCase()}`);
      else if (dish.diets[id] !== 'yes')
        unknowns.push(`${label}: not confirmed`);
      if (id === 'glutenFree' || id === 'dairyFree') {
        const allergen = id === 'glutenFree' ? 'gluten' : 'milk';
        if (
          dish.allergens[allergen] === 'contains' ||
          dish.allergens[allergen] === 'may'
        )
          exclusions.push(`${label}: conflicting allergen information`);
        else if (dish.allergens[allergen] !== 'absent')
          unknowns.push(`${label}: allergen review incomplete`);
      }
      if (
        id === 'vegan' &&
        (['milk', 'eggs', 'fish', 'crustaceans', 'molluscs'].some(
          (key) => dish.allergens[key] === 'contains',
        ) ||
          dish.diets.vegetarian === 'no')
      )
        exclusions.push('Vegan: conflicting ingredient information');
      if (
        id === 'vegetarian' &&
        ['fish', 'crustaceans', 'molluscs'].some(
          (key) => dish.allergens[key] === 'contains',
        )
      )
        exclusions.push('Vegetarian: conflicting ingredient information');
    }
    return {
      status: exclusions.length
        ? 'excluded'
        : unknowns.length
          ? 'unknown'
          : 'match',
      reasons: [...new Set([...exclusions, ...unknowns])],
    };
  }
  function price(value: string, currency: string) {
    return /^\d{1,6}([.,]\d{1,2})?$/.test(value)
      ? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
          Number(value.replace(',', '.')),
        )
      : 'Ask for price';
  }
  function escape(value: unknown) {
    return String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c]!,
    );
  }
  function website(value: string) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }
  function issues(menu: Menu) {
    const errors: string[] = [];
    if (!menu.restaurant.name.trim()) errors.push('Add your restaurant name.');
    if (menu.categories.some((c) => !c.name.trim()))
      errors.push('Give every category a name.');
    if (menu.restaurant.website && !website(menu.restaurant.website))
      errors.push('Use a full http:// or https:// website address.');
    if (!menu.dishes.some((d) => d.available))
      errors.push('Add at least one available dish.');
    for (const dish of menu.dishes.filter((d) => d.available)) {
      const name = dish.name.trim() || 'Untitled dish';
      if (!dish.name.trim()) errors.push('Give every available dish a name.');
      if (!/^\d{1,6}([.,]\d{1,2})?$/.test(dish.price))
        errors.push(`${name}: enter a valid price.`);
      if (!dish.ingredients.trim())
        errors.push(
          `${name}: add the ingredients, including compound ingredients.`,
        );
      for (const diet of diets.filter((d) => dish.diets[d.id] === 'yes')) {
        const result = evaluate(dish, { allergens: [], diets: [diet.id] });
        if (result.status !== 'match')
          errors.push(
            `${name}: review the ${diet.label.toLowerCase()} declaration (${result.reasons.join('; ')}).`,
          );
      }
    }
    return [...new Set(errors)];
  }
  return { allergens, diets, safety, evaluate, price, escape, website, issues };
}
export const engine = createMenuEngine();
export function newDish(categoryId: string): Dish {
  return {
    id: crypto.randomUUID(),
    categoryId,
    name: '',
    description: '',
    ingredients: '',
    price: '',
    available: true,
    allergens: Object.fromEntries(
      engine.allergens.map((a) => [a.id, 'unknown']),
    ),
    diets: {
      glutenFree: 'unknown',
      dairyFree: 'unknown',
      vegetarian: 'unknown',
      vegan: 'unknown',
    },
    notes: '',
  };
}
export function blankMenu(): Menu {
  return {
    version: 1,
    demo: false,
    restaurant: {
      name: '',
      tagline: 'Takeaway, made with care',
      description: '',
      address: '',
      phone: '',
      website: '',
      hours: '',
      notes: 'Please speak to our team about allergies before ordering.',
      currency: 'EUR',
      accent: '#315b45',
      font: 'serif',
      layout: 'cards',
      logo: '',
    },
    categories: [
      { id: 'mains', name: 'Mains' },
      { id: 'sides', name: 'Sides' },
      { id: 'drinks', name: 'Drinks' },
    ],
    dishes: [],
  };
}
export function sampleMenu(): Menu {
  const menu = blankMenu();
  menu.demo = true;
  menu.restaurant = {
    ...menu.restaurant,
    name: 'The Little Olive',
    tagline: 'Good food. Your way.',
    description:
      'Seasonal bowls, generous sandwiches and little things to share. Made fresh, packed with care.',
    address: 'An imaginary neighbourhood kitchen',
    hours: 'Tuesday–Sunday · 11:30–20:00',
    notes:
      'Sample information only. Our fictional kitchen handles multiple allergens. Always ask the team before ordering.',
  };
  menu.categories = [
    { id: 'bowls', name: 'Bowls & good things' },
    { id: 'sandwiches', name: 'Between two slices' },
    { id: 'sides', name: 'On the side' },
    { id: 'drinks', name: 'Something to sip' },
  ];
  const add = (
    categoryId: string,
    name: string,
    price: string,
    description: string,
    ingredients: string,
    contains: string[],
    may: string[],
    diet: Partial<Record<Diet, DietaryState>>,
  ) => {
    const dish = newDish(categoryId);
    Object.assign(dish, { name, price, description, ingredients });
    dish.allergens = Object.fromEntries(
      engine.allergens.map((a) => [
        a.id,
        contains.includes(a.id)
          ? 'contains'
          : may.includes(a.id)
            ? 'may'
            : 'absent',
      ]),
    );
    dish.diets = {
      glutenFree: 'no',
      dairyFree: 'no',
      vegetarian: 'no',
      vegan: 'no',
      ...diet,
    };
    menu.dishes.push(dish);
  };
  add(
    'bowls',
    'The green bowl',
    '13.50',
    'Roasted greens, lemony quinoa and a little crunch.',
    'Quinoa, broccoli, courgette, avocado, pumpkin seeds, lemon, olive oil, salt.',
    [],
    ['sesame'],
    { glutenFree: 'yes', dairyFree: 'yes', vegetarian: 'yes', vegan: 'yes' },
  );
  add(
    'bowls',
    'Golden halloumi',
    '14.50',
    'Warm grains, grilled halloumi and a bright herb dressing.',
    'Bulgur wheat, halloumi (milk), cucumber, tomato, parsley, lemon, olive oil.',
    ['gluten', 'milk'],
    ['sesame'],
    { vegetarian: 'yes' },
  );
  add(
    'sandwiches',
    'Sunday chicken',
    '12.00',
    'Roast chicken, crisp leaves and a generous spoon of mustard mayo.',
    'Sourdough (wheat flour, water, salt, yeast), chicken, lettuce, mayonnaise (egg, rapeseed oil, mustard, vinegar), tomato.',
    ['gluten', 'eggs', 'mustard'],
    [],
    { dairyFree: 'yes' },
  );
  add(
    'sandwiches',
    'The garden sandwich',
    '11.00',
    'Roasted vegetables and silky hummus on toasted sourdough.',
    'Sourdough (wheat flour, water, salt, yeast), chickpeas, tahini (sesame), aubergine, peppers, lemon, olive oil.',
    ['gluten', 'sesame'],
    [],
    { dairyFree: 'yes', vegetarian: 'yes', vegan: 'yes' },
  );
  add(
    'sides',
    'Rosemary potatoes',
    '5.00',
    'Crisp edges, fluffy middles, sea salt and rosemary.',
    'Potatoes, olive oil, rosemary, sea salt.',
    [],
    ['gluten'],
    { dairyFree: 'yes', vegetarian: 'yes', vegan: 'yes' },
  );
  add(
    'sides',
    'House slaw',
    '4.50',
    'Crunchy cabbage, apple and our changing house dressing.',
    'Cabbage, carrot, apple, house dressing (recipe awaiting review).',
    [],
    [],
    {},
  );
  menu.dishes[5].allergens = Object.fromEntries(
    engine.allergens.map((a) => [a.id, 'unknown']),
  );
  menu.dishes[5].diets = {
    glutenFree: 'unknown',
    dairyFree: 'unknown',
    vegetarian: 'unknown',
    vegan: 'unknown',
  };
  add(
    'drinks',
    'Lemon & mint fizz',
    '4.00',
    'A little sparkle, fresh lemon and garden mint.',
    'Sparkling water, lemon juice, mint, sugar.',
    [],
    [],
    { glutenFree: 'yes', dairyFree: 'yes', vegetarian: 'yes', vegan: 'yes' },
  );
  return menu;
}
export function parseMenu(raw: string): Menu {
  if (raw.length > 2_000_000)
    throw new Error('This backup exceeds the 2 MB limit.');
  const data = JSON.parse(raw);
  if (
    !data ||
    data.version !== 1 ||
    typeof data.demo !== 'boolean' ||
    !data.restaurant ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.dishes)
  )
    throw new Error('This is not a Tableleaf version 1 menu backup.');
  const text = (value: unknown, max: number) => {
    if (typeof value !== 'string' || value.length > max)
      throw new Error('The backup contains invalid or oversized text.');
    return value;
  };
  const id = (value: unknown) => {
    const v = text(value, 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(v))
      throw new Error('The backup contains an invalid identifier.');
    return v;
  };
  if (
    data.categories.length < 1 ||
    data.categories.length > 20 ||
    data.dishes.length > 100
  )
    throw new Error('Use 1–20 categories and at most 100 dishes.');
  const categories = data.categories.map(
    (c: { id: unknown; name: unknown }) => ({
      id: id(c.id),
      name: text(c.name, 80),
    }),
  );
  const catIds = new Set(categories.map((c: { id: string }) => c.id));
  if (catIds.size !== categories.length)
    throw new Error('Category identifiers must be unique.');
  const r = data.restaurant;
  if (
    !['EUR', 'GBP', 'USD', 'CAD'].includes(r.currency) ||
    !/^#[0-9a-fA-F]{6}$/.test(r.accent) ||
    !['serif', 'sans'].includes(r.font) ||
    !['cards', 'list'].includes(r.layout)
  )
    throw new Error('The backup has invalid style or currency settings.');
  const logo = text(r.logo, 500000);
  if (
    logo &&
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)
  )
    throw new Error('The logo must be an embedded PNG, JPEG or WebP image.');
  const restaurant = {
    name: text(r.name, 100),
    tagline: text(r.tagline, 140),
    description: text(r.description, 600),
    address: text(r.address, 250),
    phone: text(r.phone, 80),
    website: text(r.website, 300),
    hours: text(r.hours, 300),
    notes: text(r.notes, 1000),
    currency: r.currency,
    accent: r.accent,
    font: r.font,
    layout: r.layout,
    logo,
  };
  const dishes: Dish[] = data.dishes.map((d: Dish) => {
    if (!catIds.has(d.categoryId) || typeof d.available !== 'boolean')
      throw new Error('A dish has an invalid category or availability.');
    const allergens = Object.fromEntries(
      engine.allergens.map((a) => {
        const value = d.allergens?.[a.id] ?? 'unknown';
        if (!['unknown', 'contains', 'may', 'absent'].includes(value))
          throw new Error('Invalid allergen status in backup.');
        return [a.id, value];
      }),
    );
    const diets = Object.fromEntries(
      engine.diets.map((a) => {
        const value = d.diets?.[a.id] ?? 'unknown';
        if (!['unknown', 'yes', 'no'].includes(value))
          throw new Error('Invalid dietary status in backup.');
        return [a.id, value];
      }),
    ) as Record<Diet, DietaryState>;
    return {
      id: id(d.id),
      categoryId: d.categoryId,
      name: text(d.name, 100),
      description: text(d.description, 500),
      ingredients: text(d.ingredients, 2000),
      price: text(d.price, 20),
      available: d.available,
      allergens,
      diets,
      notes: text(d.notes, 1000),
    };
  });
  if (new Set(dishes.map((d) => d.id)).size !== dishes.length)
    throw new Error('Dish identifiers must be unique.');
  return { version: 1, demo: data.demo, restaurant, categories, dishes };
}
