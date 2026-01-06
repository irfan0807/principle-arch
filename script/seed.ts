import "dotenv/config";
import { db } from "../server/db";
import { restaurants, menuCategories, menuItems, users, deliveryPartners } from "../shared/schema";
import { nanoid } from "nanoid";

// Test users for different roles (use phone OTP login with these numbers)
const testUsers = [
  // Admin
  { id: "admin_001", phone: "1111111111", firstName: "Admin", lastName: "User", role: "admin" as const },
  
  // Customers
  { id: "customer_001", phone: "2222222221", firstName: "John", lastName: "Customer", role: "customer" as const },
  { id: "customer_002", phone: "2222222222", firstName: "Jane", lastName: "Doe", role: "customer" as const },
  
  // Delivery Partners (riders)
  { id: "rider_001", phone: "3333333331", firstName: "Mike", lastName: "Rider", role: "delivery_partner" as const },
  { id: "rider_002", phone: "3333333332", firstName: "Sarah", lastName: "Speed", role: "delivery_partner" as const },
];

// Use static owner IDs so they match across seed runs
const ownerIds = [
  "owner_001", "owner_002", "owner_003", "owner_004",
  "owner_005", "owner_006", "owner_007", "owner_008"
];

const sampleRestaurants = [
  {
    id: "rest_001",
    ownerId: ownerIds[0],
    name: "Bella Italia",
    description: "Authentic Italian cuisine with handmade pasta and wood-fired pizzas. Family recipes passed down for generations.",
    cuisine: "Italian",
    address: "123 Main Street",
    city: "New York",
    phone: "+1-555-0101",
    email: "info@bellaitalia.com",
    imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    rating: "4.7",
    deliveryTime: 35,
    minimumOrder: "15.00",
    deliveryFee: "3.99",
    isActive: true,
    openingHours: "11:00 AM - 10:00 PM",
  },
  {
    id: "rest_002",
    ownerId: ownerIds[1],
    name: "Spice Garden",
    description: "Experience the rich flavors of India with our traditional curries, biryanis, and tandoori specialties.",
    cuisine: "Indian",
    address: "456 Oak Avenue",
    city: "New York",
    phone: "+1-555-0102",
    email: "hello@spicegarden.com",
    imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
    rating: "4.5",
    deliveryTime: 40,
    minimumOrder: "20.00",
    deliveryFee: "2.99",
    isActive: true,
    openingHours: "12:00 PM - 11:00 PM",
  },
  {
    id: "rest_003",
    ownerId: ownerIds[2],
    name: "Dragon Palace",
    description: "Traditional Chinese dishes from Sichuan, Cantonese, and Hunan cuisines. Dim sum available on weekends.",
    cuisine: "Chinese",
    address: "789 Elm Street",
    city: "New York",
    phone: "+1-555-0103",
    email: "order@dragonpalace.com",
    imageUrl: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800",
    rating: "4.3",
    deliveryTime: 30,
    minimumOrder: "18.00",
    deliveryFee: "3.49",
    isActive: true,
    openingHours: "11:30 AM - 10:30 PM",
  },
  {
    id: "rest_004",
    ownerId: ownerIds[3],
    name: "Sakura Sushi",
    description: "Fresh sushi, sashimi, and Japanese cuisine prepared by master chefs. Omakase available.",
    cuisine: "Japanese",
    address: "321 Cherry Lane",
    city: "New York",
    phone: "+1-555-0104",
    email: "reserve@sakurasushi.com",
    imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
    rating: "4.8",
    deliveryTime: 45,
    minimumOrder: "25.00",
    deliveryFee: "4.99",
    isActive: true,
    openingHours: "12:00 PM - 10:00 PM",
  },
  {
    id: "rest_005",
    ownerId: ownerIds[4],
    name: "Taco Fiesta",
    description: "Authentic Mexican street food with fresh ingredients. Try our famous carnitas and al pastor tacos!",
    cuisine: "Mexican",
    address: "567 Sunset Blvd",
    city: "New York",
    phone: "+1-555-0105",
    email: "hola@tacofiesta.com",
    imageUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800",
    rating: "4.4",
    deliveryTime: 25,
    minimumOrder: "12.00",
    deliveryFee: "2.49",
    isActive: true,
    openingHours: "10:00 AM - 11:00 PM",
  },
  {
    id: "rest_006",
    ownerId: ownerIds[5],
    name: "Thai Orchid",
    description: "Savor the balance of sweet, sour, salty, and spicy in our traditional Thai dishes.",
    cuisine: "Thai",
    address: "890 Bamboo Road",
    city: "New York",
    phone: "+1-555-0106",
    email: "info@thaiorchid.com",
    imageUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800",
    rating: "4.6",
    deliveryTime: 35,
    minimumOrder: "15.00",
    deliveryFee: "3.49",
    isActive: true,
    openingHours: "11:00 AM - 10:00 PM",
  },
  {
    id: "rest_007",
    ownerId: ownerIds[6],
    name: "Burger Barn",
    description: "Gourmet burgers made with premium Angus beef, fresh toppings, and artisan buns.",
    cuisine: "American",
    address: "234 Ranch Road",
    city: "New York",
    phone: "+1-555-0107",
    email: "orders@burgerbarn.com",
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
    rating: "4.2",
    deliveryTime: 20,
    minimumOrder: "10.00",
    deliveryFee: "1.99",
    isActive: true,
    openingHours: "11:00 AM - 12:00 AM",
  },
  {
    id: "rest_008",
    ownerId: ownerIds[7],
    name: "Mediterranean Delight",
    description: "Fresh Mediterranean and Middle Eastern cuisine. Hummus, falafel, shawarma, and more.",
    cuisine: "Mediterranean",
    address: "456 Olive Street",
    city: "New York",
    phone: "+1-555-0108",
    email: "hello@meddelight.com",
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800",
    rating: "4.5",
    deliveryTime: 30,
    minimumOrder: "15.00",
    deliveryFee: "2.99",
    isActive: true,
    openingHours: "10:00 AM - 10:00 PM",
  },
];

