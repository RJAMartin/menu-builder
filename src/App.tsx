import { useEffect, useRef, useState } from 'react';
import {
  Leaf,
  LayoutGrid,
  Palette,
  Send,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Download,
  Upload,
  Eye,
  Check,
  Info,
  Utensils,
  FileText,
  Code,
  Printer,
} from 'lucide-react';
import {
  blankMenu,
  engine,
  newDish,
  parseMenu,
  sampleMenu,
  type AllergenState,
  type DietaryState,
  type Dish,
  type Menu,
} from './engine';
import { mountMenu } from './viewer';
import { downloadFile, embedHtml, exportHtml } from './export';
import './guest.css';
const STORAGE = 'tableleaf-menu-v1';
function readDraft() {
  try {
    const raw = localStorage.getItem(STORAGE);
    return { menu: raw ? parseMenu(raw) : sampleMenu(), error: '', raw: '' };
  } catch {
    let raw = '';
    try {
      raw = localStorage.getItem(STORAGE) || '';
    } catch {}
    return {
      menu: sampleMenu(),
      error:
        'Your saved draft could not be read. The example is shown instead. Download the recovery file before editing if you need the old draft.',
      raw,
    };
  }
}
function Preview({ menu }: { menu: Menu }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) return mountMenu(root.current, menu, engine);
  }, [menu]);
  return <div ref={root} />;
}
const colors = [
  ['Forest', '#315b45'],
  ['Terracotta', '#964d37'],
  ['Deep blue', '#304e74'],
  ['Plum', '#744565'],
  ['Charcoal', '#464b48'],
  ['Olive', '#66652b'],
];
export default function App() {
  const [initial] = useState(readDraft),
    [menu, setMenu] = useState<Menu>(initial.menu),
    [dirty, setDirty] = useState(false),
    [stage, setStage] = useState<'dishes' | 'brand' | 'export'>('dishes'),
    [previewOnly, setPreviewOnly] = useState(false);
  const [selected, setSelected] = useState(initial.menu.dishes[0]?.id || ''),
    [category, setCategory] = useState('all'),
    [notice, setNotice] = useState(initial.error),
    [saved, setSaved] = useState('Stored only on this device'),
    [code, setCode] = useState(''),
    [logoBusy, setLogoBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null),
    logoRef = useRef<HTMLInputElement>(null),
    docVersion = useRef(0);
  const dish = menu.dishes.find((d) => d.id === selected),
    errors = engine.issues(menu),
    active = menu.dishes.filter((d) => d.available),
    unreviewed = active.filter((d) =>
      engine.allergens.some((a) => d.allergens[a.id] === 'unknown'),
    ).length;
  useEffect(() => {
    if (!dirty) return;
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(menu));
        setSaved('Draft saved in this browser');
      } catch {
        setSaved('Could not save — download a backup');
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [menu, dirty]);
  function commit(update: Menu | ((m: Menu) => Menu)) {
    setMenu(update);
    setDirty(true);
    setCode('');
  }
  function restaurant(values: Partial<Menu['restaurant']>) {
    commit((m) => ({ ...m, restaurant: { ...m.restaurant, ...values } }));
  }
  function updateDish(values: Partial<Dish>) {
    if (!dish) return;
    commit((m) => ({
      ...m,
      dishes: m.dishes.map((d) => (d.id === dish.id ? { ...d, ...values } : d)),
    }));
  }
  function replaceMenu(next: Menu, message: string) {
    docVersion.current++;
    commit(next);
    setSelected(next.dishes[0]?.id || '');
    setCategory('all');
    setNotice(message);
    setStage('dishes');
    setPreviewOnly(false);
  }
  function addDish() {
    if (menu.dishes.length >= 100) {
      setNotice('This version supports up to 100 dishes.');
      return;
    }
    const next = newDish(category === 'all' ? menu.categories[0].id : category);
    commit((m) => ({ ...m, dishes: [...m.dishes, next] }));
    setSelected(next.id);
    setStage('dishes');
  }
  function duplicateDish() {
    if (!dish || menu.dishes.length >= 100) return;
    const next = {
      ...dish,
      ...newDish(dish.categoryId),
      name: `${dish.name} (copy)`.slice(0, 100),
      description: dish.description,
      ingredients: dish.ingredients,
      price: dish.price,
      notes: dish.notes,
    };
    commit((m) => ({ ...m, dishes: [...m.dishes, next] }));
    setSelected(next.id);
    setNotice(
      'Dish duplicated. All allergen and dietary declarations need a fresh review.',
    );
  }
  function moveDish(delta: number) {
    if (!dish) return;
    const ids = menu.dishes
      .filter((d) => d.categoryId === dish.categoryId)
      .map((d) => d.id);
    const pos = ids.indexOf(dish.id),
      target = ids[pos + delta];
    if (!target) return;
    commit((m) => {
      const dishes = [...m.dishes],
        a = dishes.findIndex((d) => d.id === dish.id),
        b = dishes.findIndex((d) => d.id === target);
      [dishes[a], dishes[b]] = [dishes[b], dishes[a]];
      return { ...m, dishes };
    });
  }
  function backup() {
    downloadFile(
      JSON.stringify(menu, null, 2),
      'tableleaf-menu.json',
      'application/json',
    );
    setNotice(
      'Backup downloaded. Keep it to edit or move your menu to another device.',
    );
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error('Choose a backup smaller than 2 MB.');
      const next = parseMenu(await file.text());
      if (
        !window.confirm(
          'Replace this workspace with the imported menu? Download your current backup first if needed.',
        )
      )
        return;
      replaceMenu(
        next,
        'Menu imported. Review its ingredient and allergen information before sharing.',
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : 'This backup could not be imported.',
      );
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }
  async function logo(file?: File) {
    if (!file) return;
    const version = docVersion.current;
    setLogoBusy(true);
    let bitmap: ImageBitmap | undefined;
    try {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 2_000_000
      )
        throw new Error('Use a PNG, JPEG or WebP logo under 2 MB.');
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 16_000_000)
        throw new Error('Resize the logo below 16 megapixels first.');
      const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Logo processing is unavailable.');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/png');
      if (data.length > 500000)
        throw new Error('This logo is too detailed. Try a simpler image.');
      if (version === docVersion.current) restaurant({ logo: data });
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : 'The logo could not be opened.',
      );
    } finally {
      bitmap?.close();
      setLogoBusy(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  }
  function htmlDownload() {
    try {
      downloadFile(exportHtml(menu), 'takeaway-menu.html', 'text/html');
      setNotice(
        'Interactive menu downloaded. Open it in a browser, or upload it to your own website.',
      );
    } catch (e) {
      setNotice(String(e));
    }
  }
  function printMenu() {
    try {
      const url = URL.createObjectURL(
        new Blob([exportHtml(menu, true)], { type: 'text/html' }),
      );
      const page = window.open(url, '_blank');
      if (!page) {
        setNotice(
          'Your browser blocked the print window. Allow pop-ups for this site and try again.',
        );
        URL.revokeObjectURL(url);
        return;
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice(
        'Use the new window’s print dialog to print or choose “Save as PDF”. The full menu and allergen details are included.',
      );
    } catch (e) {
      setNotice(String(e));
    }
  }
  async function makeEmbed() {
    try {
      const value = embedHtml(menu);
      setCode(value);
      try {
        await navigator.clipboard.writeText(value);
        setNotice(
          'Embed code copied. Paste it into a custom HTML block on your website.',
        );
      } catch {
        setNotice(
          'Embed code is ready below. Select and copy it, or download the code file.',
        );
      }
    } catch (e) {
      setNotice(String(e));
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="app-brand" href="./">
          <span>
            <Leaf size={21} />
          </span>
          tableleaf<span className="brand-period">.</span>
        </a>
        <p className="sidebar-label">YOUR MENU STUDIO</p>
        <nav aria-label="Editor sections">
          {(
            [
              ['dishes', Utensils, 'Build your menu'],
              ['brand', Palette, 'Make it yours'],
              ['export', Send, 'Share & export'],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              className={stage === key && !previewOnly ? 'selected' : ''}
              onClick={() => {
                setStage(key);
                setPreviewOnly(false);
              }}
            >
              <Icon size={17} />
              {label}
              <span>
                {key === 'dishes' ? '01' : key === 'brand' ? '02' : '03'}
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-tip">
          <Leaf size={21} />
          <strong>
            A little more clarity.
            <br />A seat for every guest.
          </strong>
          <p>Build a menu that helps people ask the right questions.</p>
        </div>
        <a className="portfolio" href="https://rjamartin.github.io/">
          By Renaud Martin <ArrowUpRight size={13} />
        </a>
      </aside>
      <div className="main-shell">
        <header className="toolbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{' '}
            {previewOnly
              ? 'Customer preview'
              : stage === 'dishes'
                ? 'Menu builder'
                : stage === 'brand'
                  ? 'Brand & details'
                  : 'Share & export'}
          </div>
          <div className="toolbar-actions">
            <span className="save-status">
              <span /> {saved}
            </span>
            <button
              className="button subtle"
              onClick={() => importRef.current?.click()}
            >
              <Upload size={14} />
              Import
            </button>
            <button className="button subtle" onClick={backup}>
              <Download size={14} />
              Backup
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void importBackup(e.target.files?.[0])}
          />
        </header>
        <main className="workspace-main">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">THOUGHTFUL MENUS, MADE SIMPLE</p>
              <h1>
                {previewOnly ? (
                  'A guest’s point of view.'
                ) : stage === 'dishes' ? (
                  <>
                    Good food.
                    <br className="mobile-only" /> Clear choices.
                  </>
                ) : stage === 'brand' ? (
                  'Your kitchen. Your character.'
                ) : (
                  'From your kitchen to their screen.'
                )}
              </h1>
              <p>
                {previewOnly
                  ? 'Try the filters exactly as your customers will.'
                  : stage === 'dishes'
                    ? 'Build your takeaway menu, one considered dish at a time.'
                    : stage === 'brand'
                      ? 'Give the menu your own look, voice and contact details.'
                      : 'One menu. Ready for the counter, your website or a takeaway bag.'}
              </p>
            </div>
            <button
              className="button outline"
              onClick={() => setPreviewOnly(!previewOnly)}
            >
              {previewOnly ? <ArrowLeft size={15} /> : <Eye size={15} />}{' '}
              {previewOnly ? 'Back to editor' : 'Customer preview'}
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              <Info size={16} />
              <span>{notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
              >
                ×
              </button>
            </div>
          )}
          {initial.raw && (
            <button
              className="text-button"
              onClick={() =>
                downloadFile(
                  initial.raw,
                  'tableleaf-recovery.txt',
                  'text/plain',
                )
              }
            >
              Download unreadable draft for recovery
            </button>
          )}
          {!previewOnly && (
            <div className="workspace-summary">
              <div>
                <span className="summary-number">
                  {menu.dishes.length.toString().padStart(2, '0')}
                </span>
                <span>Dishes on the menu</span>
              </div>
              <div>
                <span className="summary-number">
                  {menu.categories.length.toString().padStart(2, '0')}
                </span>
                <span>Menu categories</span>
              </div>
              <div className={unreviewed ? 'review-needed' : ''}>
                <span className="summary-number">
                  {unreviewed.toString().padStart(2, '0')}
                </span>
                <span>Need allergen review</span>
              </div>
              <div className="summary-end">
                {menu.demo ? (
                  <>
                    <span className="demo-pill">EXAMPLE WORKSPACE</span>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Start a blank restaurant menu? This replaces the example or your current edits.',
                          )
                        )
                          replaceMenu(
                            blankMenu(),
                            'Your own menu is ready. Add dishes and review each declaration.',
                          );
                      }}
                    >
                      Start my own menu <ArrowUpRight size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="own-pill">
                      <Check size={12} /> YOUR MENU
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Replace your workspace with the fictional example? Download a backup first.',
                          )
                        )
                          replaceMenu(
                            sampleMenu(),
                            'Example menu loaded. Its data is fictional.',
                          );
                      }}
                    >
                      Load example
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {previewOnly ? (
            <div className="full-preview">
              <Preview menu={menu} />
            </div>
          ) : (
            <div className={`editor-columns stage-${stage}`}>
              <section className="editor-pane" aria-label="Menu editor">
                {stage === 'dishes' && (
                  <>
                    <div className="section-card">
                      <div className="card-heading">
                        <h2>
                          <LayoutGrid size={17} /> Your dishes
                        </h2>
                        <button
                          className="button small primary"
                          onClick={addDish}
                          disabled={menu.dishes.length >= 100}
                        >
                          <Plus size={14} />
                          Add dish
                        </button>
                      </div>
                      <div className="category-tabs">
                        <button
                          className={category === 'all' ? 'active' : ''}
                          onClick={() => setCategory('all')}
                        >
                          All dishes
                        </button>
                        {menu.categories.map((c) => (
                          <button
                            key={c.id}
                            className={category === c.id ? 'active' : ''}
                            onClick={() => setCategory(c.id)}
                          >
                            {c.name || 'Untitled category'}
                          </button>
                        ))}
                      </div>
                      <div className="dish-list">
                        {menu.dishes
                          .filter(
                            (d) =>
                              category === 'all' || d.categoryId === category,
                          )
                          .map((d) => (
                            <button
                              className={`dish-row ${d.id === selected ? 'active' : ''}`}
                              key={d.id}
                              onClick={() => setSelected(d.id)}
                            >
                              <span className="dish-initial">
                                {(d.name || '?')[0]}
                              </span>
                              <span className="dish-row-name">
                                <strong>{d.name || 'Untitled dish'}</strong>
                                <small>
                                  {!d.available
                                    ? 'Hidden from customers'
                                    : engine.allergens.some(
                                          (a) =>
                                            d.allergens[a.id] === 'unknown',
                                        )
                                      ? 'Allergen review incomplete'
                                      : 'Allergen fields reviewed'}
                                </small>
                              </span>
                              <span className="dish-row-price">
                                {d.price
                                  ? engine.price(
                                      d.price,
                                      menu.restaurant.currency,
                                    )
                                  : '—'}
                              </span>
                            </button>
                          ))}
                        {!menu.dishes.filter(
                          (d) =>
                            category === 'all' || d.categoryId === category,
                        ).length && (
                          <p className="empty-editor">
                            Your next favourite dish goes here.
                            <br />
                            Add a dish to get started.
                          </p>
                        )}
                      </div>
                      <details className="category-manager">
                        <summary>
                          Manage categories <span>+</span>
                        </summary>
                        {menu.categories.map((c, i) => (
                          <div className="category-edit" key={c.id}>
                            <input
                              aria-label={`Category ${i + 1} name`}
                              value={c.name}
                              maxLength={80}
                              onChange={(e) =>
                                commit((m) => ({
                                  ...m,
                                  categories: m.categories.map((x) =>
                                    x.id === c.id
                                      ? { ...x, name: e.target.value }
                                      : x,
                                  ),
                                }))
                              }
                            />
                            <button
                              className="icon-button"
                              aria-label={`Move ${c.name} up`}
                              disabled={i === 0}
                              onClick={() =>
                                commit((m) => {
                                  const categories = [...m.categories];
                                  [categories[i - 1], categories[i]] = [
                                    categories[i],
                                    categories[i - 1],
                                  ];
                                  return { ...m, categories };
                                })
                              }
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              className="icon-button danger"
                              aria-label={`Delete ${c.name}`}
                              disabled={menu.categories.length === 1}
                              onClick={() => {
                                if (
                                  menu.dishes.some((d) => d.categoryId === c.id)
                                ) {
                                  setNotice(
                                    'Move or remove the dishes in this category before deleting it.',
                                  );
                                  return;
                                }
                                commit((m) => ({
                                  ...m,
                                  categories: m.categories.filter(
                                    (x) => x.id !== c.id,
                                  ),
                                }));
                                setCategory('all');
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        <button
                          className="text-button"
                          disabled={menu.categories.length >= 20}
                          onClick={() =>
                            commit((m) => ({
                              ...m,
                              categories: [
                                ...m.categories,
                                {
                                  id: crypto.randomUUID(),
                                  name: 'New category',
                                },
                              ],
                            }))
                          }
                        >
                          <Plus size={13} />
                          Add category
                        </button>
                      </details>
                    </div>
                    {dish ? (
                      <div className="section-card dish-editor" key={dish.id}>
                        <div className="card-heading">
                          <h2>Edit dish</h2>
                          <div className="icon-actions">
                            <button
                              className="icon-button"
                              title="Move up in category"
                              aria-label="Move dish up"
                              onClick={() => moveDish(-1)}
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label="Move dish down"
                              onClick={() => moveDish(1)}
                            >
                              <ArrowDown size={15} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label="Duplicate dish"
                              onClick={duplicateDish}
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              className="icon-button danger"
                              aria-label="Delete dish"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete ${dish.name || 'this dish'}?`,
                                  )
                                ) {
                                  commit((m) => ({
                                    ...m,
                                    dishes: m.dishes.filter(
                                      (d) => d.id !== dish.id,
                                    ),
                                  }));
                                  setSelected(
                                    menu.dishes.find((d) => d.id !== dish.id)
                                      ?.id || '',
                                  );
                                }
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        <div className="form-body">
                          <label>
                            Dish name
                            <input
                              value={dish.name}
                              maxLength={100}
                              placeholder="Something delicious"
                              onChange={(e) =>
                                updateDish({ name: e.target.value })
                              }
                            />
                          </label>
                          <div className="form-pair">
                            <label>
                              Category
                              <select
                                aria-label="Dish category"
                                value={dish.categoryId}
                                onChange={(e) => {
                                  updateDish({ categoryId: e.target.value });
                                  setCategory('all');
                                }}
                              >
                                {menu.categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name || 'Untitled category'}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Price ({menu.restaurant.currency})
                              <input
                                inputMode="decimal"
                                value={dish.price}
                                maxLength={20}
                                placeholder="12.50"
                                onChange={(e) =>
                                  updateDish({ price: e.target.value })
                                }
                              />
                            </label>
                          </div>
                          <label>
                            Description
                            <textarea
                              rows={2}
                              value={dish.description}
                              maxLength={500}
                              placeholder="What makes this dish special?"
                              onChange={(e) =>
                                updateDish({ description: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Ingredients
                            <textarea
                              rows={3}
                              value={dish.ingredients}
                              maxLength={2000}
                              placeholder="Include sauces, garnishes and compound ingredients. Name specific cereals and nuts."
                              onChange={(e) =>
                                updateDish({
                                  ingredients: e.target.value,
                                  allergens: newDish(dish.categoryId).allergens,
                                  diets: newDish(dish.categoryId).diets,
                                })
                              }
                            />
                            <span className="field-hint">
                              Changing ingredients resets allergen and dietary
                              reviews. Nothing is inferred automatically.
                            </span>
                          </label>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={dish.available}
                              onChange={(e) =>
                                updateDish({ available: e.target.checked })
                              }
                            />
                            Available on the customer menu
                          </label>
                        </div>
                        <div className="allergen-editor">
                          <div className="subheading">
                            <h3>Allergens, clearly declared</h3>
                            <span>
                              {
                                engine.allergens.filter(
                                  (a) => dish.allergens[a.id] !== 'unknown',
                                ).length
                              }
                              /14 reviewed
                            </span>
                          </div>
                          <p className="help-text">
                            Check the recipe, supplier labels and shared
                            preparation. “Reviewed: not present” is not a
                            guarantee against cross-contact.
                          </p>
                          <div className="allergen-grid">
                            {engine.allergens.map((a) => (
                              <label key={a.id} title={a.detail}>
                                <span>{a.short}</span>
                                <select
                                  aria-label={`${a.label} status`}
                                  className={`state-${dish.allergens[a.id]}`}
                                  value={dish.allergens[a.id]}
                                  onChange={(e) =>
                                    updateDish({
                                      allergens: {
                                        ...dish.allergens,
                                        [a.id]: e.target.value as AllergenState,
                                      },
                                    })
                                  }
                                >
                                  <option value="unknown">Not reviewed</option>
                                  <option value="contains">Contains</option>
                                  <option value="may">
                                    May contain / shared prep
                                  </option>
                                  <option value="absent">
                                    Reviewed: not present
                                  </option>
                                </select>
                              </label>
                            ))}
                          </div>
                          <p className="field-hint">
                            Gluten cereals and tree nuts are group filters. List
                            the specific cereal or nut in the ingredients.
                          </p>
                        </div>
                        <div className="diet-editor">
                          <div className="subheading">
                            <h3>Dietary declarations</h3>
                            <span>RESTAURANT REVIEWED</span>
                          </div>
                          <p className="help-text">
                            Only confirm a claim you can substantiate for the
                            finished dish. Gluten-free is distinct from a wheat
                            allergy; dairy-free is distinct from lactose-free.
                          </p>
                          <div className="form-pair">
                            {engine.diets.map((d) => (
                              <label key={d.id}>
                                {d.label}
                                <select
                                  aria-label={`${d.label} declaration`}
                                  value={dish.diets[d.id]}
                                  onChange={(e) =>
                                    updateDish({
                                      diets: {
                                        ...dish.diets,
                                        [d.id]: e.target.value as DietaryState,
                                      },
                                    })
                                  }
                                >
                                  <option value="unknown">Not confirmed</option>
                                  <option value="yes">Yes — reviewed</option>
                                  <option value="no">No</option>
                                </select>
                              </label>
                            ))}
                          </div>
                          <label>
                            Kitchen / cross-contact note
                            <textarea
                              rows={2}
                              value={dish.notes}
                              maxLength={1000}
                              placeholder="For example: prepared in a shared fryer."
                              onChange={(e) =>
                                updateDish({ notes: e.target.value })
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-editor section-card">
                        <Utensils size={25} />
                        <h3>Start with a dish.</h3>
                        <p>Choose one above, or add your first item.</p>
                      </div>
                    )}
                  </>
                )}
                {stage === 'brand' && (
                  <>
                    <div className="section-card">
                      <div className="card-heading">
                        <h2>
                          <Palette size={18} /> Restaurant & style
                        </h2>
                      </div>
                      <div className="form-body">
                        <label>
                          Restaurant name
                          <input
                            value={menu.restaurant.name}
                            maxLength={100}
                            onChange={(e) =>
                              restaurant({ name: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Tagline
                          <input
                            value={menu.restaurant.tagline}
                            maxLength={140}
                            onChange={(e) =>
                              restaurant({ tagline: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          A short introduction
                          <textarea
                            rows={3}
                            value={menu.restaurant.description}
                            maxLength={600}
                            onChange={(e) =>
                              restaurant({ description: e.target.value })
                            }
                          />
                        </label>
                        <div className="logo-uploader">
                          {menu.restaurant.logo ? (
                            <img
                              src={menu.restaurant.logo}
                              alt="Current restaurant logo"
                            />
                          ) : (
                            <span className="logo-placeholder">
                              <Leaf size={24} />
                            </span>
                          )}
                          <div>
                            <strong>Your logo</strong>
                            <p>PNG, JPEG or WebP · under 2 MB</p>
                            <button
                              className="text-button"
                              disabled={logoBusy}
                              onClick={() => logoRef.current?.click()}
                            >
                              {logoBusy
                                ? 'Preparing…'
                                : menu.restaurant.logo
                                  ? 'Replace logo'
                                  : 'Choose logo'}
                            </button>
                            {menu.restaurant.logo && (
                              <button
                                className="text-button danger"
                                onClick={() => restaurant({ logo: '' })}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <input
                            ref={logoRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            hidden
                            onChange={(e) => void logo(e.target.files?.[0])}
                          />
                        </div>
                        <label>Menu colour</label>
                        <div className="swatches">
                          {colors.map(([name, color]) => (
                            <button
                              key={color}
                              title={name}
                              aria-label={`${name} menu colour`}
                              aria-pressed={menu.restaurant.accent === color}
                              style={{ background: color }}
                              onClick={() => restaurant({ accent: color })}
                            >
                              {menu.restaurant.accent === color && (
                                <Check size={16} />
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="form-pair">
                          <label>
                            Typography
                            <select
                              aria-label="Typography"
                              value={menu.restaurant.font}
                              onChange={(e) =>
                                restaurant({
                                  font: e.target.value as 'serif' | 'sans',
                                })
                              }
                            >
                              <option value="serif">Classic serif</option>
                              <option value="sans">Modern sans</option>
                            </select>
                          </label>
                          <label>
                            Layout
                            <select
                              aria-label="Layout"
                              value={menu.restaurant.layout}
                              onChange={(e) =>
                                restaurant({
                                  layout: e.target.value as 'cards' | 'list',
                                })
                              }
                            >
                              <option value="cards">Dish cards</option>
                              <option value="list">Simple list</option>
                            </select>
                          </label>
                        </div>
                        <label>
                          Currency
                          <select
                            aria-label="Currency"
                            value={menu.restaurant.currency}
                            onChange={(e) =>
                              restaurant({ currency: e.target.value })
                            }
                          >
                            <option value="EUR">EUR — Euro</option>
                            <option value="GBP">GBP — British pound</option>
                            <option value="USD">USD — US dollar</option>
                            <option value="CAD">CAD — Canadian dollar</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="section-card">
                      <div className="card-heading">
                        <h2>Contact & collection</h2>
                      </div>
                      <div className="form-body">
                        <label>
                          Address
                          <input
                            value={menu.restaurant.address}
                            maxLength={250}
                            onChange={(e) =>
                              restaurant({ address: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Phone
                          <input
                            value={menu.restaurant.phone}
                            maxLength={80}
                            onChange={(e) =>
                              restaurant({ phone: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Website
                          <input
                            type="url"
                            placeholder="https://your-restaurant.com"
                            value={menu.restaurant.website}
                            maxLength={300}
                            onChange={(e) =>
                              restaurant({ website: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Opening / collection hours
                          <textarea
                            rows={2}
                            value={menu.restaurant.hours}
                            maxLength={300}
                            onChange={(e) =>
                              restaurant({ hours: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Message from the kitchen
                          <textarea
                            rows={3}
                            value={menu.restaurant.notes}
                            maxLength={1000}
                            onChange={(e) =>
                              restaurant({ notes: e.target.value })
                            }
                          />
                          <span className="field-hint">
                            Mention shared preparation and how customers should
                            contact you about allergies. This appears on every
                            exported menu.
                          </span>
                        </label>
                      </div>
                    </div>
                  </>
                )}
                {stage === 'export' && (
                  <>
                    <div className="section-card export-review">
                      <div className="card-heading">
                        <h2>
                          <Check size={18} /> Before you share
                        </h2>
                      </div>
                      <div className="form-body">
                        {menu.demo && (
                          <p className="export-warning">
                            This is still the fictional example menu. “Example
                            menu” remains visible in exports. Start your own
                            blank menu to publish real dishes.
                          </p>
                        )}
                        {errors.length ? (
                          <>
                            <h3>A few details need attention</h3>
                            <ul>
                              {errors.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p className="ready-note">
                            <Check size={16} /> Menu fields are ready to export.
                          </p>
                        )}
                        <p>
                          {unreviewed
                            ? `${unreviewed} available dish${unreviewed === 1 ? ' has' : 'es have'} incomplete allergen information. Customers will see “Not reviewed”; those dishes cannot match an affected allergy filter.`
                            : 'All available dishes have explicit allergen statuses. These declarations still need to reflect the actual recipe and preparation.'}
                        </p>
                        <p className="help-text">
                          This tool cannot verify a kitchen or certify a dietary
                          claim. Check local food-information requirements
                          before using the menu with customers.
                        </p>
                      </div>
                    </div>
                    <div className="export-options">
                      <div className="section-card export-option">
                        <FileText size={23} />
                        <h3>Interactive menu</h3>
                        <p>
                          A self-contained HTML file, including customer
                          filters. Open it in a browser or upload it to your
                          website.
                        </p>
                        <button
                          className="button primary"
                          disabled={!!errors.length}
                          onClick={htmlDownload}
                        >
                          <Download size={15} />
                          Download menu
                        </button>
                      </div>
                      <div className="section-card export-option">
                        <Printer size={23} />
                        <h3>Print or save a PDF</h3>
                        <p>
                          Your full menu with ingredients and allergen details.
                          Choose “Save as PDF” in your browser’s print dialog.
                        </p>
                        <button
                          className="button outline"
                          disabled={!!errors.length}
                          onClick={printMenu}
                        >
                          <Printer size={15} />
                          Print full menu
                        </button>
                      </div>
                      <div className="section-card export-option">
                        <Code size={23} />
                        <h3>Embed on your website</h3>
                        <p>
                          Paste the self-contained iframe into a custom HTML
                          block. Your website must permit iframes with inline
                          scripts.
                        </p>
                        <button
                          className="button outline"
                          disabled={!!errors.length}
                          onClick={() => void makeEmbed()}
                        >
                          <Copy size={15} />
                          Copy embed code
                        </button>
                      </div>
                      <div className="section-card export-option">
                        <Download size={23} />
                        <h3>Keep an editable copy</h3>
                        <p>
                          A JSON backup for this editor. Bring it back here to
                          change dishes, prices or ingredient information.
                        </p>
                        <button className="button outline" onClick={backup}>
                          Download backup
                        </button>
                      </div>
                    </div>
                    {code && (
                      <div className="section-card code-panel">
                        <label>
                          Embed code
                          <textarea
                            aria-label="Embed code"
                            rows={7}
                            readOnly
                            value={code}
                            onFocus={(e) => e.target.select()}
                          />
                        </label>
                        <button
                          className="text-button"
                          onClick={() =>
                            downloadFile(code, 'menu-embed.txt', 'text/plain')
                          }
                        >
                          Download embed code
                        </button>
                        <p>
                          Default height: 1,100 px, with internal scrolling.
                          Adjust the iframe height to suit your site. Re-export
                          after menu changes; previously shared copies don’t
                          update automatically.
                        </p>
                      </div>
                    )}
                    <div className="export-footnote">
                      <strong>One more thing</strong>
                      <p>
                        This is a menu, not an ordering or payment system.
                        There’s no account or automatic hosting. Customer
                        filters stay in that customer’s browser tab.
                      </p>
                      <a
                        href="https://food.ec.europa.eu/food-safety/campaign-2026/allergies_en"
                        target="_blank"
                        rel="noreferrer"
                      >
                        EU allergen information ↗
                      </a>
                      <a
                        href="https://food.ec.europa.eu/food-safety/labelling-and-nutrition/specific-groups/gluten-free-food_en"
                        target="_blank"
                        rel="noreferrer"
                      >
                        About gluten-free claims ↗
                      </a>
                    </div>
                  </>
                )}
              </section>
              <aside className="preview-pane">
                <div className="preview-heading">
                  <span>
                    <span className="live-dot" /> CUSTOMER VIEW
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setPreviewOnly(true)}
                  >
                    Try the filters <ArrowUpRight size={13} />
                  </button>
                </div>
                <Preview menu={menu} />
                <p className="preview-caption">
                  A live preview of what your guests will see. Try an allergy
                  filter above.
                </p>
              </aside>
            </div>
          )}
          <footer className="workspace-footer">
            <span>Made for independent kitchens. Built with care.</span>
            <a href="https://github.com/RJAMartin/menu-builder">
              View source <ArrowUpRight size={12} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
