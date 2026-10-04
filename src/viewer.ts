import type { Menu, Filters, Diet } from './engine';
import type { createMenuEngine } from './engine';
export type MenuEngine = ReturnType<typeof createMenuEngine>;
/** Runs unchanged inside the builder and the exported, dependency-free menu. */
export function mountMenu(
  root: HTMLElement,
  menu: Menu,
  tools: MenuEngine,
  printMode = false,
) {
  const esc = tools.escape,
    r = menu.restaurant;
  root.className = `guest-menu font-${r.font} layout-${r.layout}${printMode ? ' print-menu' : ''}`;
  root.style.setProperty('--menu-accent', r.accent);
  const available = menu.dishes.filter((d) => d.available);
  const site = tools.website(r.website);
  root.innerHTML = `${menu.demo ? '<div class="gm-demo">EXAMPLE MENU · Fictional dishes and allergen information. Not for ordering.</div>' : ''}
    <header class="gm-header">${r.logo ? `<img class="gm-logo" src="${esc(r.logo)}" alt="${esc(r.name)} logo" />` : '<span class="gm-flourish" aria-hidden="true">✳</span>'}<p class="gm-eyebrow">${esc(r.tagline || 'TAKEAWAY MENU')}</p><h1>${esc(r.name || 'Your restaurant')}</h1>${r.description ? `<p class="gm-description">${esc(r.description)}</p>` : ''}<div class="gm-contact">${r.address ? `<span>${esc(r.address)}</span>` : ''}${r.phone ? `<span>${esc(r.phone)}</span>` : ''}${site ? `<a href="${esc(site)}" target="_blank" rel="noopener noreferrer">Visit our website ↗</a>` : ''}</div>${r.hours ? `<p class="gm-hours">${esc(r.hours)}</p>` : ''}</header>
    <aside class="gm-safety"><strong>A note about allergies</strong><p>${esc(tools.safety)}</p>${r.notes ? `<p class="gm-kitchen-note">${esc(r.notes)}</p>` : ''}</aside>
    <section class="gm-filters" aria-label="Menu filters"><div class="gm-filter-top"><label class="gm-search-label">Find a dish<input class="gm-search" type="search" placeholder="Search dishes and ingredients" maxlength="100" /></label><button class="gm-reset" type="button">Reset filters</button></div><details class="gm-filter-details"><summary>Allergens & dietary preferences <span class="gm-selected-count">None selected</span></summary><div class="gm-filter-body"><fieldset><legend>Ingredients you need to avoid</legend><p>“May contain” dishes won’t match. Unreviewed information stays uncertain.</p><div class="gm-checks">${tools.allergens.map((a) => `<label><input type="checkbox" data-allergen="${a.id}" />${esc(a.short)}</label>`).join('')}</div></fieldset><fieldset><legend>Dietary preferences</legend><p>Only explicitly reviewed declarations can match. Vegan and lactose-free do not mean milk-allergen-free.</p><div class="gm-checks">${tools.diets.map((d) => `<label><input type="checkbox" data-diet="${d.id}" />${esc(d.label)}</label>`).join('')}</div></fieldset></div></details><div class="gm-view-options"><label><input class="gm-only" type="checkbox" /> Show only dishes matching these declarations</label><span class="gm-count" role="status" aria-live="polite"></span></div></section>
    <nav class="gm-categories" aria-label="Menu categories">${menu.categories
      .filter((c) => available.some((d) => d.categoryId === c.id))
      .map(
        (c) =>
          `<button type="button" data-category="${esc(c.id)}">${esc(c.name)}</button>`,
      )
      .join('')}</nav><div class="gm-results"></div>
    <footer class="gm-footer"><p>Dietary labels and allergen information are declared by the restaurant. Ingredients outside these 14 groups may also cause reactions.</p><a href="https://rjamartin.github.io/menu-builder/" target="_blank" rel="noopener noreferrer">Menu made with Tableleaf ↗</a></footer>`;
  const search = root.querySelector<HTMLInputElement>('.gm-search')!,
    only = root.querySelector<HTMLInputElement>('.gm-only')!,
    results = root.querySelector<HTMLElement>('.gm-results')!;
  function render() {
    const filters: Filters = {
      allergens: [
        ...root.querySelectorAll<HTMLInputElement>('[data-allergen]:checked'),
      ].map((x) => x.dataset.allergen!),
      diets: [
        ...root.querySelectorAll<HTMLInputElement>('[data-diet]:checked'),
      ].map((x) => x.dataset.diet as Diet),
    };
    const active = filters.allergens.length + filters.diets.length > 0;
    const query = printMode ? '' : search.value.trim().toLocaleLowerCase();
    const searched = available.filter((d) =>
      [d.name, d.description, d.ingredients]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
    const shown = searched.filter(
      (d) =>
        printMode ||
        !only.checked ||
        !active ||
        tools.evaluate(d, filters).status === 'match',
    );
    const matching = searched.filter(
      (d) => tools.evaluate(d, filters).status === 'match',
    ).length;
    root.querySelector('.gm-count')!.textContent = active
      ? `${matching} of ${searched.length} match the selected declarations`
      : `${shown.length} dishes`;
    root.querySelector('.gm-selected-count')!.textContent = active
      ? `${filters.allergens.length + filters.diets.length} selected`
      : 'None selected';
    only.disabled = !active;
    results.innerHTML =
      menu.categories
        .map((category) => {
          const dishes = shown.filter((d) => d.categoryId === category.id);
          if (!dishes.length) return '';
          return `<section class="gm-category" data-section="${esc(category.id)}"><h2>${esc(category.name)}</h2><div class="gm-dishes">${dishes
            .map((dish) => {
              const match = tools.evaluate(dish, filters);
              const contains = tools.allergens.filter(
                  (a) => dish.allergens[a.id] === 'contains',
                ),
                may = tools.allergens.filter(
                  (a) => dish.allergens[a.id] === 'may',
                ),
                unknown = tools.allergens.filter(
                  (a) =>
                    !dish.allergens[a.id] || dish.allergens[a.id] === 'unknown',
                ),
                absent = tools.allergens.filter(
                  (a) => dish.allergens[a.id] === 'absent',
                );
              const declarations = tools.diets.filter(
                (d) => dish.diets[d.id] === 'yes',
              );
              return `<article class="gm-dish ${active ? 'gm-' + match.status : ''}"><div class="gm-dish-title"><h3>${esc(dish.name || 'Untitled dish')}</h3><span class="gm-price">${esc(tools.price(dish.price, r.currency))}</span></div>${dish.description ? `<p class="gm-dish-description">${esc(dish.description)}</p>` : ''}${declarations.length ? `<ul class="gm-tags" aria-label="Restaurant dietary declarations">${declarations.map((d) => `<li>${esc(d.label)}</li>`).join('')}</ul>` : ''}${active ? `<div class="gm-match-note"><strong>${match.status === 'match' ? 'Matches declarations · confirm with staff' : match.status === 'unknown' ? 'Needs a conversation' : 'Does not match'}</strong>${match.reasons.length ? `<p>${esc(match.reasons.join(' · '))}</p>` : ''}</div>` : ''}
          <details class="gm-dish-details" ${printMode ? 'open' : ''}><summary>Ingredients & allergen details</summary><div><p><strong>Ingredients</strong><br />${esc(dish.ingredients || 'Not supplied — ask the restaurant.')}</p><dl><dt>Contains</dt><dd>${contains.length ? esc(contains.map((a) => a.label).join(', ')) : 'None declared' + (unknown.length ? ' — review incomplete' : '')}</dd><dt>May contain / cross-contact</dt><dd>${may.length ? esc(may.map((a) => a.label).join(', ')) : 'None declared' + (unknown.length ? ' — review incomplete' : '')}</dd>${unknown.length ? `<dt class="gm-unknown-label">Not reviewed</dt><dd>${esc(unknown.map((a) => a.label).join(', '))}</dd>` : ''}${absent.length ? `<dt>Reviewed: not declared present</dt><dd>${esc(absent.map((a) => a.label).join(', '))}</dd>` : ''}</dl>${dish.notes ? `<p><strong>Kitchen note</strong><br />${esc(dish.notes)}</p>` : ''}<p class="gm-detail-note">Absence from a recipe is not a guarantee against cross-contact. Confirm with the restaurant.</p></div></details></article>`;
            })
            .join('')}</div></section>`;
        })
        .join('') ||
      '<div class="gm-empty"><h2>No dishes to show</h2><p>Try a different search, or reset the filters. If nothing matches your requirements, speak to the restaurant.</p></div>';
    for (const button of root.querySelectorAll<HTMLButtonElement>(
      '[data-category]',
    ))
      button.hidden = !shown.some(
        (d) => d.categoryId === button.dataset.category,
      );
  }
  search.addEventListener('input', render);
  root.querySelector('.gm-filters')!.addEventListener('change', render);
  root.querySelector('.gm-reset')!.addEventListener('click', () => {
    search.value = '';
    only.checked = false;
    for (const input of root.querySelectorAll<HTMLInputElement>(
      '[data-allergen],[data-diet]',
    ))
      input.checked = false;
    render();
  });
  root.querySelector('.gm-categories')!.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '[data-category]',
    );
    if (!button) return;
    const section = [
      ...root.querySelectorAll<HTMLElement>('[data-section]'),
    ].find((x) => x.dataset.section === button.dataset.category);
    section?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  });
  render();
  return () => root.replaceChildren();
}
