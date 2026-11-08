// Name → icon + shelf guesses. Edit by hand, or with the tuning page (`npm run tune`),
// which rewrites this file (comments other than these headers aren't kept).
// How matching works: docs/icons-and-keywords.md. Rule order doesn't matter.
import type { KeywordRule } from './types'

export const KEYWORD_RULES: KeywordRule[] = [
  // dairy
  { shelf: "dairy", icon: "milk", keywords: ["milk", "oat milk", "almond milk", "soy milk", "soya milk"] },
  { shelf: "dairy", icon: "milk", keywords: ["cheese", "cheddar", "mozzarella", "parmesan", "feta", "halloumi", "brie", "paneer"] },
  { shelf: "dairy", icon: "milk", keywords: ["butter", "margarine"] },
  { shelf: "dairy", icon: "soup", keywords: ["yogurt", "yoghurt", "cream", "creme fraiche", "custard"] },

  // cold
  { shelf: "cold", icon: "egg", keywords: ["egg"] },
  { shelf: "cold", icon: "drumstick", keywords: ["chicken", "turkey"] },
  { shelf: "cold", icon: "beef", keywords: ["beef", "steak", "mince", "lamb", "pork", "burger"] },
  { shelf: "cold", icon: "ham", keywords: ["bacon", "ham", "sausage", "chorizo", "salami", "pepperoni"] },
  { shelf: "cold", icon: "fish", keywords: ["fish", "salmon", "cod", "haddock", "tuna steak"] },
  { shelf: "cold", icon: "shrimp", keywords: ["prawn", "shrimp"] },
  { shelf: "cold", icon: "soup", keywords: ["tofu", "hummus", "houmous"] },

  // frozen
  { shelf: "frozen", icon: "ice-cream", keywords: ["ice cream", "gelato"] },
  { shelf: "frozen", icon: "popsicle", keywords: ["ice lolly", "lolly", "ice pop"] },
  { shelf: "frozen", icon: "snowflake", keywords: ["frozen", "ice", "peas", "fish fingers", "oven chips", "nuggets"] },
  { shelf: "frozen", icon: "pizza", keywords: ["pizza"] },

  // spices
  { shelf: "spices", icon: "salt", keywords: ["salt", "sea salt", "salt and pepper", "pepper", "black pepper", "white pepper", "ground pepper"] },
  { shelf: "spices", icon: "spice-mill", keywords: ["peppercorns", "pepper mill", "peppermill", "salt mill", "grinder", "spice mill", "spice grinder"] },
  { shelf: "spices", icon: "flame", keywords: ["chilli", "chili", "chilli flakes", "paprika", "cayenne"] },
  { shelf: "spices", icon: "leaf", keywords: ["garlic powder", "onion powder", "cinnamon", "cumin", "turmeric", "curry powder", "garam masala", "oregano", "basil", "thyme", "rosemary", "parsley", "coriander", "spice", "mixed spice", "herb", "mixed herbs", "nutmeg", "ginger", "bay leaves", "stock cube", "stock", "gravy"] },

  // baking
  { shelf: "baking", icon: "wheat", keywords: ["flour", "self raising flour", "plain flour", "cornflour"] },
  { shelf: "baking", icon: "candy", keywords: ["sugar", "icing sugar", "brown sugar", "caster sugar"] },
  { shelf: "baking", icon: "cupcake", keywords: ["baking powder", "baking soda", "bicarb", "bicarbonate of soda", "yeast", "vanilla", "vanilla extract", "cocoa", "chocolate chips", "sprinkles", "food colouring"] },
  { shelf: "baking", icon: "amphora", keywords: ["honey", "syrup", "golden syrup", "maple syrup"] },

  // coffee
  { shelf: "coffee", icon: "coffee", keywords: ["coffee", "espresso", "coffee beans", "instant coffee", "hot chocolate"] },
  { shelf: "coffee", icon: "coffee", keywords: ["tea", "tea bags", "green tea", "peppermint tea", "matcha", "chai"] },
  { shelf: "coffee", icon: "milk", keywords: ["creamer", "coffee creamer"] },

  // cereals
  { shelf: "cereals", icon: "cereal-box", keywords: ["cereal", "cereal box", "cornflakes", "corn flakes", "granola", "muesli", "bran flakes", "weetabix", "shreddies", "cheerios", "rice krispies", "coco pops", "frosties"] },
  { shelf: "cereals", icon: "wheat", keywords: ["oats", "porridge", "porridge oats", "rolled oats"] },

  // grains
  { shelf: "grains", icon: "cooking-pot", keywords: ["pasta", "spaghetti", "penne", "fusilli", "macaroni", "lasagne", "noodle", "couscous", "quinoa"] },
  { shelf: "grains", icon: "cooking-pot", keywords: ["rice", "basmati", "risotto"] },
  { shelf: "grains", icon: "sandwich", keywords: ["bread", "loaf", "bagel", "wrap", "tortilla", "pitta", "naan", "crumpet", "garlic bread"] },
  { shelf: "grains", icon: "croissant", keywords: ["croissant", "pastry", "pain au chocolat"] },

  // canned
  { shelf: "canned", icon: "can", keywords: ["beans", "baked beans", "kidney beans", "black beans", "butter beans", "chickpea", "lentil", "tin", "tinned", "can of", "canned", "soup", "chopped tomatoes", "tinned tomatoes", "tuna", "sweetcorn", "coconut milk"] },
  { shelf: "canned", icon: "amphora", keywords: ["jam", "marmalade", "peanut butter", "nutella", "spread", "chocolate spread"] },

  // sauces
  { shelf: "sauces", icon: "droplet", keywords: ["oil", "olive oil", "vegetable oil", "sunflower oil", "olive"] },
  { shelf: "sauces", icon: "amphora", keywords: ["ketchup", "mayo", "mayonnaise", "mustard", "sauce", "vinegar", "soy", "sriracha", "pesto", "salsa", "dressing", "chutney", "relish"] },

  // snacks
  { shelf: "snacks", icon: "popcorn", keywords: ["crisps", "chips", "tortilla chips", "pringles"] },
  { shelf: "snacks", icon: "candy", keywords: ["chocolate", "chocolate bar"] },
  { shelf: "snacks", icon: "candy", keywords: ["sweets", "candy", "candy cane", "gummy"] },
  { shelf: "snacks", icon: "cookie", keywords: ["biscuit", "cookie", "digestives", "crackers"] },
  { shelf: "snacks", icon: "cake-slice", keywords: ["cake", "brownie", "muffin"] },
  { shelf: "snacks", icon: "popcorn", keywords: ["popcorn"] },
  { shelf: "snacks", icon: "nut", keywords: ["nuts", "almond", "peanut", "cashew", "pecan", "walnut", "pistachio", "hazelnut"] },

  // drinks
  { shelf: "drinks", icon: "cup-soda", keywords: ["juice", "orange juice", "apple juice", "smoothie", "squash", "cordial"] },
  { shelf: "drinks", icon: "beer", keywords: ["beer", "lager", "ale", "cider"] },
  { shelf: "drinks", icon: "wine", keywords: ["wine", "prosecco"] },
  { shelf: "drinks", icon: "martini", keywords: ["vodka", "gin", "rum", "whisky", "whiskey", "tequila"] },
  { shelf: "drinks", icon: "glass-water", keywords: ["water", "sparkling water"] },
  { shelf: "drinks", icon: "cup-soda", keywords: ["soda", "cola", "coke", "lemonade", "pop", "fizzy", "energy drink"] },

  // produce
  { shelf: "produce", icon: "apple", keywords: ["apple"] },
  { shelf: "produce", icon: "banana", keywords: ["banana"] },
  { shelf: "produce", icon: "citrus", keywords: ["lemon", "lime", "orange", "satsuma", "clementine", "grapefruit"] },
  { shelf: "produce", icon: "grape", keywords: ["grape"] },
  { shelf: "produce", icon: "avocado", keywords: ["avocado"] },
  { shelf: "produce", icon: "tomato", keywords: ["tomato", "cherry tomatoes", "vine tomatoes", "plum tomatoes"] },
  { shelf: "produce", icon: "cherry", keywords: ["berry", "strawberry", "blueberry", "raspberry", "cherry"] },
  { shelf: "produce", icon: "onion", keywords: ["onion", "red onion", "shallot"] },
  { shelf: "produce", icon: "leafy-green", keywords: ["spring onion", "leek", "celery"] },
  { shelf: "produce", icon: "garlic", keywords: ["garlic", "garlic bulb"] },
  { shelf: "produce", icon: "bean", keywords: ["potato", "sweet potato"] },
  { shelf: "produce", icon: "carrot", keywords: ["carrot", "parsnip"] },
  { shelf: "produce", icon: "broccoli", keywords: ["broccoli", "cauliflower"] },
  { shelf: "produce", icon: "bell-pepper", keywords: ["bell pepper", "peppers", "red pepper", "green pepper", "yellow pepper", "sweet pepper", "jalapeno"] },
  { shelf: "produce", icon: "sprout", keywords: ["mushroom", "aubergine", "eggplant", "courgette", "zucchini", "cucumber"] },
  { shelf: "produce", icon: "leafy-green", keywords: ["lettuce", "spinach", "salad", "kale", "cabbage", "rocket"] },

  // other
  { shelf: "other", icon: "spray-can", keywords: ["foil", "tin foil", "cling film", "cling", "bin bags", "sponge", "soap", "washing up liquid", "kitchen roll", "paper towel", "toilet roll", "bleach", "detergent"] },
]