const menuData: Record<string, { categories: { name: string; items: { name: string; description: string; price: string; }[] }[] }> = {
  "Italian": {
    categories: [
      {
        name: "Appetizers",
        items: [
          { name: "Bruschetta", description: "Toasted bread with fresh tomatoes, basil, and garlic", price: "8.99" },
          { name: "Caprese Salad", description: "Fresh mozzarella, tomatoes, and basil with balsamic glaze", price: "12.99" },
          { name: "Calamari Fritti", description: "Crispy fried calamari with marinara sauce", price: "14.99" },
        ]
      },
      {
        name: "Pasta",
        items: [
          { name: "Spaghetti Carbonara", description: "Classic Roman pasta with eggs, pecorino, and guanciale", price: "18.99" },
          { name: "Fettuccine Alfredo", description: "Creamy parmesan sauce with fresh fettuccine", price: "16.99" },
          { name: "Penne Arrabbiata", description: "Spicy tomato sauce with garlic and chili", price: "15.99" },
          { name: "Lasagna", description: "Layered pasta with meat sauce, béchamel, and cheese", price: "19.99" },
        ]
      },
      {
        name: "Pizza",
        items: [
          { name: "Margherita", description: "San Marzano tomatoes, fresh mozzarella, basil", price: "16.99" },
          { name: "Pepperoni", description: "Classic pepperoni with mozzarella", price: "18.99" },
          { name: "Quattro Formaggi", description: "Four cheese pizza with mozzarella, gorgonzola, parmesan, fontina", price: "20.99" },
        ]
      }
    ]
  },
  "Indian": {
    categories: [
      {
        name: "Starters",
        items: [
          { name: "Samosas", description: "Crispy pastries filled with spiced potatoes and peas", price: "6.99" },
          { name: "Onion Bhaji", description: "Crispy onion fritters with mint chutney", price: "7.99" },
          { name: "Chicken Tikka", description: "Marinated chicken pieces grilled in tandoor", price: "12.99" },
        ]
      },
      {
        name: "Curries",
        items: [
          { name: "Butter Chicken", description: "Tender chicken in creamy tomato sauce", price: "17.99" },
          { name: "Lamb Rogan Josh", description: "Slow-cooked lamb in aromatic Kashmiri spices", price: "19.99" },
          { name: "Palak Paneer", description: "Cottage cheese in creamy spinach sauce", price: "15.99" },
          { name: "Chicken Tikka Masala", description: "Grilled chicken in spiced tomato cream sauce", price: "18.99" },
        ]
      },
      {
        name: "Biryani",
        items: [
          { name: "Chicken Biryani", description: "Fragrant basmati rice with spiced chicken", price: "18.99" },
          { name: "Lamb Biryani", description: "Aromatic rice with tender lamb pieces", price: "21.99" },
          { name: "Vegetable Biryani", description: "Mixed vegetables with fragrant basmati rice", price: "15.99" },
        ]
      }
    ]
  },
  "Chinese": {
    categories: [
      {
        name: "Appetizers",
        items: [
          { name: "Spring Rolls", description: "Crispy vegetable spring rolls with sweet chili sauce", price: "7.99" },
          { name: "Dumplings", description: "Steamed pork dumplings with soy dipping sauce", price: "10.99" },
          { name: "Wonton Soup", description: "Savory broth with pork wontons", price: "8.99" },
        ]
      },
      {
        name: "Main Dishes",
        items: [
          { name: "Kung Pao Chicken", description: "Spicy stir-fried chicken with peanuts and vegetables", price: "16.99" },
          { name: "Sweet and Sour Pork", description: "Crispy pork in tangy sweet and sour sauce", price: "17.99" },
          { name: "Beef with Broccoli", description: "Tender beef slices with fresh broccoli", price: "18.99" },
          { name: "Mapo Tofu", description: "Silken tofu in spicy Sichuan sauce", price: "14.99" },
        ]
      },
      {
        name: "Noodles & Rice",
        items: [
          { name: "Fried Rice", description: "Wok-fried rice with eggs, vegetables, and choice of protein", price: "13.99" },
          { name: "Lo Mein", description: "Stir-fried noodles with vegetables", price: "14.99" },
          { name: "Dan Dan Noodles", description: "Spicy Sichuan noodles with minced pork", price: "15.99" },
        ]
      }
    ]
  },
  "Japanese": {
    categories: [
      {
        name: "Sushi Rolls",
        items: [
          { name: "California Roll", description: "Crab, avocado, cucumber", price: "12.99" },
          { name: "Spicy Tuna Roll", description: "Fresh tuna with spicy mayo", price: "14.99" },
          { name: "Dragon Roll", description: "Eel, crab, avocado with eel sauce", price: "18.99" },
          { name: "Rainbow Roll", description: "California roll topped with assorted sashimi", price: "19.99" },
        ]
      },
      {
        name: "Sashimi",
        items: [
          { name: "Salmon Sashimi", description: "5 pieces of fresh salmon", price: "16.99" },
          { name: "Tuna Sashimi", description: "5 pieces of fresh tuna", price: "18.99" },
          { name: "Sashimi Platter", description: "Chef's selection of 15 pieces", price: "34.99" },
        ]
      },
      {
        name: "Hot Dishes",
        items: [
          { name: "Chicken Teriyaki", description: "Grilled chicken with teriyaki sauce", price: "17.99" },
          { name: "Tempura Udon", description: "Hot udon noodles with shrimp tempura", price: "16.99" },
          { name: "Tonkotsu Ramen", description: "Rich pork bone broth with noodles", price: "15.99" },
        ]
      }
    ]
  },
  "Mexican": {
    categories: [
      {
        name: "Tacos",
        items: [
          { name: "Carnitas Tacos", description: "Slow-cooked pork with onions and cilantro (3 pcs)", price: "12.99" },
          { name: "Al Pastor Tacos", description: "Marinated pork with pineapple (3 pcs)", price: "13.99" },
          { name: "Carne Asada Tacos", description: "Grilled steak with fresh salsa (3 pcs)", price: "14.99" },
          { name: "Fish Tacos", description: "Beer-battered fish with cabbage slaw (3 pcs)", price: "14.99" },
        ]
      },
      {
        name: "Burritos",
        items: [
          { name: "Chicken Burrito", description: "Large flour tortilla with chicken, rice, beans, cheese", price: "13.99" },
          { name: "Carne Asada Burrito", description: "Grilled steak burrito with all the fixings", price: "15.99" },
          { name: "Veggie Burrito", description: "Grilled vegetables, rice, beans, guacamole", price: "12.99" },
        ]
      },
      {
        name: "Sides & Extras",
        items: [
          { name: "Guacamole & Chips", description: "Fresh made guacamole with tortilla chips", price: "9.99" },
          { name: "Queso Fundido", description: "Melted cheese with chorizo", price: "10.99" },
          { name: "Elote", description: "Mexican street corn with mayo, cheese, chili", price: "6.99" },
        ]
      }
    ]
  },
  "Thai": {
    categories: [
      {
        name: "Starters",
        items: [
          { name: "Tom Yum Soup", description: "Spicy and sour shrimp soup", price: "9.99" },
          { name: "Satay", description: "Grilled chicken skewers with peanut sauce", price: "11.99" },
          { name: "Fresh Spring Rolls", description: "Rice paper rolls with shrimp and vegetables", price: "8.99" },
        ]
      },
      {
        name: "Curries",
        items: [
          { name: "Green Curry", description: "Thai green curry with coconut milk and bamboo shoots", price: "16.99" },
          { name: "Red Curry", description: "Red curry with bell peppers and Thai basil", price: "16.99" },
          { name: "Massaman Curry", description: "Rich curry with potatoes and peanuts", price: "17.99" },
        ]
      },
      {
        name: "Noodles",
        items: [
          { name: "Pad Thai", description: "Stir-fried rice noodles with tamarind sauce", price: "15.99" },
          { name: "Pad See Ew", description: "Wide rice noodles with soy sauce", price: "14.99" },
          { name: "Drunken Noodles", description: "Spicy wide noodles with Thai basil", price: "15.99" },
        ]
      }
    ]
  },
  "American": {
    categories: [
      {
        name: "Burgers",
        items: [
          { name: "Classic Burger", description: "Angus beef patty with lettuce, tomato, onion", price: "13.99" },
          { name: "Bacon Cheeseburger", description: "Beef patty with bacon, cheddar, special sauce", price: "16.99" },
          { name: "Mushroom Swiss Burger", description: "Sautéed mushrooms and Swiss cheese", price: "15.99" },
          { name: "BBQ Burger", description: "BBQ sauce, onion rings, bacon, cheddar", price: "17.99" },
        ]
      },
      {
        name: "Sides",
        items: [
          { name: "French Fries", description: "Crispy golden fries", price: "4.99" },
          { name: "Onion Rings", description: "Beer-battered onion rings", price: "6.99" },
          { name: "Loaded Fries", description: "Fries with cheese, bacon, and sour cream", price: "8.99" },
        ]
      },
      {
        name: "Shakes",
        items: [
          { name: "Chocolate Shake", description: "Classic chocolate milkshake", price: "6.99" },
          { name: "Vanilla Shake", description: "Creamy vanilla milkshake", price: "6.99" },
          { name: "Strawberry Shake", description: "Fresh strawberry milkshake", price: "6.99" },
        ]
      }
    ]
  },
  "Mediterranean": {
    categories: [
      {
        name: "Mezze",
        items: [
          { name: "Hummus", description: "Creamy chickpea dip with olive oil and pita", price: "8.99" },
          { name: "Baba Ganoush", description: "Smoky eggplant dip", price: "9.99" },
          { name: "Falafel", description: "Crispy chickpea fritters with tahini", price: "10.99" },
        ]
      },
      {
        name: "Grilled",
        items: [
          { name: "Chicken Shawarma", description: "Marinated chicken with garlic sauce", price: "16.99" },
          { name: "Lamb Kofta", description: "Grilled lamb skewers with rice", price: "18.99" },
          { name: "Mixed Grill Platter", description: "Chicken, lamb, and kofta with sides", price: "24.99" },
        ]
      },
      {
        name: "Salads",
        items: [
          { name: "Greek Salad", description: "Tomatoes, cucumbers, olives, feta cheese", price: "11.99" },
          { name: "Fattoush", description: "Crispy pita salad with sumac dressing", price: "10.99" },
          { name: "Tabbouleh", description: "Fresh parsley and bulgur salad", price: "9.99" },
        ]
      }
    ]
  }
};

