import { describe, expect, it } from 'vitest';
import { blankMenu, engine, newDish, parseMenu, sampleMenu } from './engine';
import { embedHtml, exportHtml } from './export';
describe('conservative customer filtering', () => {
  it('starts every new dish with unknown declarations', () => {
    const d = newDish('mains');
    expect(Object.values(d.allergens)).toHaveLength(14);
    expect(Object.values(d.allergens).every((x) => x === 'unknown')).toBe(true);
    expect(engine.evaluate(d, { allergens: ['milk'], diets: [] }).status).toBe(
      'unknown',
    );
  });
  it('excludes both direct presence and possible cross-contact', () => {
    const d = newDish('mains');
    for (const state of ['contains', 'may'] as const) {
      d.allergens.milk = state;
      expect(
        engine.evaluate(d, { allergens: ['milk'], diets: [] }).status,
      ).toBe('excluded');
    }
  });
  it('requires every selected allergen to have a reviewed absence', () => {
    const d = newDish('mains');
    d.allergens.milk = 'absent';
    expect(
      engine.evaluate(d, { allergens: ['milk', 'eggs'], diets: [] }).status,
    ).toBe('unknown');
    d.allergens.eggs = 'absent';
    expect(
      engine.evaluate(d, { allergens: ['milk', 'eggs'], diets: [] }).status,
    ).toBe('match');
    d.allergens.gluten = 'contains';
    expect(
      engine.evaluate(d, { allergens: ['milk', 'eggs'], diets: [] }).status,
    ).toBe('match');
  });
  it('never interprets a missing or invalid allergen as absence', () => {
    const d = newDish('mains');
    delete d.allergens.milk;
    expect(engine.evaluate(d, { allergens: ['milk'], diets: [] }).status).toBe(
      'unknown',
    );
    expect(
      engine.evaluate(d, { allergens: ['unrecognised'], diets: [] }).status,
    ).toBe('unknown');
  });
  it('does not infer gluten-free from an absence of listed cereals', () => {
    const d = newDish('mains');
    d.allergens.gluten = 'absent';
    expect(
      engine.evaluate(d, { allergens: [], diets: ['glutenFree'] }).status,
    ).toBe('unknown');
    d.diets.glutenFree = 'yes';
    expect(
      engine.evaluate(d, { allergens: [], diets: ['glutenFree'] }).status,
    ).toBe('match');
  });
  it('rejects conflicting or incomplete gluten-free declarations', () => {
    const d = newDish('mains');
    d.diets.glutenFree = 'yes';
    expect(
      engine.evaluate(d, { allergens: [], diets: ['glutenFree'] }).status,
    ).toBe('unknown');
    d.allergens.gluten = 'may';
    expect(
      engine.evaluate(d, { allergens: [], diets: ['glutenFree'] }).status,
    ).toBe('excluded');
  });
  it('does not treat a vegan label as a milk-allergy declaration', () => {
    const d = newDish('mains');
    d.diets.vegan = 'yes';
    d.allergens.milk = 'may';
    expect(
      engine.evaluate(d, { allergens: ['milk'], diets: ['vegan'] }).status,
    ).toBe('excluded');
  });
  it('blocks dairy-free conflicts and unknown milk status', () => {
    const d = newDish('mains');
    d.diets.dairyFree = 'yes';
    expect(
      engine.evaluate(d, { allergens: [], diets: ['dairyFree'] }).status,
    ).toBe('unknown');
    d.allergens.milk = 'contains';
    expect(
      engine.evaluate(d, { allergens: [], diets: ['dairyFree'] }).status,
    ).toBe('excluded');
  });
  it('rejects contradictory animal-allergen declarations for vegan/vegetarian', () => {
    const d = newDish('mains');
    d.diets.vegan = 'yes';
    d.diets.vegetarian = 'yes';
    d.allergens.fish = 'contains';
    for (const diet of ['vegan', 'vegetarian'] as const)
      expect(engine.evaluate(d, { allergens: [], diets: [diet] }).status).toBe(
        'excluded',
      );
  });
  it('distinguishes no matching options from incomplete reviews in the sample', () => {
    const m = sampleMenu();
    expect(
      engine.evaluate(
        m.dishes.find((d) => d.name === 'House slaw')!,
        { allergens: ['milk'], diets: [] },
      ).status,
    ).toBe('unknown');
    expect(
      engine.evaluate(
        m.dishes.find((d) => d.name === 'Golden halloumi')!,
        { allergens: ['milk'], diets: [] },
      ).status,
    ).toBe('excluded');
    expect(
      engine.evaluate(
        m.dishes.find((d) => d.name === 'The green bowl')!,
        { allergens: ['milk'], diets: [] },
      ).status,
    ).toBe('match');
  });
});
describe('menu import and export boundaries', () => {
  it('round-trips a valid editable menu', () => {
    const m = sampleMenu();
    expect(parseMenu(JSON.stringify(m))).toEqual(m);
  });
  it('defaults missing imported declarations to unknown', () => {
    const m = sampleMenu();
    delete m.dishes[0].allergens.milk;
    expect(parseMenu(JSON.stringify(m)).dishes[0].allergens.milk).toBe(
      'unknown',
    );
  });
  it('rejects invalid statuses, duplicate IDs and orphan categories', () => {
    for (const modify of [
      (m: ReturnType<typeof sampleMenu>) => {
        m.dishes[0].allergens.milk = 'safe' as never;
      },
      (m: ReturnType<typeof sampleMenu>) => {
        m.dishes[1].id = m.dishes[0].id;
      },
      (m: ReturnType<typeof sampleMenu>) => {
        m.dishes[0].categoryId = 'absent';
      },
    ]) {
      const m = sampleMenu();
      modify(m);
      expect(() => parseMenu(JSON.stringify(m))).toThrow();
    }
  });
  it('rejects code-bearing logos and invalid theme values', () => {
    const m = sampleMenu();
    m.restaurant.logo = 'data:image/svg+xml;base64,PHN2Zz4=';
    expect(() => parseMenu(JSON.stringify(m))).toThrow();
    m.restaurant.logo = '';
    m.restaurant.accent = 'red;display:none';
    expect(() => parseMenu(JSON.stringify(m))).toThrow();
  });
  it('blocks empty menus, invalid prices and unsubstantiated dietary labels', () => {
    expect(engine.issues(blankMenu()).length).toBeGreaterThan(0);
    const m = sampleMenu();
    m.dishes[0].price = 'NaN';
    expect(() => exportHtml(m)).toThrow('valid price');
    m.dishes[0].price = '0';
    m.dishes[0].allergens.gluten = 'may';
    expect(() => exportHtml(m)).toThrow('gluten-free');
  });
  it('permits incomplete reviews but retains their unknown status and customer warning', () => {
    const m = sampleMenu();
    const html = exportHtml(m);
    expect(html).toContain('not a guarantee');
    expect(html).toContain('Not reviewed');
    expect(html).toContain('House slaw');
    expect(html).toContain('Fictional dishes');
  });
  it('escapes markup and closing scripts in exported user text', () => {
    const m = sampleMenu();
    m.restaurant.name = '</title><script>alert(1)</script>';
    m.dishes[0].name = '</script><img src=x onerror=alert(1)>';
    const html = exportHtml(m);
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script>');
    expect(html).toContain('&lt;/title&gt;');
  });
  it('escapes iframe attributes and does not grant same-origin access', () => {
    const m = sampleMenu();
    m.restaurant.name = 'Menu " onload="alert(1)';
    const iframe = embedHtml(m);
    expect(iframe).toContain('Menu &quot; onload=&quot;alert(1)');
    expect(iframe).not.toContain('allow-same-origin');
    expect(iframe).toContain('srcdoc="&lt;!doctype html&gt;');
  });
  it('keeps executable website URLs out of exported menus', () => {
    const m = sampleMenu();
    m.restaurant.website = 'javascript:alert(1)';
    expect(() => exportHtml(m)).toThrow('https://');
    expect(engine.website('https://example.com/menu')).toBe(
      'https://example.com/menu',
    );
  });
  it('includes the full menu for print and preserves decimal prices', () => {
    expect(exportHtml(sampleMenu(), true)).toContain('window.print()');
    expect(engine.price('12,50', 'EUR')).toBe('€12.50');
    expect(engine.price('', 'EUR')).toBe('Ask for price');
    expect(engine.price('0', 'EUR')).toBe('€0.00');
  });
});
it('omits unavailable recipes and unused categories from public exports', () => {
  const menu = sampleMenu();
  menu.categories.push({ id: 'private-draft', name: 'UNPUBLISHED-CATEGORY' });
  const hidden = newDish('private-draft');
  hidden.name = 'UNPUBLISHED-DISH';
  hidden.ingredients = 'PRIVATE-RECIPE';
  hidden.available = false;
  menu.dishes.push(hidden);
  const html = exportHtml(menu);
  expect(html).not.toContain('UNPUBLISHED-DISH');
  expect(html).not.toContain('PRIVATE-RECIPE');
  expect(html).not.toContain('UNPUBLISHED-CATEGORY');
  expect(JSON.stringify(menu)).toContain('PRIVATE-RECIPE');
});
