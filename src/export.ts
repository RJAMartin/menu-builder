import { createMenuEngine, engine, parseMenu, type Menu } from './engine';
import { mountMenu } from './viewer';
import guestCss from './guest.css?inline';
export function exportHtml(menu: Menu, print = false) {
  const validated = parseMenu(JSON.stringify(menu));
  const errors = engine.issues(validated);
  if (errors.length) throw new Error(errors.join('\n'));
  const dishes = validated.dishes.filter((dish) => dish.available);
  const published = {
    ...validated,
    dishes,
    categories: validated.categories.filter((category) =>
      dishes.some((dish) => dish.categoryId === category.id),
    ),
  };
  const json = JSON.stringify(published)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const script = `(${mountMenu.toString()})(document.getElementById('menu-root'),${json},(${createMenuEngine.toString()})(),${print});${print ? 'window.addEventListener("load",()=>{for(const d of document.querySelectorAll("details"))d.open=true;window.print();});' : ''}`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${engine.escape(validated.restaurant.tagline)}"><title>${engine.escape(validated.restaurant.name)} — Menu</title><style>body{margin:0;padding:24px;background:#f4f3ed}#menu-root{max-width:1050px;margin:auto}@media(max-width:600px){body{padding:0}}@media print{body{padding:0;background:white}}${guestCss}</style></head><body><main id="menu-root"></main><noscript>This interactive menu requires JavaScript. Contact the restaurant directly for ingredients and allergen information.</noscript><script>${script}</script></body></html>`;
}
export function embedHtml(menu: Menu) {
  return `<iframe title="${engine.escape(menu.restaurant.name)} takeaway menu" srcdoc="${engine.escape(exportHtml(menu))}" style="width:100%;height:1100px;border:0;border-radius:12px;" loading="lazy" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals"></iframe>`;
}
export function downloadFile(data: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