async function seed() {
  console.log("🌱 Seeding database...\n");

  try {
    // Create test users for all roles
    console.log("Creating test users...");
    for (const testUser of testUsers) {
      await db.insert(users).values({
        id: testUser.id,
        phone: testUser.phone,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        role: testUser.role,
      }).onConflictDoNothing();
      console.log(`  ✓ ${testUser.firstName} ${testUser.lastName} (${testUser.role}) - Phone: ${testUser.phone}`);
    }

    // Create delivery partner records for riders
    console.log("\nCreating delivery partner profiles...");
    const riderUsers = testUsers.filter(u => u.role === "delivery_partner");
    for (const rider of riderUsers) {
      await db.insert(deliveryPartners).values({
        id: nanoid(),
        userId: rider.id,
        vehicleType: "bike",
        vehicleNumber: `BIKE-${rider.phone.slice(-4)}`,
        licenseNumber: `LIC-${rider.phone.slice(-4)}`,
        status: "available",
        isVerified: true,
      }).onConflictDoNothing();
      console.log(`  ✓ ${rider.firstName} ${rider.lastName} - Delivery Partner Profile`);
    }

    // Create owner users
    console.log("\nCreating restaurant owners...");
    const ownerNames = [
      "Marco Rossi", "Priya Sharma", "Wei Chen", "Yuki Tanaka", 
      "Carlos Rodriguez", "Somchai Wongsuwan", "Mike Johnson", "Fatima Hassan"
    ];
    
    for (let i = 0; i < ownerIds.length; i++) {
      await db.insert(users).values({
        id: ownerIds[i],
        email: `owner${i + 1}@fooddash.com`,
        phone: `444444444${i + 1}`,
        firstName: ownerNames[i].split(" ")[0],
        lastName: ownerNames[i].split(" ")[1],
        role: "restaurant_owner",
      }).onConflictDoNothing();
      console.log(`  ✓ ${ownerNames[i]}`);
    }

    // Insert restaurants
    console.log("\nAdding restaurants...");
    for (const restaurant of sampleRestaurants) {
      await db.insert(restaurants).values(restaurant).onConflictDoNothing();
      console.log(`  ✓ ${restaurant.name}`);

      // Get menu data for this cuisine
      const cuisineMenu = menuData[restaurant.cuisine];
      if (cuisineMenu) {
        for (const category of cuisineMenu.categories) {
          const categoryId = nanoid();
          await db.insert(menuCategories).values({
            id: categoryId,
            restaurantId: restaurant.id,
            name: category.name,
            sortOrder: cuisineMenu.categories.indexOf(category),
          }).onConflictDoNothing();

          for (const item of category.items) {
            await db.insert(menuItems).values({
              id: nanoid(),
              restaurantId: restaurant.id,
              categoryId: categoryId,
              name: item.name,
              description: item.description,
              price: item.price,
              isAvailable: true,
            }).onConflictDoNothing();
          }
        }
      }
    }

    console.log("\n✅ Database seeded successfully!");
    console.log(`   - ${sampleRestaurants.length} restaurants added`);
    console.log(`   - Menu categories and items added for each restaurant`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
