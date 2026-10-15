import type { Category, Food, Recipe, Unit } from '../types';

// Built-in foods: [id, name, category, defaultQuantity, defaultUnit]
const F: [string, string, Category, number, Unit][] = [
  // Proteins
  ['chicken-breast', 'Chicken breast', 'proteins', 200, 'g'],
  ['chicken-thigh', 'Chicken thighs', 'proteins', 200, 'g'],
  ['ground-beef', 'Ground beef', 'proteins', 250, 'g'],
  ['beef-sirloin', 'Beef sirloin', 'proteins', 200, 'g'],
  ['salmon', 'Salmon fillet', 'proteins', 150, 'g'],
  ['white-fish', 'White fish (cod)', 'proteins', 150, 'g'],
  ['shrimp', 'Shrimp', 'proteins', 150, 'g'],
  ['pork-chop', 'Pork chops', 'proteins', 200, 'g'],
  ['tofu', 'Firm tofu', 'proteins', 200, 'g'],
  ['turkey-slices', 'Turkey slices', 'proteins', 4, 'slice'],
  ['bacon', 'Bacon', 'proteins', 4, 'slice'],
  // Vegetables
  ['onion', 'Onion', 'vegetables', 1, 'piece'],
  ['garlic', 'Garlic', 'vegetables', 2, 'clove'],
  ['bell-pepper', 'Bell pepper', 'vegetables', 1, 'piece'],
  ['broccoli', 'Broccoli', 'vegetables', 200, 'g'],
  ['carrot', 'Carrots', 'vegetables', 2, 'piece'],
  ['spinach', 'Spinach', 'vegetables', 100, 'g'],
  ['tomato', 'Tomatoes', 'vegetables', 2, 'piece'],
  ['lettuce', 'Romaine lettuce', 'vegetables', 1, 'piece'],
  ['zucchini', 'Zucchini', 'vegetables', 1, 'piece'],
  ['potato', 'Potatoes', 'vegetables', 500, 'g'],
  ['sweet-potato', 'Sweet potatoes', 'vegetables', 1, 'piece'],
  ['cucumber', 'Cucumber', 'vegetables', 1, 'piece'],
  ['mushrooms', 'Mushrooms', 'vegetables', 200, 'g'],
  ['asparagus', 'Asparagus', 'vegetables', 200, 'g'],
  ['avocado', 'Avocado', 'vegetables', 1, 'piece'],
  ['ginger', 'Fresh ginger', 'vegetables', 10, 'g'],
  ['green-onion', 'Green onions', 'vegetables', 2, 'piece'],
  ['cilantro', 'Cilantro', 'vegetables', 1, 'pack'],
  // Fruits
  ['banana', 'Bananas', 'fruits', 1, 'piece'],
  ['apple', 'Apples', 'fruits', 1, 'piece'],
  ['berries', 'Mixed berries', 'fruits', 100, 'g'],
  ['lemon', 'Lemons', 'fruits', 1, 'piece'],
  ['lime', 'Limes', 'fruits', 1, 'piece'],
  ['orange', 'Oranges', 'fruits', 1, 'piece'],
  // Grains
  ['white-rice', 'White rice', 'grains', 100, 'g'],
  ['brown-rice', 'Brown rice', 'grains', 100, 'g'],
  ['spaghetti', 'Spaghetti', 'grains', 100, 'g'],
  ['penne', 'Penne pasta', 'grains', 100, 'g'],
  ['bread', 'Sliced bread', 'grains', 2, 'slice'],
  ['tortillas', 'Flour tortillas', 'grains', 2, 'piece'],
  ['rolled-oats', 'Rolled oats', 'grains', 50, 'g'],
  ['quinoa', 'Quinoa', 'grains', 80, 'g'],
  ['noodles', 'Egg noodles', 'grains', 100, 'g'],
  // Dairy
  ['eggs', 'Eggs', 'dairy', 2, 'piece'],
  ['milk', 'Milk', 'dairy', 250, 'ml'],
  ['butter', 'Butter', 'dairy', 1, 'tbsp'],
  ['cheddar', 'Cheddar cheese', 'dairy', 50, 'g'],
  ['parmesan', 'Parmesan', 'dairy', 30, 'g'],
  ['greek-yogurt', 'Greek yogurt', 'dairy', 150, 'g'],
  ['sour-cream', 'Sour cream', 'dairy', 2, 'tbsp'],
  ['mozzarella', 'Mozzarella', 'dairy', 100, 'g'],
  // Legumes
  ['black-beans', 'Black beans (canned)', 'legumes', 1, 'can'],
  ['chickpeas', 'Chickpeas (canned)', 'legumes', 1, 'can'],
  ['lentils', 'Red lentils', 'legumes', 100, 'g'],
  ['kidney-beans', 'Kidney beans (canned)', 'legumes', 1, 'can'],
  ['peanut-butter', 'Peanut butter', 'legumes', 2, 'tbsp'],
  // Pantry: oils, spices, condiments
  ['olive-oil', 'Olive oil', 'pantry', 1, 'tbsp'],
  ['vegetable-oil', 'Vegetable oil', 'pantry', 1, 'tbsp'],
  ['salt', 'Salt', 'pantry', 1, 'pinch'],
  ['black-pepper', 'Black pepper', 'pantry', 1, 'pinch'],
  ['soy-sauce', 'Soy sauce', 'pantry', 2, 'tbsp'],
  ['honey', 'Honey', 'pantry', 1, 'tbsp'],
  ['cumin', 'Ground cumin', 'pantry', 1, 'tsp'],
  ['chili-powder', 'Chili powder', 'pantry', 1, 'tsp'],
  ['paprika', 'Paprika', 'pantry', 1, 'tsp'],
  ['oregano', 'Dried oregano', 'pantry', 1, 'tsp'],
  ['tomato-sauce', 'Tomato sauce (passata)', 'pantry', 400, 'ml'],
  ['salsa', 'Salsa', 'pantry', 4, 'tbsp'],
  ['chicken-stock', 'Chicken stock', 'pantry', 500, 'ml'],
  ['cinnamon', 'Ground cinnamon', 'pantry', 1, 'tsp'],
  ['maple-syrup', 'Maple syrup', 'pantry', 1, 'tbsp'],
  ['sesame-oil', 'Sesame oil', 'pantry', 1, 'tsp'],
  ['cornstarch', 'Cornstarch', 'pantry', 1, 'tbsp'],
  ['mayonnaise', 'Mayonnaise', 'pantry', 1, 'tbsp'],
  // Frozen
  ['frozen-peas', 'Frozen peas', 'frozen', 100, 'g'],
  ['frozen-corn', 'Frozen corn', 'frozen', 100, 'g'],
  ['frozen-veg-mix', 'Frozen stir-fry vegetables', 'frozen', 200, 'g'],
  ['frozen-berries', 'Frozen berries', 'frozen', 100, 'g'],
  // Snacks & misc
  ['almonds', 'Almonds', 'snacks', 30, 'g'],
  ['hummus', 'Hummus', 'snacks', 4, 'tbsp'],
  ['granola', 'Granola', 'snacks', 40, 'g'],
  ['dark-chocolate', 'Dark chocolate', 'snacks', 20, 'g'],
  ['crackers', 'Crackers', 'snacks', 1, 'pack'],
];

