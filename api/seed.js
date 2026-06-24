const path = require('path')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const Category = require('./models/Category')
const Product = require('./models/Product')
const User = require('./models/User')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb+srv://mankarmayur4fox_db_user:Mayur%40321@cluster0.pgtcaoj.mongodb.net/preelly'

const categories = [
  {
    name: 'Electronics',
    emoji: '📱',
    subcategories: [
      { name: 'Mobile Phones' },
      { name: 'Laptops' },
      { name: 'Tablets' },
      { name: 'Cameras' },
      { name: 'Gaming Consoles' },
      { name: 'Headphones' },
    ],
  },
  {
    name: 'Vehicles',
    emoji: '🚗',
    subcategories: [
      { name: 'Cars' },
      { name: 'Motorcycles' },
      { name: 'Bicycles' },
    ],
  },
  {
    name: 'Furniture',
    emoji: '🪑',
    subcategories: [
      { name: 'Sofas' },
      { name: 'Tables' },
      { name: 'Chairs' },
      { name: 'Beds' },
      { name: 'Wardrobes' },
    ],
  },
  {
    name: 'Fashion',
    emoji: '👕',
    subcategories: [
      { name: 'Men\'s Clothing' },
      { name: 'Women\'s Clothing' },
      { name: 'Shoes' },
      { name: 'Accessories' },
      { name: 'Watches' },
    ],
  },
  {
    name: 'Home & Garden',
    emoji: '🏠',
    subcategories: [
      { name: 'Appliances' },
      { name: 'Tools' },
      { name: 'Plants' },
      { name: 'Decor' },
    ],
  },
  {
    name: 'Sports',
    emoji: '⚽',
    subcategories: [
      { name: 'Fitness Equipment' },
      { name: 'Outdoor Gear' },
      { name: 'Sports Accessories' },
    ],
  },
  {
    name: 'Books',
    emoji: '📚',
    subcategories: [
      { name: 'Fiction' },
      { name: 'Non-Fiction' },
      { name: 'Textbooks' },
    ],
  },
  {
    name: 'Toys & Games',
    emoji: '🎮',
    subcategories: [
      { name: 'Board Games' },
      { name: 'Video Games' },
      { name: 'Toys' },
    ],
  },
]

// Dummy users
const users = [
  {
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1234567890',
    password: 'password123',
    rating: 4.8,
    memberSince: new Date('2023-01-15'),
    isVerified: true,
  },
  {
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    phone: '+1234567891',
    password: 'password123',
    rating: 4.9,
    memberSince: new Date('2022-11-20'),
    isVerified: true,
  },
  {
    name: 'Mike Wilson',
    email: 'mike.wilson@example.com',
    phone: '+1234567892',
    password: 'password123',
    rating: 4.5,
    memberSince: new Date('2023-03-10'),
    isVerified: false,
  },
  {
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    phone: '+1234567893',
    password: 'password123',
    rating: 4.7,
    memberSince: new Date('2023-05-05'),
    isVerified: true,
  },
  {
    name: 'David Brown',
    email: 'david.brown@example.com',
    phone: '+1234567894',
    password: 'password123',
    rating: 4.6,
    memberSince: new Date('2022-09-12'),
    isVerified: true,
  },
  {
    name: 'Admin User',
    email: 'admin@example.com',
    phone: '+1234567899',
    password: 'admin123',
    role: 'admin',
    rating: 5.0,
    memberSince: new Date('2022-01-01'),
    isVerified: true,
  },
]

