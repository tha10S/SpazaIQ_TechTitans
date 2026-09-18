import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pos_app_mock_state_v1';

const SEED_STATE = {
  products: [
    { id: 'p1', name: 'Simba Fruit Chutney Chips', unit_price: 12 },
    { id: 'p2', name: 'Coca-Cola Original 500ml', unit_price: 18 },
    { id: 'p3', name: 'Albany Superior White Bread', unit_price: 16 },
    { id: 'p4', name: 'Lucky Star Pilchards 400g', unit_price: 22 },
    { id: 'p5', name: 'White Star Maize Meal 2.5kg', unit_price: 35 },
    { id: 'p6', name: 'Full Cream Milk 1L', unit_price: 19 },
    { id: 'p7', name: 'Full Cream Milk 2L', unit_price: 34 },
    { id: 'p8', name: 'Cheddar Cheese 250g', unit_price: 42 },
    { id: 'p9', name: 'Processed Cheese Slices 200g', unit_price: 38 },
    { id: 'p10', name: 'Amasi 1L', unit_price: 24 },
    { id: 'p11', name: 'Plain Yoghurt 1kg', unit_price: 32 },
    { id: 'p12', name: 'Free Range Eggs 6 Pack', unit_price: 28 },
    { id: 'p13', name: 'Free Range Eggs 18 Pack', unit_price: 72 },
    { id: 'p14', name: 'Brown Bread', unit_price: 18 },
    { id: 'p15', name: 'Hot Dog Rolls 6 Pack', unit_price: 25 },
    { id: 'p16', name: 'White Sugar 1kg', unit_price: 24 },
    { id: 'p17', name: 'White Sugar 2.5kg', unit_price: 52 },
    { id: 'p18', name: 'Cake Wheat Flour 2.5kg', unit_price: 38 },
    { id: 'p19', name: 'Rice 2kg', unit_price: 42 },
    { id: 'p20', name: 'Rice 5kg', unit_price: 96 },
    { id: 'p21', name: 'Cooking Oil 750ml', unit_price: 29 },
    { id: 'p22', name: 'Cooking Oil 2L', unit_price: 68 },
    { id: 'p23', name: 'Salt 1kg', unit_price: 15 },
    { id: 'p24', name: 'Baked Beans 410g', unit_price: 18 },
    { id: 'p25', name: 'Sweetcorn 410g', unit_price: 20 },
    { id: 'p26', name: 'Tomato & Onion Mix 410g', unit_price: 19 },
    { id: 'p27', name: 'Peanut Butter 400g', unit_price: 46 },
    { id: 'p28', name: 'Strawberry Jam 450g', unit_price: 39 },
    { id: 'p29', name: 'Mayonnaise 750ml', unit_price: 48 },
    { id: 'p30', name: 'Tomato Sauce 750ml', unit_price: 32 },
    { id: 'p31', name: 'Two Minute Noodles Chicken', unit_price: 9 },
    { id: 'p32', name: 'Two Minute Noodles Beef', unit_price: 9 },
    { id: 'p33', name: 'Mince Beef 500g', unit_price: 62 },
    { id: 'p34', name: 'Chicken Portions 1kg', unit_price: 78 },
    { id: 'p35', name: 'Vienna Sausages 400g', unit_price: 35 },
    { id: 'p36', name: 'Frozen Mixed Vegetables 1kg', unit_price: 44 },
    { id: 'p37', name: 'Apples 1kg', unit_price: 35 },
    { id: 'p38', name: 'Bananas 1kg', unit_price: 24 },
    { id: 'p39', name: 'Oranges 1kg', unit_price: 30 },
    { id: 'p40', name: 'Coca-Cola Original 2L', unit_price: 28 },
    { id: 'p41', name: 'Bottled Water 500ml', unit_price: 10 },
    { id: 'p42', name: 'Bottled Water 1.5L', unit_price: 16 },
    { id: 'p43', name: 'Energade 500ml', unit_price: 15 },
    { id: 'p44', name: 'Instant Coffee 250g', unit_price: 58 },
    { id: 'p45', name: 'Rooibos Tea 40 Pack', unit_price: 38 },
    { id: 'p46', name: 'Long Life Milk 1L', unit_price: 21 },
    { id: 'p47', name: 'Toilet Paper 2 Pack', unit_price: 22 },
    { id: 'p48', name: 'Toilet Paper 9 Pack', unit_price: 74 },
    { id: 'p49', name: 'Washing Powder 2kg', unit_price: 68 },
    { id: 'p50', name: 'Dishwashing Liquid 750ml', unit_price: 27 },
    { id: 'p51', name: 'Bleach 750ml', unit_price: 18 },
    { id: 'p52', name: 'Hand Soap 175g', unit_price: 12 },
    { id: 'p53', name: 'Toothpaste 100ml', unit_price: 28 },
    { id: 'p54', name: 'Toothbrush', unit_price: 18 },
    { id: 'p55', name: 'Petroleum Jelly 100ml', unit_price: 24 },
    { id: 'p56', name: 'Sanitary Pads 10 Pack', unit_price: 32 },
    { id: 'p57', name: 'Disposable Nappies Medium 10 Pack', unit_price: 48 },
    { id: 'p58', name: 'Disposable Lighter', unit_price: 12 },
    { id: 'p59', name: 'Matches 10 Pack', unit_price: 10 },
    { id: 'p60', name: 'AA Batteries 4 Pack', unit_price: 35 },
  ],
  customers: [
    { id: 'c1', name: 'Sipho Nkosi', phone: '+27821234567' },
    { id: 'c2', name: 'Maria Dlamini', phone: '+27831234567' },
    { id: 'c3', name: 'John Moyo', phone: '+27841234567' },
  ],
  // Positive amount = credit given, negative = repayment
  creditTransactions: [
    { id: 't1', customer_id: 'c1', amount: 450, due_date: '2026-08-28' },
    { id: 't2', customer_id: 'c2', amount: 820, due_date: '2026-08-15' },
    { id: 't3', customer_id: 'c3', amount: 1200, due_date: '2026-08-10' },
  ],
  sales: [],
};

// In-memory cache, hydrated from AsyncStorage on first access.
let state = null;
let loadingPromise = null;

function mergeSeedProducts(currentState) {
  const savedProductIds = new Set(currentState.products.map((product) => product.id));
  const missingProducts = SEED_STATE.products.filter(
    (product) => !savedProductIds.has(product.id)
  );

  if (missingProducts.length > 0) {
    currentState.products.push(...missingProducts);
  }

  return currentState;
}

async function loadState() {
  if (state) return mergeSeedProducts(state);
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const savedState = JSON.parse(raw);
        state = mergeSeedProducts(savedState);
      } else {
        state = deepClone(SEED_STATE);
      }
    } catch (err) {
      console.warn('[mockData] Failed to load persisted state, using seed data', err);
      state = deepClone(SEED_STATE);
    }
    return state;
  })();

  return loadingPromise;
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[mockData] Failed to persist state', err);
  }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Returns the current state, loading from AsyncStorage first if needed. */
export async function getState() {
  return loadState();
}

/**
 * Applies a mutation to the in-memory state and persists the result.
 * `mutator` receives the live state object and should mutate it directly
 * (push to arrays, etc.) — same pattern as before, just persisted now.
 */
export async function mutate(mutator) {
  const current = await loadState();
  mutator(current);
  await persist();
  return current;
}

/** Wipes persisted data and resets to the seed dataset — handy while testing. */
export async function resetMockData() {
  state = deepClone(SEED_STATE);
  await persist();
  return state;
}

export const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

export function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}