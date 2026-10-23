/**
 * Demo kitchens for trying the customer app with a realistic amount of data.
 *
 *   node scripts/seed-demo-kitchens.js            # (re)seed — removes old demo data first
 *   node scripts/seed-demo-kitchens.js --remove   # remove every demo kitchen
 *
 * Each kitchen is what a cook who registered, finished onboarding and was
 * approved by an admin looks like: an active `cook` user who can log in
 * (password below), a completed profile with hours, a default bank account,
 * and 10–12 menu items with photos, serving windows, variations and platter
 * contents. Photos are real food pictures from TheMealDB / TheCocktailDB,
 * downloaded into the uploads folder like any cook upload.
 *
 * Demo accounts are recognised by their @demo.hometiffin.pk email, and their
 * photos by the seed_demo_ filename prefix, so removal never touches real data.
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const pool = require("../config/db");

const DEMO_DOMAIN = "demo.hometiffin.pk";
const DEMO_PASSWORD = "Demo@1234";
const FILE_PREFIX = "seed_demo_";
const UPLOADS =
  process.env.STORAGE_ROOT || path.join(__dirname, "..", "uploads");

// ---------------------------------------------------------------- Menus
// [name, category, price, description, serves, spice, prepMinutes, imageKeyword,
//  extras?: { variations: [[name, price, serves]], contents: [[name, qty]] }]
const MENUS = {
  desi: [
    ["Chicken Karahi", "Karahi & Handi", 1450, "Tomato-and-green-chilli karahi finished with ginger and fresh coriander, cooked in a proper iron wok.", "2-3 people", 2, 35, "karahi|curry|chicken", { variations: [["Half", 1450, "2 people"], ["Full", 2700, "4-5 people"]] }],
    ["Mutton Karahi", "Karahi & Handi", 2400, "Bone-in mutton slow cooked with tomatoes, black pepper and desi ghee.", "2-3 people", 2, 50, "lamb|mutton|rogan", { variations: [["Half kg", 2400, "2-3 people"], ["1 kg", 4600, "5-6 people"]] }],
    ["Chicken Handi", "Karahi & Handi", 1350, "Creamy boneless handi with yoghurt, cream and a touch of butter.", "2 people", 1, 30, "butter chicken|korma|tikka masala", null],
    ["Aloo Gosht", "Curries & Salan", 950, "Home-style beef and potato salan, the way it's made on a Sunday.", "2 people", 2, 45, "beef|stew|madras", null],
    ["Chicken Qorma", "Curries & Salan", 1100, "Shadi-style qorma with fried onions, cardamom and kewra.", "2-3 people", 1, 40, "korma|curry", null],
    ["Nihari", "Curries & Salan", 1300, "Overnight beef shank nihari served with ginger, chillies and lemon.", "2 people", 3, 60, "beef|nihari|curry", { variations: [["Regular", 1300, "2 people"], ["Family", 2500, "4 people"]] }],
    ["Daal Mash", "Daal & Sabzi", 550, "Dry white lentils with a garlic and cumin tarka.", "2 people", 1, 25, "dal|lentil", null],
    ["Daal Chana", "Daal & Sabzi", 500, "Split chickpea daal with a smoky tarka.", "2 people", 1, 25, "dal|chickpea|lentil", null],
    ["Bhindi Masala", "Daal & Sabzi", 600, "Crisp okra with onions and tomatoes.", "2 people", 2, 25, "vegetable|okra|aloo", null],
    ["Aloo Palak", "Daal & Sabzi", 550, "Potatoes in garlicky spinach.", "2 people", 1, 25, "spinach|saag|palak", null],
    ["Tandoori Roti", "Roti & Naan", 30, "Fresh from the tandoor.", "1 person", 1, 10, "bread|naan|flatbread|chapati", { variations: [["Plain", 30, null], ["With butter", 50, null]] }],
    ["Garlic Naan", "Roti & Naan", 120, "Butter naan topped with garlic and coriander.", "1 person", 1, 12, "naan|bread|flatbread", null],
    ["Kheer", "Desserts & Sweets", 350, "Slow-cooked rice pudding with cardamom and pistachios.", "2 people", 1, 15, "rice pudding|kheer|pudding", null],
    ["Lunch Tiffin", "Tiffin & Meal Deals", 650, "A full home lunch — changes daily.", "1 person", 1, 20, "curry|dal|rice", { contents: [["Salan of the day", "1 bowl"], ["Daal", "1 bowl"], ["Rice", "1 plate"], ["Roti", "2"], ["Raita", "1 cup"]] }],
    ["Mint Raita", "Salads & Raita", 120, "Yoghurt with mint, cucumber and roasted cumin.", "2 people", 1, 5, "raita|yogurt|tzatziki|cucumber", null],
  ],
  bbq: [
    ["Chicken Tikka", "BBQ & Grill", 650, "Leg-and-thigh tikka marinated overnight and charcoal grilled.", "1 person", 2, 30, "tikka|tandoori|grill", { variations: [["Quarter", 650, "1 person"], ["Half", 1200, "2 people"]] }],
    ["Seekh Kebab", "BBQ & Grill", 900, "Beef seekh kebabs, six skewers, with chutney.", "2 people", 2, 25, "kebab|kofta|skewer", null],
    ["Malai Boti", "BBQ & Grill", 1100, "Boneless chicken in a cream-and-cheese marinade.", "2 people", 1, 30, "chicken|skewer|kebab", null],
    ["Reshmi Kebab", "BBQ & Grill", 950, "Silky minced chicken kebabs, mild.", "2 people", 1, 25, "kofta|kebab|meatball", null],
    ["Lamb Chops", "BBQ & Grill", 2200, "Spiced lamb chops grilled to order.", "2 people", 2, 35, "lamb|chops|grill", null],
    ["Fish Tikka", "BBQ & Grill", 1400, "River sole in a lemon-ajwain marinade.", "2 people", 2, 25, "fish|salmon|cod", null],
    ["BBQ Platter", "Tiffin & Meal Deals", 3200, "Something of everything for the table.", "4 people", 2, 45, "grill|kebab|tandoori|skewer", { contents: [["Chicken tikka", "2 pcs"], ["Seekh kebab", "4"], ["Malai boti", "8 pcs"], ["Naan", "4"], ["Raita & salad", "1 each"]] }],
    ["Chicken Shashlik", "Chinese", 1150, "Chicken, peppers and onions in a tangy sauce with rice.", "2 people", 1, 30, "shashlik|sweet and sour|pepper", null],
    ["Kachumber Salad", "Salads & Raita", 180, "Onion, tomato and cucumber with lemon.", "2 people", 1, 5, "salad|cucumber|tomato", null],
    ["Roghni Naan", "Roti & Naan", 90, "Soft naan brushed with egg and sesame.", "1 person", 1, 12, "naan|bread", null],
    ["Mint Lemonade", "Beverages", 250, "Fresh lemon, mint and crushed ice.", "1 person", 1, 5, "lemonade|mint|lime", null],
    ["Gulab Jamun", "Desserts & Sweets", 300, "Four warm jamun in rose syrup.", "2 people", 1, 10, "dessert|doughnut|ball", null],
  ],
  biryani: [
    ["Chicken Biryani", "Biryani & Pulao", 650, "Karachi-style biryani with aloo and plum.", "1-2 people", 2, 40, "biryani", { variations: [["Single", 650, "1 person"], ["Half kg", 1100, "2-3 people"], ["1 kg", 2100, "5 people"]] }],
    ["Mutton Biryani", "Biryani & Pulao", 950, "Tender mutton layered with saffron rice.", "1-2 people", 2, 50, "biryani|lamb", null],
    ["Beef Pulao", "Biryani & Pulao", 750, "Yakhni pulao with tender beef and whole spices.", "1-2 people", 1, 45, "pilaf|pulao|rice", null],
    ["Chicken Pulao", "Biryani & Pulao", 600, "Mild yakhni pulao with chicken.", "1-2 people", 1, 40, "pilaf|rice|chicken", null],
    ["Sindhi Biryani", "Biryani & Pulao", 700, "Extra spicy with green chillies and dried plums.", "1-2 people", 3, 45, "biryani|rice", null],
    ["Zarda", "Desserts & Sweets", 350, "Sweet saffron rice with nuts and murabba.", "2 people", 1, 25, "rice|pudding|sweet", null],
    ["Shami Kebab", "Soups & Starters", 400, "Four lentil-and-beef shami kebabs.", "2 people", 1, 20, "kebab|patty|kofta", null],
    ["Boiled Egg Raita", "Salads & Raita", 150, "Classic raita with boiled egg.", "2 people", 1, 5, "raita|yogurt|egg", null],
    ["Biryani Deal", "Tiffin & Meal Deals", 1500, "Biryani for the family with sides.", "3-4 people", 2, 45, "biryani|rice", { contents: [["Chicken biryani", "1 kg"], ["Raita", "2 cups"], ["Salad", "1 bowl"], ["Soft drink", "1.5 L"]] }],
    ["Doodh Patti", "Beverages", 120, "Strong milk tea.", "1 person", 1, 8, "tea|chai|milk", null],
    ["Shahi Tukray", "Desserts & Sweets", 450, "Fried bread in rabri with pistachios.", "2 people", 1, 15, "bread pudding|toast|dessert", null],
    ["Kabuli Pulao", "Biryani & Pulao", 850, "Afghan pulao with carrots and raisins.", "2 people", 1, 50, "pilaf|lamb|rice", null],
  ],
  chinese: [
    ["Chicken Manchurian", "Chinese", 950, "Chicken in a tangy garlic-soy gravy with egg fried rice.", "2 people", 2, 25, "manchurian|chicken|sweet and sour", null],
    ["Chicken Chow Mein", "Chinese", 850, "Wok-tossed noodles with chicken and vegetables.", "2 people", 1, 20, "chow mein|noodle|lo mein", null],
    ["Egg Fried Rice", "Chinese", 600, "Fluffy fried rice with egg and spring onions.", "2 people", 1, 15, "fried rice|egg|rice", null],
    ["Kung Pao Chicken", "Chinese", 1050, "Spicy chicken with peanuts and dried chillies.", "2 people", 3, 25, "kung pao|chicken", null],
    ["Sweet & Sour Chicken", "Chinese", 950, "Crispy chicken in a bright sweet and sour sauce.", "2 people", 1, 25, "sweet and sour", null],
    ["Beef Chilli Dry", "Chinese", 1150, "Strips of beef with capsicum and green chilli.", "2 people", 3, 25, "beef|stir fry|szechuan", null],
    ["Hot & Sour Soup", "Soups & Starters", 550, "Peppery soup with chicken and egg.", "2 people", 2, 15, "soup|hot and sour|wonton", { variations: [["Single", 300, "1 person"], ["Family bowl", 550, "3-4 people"]] }],
    ["Chicken Corn Soup", "Soups & Starters", 500, "Silky chicken and sweetcorn soup.", "2-3 people", 1, 15, "soup|corn|chicken", null],
    ["Spring Rolls", "Soups & Starters", 450, "Six crisp vegetable spring rolls.", "2 people", 1, 15, "spring roll|roll|dumpling", null],
    ["Chicken Dumplings", "Soups & Starters", 650, "Eight steamed dumplings with chilli oil.", "2 people", 2, 20, "dumpling|wonton|gyoza", null],
    ["Chinese Platter", "Tiffin & Meal Deals", 2400, "A full Chinese spread.", "4 people", 2, 35, "chinese|noodle|fried rice", { contents: [["Manchurian", "1 portion"], ["Chow mein", "1 portion"], ["Fried rice", "1 portion"], ["Spring rolls", "6"]] }],
    ["Fresh Lime", "Beverages", 200, "Sweet or salted lime soda.", "1 person", 1, 5, "lime|lemonade|soda", null],
  ],
  breakfast: [
    ["Halwa Puri", "Breakfast & Nashta", 450, "Two puris, suji halwa, chana and achaar.", "1 person", 1, 20, "breakfast|bread|puri|fried", { contents: [["Puri", "2"], ["Suji halwa", "1 bowl"], ["Chana", "1 bowl"], ["Achaar", "1 spoon"]] }],
    ["Aloo Paratha", "Breakfast & Nashta", 250, "Stuffed paratha with butter and yoghurt.", "1 person", 1, 15, "paratha|flatbread|bread", null],
    ["Anda Paratha", "Breakfast & Nashta", 280, "Egg-in-paratha, crisp outside.", "1 person", 1, 15, "omelette|egg|paratha", null],
    ["Masala Omelette", "Breakfast & Nashta", 220, "Two-egg omelette with onion, tomato and chilli.", "1 person", 2, 10, "omelette|egg", null],
    ["Chana Chaat", "Soups & Starters", 300, "Chickpeas, onions, chutney and chaat masala.", "1-2 people", 2, 10, "chickpea|chaat|salad", null],
    ["Lassi", "Beverages", 220, "Sweet or salted, thick and cold.", "1 person", 1, 5, "lassi|smoothie|yogurt|shake", { variations: [["Sweet", 220, null], ["Salted", 200, null], ["Mango", 300, null]] }],
    ["Doodh Patti", "Beverages", 120, "Strong milk tea.", "1 person", 1, 8, "tea|chai|milk", null],
    ["Nashta Deal", "Tiffin & Meal Deals", 900, "Breakfast for two.", "2 people", 1, 20, "breakfast|egg|bread", { contents: [["Aloo paratha", "2"], ["Omelette", "2"], ["Chai", "2 cups"]] }],
    ["French Toast", "Breakfast & Nashta", 350, "Cinnamon french toast with honey.", "1 person", 1, 12, "french toast|toast|pancake", null],
    ["Pancakes", "Breakfast & Nashta", 450, "Three fluffy pancakes with maple syrup.", "1 person", 1, 15, "pancake", null],
    ["Fruit Chaat", "Salads & Raita", 350, "Seasonal fruit with chaat masala.", "2 people", 1, 10, "fruit|salad", null],
    ["Shakshuka", "Breakfast & Nashta", 550, "Eggs poached in spiced tomato sauce.", "1-2 people", 2, 20, "shakshuka|egg|tomato", null],
  ],
  fastfood: [
    ["Zinger Burger", "Fast Food", 650, "Crispy fried chicken fillet, lettuce and mayo.", "1 person", 2, 15, "burger|chicken", { variations: [["Single", 650, null], ["Double", 950, null]] }],
    ["Beef Smash Burger", "Fast Food", 850, "Double smashed patty with cheese.", "1 person", 1, 15, "burger|beef|cheese", null],
    ["Chicken Shawarma", "Fast Food", 400, "Garlic sauce, pickles, wrapped in pita.", "1 person", 2, 10, "shawarma|wrap|pita|gyro", null],
    ["Club Sandwich", "Fast Food", 600, "Triple-decker with chicken, egg and fries.", "1 person", 1, 15, "sandwich|club|toast", null],
    ["Loaded Fries", "Fast Food", 550, "Fries with cheese sauce and jalapeños.", "1-2 people", 2, 12, "fries|chips|potato", null],
    ["Chicken Wings", "Fast Food", 750, "Ten wings in hot sauce.", "2 people", 3, 20, "wings|buffalo|chicken", null],
    ["Margherita Pizza", "Fast Food", 1100, "Home-baked pizza with fresh mozzarella.", "2 people", 1, 25, "pizza", { variations: [["Small", 700, "1 person"], ["Medium", 1100, "2 people"], ["Large", 1600, "3-4 people"]] }],
    ["Chicken Tikka Pizza", "Fast Food", 1250, "Desi tikka topping, onions and green chilli.", "2 people", 2, 25, "pizza|chicken", null],
    ["Mac & Cheese", "Fast Food", 650, "Baked with a crispy cheese top.", "1-2 people", 1, 20, "macaroni|cheese|pasta", null],
    ["Chocolate Shake", "Beverages", 450, "Thick chocolate milkshake.", "1 person", 1, 5, "chocolate|shake|milk", null],
    ["Burger Deal", "Tiffin & Meal Deals", 1100, "A burger meal for one.", "1 person", 2, 15, "burger|fries", { contents: [["Zinger burger", "1"], ["Fries", "1 regular"], ["Soft drink", "1"]] }],
    ["Brownie", "Desserts & Sweets", 300, "Fudgy chocolate brownie.", "1 person", 1, 5, "brownie|chocolate", null],
  ],
  desserts: [
    ["Chocolate Fudge Cake", "Desserts & Sweets", 1800, "Two-pound fudge cake, made to order.", "6-8 people", 1, 90, "chocolate cake|cake|chocolate", { variations: [["1 lb", 1000, "3-4 people"], ["2 lb", 1800, "6-8 people"]] }],
    ["Gajar Halwa", "Desserts & Sweets", 650, "Winter carrot halwa with khoya.", "2-3 people", 1, 20, "carrot|halwa|cake", null],
    ["Kheer", "Desserts & Sweets", 350, "Slow-cooked rice pudding with cardamom.", "2 people", 1, 15, "rice pudding|pudding", null],
    ["Trifle", "Desserts & Sweets", 700, "Custard, jelly, sponge and cream.", "4 people", 1, 20, "trifle|custard", null],
    ["Lab-e-Shireen", "Desserts & Sweets", 650, "Custard with vermicelli, jelly and fruit.", "4 people", 1, 20, "custard|pudding|fruit", null],
    ["Cheesecake", "Desserts & Sweets", 1600, "New York baked cheesecake.", "6 people", 1, 120, "cheesecake", { variations: [["Slice", 450, "1 person"], ["Whole", 1600, "6 people"]] }],
    ["Brownies Box", "Desserts & Sweets", 1200, "Six fudgy brownies.", "3-6 people", 1, 30, "brownie|chocolate", null],
    ["Banana Bread", "Desserts & Sweets", 800, "Moist loaf with walnuts.", "4 people", 1, 60, "banana|bread|loaf", null],
    ["Apple Pie", "Desserts & Sweets", 1100, "Lattice-top pie with cinnamon apples.", "6 people", 1, 60, "apple|pie|crumble", null],
    ["Tiramisu", "Desserts & Sweets", 1300, "Coffee-soaked layers with mascarpone.", "4-6 people", 1, 30, "tiramisu|coffee", null],
    ["Cold Coffee", "Beverages", 400, "Blended iced coffee.", "1 person", 1, 5, "coffee|frappe|iced", null],
    ["Dessert Box", "Tiffin & Meal Deals", 1500, "A taste of everything.", "3-4 people", 1, 30, "dessert|cake|pudding", { contents: [["Brownie", "2"], ["Cheesecake slice", "1"], ["Trifle cup", "2"], ["Kheer cup", "2"]] }],
  ],
  healthy: [
    ["Grilled Chicken Salad", "Healthy & Diet", 850, "Grilled breast, greens and a lemon vinaigrette.", "1 person", 1, 15, "salad|chicken|grilled", null],
    ["Quinoa Bowl", "Healthy & Diet", 950, "Quinoa, chickpeas, roasted veg and tahini.", "1 person", 1, 15, "quinoa|bowl|chickpea", null],
    ["Grilled Fish & Veg", "Healthy & Diet", 1350, "Lemon-herb fish with steamed vegetables.", "1 person", 1, 20, "fish|salmon|grilled", null],
    ["Daal Soup", "Soups & Starters", 400, "Light lentil soup with lemon.", "1 person", 1, 15, "lentil soup|soup|dal", null],
    ["Chicken Broth", "Soups & Starters", 450, "Clear yakhni with vegetables.", "1 person", 1, 20, "soup|broth|chicken", null],
    ["Brown Rice & Daal", "Healthy & Diet", 550, "Brown rice with moong daal.", "1 person", 1, 20, "dal|lentil|rice", null],
    ["Greek Salad", "Salads & Raita", 650, "Tomato, cucumber, olives and feta.", "1-2 people", 1, 10, "greek salad|salad|feta", null],
    ["Avocado Toast", "Breakfast & Nashta", 700, "Sourdough, smashed avocado and eggs.", "1 person", 1, 10, "avocado|toast|egg", null],
    ["Oats Porridge", "Breakfast & Nashta", 400, "Oats with honey, banana and nuts.", "1 person", 1, 10, "porridge|oat|granola", null],
    ["Green Smoothie", "Beverages", 450, "Spinach, apple, banana and ginger.", "1 person", 1, 5, "smoothie|green|juice", null],
    ["Diet Tiffin", "Tiffin & Meal Deals", 850, "A balanced 500-calorie lunch.", "1 person", 1, 20, "salad|chicken|healthy", { contents: [["Grilled chicken", "150 g"], ["Brown rice", "1 cup"], ["Salad", "1 bowl"], ["Yoghurt", "1 cup"]] }],
    ["Chicken Wrap", "Healthy & Diet", 650, "Whole-wheat wrap with grilled chicken.", "1 person", 1, 12, "wrap|tortilla|chicken", null],
  ],
};

// ---------------------------------------------------------------- Kitchens
// mealType ids are tblmealtypes rows (1 Desi, 2 BBQ, 3 Biryani, 4 Fast food,
// 5 Chinese, 6 Healthy, 7 Breakfast, 8 Desserts).
const KITCHENS = [
  { kitchen: "Ammi Jaan Ka Dastarkhwan", cook: "Nasreen Akhtar", slug: "nasreen", area: "G-11/3", city: "Islamabad", mealType: 1, menus: ["desi"], open: true, hours: ["12:00", "22:00"], rating: 4.8, reviews: 214 },
  { kitchen: "Lahori Tikka House", cook: "Imran Butt", slug: "imran", area: "Bahria Town Phase 4", city: "Rawalpindi", mealType: 2, menus: ["bbq"], open: true, hours: ["17:00", "23:30"], rating: 4.6, reviews: 152 },
  { kitchen: "Biryani by Saima", cook: "Saima Rizwan", slug: "saima", area: "F-10 Markaz", city: "Islamabad", mealType: 3, menus: ["biryani"], open: true, hours: ["11:30", "22:00"], rating: 4.7, reviews: 389 },
  { kitchen: "Dragon Wok Home Kitchen", cook: "Ali Hassan", slug: "alihassan", area: "Satellite Town", city: "Rawalpindi", mealType: 5, menus: ["chinese"], open: false, hours: ["13:00", "23:00"], rating: 4.3, reviews: 67 },
  { kitchen: "Subah Ka Nashta", cook: "Rukhsana Bibi", slug: "rukhsana", area: "I-8/2", city: "Islamabad", mealType: 7, menus: ["breakfast"], open: true, hours: ["07:00", "12:30"], rating: 4.9, reviews: 98, days: "fri,sat,sun" },
  { kitchen: "Burger Lab at Home", cook: "Hamza Qureshi", slug: "hamza", area: "DHA Phase 2", city: "Islamabad", mealType: 4, menus: ["fastfood"], open: true, hours: ["16:00", "02:00"], rating: 4.4, reviews: 176 },
  { kitchen: "Sweet Tooth by Mehwish", cook: "Mehwish Tariq", slug: "mehwish", area: "E-11/4", city: "Islamabad", mealType: 8, menus: ["desserts"], open: true, hours: ["11:00", "21:00"], rating: 4.9, reviews: 241 },
  { kitchen: "FitBite Kitchen", cook: "Sara Malik", slug: "sara", area: "Blue Area", city: "Islamabad", mealType: 6, menus: ["healthy"], open: false, hours: ["09:00", "18:00"], rating: 4.5, reviews: 54, days: "mon,tue,wed,thu,fri" },
  { kitchen: "Peshawari Karahi Ghar", cook: "Gul Khan", slug: "gulkhan", area: "Saddar", city: "Rawalpindi", mealType: 1, menus: ["desi", "bbq"], open: true, hours: ["12:00", "23:00"], rating: 4.6, reviews: 312 },
  { kitchen: "Khala's Tiffin Service", cook: "Shaheen Begum", slug: "shaheen", area: "G-9/1", city: "Islamabad", mealType: 1, menus: ["desi"], open: true, hours: ["11:00", "15:30"], rating: 4.7, reviews: 133, days: "mon,tue,wed,thu,fri,sat" },
  { kitchen: "Karachi Biryani Centre", cook: "Farhan Siddiqui", slug: "farhan", area: "Commercial Market", city: "Rawalpindi", mealType: 3, menus: ["biryani", "bbq"], open: false, hours: ["12:00", "22:30"], rating: 4.2, reviews: 88 },
  { kitchen: "The Noodle Nook", cook: "Ayesha Chaudhry", slug: "ayesha", area: "PWD Housing", city: "Islamabad", mealType: 5, menus: ["chinese", "fastfood"], open: true, hours: ["13:00", "23:00"], rating: 0, reviews: 0 },
  { kitchen: "Bake & Brew", cook: "Zara Ahmed", slug: "zara", area: "F-7 Jinnah Super", city: "Islamabad", mealType: 8, menus: ["desserts", "breakfast"], open: true, hours: ["09:00", "21:00"], rating: 4.8, reviews: 47 },
  { kitchen: "Desi Fusion Kitchen", cook: "Usman Javed", slug: "usman", area: "Gulberg Greens", city: "Islamabad", mealType: 1, menus: ["desi", "healthy"], open: false, hours: ["12:00", "22:00"], rating: 4.1, reviews: 29 },
];

// ---------------------------------------------------------------- Photos
const API = "https://www.themealdb.com/api/json/v1/1";
const MEAL_POOLS = [
  "a=India", "a=Chinese", "c=Dessert", "c=Breakfast", "c=Vegetarian",
  "c=Starter", "c=Side", "c=Lamb", "c=Chicken", "c=Beef", "c=Vegan",
  "c=Seafood", "c=Pasta", "c=Miscellaneous",
];

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
};

/** Every photo we can draw from, as { name, url }. */
const loadPhotoPool = async () => {
  const seen = new Map();
  for (const filter of MEAL_POOLS) {
    const data = await getJson(`${API}/filter.php?${filter}`);
    for (const m of data.meals || []) seen.set(m.strMealThumb, m.strMeal);
  }
  const drinks = await getJson(
    "https://www.thecocktaildb.com/api/json/v1/1/filter.php?a=Non_Alcoholic"
  );
  for (const d of drinks.drinks || []) {
    seen.set(d.strDrinkThumb, `${d.strDrink} drink tea coffee lemonade shake smoothie juice soda`);
  }
  return [...seen.entries()].map(([url, name]) => ({ url, name: name.toLowerCase() }));
};