export const SEED_FOODS: Food[] = F.map(([id, name, category, defaultQuantity, defaultUnit]) => ({
  id, name, category, defaultQuantity, defaultUnit,
}));

type I = [string, number, Unit];
const ing = (list: I[]) => list.map(([foodId, quantity, unit]) => ({ foodId, quantity, unit }));

export const SEED_RECIPES: Recipe[] = [
  {
    id: 'r-chicken-rice', emoji: '🍗', name: 'Chicken and rice', servings: 1, prepMinutes: 30,
    description: 'Pan-seared chicken breast over fluffy white rice.',
    ingredients: ing([['chicken-breast', 200, 'g'], ['white-rice', 100, 'g'], ['olive-oil', 1, 'tbsp'], ['garlic', 1, 'clove'], ['salt', 1, 'pinch']]),
    instructions: 'Rinse and cook the rice.\nSeason the chicken, sear in olive oil 6–7 min per side.\nAdd minced garlic for the last minute. Slice and serve over rice.',
  },
  {
    id: 'r-spaghetti', emoji: '🍝', name: 'Spaghetti with meat sauce', servings: 4, prepMinutes: 40,
    description: 'A weeknight classic: beef and tomato sauce over spaghetti.',
    ingredients: ing([['spaghetti', 400, 'g'], ['ground-beef', 500, 'g'], ['tomato-sauce', 700, 'ml'], ['onion', 1, 'piece'], ['garlic', 3, 'clove'], ['olive-oil', 2, 'tbsp'], ['oregano', 1, 'tsp'], ['parmesan', 60, 'g']]),
    instructions: 'Soften chopped onion and garlic in olive oil.\nBrown the beef, add tomato sauce and oregano, simmer 20 min.\nCook spaghetti, toss with sauce, top with parmesan.',
  },
  {
    id: 'r-salmon', emoji: '🐟', name: 'Grilled salmon with vegetables', servings: 2, prepMinutes: 25,
    description: 'Lemony salmon with roasted asparagus and zucchini.',
    ingredients: ing([['salmon', 300, 'g'], ['asparagus', 250, 'g'], ['zucchini', 1, 'piece'], ['lemon', 1, 'piece'], ['olive-oil', 2, 'tbsp'], ['garlic', 2, 'clove']]),
    instructions: 'Toss vegetables with oil and garlic, roast at 220 °C for 15 min.\nGrill salmon 4 min per side. Finish with lemon.',
  },
  {
    id: 'r-burrito-bowl', emoji: '🌯', name: 'Chicken burrito bowl', servings: 1, prepMinutes: 30,
    description: 'Spiced chicken, rice, beans, salsa, and avocado.',
    ingredients: ing([['chicken-breast', 150, 'g'], ['white-rice', 100, 'g'], ['black-beans', 0.5, 'can'], ['salsa', 3, 'tbsp'], ['avocado', 0.5, 'piece'], ['lime', 0.5, 'piece'], ['cumin', 1, 'tsp'], ['chili-powder', 0.5, 'tsp']]),
    instructions: 'Cook rice. Rub chicken with cumin and chili powder and pan-fry.\nWarm the beans. Build bowls and finish with salsa, avocado, and lime.',
  },
  {
    id: 'r-eggs-toast', emoji: '🍳', name: 'Breakfast eggs and toast', servings: 1, prepMinutes: 10,
    description: 'Scrambled eggs with buttered toast.',
    ingredients: ing([['eggs', 2, 'piece'], ['bread', 2, 'slice'], ['butter', 1, 'tbsp'], ['milk', 2, 'tbsp'], ['salt', 1, 'pinch']]),
    instructions: 'Whisk eggs with milk and salt.\nScramble gently in half the butter. Toast bread and spread with the rest.',
  },
  {
    id: 'r-oatmeal', emoji: '🥣', name: 'Oatmeal with fruit', servings: 1, prepMinutes: 10,
    description: 'Creamy oats topped with banana and berries.',
    ingredients: ing([['rolled-oats', 50, 'g'], ['milk', 250, 'ml'], ['banana', 1, 'piece'], ['berries', 50, 'g'], ['honey', 1, 'tsp'], ['cinnamon', 0.25, 'tsp']]),
    instructions: 'Simmer oats in milk for 5 min, stirring.\nTop with sliced banana, berries, honey, and cinnamon.',
  },
  {
    id: 'r-stir-fry', emoji: '🥢', name: 'Beef stir-fry', servings: 2, prepMinutes: 25,
    description: 'Quick sirloin and vegetable stir-fry with a soy-ginger sauce.',
    ingredients: ing([['beef-sirloin', 300, 'g'], ['bell-pepper', 1, 'piece'], ['broccoli', 200, 'g'], ['soy-sauce', 3, 'tbsp'], ['ginger', 10, 'g'], ['garlic', 2, 'clove'], ['vegetable-oil', 1, 'tbsp'], ['cornstarch', 1, 'tsp'], ['white-rice', 150, 'g']]),
    instructions: 'Slice beef thinly and toss with cornstarch.\nStir-fry beef in hot oil 2 min, remove.\nStir-fry vegetables, ginger, and garlic; return beef with soy sauce. Serve with rice.',
  },
  {
    id: 'r-lentil-soup', emoji: '🍲', name: 'Red lentil soup', servings: 4, prepMinutes: 35,
    description: 'Warming, budget-friendly soup with cumin and lemon.',
    ingredients: ing([['lentils', 300, 'g'], ['onion', 1, 'piece'], ['carrot', 2, 'piece'], ['garlic', 2, 'clove'], ['chicken-stock', 1, 'l'], ['cumin', 2, 'tsp'], ['olive-oil', 2, 'tbsp'], ['lemon', 1, 'piece']]),
    instructions: 'Soften onion, carrot, and garlic in oil.\nAdd cumin, lentils, and stock; simmer 20 min.\nBlend partly and finish with lemon juice.',
  },
  {
    id: 'r-yogurt-parfait', emoji: '🍓', name: 'Yogurt parfait', servings: 1, prepMinutes: 5,
    description: 'Greek yogurt layered with granola and berries.',
    ingredients: ing([['greek-yogurt', 170, 'g'], ['granola', 40, 'g'], ['berries', 60, 'g'], ['honey', 1, 'tsp']]),
  },
  {
    id: 'r-hummus-snack', emoji: '🥕', name: 'Hummus and veggie sticks', servings: 1, prepMinutes: 5,
    description: 'Crunchy carrot and cucumber with hummus.',
    ingredients: ing([['hummus', 4, 'tbsp'], ['carrot', 1, 'piece'], ['cucumber', 0.5, 'piece']]),
  },
  {
    id: 'r-turkey-sandwich', emoji: '🥪', name: 'Turkey sandwich', servings: 1, prepMinutes: 5,
    description: 'Turkey, cheddar, lettuce, and tomato on toasted bread.',
    ingredients: ing([['bread', 2, 'slice'], ['turkey-slices', 4, 'slice'], ['cheddar', 30, 'g'], ['lettuce', 0.25, 'piece'], ['tomato', 0.5, 'piece'], ['mayonnaise', 1, 'tbsp']]),
  },
];