// Sample product data
const getProducts = (categories, users) => {
  const electronicsCategory = categories.find(c => c.name === 'Electronics')
  const vehiclesCategory = categories.find(c => c.name === 'Vehicles')
  const furnitureCategory = categories.find(c => c.name === 'Furniture')
  const fashionCategory = categories.find(c => c.name === 'Fashion')
  const homeCategory = categories.find(c => c.name === 'Home & Garden')
  const sportsCategory = categories.find(c => c.name === 'Sports')

  return [
    // Electronics Products
    {
      title: 'iPhone 13 Pro Max - 256GB - Like New',
      description: 'Selling my iPhone 13 Pro Max. Bought 6 months ago, in excellent condition. Comes with original box, charger, and screen protector already applied. No scratches or dents. Battery health at 95%. All accessories included.',
      price: 850,
      currency: 'USD',
      category: electronicsCategory._id,
      subcategory: electronicsCategory.subcategories[0]._id,
      location: 'New York, NY',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      images: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800',
      ],
      brand: 'Apple',
      condition: 'Like New',
      seller: users[0]._id,
      status: 'active',
      views: 245,
    },
    {
      title: '2020 MacBook Pro 13" - M1 Chip - 8GB RAM',
      description: 'MacBook Pro with M1 chip, 8GB RAM, 256GB SSD. Perfect condition, used for light work. Includes original charger and box. No issues, runs like new. Selling because I upgraded to a larger model.',
      price: 900,
      currency: 'USD',
      category: electronicsCategory._id,
      subcategory: electronicsCategory.subcategories[1]._id,
      location: 'San Francisco, CA',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      images: [
        'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800',
        'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800',
      ],
      brand: 'Apple',
      condition: 'Good',
      seller: users[1]._id,
      status: 'active',
      views: 189,
    },
    {
      title: 'Sony A7III Mirrorless Camera with 24-70mm Lens',
      description: 'Professional camera setup in excellent condition. Includes camera body, 24-70mm f/2.8 lens, battery charger, and camera bag. Used for professional photography but well maintained. Shutter count: 15,000.',
      price: 1800,
      currency: 'USD',
      category: electronicsCategory._id,
      subcategory: electronicsCategory.subcategories[3]._id,
      location: 'Los Angeles, CA',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      images: [
        'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=800',
        'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800',
      ],
      brand: 'Sony',
      condition: 'Good',
      seller: users[2]._id,
      status: 'active',
      views: 312,
    },
    {
      title: 'Samsung 55" 4K Smart TV - QLED',
      description: 'Samsung 55-inch 4K UHD Smart TV. Great picture quality, all apps working. Remote included. Minor scratch on bezel, not visible when watching. Perfect for living room or bedroom.',
      price: 450,
      currency: 'USD',
      category: electronicsCategory._id,
      location: 'Chicago, IL',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      images: [
        'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800',
      ],
      brand: 'Samsung',
      condition: 'Good',
      seller: users[3]._id,
      status: 'active',
      views: 156,
    },
    {
      title: 'PlayStation 5 Console - Brand New',
      description: 'Brand new PlayStation 5 console, still sealed in box. Bought as a gift but recipient already has one. Includes controller and all cables. Cash only, meet in public place.',
      price: 550,
      currency: 'USD',
      category: electronicsCategory._id,
      subcategory: electronicsCategory.subcategories[4]._id,
      location: 'Miami, FL',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      images: [
        'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800',
      ],
      brand: 'Sony',
      condition: 'New',
      seller: users[4]._id,
      status: 'active',
      views: 423,
    },
    {
      title: 'AirPods Pro 2nd Generation',
      description: 'AirPods Pro 2nd generation, excellent condition. All original accessories included. Battery life is great. No issues whatsoever. Selling because I got the Max version.',
      price: 180,
      currency: 'USD',
      category: electronicsCategory._id,
      subcategory: electronicsCategory.subcategories[5]._id,
      location: 'Seattle, WA',
      images: [
        'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800',
      ],
      brand: 'Apple',
      condition: 'Like New',
      seller: users[0]._id,
      status: 'active',
      views: 98,
    },
    // Vehicles
    {
      title: '2018 Honda Civic - 45K Miles - Excellent Condition',
      description: '2018 Honda Civic in excellent condition. One owner, garage kept, regular maintenance. No accidents, clean title. All service records available. Great fuel economy, perfect commuter car.',
      price: 18500,
      currency: 'USD',
      category: vehiclesCategory._id,
      subcategory: vehiclesCategory.subcategories[0]._id,
      location: 'Phoenix, AZ',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      images: [
        'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800',
        'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800',
      ],
      brand: 'Honda',
      condition: 'Good',
      seller: users[1]._id,
      status: 'active',
      views: 567,
    },
    {
      title: 'Mountain Bike - Trek X-Caliber 8 - Size Large',
      description: 'Trek X-Caliber 8 mountain bike in great condition. Used for trail riding but well maintained. Recent tune-up, new brake pads. Perfect for intermediate riders. Size Large fits 5\'10" to 6\'2".',
      price: 650,
      currency: 'USD',
      category: vehiclesCategory._id,
      subcategory: vehiclesCategory.subcategories[2]._id,
      location: 'Denver, CO',
      images: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      ],
      brand: 'Trek',
      condition: 'Good',
      seller: users[2]._id,
      status: 'active',
      views: 134,
    },
    // Furniture
    {
      title: 'Vintage Leather Sofa - 3 Seater - Brown',
      description: 'Beautiful vintage leather sofa in great condition. Some wear on arms but overall excellent. Very comfortable. Pickup only. Dimensions: 84" x 36" x 34".',
      price: 600,
      currency: 'USD',
      category: furnitureCategory._id,
      subcategory: furnitureCategory.subcategories[0]._id,
      location: 'Miami, FL',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      images: [
        'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800',
      ],
      brand: 'Unknown',
      condition: 'Fair',
      seller: users[3]._id,
      status: 'active',
      views: 201,
    },
    {
      title: 'Modern Dining Table - Glass Top - Seats 6',
      description: 'Modern glass-top dining table with chrome base. Seats 6 comfortably. Excellent condition, no scratches. Perfect for modern homes. Dimensions: 72" x 36".',
      price: 350,
      currency: 'USD',
      category: furnitureCategory._id,
      subcategory: furnitureCategory.subcategories[1]._id,
      location: 'Portland, OR',
      images: [
        'https://images.unsplash.com/photo-1581539250439-c96689b516dd?w=800',
      ],
      brand: 'IKEA',
      condition: 'Like New',
      seller: users[4]._id,
      status: 'active',
      views: 89,
    },
    // Fashion
    {
      title: 'Nike Air Max 270 - Size 10 - Black/White',
      description: 'Barely worn Nike Air Max 270. Only used a few times, in excellent condition. Original box included. Size 10, perfect fit.',
      price: 80,
      currency: 'USD',
      category: fashionCategory._id,
      subcategory: fashionCategory.subcategories[2]._id,
      location: 'Los Angeles, CA',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      images: [
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
      ],
      brand: 'Nike',
      condition: 'Like New',
      seller: users[0]._id,
      status: 'active',
      views: 67,
    },
    {
      title: 'Rolex Submariner Homage Watch - Automatic',
      description: 'High-quality automatic watch, Rolex Submariner style. Excellent condition, keeps perfect time. Stainless steel, water resistant. Great value for money.',
      price: 250,
      currency: 'USD',
      category: fashionCategory._id,
      subcategory: fashionCategory.subcategories[4]._id,
      location: 'New York, NY',
      images: [
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
      ],
      brand: 'Unknown',
      condition: 'Good',
      seller: users[1]._id,
      status: 'active',
      views: 145,
    },
    // Home & Garden
    {
      title: 'Dyson V11 Cordless Vacuum - Excellent Condition',
      description: 'Dyson V11 cordless vacuum in excellent condition. All attachments included. Battery holds charge well. Selling because I upgraded to newer model.',
      price: 320,
      currency: 'USD',
      category: homeCategory._id,
      subcategory: homeCategory.subcategories[0]._id,
      location: 'Boston, MA',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreet.mp4',
      images: [
        'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800',
      ],
      brand: 'Dyson',
      condition: 'Good',
      seller: users[2]._id,
      status: 'active',
      views: 112,
    },
    {
      title: 'Indoor Plant Collection - 5 Plants',
      description: 'Collection of 5 healthy indoor plants. Includes Monstera, Snake Plant, Pothos, ZZ Plant, and Fiddle Leaf Fig. All in decorative pots. Great for home or office.',
      price: 120,
      currency: 'USD',
      category: homeCategory._id,
      subcategory: homeCategory.subcategories[2]._id,
      location: 'Austin, TX',
      images: [
        'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800',
        'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800',
      ],
      brand: 'Various',
      condition: 'New',
      seller: users[3]._id,
      status: 'active',
      views: 78,
    },
    // Sports
    {
      title: 'Bowflex Adjustable Dumbbells - 52.5 lbs each',
      description: 'Bowflex SelectTech 552 adjustable dumbbells. Excellent condition, like new. Takes up minimal space. Perfect for home gym. Includes stand.',
      price: 400,
      currency: 'USD',
      category: sportsCategory._id,
      subcategory: sportsCategory.subcategories[0]._id,
      location: 'Las Vegas, NV',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      images: [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
      ],
      brand: 'Bowflex',
      condition: 'Like New',
      seller: users[4]._id,
      status: 'active',
      views: 234,
    },
    {
      title: 'Yoga Mat Set - Premium Quality',
      description: 'Premium yoga mat set including mat, blocks, and strap. Used only a few times. Excellent condition. Perfect for beginners or experienced yogis.',
      price: 45,
      currency: 'USD',
      category: sportsCategory._id,
      subcategory: sportsCategory.subcategories[2]._id,
      location: 'San Diego, CA',
      images: [
        'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
      ],
      brand: 'Gaiam',
      condition: 'Like New',
      seller: users[0]._id,
      status: 'active',
      views: 56,
    },
  ]
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB')

    // Clear existing data
    await User.deleteMany({})
    await Category.deleteMany({})
    await Product.deleteMany({})
    console.log('Cleared existing data')

    // Seed users - hash passwords before inserting
    const usersWithHashedPasswords = await Promise.all(
      users.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 12),
      }))
    )
    const createdUsers = await User.insertMany(usersWithHashedPasswords)
    console.log(`Created ${createdUsers.length} users`)

    // Seed categories
    const createdCategories = await Category.insertMany(categories)
    console.log(`Created ${createdCategories.length} categories`)

    // Seed products
    // Map categories with their subcategories for easy lookup
    const categoriesWithSubs = createdCategories.map(cat => ({
      _id: cat._id,
      name: cat.name,
      subcategories: cat.subcategories || []
    }))
    
    const products = getProducts(categoriesWithSubs, createdUsers)
    
    const createdProducts = await Product.insertMany(products)
    console.log(`Created ${createdProducts.length} products`)

    // Update category counts
    for (const category of createdCategories) {
      const count = await Product.countDocuments({ category: category._id })
      category.count = count
      await category.save()
    }

    console.log('\n✅ Seed completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`   - Users: ${createdUsers.length}`)
    console.log(`   - Categories: ${createdCategories.length}`)
    console.log(`   - Products: ${createdProducts.length}`)
    console.log('\n🔑 Test User Credentials:')
    console.log('   Email: john.smith@example.com')
    console.log('   Password: password123')
    console.log('\n   Email: sarah.j@example.com')
    console.log('   Password: password123')
    console.log('\n   (All test users use password: password123)')
    console.log('\n👑 Admin Credentials:')
    console.log('   Email: admin@example.com')
    console.log('   Password: admin123')
    
    process.exit(0)
  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  }
}

seed()