const useCount = new Map();
/** Photos whose name matches a keyword, least-used first, so menus vary. */
const pickPhotos = (pool, keywords, count, fallbackKeywords) => {
  const pattern = new RegExp(keywords, "i");
  let matches = pool.filter((p) => pattern.test(p.name));
  if (matches.length < count && fallbackKeywords) {
    const fallback = new RegExp(fallbackKeywords, "i");
    matches = matches.concat(pool.filter((p) => fallback.test(p.name) && !matches.includes(p)));
  }
  if (!matches.length) matches = pool;
  return matches
    .map((p) => ({ p, n: (useCount.get(p.url) || 0) + Math.random() }))
    .sort((a, b) => a.n - b.n)
    .slice(0, count)
    .map(({ p }) => {
      useCount.set(p.url, (useCount.get(p.url) || 0) + 1);
      return p.url;
    });
};

const downloaded = new Map();
/** Saves a photo into uploads once and returns its /uploads path. */
const download = async (url) => {
  if (downloaded.has(url)) return downloaded.get(url);
  const ext = path.extname(new URL(url).pathname) || ".jpg";
  const base = path.basename(new URL(url).pathname, ext).replace(/[^a-z0-9_-]/gi, "");
  const file = `${FILE_PREFIX}${base}${ext}`;
  const target = path.join(UPLOADS, file);
  if (!fs.existsSync(target)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} downloading ${url}`);
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  }
  const stored = `/uploads/${file}`;
  downloaded.set(url, stored);
  return stored;
};

// ---------------------------------------------------------------- Helpers
const CATEGORY_FALLBACK = {
  "Beverages": "drink", "Desserts & Sweets": "cake|pudding|pie|tart",
  "Breakfast & Nashta": "breakfast|egg|pancake", "Chinese": "chinese|noodle|rice",
  "Fast Food": "burger|sandwich|fries|pizza", "Roti & Naan": "bread",
  "Salads & Raita": "salad", "Soups & Starters": "soup|starter",
  "Healthy & Diet": "salad|vegan|grilled",
};

const shuffle = (list) => list
  .map((v) => ({ v, r: Math.random() }))
  .sort((a, b) => a.r - b.r)
  .map(({ v }) => v);

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toTime = (mins) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
};

/**
 * Serving windows inside the kitchen's hours, as the cook app requires. Long
 * days get a lunch and a dinner window; short ones a single window. Kitchens
 * open past midnight serve until their closing time (stored as such).
 */
const windowsFor = ([open, close]) => {
  const start = toMinutes(open);
  let end = toMinutes(close);
  if (end <= start) end = 23 * 60 + 59; // overnight: serve until midnight
  if (end - start >= 8 * 60) {
    return [
      [toTime(start), toTime(start + 3 * 60 + 30)],
      [toTime(end - 3 * 60), toTime(end)],
    ];
  }
  return [[toTime(start), toTime(end)]];
};

/** Prices vary a little between kitchens, rounded like a real menu. */
const nudge = (price) => {
  if (price < 100) return price;
  const factor = 0.9 + Math.random() * 0.25;
  return Math.max(50, Math.round((price * factor) / 10) * 10);
};

const cnic = (i) => `3520${i % 10}-${String(1234567 + i * 7919).slice(0, 7)}-${i % 9}`;
const iban = (i) => `PK${String(36 + i).padStart(2, "0")}MEZN${String(100000000000 + i * 937531).padStart(16, "0")}`;
const phone = (i) => `0399${String(1000000 + i * 1319).slice(0, 7)}`;

// ---------------------------------------------------------------- Remove
const removeDemo = async (conn, { files: removeFiles }) => {
  const [cooks] = await conn.query(
    "SELECT id FROM tblusers WHERE email LIKE ? AND role = 'cook'",
    [`%@${DEMO_DOMAIN}`]
  );
  const ids = cooks.map((c) => c.id);
  if (ids.length) {
    // Orders do not cascade from users; anything ordered from a demo kitchen
    // is test data too.
    const [orders] = await conn.query("SELECT id FROM tblorders WHERE cook_id IN (?)", [ids]);
    if (orders.length) {
      const orderIds = orders.map((o) => o.id);
      await conn.query("DELETE FROM tblreviews WHERE order_id IN (?)", [orderIds]);
      await conn.query("DELETE FROM tblorderitems WHERE order_id IN (?)", [orderIds]);
      await conn.query("DELETE FROM tblorders WHERE id IN (?)", [orderIds]);
    }
    // Profile, bank accounts, dishes and everything under them cascade.
    await conn.query("DELETE FROM tblusers WHERE id IN (?)", [ids]);
  }
  // A re-seed keeps the photos and reuses them, so a failed run that rolls
  // back never leaves dishes pointing at deleted files.
  let files = 0;
  if (removeFiles && fs.existsSync(UPLOADS)) {
    for (const file of fs.readdirSync(UPLOADS)) {
      if (file.startsWith(FILE_PREFIX)) {
        fs.unlinkSync(path.join(UPLOADS, file));
        files += 1;
      }
    }
  }
  return { cooks: ids.length, files };
};

// ---------------------------------------------------------------- Seed
const seed = async (conn) => {
  const [categories] = await conn.query("SELECT id, name FROM tbldishcategories");
  const categoryId = new Map(categories.map((c) => [c.name, c.id]));

  console.log("Fetching food photos…");
  const pool = await loadPhotoPool();
  console.log(`  ${pool.length} photos to choose from`);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let dishTotal = 0;

  for (const [i, k] of KITCHENS.entries()) {
    const email = `${k.slug}@${DEMO_DOMAIN}`;
    const [user] = await conn.query(
      `INSERT INTO tblusers (name, email, email_verified_at, phone, password, auth_provider, role, status)
       VALUES (?, ?, NOW(), ?, ?, 'password', 'cook', 'active')`,
      [k.cook, email, phone(i), hash]
    );
    const cookId = user.insertId;

    // Kitchen photos and the menu picture, like the onboarding uploads.
    const kitchenPhotos = [];
    for (const url of pickPhotos(pool, MENUS[k.menus[0]].map((d) => d[7]).join("|"), 2)) {
      kitchenPhotos.push(await download(url));
    }
    const menuPicture = path.basename(kitchenPhotos[0]); // stored bare, as onboarding does
    const holder = k.cook;
    const bank = ["Meezan Bank", "HBL", "UBL", "Bank Alfalah", "MCB"][i % 5];

    await conn.query(
      `INSERT INTO tblcookprofiles
        (user_id, onboarding_step, onboarding_completed_at, kitchen_name, city, area, bio,
         rating, total_reviews, is_kitchen_open, kitchen_photos, approved_at, meal_type_id,
         address_street, address_house, address_state, address_postal_code,
         is_tax_registered, cnic_number, bank_account_holder, bank_name, bank_iban,
         billing_same_as_business, bank_proof, menu_picture,
         contract_status, documents_status, profile_status, activation_status,
         operating_days, opening_time, closing_time, daily_capacity)
       VALUES (?, 5, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?,
               'completed', 'approved', 'completed', 'active', ?, ?, ?, ?)`,
      [
        cookId, k.kitchen, k.city, k.area,
        `Home-cooked food from ${k.cook.split(" ")[0]}'s kitchen in ${k.area}. Fresh every day, no preservatives.`,
        k.rating, k.reviews, k.open ? 1 : 0, JSON.stringify(kitchenPhotos), k.mealType,
        `Street ${10 + i}`, `House ${100 + i * 7}`, k.city === "Islamabad" ? "ICT" : "Punjab",
        k.city === "Islamabad" ? "44000" : "46000",
        cnic(i), holder, bank, iban(i), menuPicture, menuPicture,
        k.days || null, `${k.hours[0]}:00`, `${k.hours[1]}:00`, 30 + (i % 4) * 10,
      ]
    );

    await conn.query(
      `INSERT INTO tblcookbankaccounts (cook_id, bank_name, account_title, account_number, iban, is_default)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [cookId, bank, holder, iban(i), iban(i)]
    );

    // 10–12 items, drawn from the kitchen's menus without repeats.
    const wanted = 10 + (i % 3);
    const items = [];
    const names = new Set();
    for (const dish of shuffle(k.menus.flatMap((m) => MENUS[m]))) {
      if (items.length >= wanted) break;
      if (names.has(dish[0])) continue;
      names.add(dish[0]);
      items.push(dish);
    }

    const windows = windowsFor(k.hours);
    for (const [j, d] of items.entries()) {
      const [name, category, basePrice, description, serves, spice, prep, keywords, extras] = d;
      const variations = extras?.variations?.map(([n, p, s]) => [n, nudge(p), s]) || [];
      // The base price is the cheapest option, as the cook app saves it.
      const price = variations.length ? Math.min(...variations.map((v) => v[1])) : nudge(basePrice);
      const photos = [];
      for (const url of pickPhotos(pool, keywords, 1 + (j % 3), CATEGORY_FALLBACK[category])) {
        photos.push(await download(url));
      }

      const [dish] = await conn.query(
        `INSERT INTO tbldishes
          (cook_id, name, description, category, category_id, price, serves, spice_level,
           prep_time_minutes, available_days, is_available, is_hidden, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          cookId, name, description, category, categoryId.get(category) || null, price,
          variations.length ? null : serves, spice, prep, k.days || null,
          // One sold-out item now and then, like a real menu.
          j === 7 && i % 4 === 0 ? 0 : 1,
          photos[0],
        ]
      );
      const dishId = dish.insertId;

      for (const [s, image] of photos.entries()) {
        await conn.query(
          "INSERT INTO tbldishimages (dish_id, image, sort_order) VALUES (?, ?, ?)",
          [dishId, image, s]
        );
      }
      for (const [s, [vName, vPrice, vServes]] of variations.entries()) {
        await conn.query(
          "INSERT INTO tbldishvariations (dish_id, name, price, serves, sort_order) VALUES (?, ?, ?, ?, ?)",
          [dishId, vName, vPrice, vServes, s]
        );
      }
      for (const [s, [from, to]] of windows.entries()) {
        await conn.query(
          "INSERT INTO tbldishavailability (dish_id, available_from, available_to, sort_order) VALUES (?, ?, ?, ?)",
          [dishId, from, to, s]
        );
      }
      for (const [s, [cName, qty]] of (extras?.contents || []).entries()) {
        await conn.query(
          "INSERT INTO tbldishcontents (dish_id, name, quantity, sort_order) VALUES (?, ?, ?, ?)",
          [dishId, cName, qty, s]
        );
      }
      dishTotal += 1;
    }
    console.log(`  ${k.open ? "OPEN  " : "closed"} ${k.kitchen.padEnd(28)} ${items.length} items   ${email}`);
  }
  return { cooks: KITCHENS.length, dishes: dishTotal, photos: downloaded.size };
};

(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const removeOnly = process.argv.includes("--remove");
    const removed = await removeDemo(conn, { files: removeOnly });
    if (removed.cooks) console.log(`Removed ${removed.cooks} old demo kitchens and ${removed.files} photos.`);
    if (!removeOnly) {
      const result = await seed(conn);
      console.log(
        `\nSeeded ${result.cooks} kitchens, ${result.dishes} menu items, ${result.photos} photos.` +
          `\nLog in to the cook app as any of them with password ${DEMO_PASSWORD}.`
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    console.error("Seeding failed — nothing was saved:", error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
})();
