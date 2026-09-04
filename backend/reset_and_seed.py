"""
AgentCART — Full Demo Seed Script
5 Merchants × 10-14 products each
5 Customers with mixed orders
All passwords: Pass@1234
"""
import asyncio, uuid, hashlib, json
from datetime import datetime, timedelta
from sqlalchemy import select
from app.db.database import AsyncSessionLocal, engine, Base
from app.models.models import (
    User, Store, Product, Address, Order, OrderItem,
    OrderStatus, StoreAgentConfig
)

def _uuid(): return str(uuid.uuid4())
def hash_pw(p): return hashlib.sha256(f"agentcart_salt_{p}".encode()).hexdigest()
PWD = hash_pw("Pass@1234")

# ─────────────────────────────────────────────────────────────────────────────
# MERCHANTS
# ─────────────────────────────────────────────────────────────────────────────
MERCHANTS = [
    {
        "email": "arjun.sharma@techzone.in",
        "name": "Arjun Sharma",
        "phone": "+919876543210",
        "store": {
            "name": "TechZone India",
            "slug": "techzone-india",
            "description": "Premium laptops, desktops, and accessories. India's top tech store.",
            "category": "Computing",
        },
        "agent": {
            "greeting": "Hey! Welcome to TechZone India. Looking for your next laptop or gadget?",
            "persona": "Expert tech advisor",
            "context": "We sell premium laptops, desktops, components, and accessories. Our flagship is the UltraBook Pro.",
            "max_discount_pct": 8.0,
            "min_cart_paise": 200000,
        },
        "products": [
            {"sku":"TZ-001","name":"UltraBook Pro 14","desc":"14-inch ultrabook, Intel i7, 16GB RAM, 512GB SSD","cat":"Computing","brand":"UltraBook","price":8999900,"orig":9999900,"stock":25,"img":"https://images.unsplash.com/photo-1496181133206-80ce9b88a853","tags":["laptop","ultrabook","intel"],"rating":4.6,"reviews":312},
            {"sku":"TZ-002","name":"GamerX RTX 4080 Laptop","desc":"17-inch gaming beast with RTX 4080, i9, 32GB RAM","cat":"Computing","brand":"GamerX","price":18999900,"orig":21999900,"stock":8,"img":"https://images.unsplash.com/photo-1593640408182-31c70c8268f5","tags":["gaming","laptop","rtx"],"rating":4.8,"reviews":198},
            {"sku":"TZ-003","name":"Mechanical RGB Keyboard","desc":"TKL mechanical keyboard, Cherry MX Red switches, per-key RGB","cat":"Computing","brand":"KeyMaster","price":599900,"orig":799900,"stock":60,"img":"https://images.unsplash.com/photo-1541140532154-b024d705b90a","tags":["keyboard","mechanical","rgb"],"rating":4.5,"reviews":876},
            {"sku":"TZ-004","name":"4K Ultra-Wide Monitor 34\"","desc":"34-inch curved IPS, 144Hz, HDR400, USB-C","cat":"Computing","brand":"ViewMax","price":4599900,"orig":5299900,"stock":15,"img":"https://images.unsplash.com/photo-1527443224154-c4a3942d3acf","tags":["monitor","4k","ultrawide"],"rating":4.7,"reviews":245},
            {"sku":"TZ-005","name":"Wireless Ergonomic Mouse","desc":"Ergonomic wireless mouse, 4000 DPI, silent clicks, 90-day battery","cat":"Computing","brand":"ErgoTech","price":299900,"orig":399900,"stock":100,"img":"https://images.unsplash.com/photo-1527864550417-7fd91fc51a46","tags":["mouse","wireless","ergonomic"],"rating":4.3,"reviews":1203},
            {"sku":"TZ-006","name":"NVMe SSD 2TB","desc":"PCIe 4.0 NVMe SSD, 7000MB/s read, M.2 form factor","cat":"Computing","brand":"SwiftDrive","price":1299900,"orig":1599900,"stock":45,"img":"https://images.unsplash.com/photo-1551808525-51a94da548ce","tags":["ssd","storage","nvme"],"rating":4.9,"reviews":532},
            {"sku":"TZ-007","name":"USB-C 12-in-1 Hub","desc":"12-in-1 USB-C hub: 4K HDMI, Ethernet, SD card, 100W PD","cat":"Computing","brand":"HubPro","price":399900,"orig":499900,"stock":75,"img":"https://images.unsplash.com/photo-1625723044792-44de16ccb4e9","tags":["hub","usb-c","adapter"],"rating":4.4,"reviews":689},
            {"sku":"TZ-008","name":"DDR5 32GB RAM Kit","desc":"32GB (2×16GB) DDR5 6000MHz CL36, XMP 3.0 support","cat":"Computing","brand":"SpeedMem","price":1199900,"orig":1499900,"stock":30,"img":"https://images.unsplash.com/photo-1558618666-fcd25c85cd64","tags":["ram","ddr5","memory"],"rating":4.6,"reviews":178},
            {"sku":"TZ-009","name":"Webcam 4K 60fps","desc":"4K webcam, auto-focus, built-in noise-cancelling mic, ring light","cat":"Computing","brand":"ClearVision","price":799900,"orig":999900,"stock":40,"img":"https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04","tags":["webcam","4k","streaming"],"rating":4.2,"reviews":341},
            {"sku":"TZ-010","name":"Laptop Cooling Stand Pro","desc":"Adjustable laptop stand with dual 120mm fans, RGB lighting","cat":"Computing","brand":"CoolBase","price":199900,"orig":249900,"stock":85,"img":"https://images.unsplash.com/photo-1593640408182-31c70c8268f5","tags":["cooling","stand","laptop"],"rating":4.1,"reviews":567},
            {"sku":"TZ-011","name":"RTX 4070 Ti Graphics Card","desc":"NVIDIA RTX 4070 Ti, 12GB GDDR6X, triple-fan cooling","cat":"Computing","brand":"NvidiaPartner","price":8499900,"orig":9299900,"stock":6,"img":"https://images.unsplash.com/photo-1591488320449-011701bb6704","tags":["gpu","graphics","gaming"],"rating":4.8,"reviews":156},
        ]
    },
    {
        "email": "priya.nair@fashionhub.in",
        "name": "Priya Nair",
        "phone": "+918765432109",
        "store": {
            "name": "FashionHub",
            "slug": "fashionhub",
            "description": "Trendy ethnic and western wear for men and women. Delivered across India.",
            "category": "Fashion",
        },
        "agent": {
            "greeting": "Namaste! Welcome to FashionHub. Let me help you find your perfect outfit!",
            "persona": "Friendly fashion stylist",
            "context": "We sell ethnic wear (kurtas, sarees, lehengas) and western wear (jeans, tops, dresses). All sizes available.",
            "max_discount_pct": 12.0,
            "min_cart_paise": 50000,
        },
        "products": [
            {"sku":"FH-001","name":"Banarasi Silk Saree","desc":"Pure Banarasi silk saree with zari work, comes with blouse piece","cat":"Fashion","brand":"SilkRoute","price":1299900,"orig":1799900,"stock":20,"img":"https://images.unsplash.com/photo-1583391733956-6c78276477e2","tags":["saree","silk","ethnic"],"rating":4.8,"reviews":432},
            {"sku":"FH-002","name":"Men's Slim Fit Kurta","desc":"Cotton kurta with Nehru collar, festival collection 2024","cat":"Fashion","brand":"EthnicMan","price":149900,"orig":199900,"stock":80,"img":"https://images.unsplash.com/photo-1610030469983-98e550d6193c","tags":["kurta","men","ethnic"],"rating":4.5,"reviews":761},
            {"sku":"FH-003","name":"Anarkali Suit Set","desc":"Fully embroidered anarkali with dupatta, sizes XS-3XL","cat":"Fashion","brand":"GargiDesigns","price":399900,"orig":599900,"stock":35,"img":"https://images.unsplash.com/photo-1583391733956-6c78276477e2","tags":["anarkali","suit","women"],"rating":4.6,"reviews":298},
            {"sku":"FH-004","name":"Denim Jogger Jeans","desc":"Stretchable denim jogger jeans, slim fit, ankle zip","cat":"Fashion","brand":"UrbanDenim","price":179900,"orig":249900,"stock":65,"img":"https://images.unsplash.com/photo-1542272604-787c3835535d","tags":["jeans","denim","casual"],"rating":4.3,"reviews":1043},
            {"sku":"FH-005","name":"Printed Crop Top","desc":"100% cotton printed crop top, available in 12 prints","cat":"Fashion","brand":"TrendyTops","price":69900,"orig":99900,"stock":120,"img":"https://images.unsplash.com/photo-1562572159-4efc207f5aff","tags":["top","crop","women"],"rating":4.2,"reviews":892},
            {"sku":"FH-006","name":"Lehenga Choli Set","desc":"Bridal lehenga with heavy embroidery, 2-layer flare","cat":"Fashion","brand":"BridalBliss","price":1899900,"orig":2499900,"stock":12,"img":"https://images.unsplash.com/photo-1583391733956-6c78276477e2","tags":["lehenga","bridal","ethnic"],"rating":4.9,"reviews":187},
            {"sku":"FH-007","name":"Casual Linen Shirt","desc":"Breathable linen shirt, relaxed fit, summer collection","cat":"Fashion","brand":"LinenLux","price":119900,"orig":159900,"stock":90,"img":"https://images.unsplash.com/photo-1598032895397-b9472444bf93","tags":["shirt","linen","men"],"rating":4.4,"reviews":534},
            {"sku":"FH-008","name":"Palazzo Pants Set","desc":"Printed palazzo pants with matching kurti, festive wear","cat":"Fashion","brand":"PalazzoStyle","price":299900,"orig":399900,"stock":45,"img":"https://images.unsplash.com/photo-1603217192634-61068e4d4bf9","tags":["palazzo","women","festive"],"rating":4.5,"reviews":367},
            {"sku":"FH-009","name":"Men's Wedding Sherwani","desc":"Off-white sherwani with gold embroidery, premium fabric","cat":"Fashion","brand":"RoyalWear","price":1499900,"orig":1999900,"stock":10,"img":"https://images.unsplash.com/photo-1610030469983-98e550d6193c","tags":["sherwani","wedding","men"],"rating":4.7,"reviews":143},
            {"sku":"FH-010","name":"Maxi Floral Dress","desc":"Floor-length maxi dress, floral print, off-shoulder design","cat":"Fashion","brand":"FlowerLane","price":189900,"orig":249900,"stock":55,"img":"https://images.unsplash.com/photo-1572804013309-59a88b7e92f1","tags":["dress","maxi","women"],"rating":4.3,"reviews":678},
            {"sku":"FH-011","name":"Embroidered Dupatta","desc":"Pure chiffon dupatta with phulkari embroidery","cat":"Fashion","brand":"DupattalLore","price":89900,"orig":129900,"stock":70,"img":"https://images.unsplash.com/photo-1583391733956-6c78276477e2","tags":["dupatta","ethnic","chiffon"],"rating":4.6,"reviews":312},
        ]
    },
    {
        "email": "rahul.verma@homeliving.in",
        "name": "Rahul Verma",
        "phone": "+917654321098",
        "store": {
            "name": "HomeLiving Essentials",
            "slug": "homeliving-essentials",
            "description": "Everything for your home — kitchen, decor, furniture, and more.",
            "category": "Home & Kitchen",
        },
        "agent": {
            "greeting": "Welcome to HomeLiving! Let me help you find the perfect home essentials.",
            "persona": "Home decor expert",
            "context": "We sell kitchen appliances, home decor, storage solutions, and furniture. Focus on quality and durability.",
            "max_discount_pct": 10.0,
            "min_cart_paise": 100000,
        },
        "products": [
            {"sku":"HL-001","name":"Instant Pot 7-in-1 6L","desc":"6L electric pressure cooker, air fryer, slow cooker combo","cat":"Home & Kitchen","brand":"InstantPot","price":899900,"orig":1199900,"stock":30,"img":"https://images.unsplash.com/photo-1585515320310-259814833e62","tags":["cooker","kitchen","appliance"],"rating":4.8,"reviews":2341},
            {"sku":"HL-002","name":"Ceramic Non-Stick Cookware Set","desc":"5-piece non-stick ceramic cookware set, PFOA-free","cat":"Home & Kitchen","brand":"CookPure","price":599900,"orig":799900,"stock":25,"img":"https://images.unsplash.com/photo-1556909114-f6e7ad7d3136","tags":["cookware","ceramic","kitchen"],"rating":4.6,"reviews":876},
            {"sku":"HL-003","name":"Air Purifier HEPA H13","desc":"HEPA H13 air purifier, 600 sq ft coverage, silent mode","cat":"Home & Kitchen","brand":"PureAir","price":1299900,"orig":1699900,"stock":18,"img":"https://images.unsplash.com/photo-1585771724684-38269d6639fd","tags":["air purifier","hepa","home"],"rating":4.7,"reviews":543},
            {"sku":"HL-004","name":"Bamboo Modular Shelf","desc":"5-tier bamboo modular shelf, easy assembly, holds 80kg","cat":"Home & Kitchen","brand":"BambooHome","price":449900,"orig":599900,"stock":22,"img":"https://images.unsplash.com/photo-1555041469-a586c61ea9bc","tags":["shelf","storage","bamboo"],"rating":4.4,"reviews":267},
            {"sku":"HL-005","name":"Robot Vacuum Cleaner","desc":"2700Pa suction robot vacuum with mop, AI obstacle avoidance","cat":"Home & Kitchen","brand":"RoboClean","price":1999900,"orig":2699900,"stock":12,"img":"https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1","tags":["robot","vacuum","smart"],"rating":4.5,"reviews":432},
            {"sku":"HL-006","name":"Electric Kettle 1.7L SS","desc":"Stainless steel 1.7L electric kettle, 1800W, auto shut-off","cat":"Home & Kitchen","brand":"BrewMaster","price":129900,"orig":179900,"stock":90,"img":"https://images.unsplash.com/photo-1556909172-54557c7e4fb7","tags":["kettle","electric","kitchen"],"rating":4.3,"reviews":1567},
            {"sku":"HL-007","name":"Decorative LED String Lights","desc":"10m waterproof copper string lights, 100 LEDs, warm white","cat":"Home & Kitchen","brand":"GlowHome","price":89900,"orig":129900,"stock":150,"img":"https://images.unsplash.com/photo-1545127398-14699f92334b","tags":["lights","led","decor"],"rating":4.5,"reviews":2103},
            {"sku":"HL-008","name":"Memory Foam Pillow Pair","desc":"Cervical memory foam pillow, orthopedic support, pair of 2","cat":"Home & Kitchen","brand":"SleepRight","price":349900,"orig":499900,"stock":40,"img":"https://images.unsplash.com/photo-1584100936595-c0654b55a2e6","tags":["pillow","memory foam","sleep"],"rating":4.6,"reviews":891},
            {"sku":"HL-009","name":"Airtight Glass Container Set","desc":"12-piece borosilicate glass food storage set, leak-proof","cat":"Home & Kitchen","brand":"GlassStore","price":249900,"orig":349900,"stock":60,"img":"https://images.unsplash.com/photo-1556909114-f6e7ad7d3136","tags":["storage","glass","kitchen"],"rating":4.7,"reviews":1234},
            {"sku":"HL-010","name":"Wall Art Canvas Print Set","desc":"Set of 3 abstract canvas prints, ready to hang, 40×60cm each","cat":"Home & Kitchen","brand":"ArtWall","price":199900,"orig":299900,"stock":35,"img":"https://images.unsplash.com/photo-1513519245088-0e12902e35ca","tags":["art","canvas","decor"],"rating":4.4,"reviews":456},
            {"sku":"HL-011","name":"Nonstick Tawa 30cm","desc":"Hard-anodized nonstick tawa, induction compatible, 30cm","cat":"Home & Kitchen","brand":"CookPure","price":79900,"orig":119900,"stock":110,"img":"https://images.unsplash.com/photo-1556909114-f6e7ad7d3136","tags":["tawa","nonstick","cookware"],"rating":4.2,"reviews":2890},
            {"sku":"HL-012","name":"Over-the-Door Organizer","desc":"9-pocket over-the-door shoe organizer, clear pockets","cat":"Home & Kitchen","brand":"OrganizeIt","price":59900,"orig":89900,"stock":75,"img":"https://images.unsplash.com/photo-1555041469-a586c61ea9bc","tags":["organizer","storage","door"],"rating":4.1,"reviews":789},
        ]
    },
    {
        "email": "kavya.reddy@sportspro.in",
        "name": "Kavya Reddy",
        "phone": "+916543210987",
        "store": {
            "name": "SportsPro India",
            "slug": "sportspro-india",
            "description": "Professional sports equipment, fitness gear, and activewear.",
            "category": "Sports & Fitness",
        },
        "agent": {
            "greeting": "Welcome to SportsPro! Ready to level up your fitness game?",
            "persona": "Certified fitness coach",
            "context": "We sell gym equipment, sports accessories, yoga gear, protein supplements, and activewear. All products are certified.",
            "max_discount_pct": 7.0,
            "min_cart_paise": 75000,
        },
        "products": [
            {"sku":"SP-001","name":"Adjustable Dumbbell Set 5-52.5lbs","desc":"Bowflex-style adjustable dumbbell, 15 weight settings","cat":"Sports & Fitness","brand":"IronGrip","price":1799900,"orig":2299900,"stock":15,"img":"https://images.unsplash.com/photo-1534438327276-14e5300c3a48","tags":["dumbbell","gym","strength"],"rating":4.8,"reviews":567},
            {"sku":"SP-002","name":"Yoga Mat 6mm Premium","desc":"6mm non-slip TPE yoga mat, 183×61cm, includes carry strap","cat":"Sports & Fitness","brand":"YogaZen","price":149900,"orig":199900,"stock":100,"img":"https://images.unsplash.com/photo-1601925228150-f8e6de5f63a0","tags":["yoga","mat","fitness"],"rating":4.6,"reviews":2341},
            {"sku":"SP-003","name":"Resistance Bands Set (5 levels)","desc":"5-level resistance bands, includes handles, door anchor, ankle straps","cat":"Sports & Fitness","brand":"FlexBand","price":99900,"orig":149900,"stock":150,"img":"https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b","tags":["resistance","bands","workout"],"rating":4.5,"reviews":1876},
            {"sku":"SP-004","name":"Smart Fitness Tracker Band","desc":"IP68 fitness band, heart rate, SpO2, sleep tracking, 15-day battery","cat":"Sports & Fitness","brand":"FitTrack","price":299900,"orig":399900,"stock":80,"img":"https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6","tags":["fitness","tracker","smartband"],"rating":4.3,"reviews":3201},
            {"sku":"SP-005","name":"Pull-Up Bar Doorframe","desc":"Adjustable doorframe pull-up bar, no screws, 150kg capacity","cat":"Sports & Fitness","brand":"IronBar","price":249900,"orig":349900,"stock":45,"img":"https://images.unsplash.com/photo-1534438327276-14e5300c3a48","tags":["pullup","bar","home gym"],"rating":4.4,"reviews":876},
            {"sku":"SP-006","name":"Whey Protein Isolate 2kg","desc":"25g protein per serving, zero sugar, chocolate flavour, 66 servings","cat":"Sports & Fitness","brand":"MuscleFuel","price":399900,"orig":499900,"stock":60,"img":"https://images.unsplash.com/photo-1593095948071-474c5cc2989d","tags":["protein","whey","supplement"],"rating":4.7,"reviews":1432},
            {"sku":"SP-007","name":"Skipping Rope with Counter","desc":"Steel wire jump rope, digital counter, adjustable length","cat":"Sports & Fitness","brand":"JumpPro","price":79900,"orig":119900,"stock":200,"img":"https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b","tags":["skipping","rope","cardio"],"rating":4.2,"reviews":2103},
            {"sku":"SP-008","name":"Foam Roller 33cm","desc":"High-density EPP foam roller, 33cm, deep tissue massage","cat":"Sports & Fitness","brand":"RollEase","price":129900,"orig":179900,"stock":85,"img":"https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b","tags":["foam roller","recovery","massage"],"rating":4.5,"reviews":987},
            {"sku":"SP-009","name":"Cricket Bat Kashmir Willow","desc":"Kashmir willow cricket bat, full size, oiled and pressed","cat":"Sports & Fitness","brand":"BatKing","price":249900,"orig":349900,"stock":30,"img":"https://images.unsplash.com/photo-1531415074968-036ba1b575da","tags":["cricket","bat","sports"],"rating":4.6,"reviews":543},
            {"sku":"SP-010","name":"Running Shoes Pro","desc":"Lightweight running shoes, air-cushioned sole, reflective strip","cat":"Sports & Fitness","brand":"RunFast","price":299900,"orig":399900,"stock":70,"img":"https://images.unsplash.com/photo-1542291026-7eec264c27ff","tags":["shoes","running","footwear"],"rating":4.4,"reviews":1654},
            {"sku":"SP-011","name":"Gym Gloves Full-Finger","desc":"Anti-slip full-finger gym gloves, wrist wrap support","cat":"Sports & Fitness","brand":"GripMax","price":69900,"orig":99900,"stock":120,"img":"https://images.unsplash.com/photo-1534438327276-14e5300c3a48","tags":["gloves","gym","wrist"],"rating":4.3,"reviews":789},
        ]
    },
    {
        "email": "merchant@test.com",
        "name": "Demo Merchant",
        "phone": "+919000000002",
        "store": {
            "name": "AgentCART Demo Store",
            "slug": "demo-store",
            "description": "Demo store for testing AgentCART features end-to-end.",
            "category": "Electronics",
        },
        "agent": {
            "greeting": "Welcome to the AgentCART Demo Store! Ask me anything about our products.",
            "persona": "Helpful sales assistant",
            "context": "We sell a curated mix of electronics, books, and fitness gear for demonstration purposes.",
            "max_discount_pct": 10.0,
            "min_cart_paise": 50000,
        },
        "products": [
            {"sku":"DEMO-001","name":"Noise-Cancelling Headphones","desc":"Wireless over-ear headphones, 30h battery, ANC","cat":"Electronics","brand":"SoundMax","price":299900,"orig":399900,"stock":50,"img":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e","tags":["headphones","wireless","anc"],"rating":4.5,"reviews":234},
            {"sku":"DEMO-002","name":"Smart Watch Series 5","desc":"Fitness tracker with GPS, heart rate, SpO2, 7-day battery","cat":"Electronics","brand":"FitWatch","price":199900,"orig":249900,"stock":40,"img":"https://images.unsplash.com/photo-1523275335684-37898b6baf30","tags":["smartwatch","fitness","gps"],"rating":4.4,"reviews":567},
            {"sku":"DEMO-003","name":"Mechanical Keyboard TKL","desc":"Tenkeyless mechanical keyboard, blue switches, RGB backlight","cat":"Electronics","brand":"TypePro","price":149900,"orig":199900,"stock":30,"img":"https://images.unsplash.com/photo-1541140532154-b024d705b90a","tags":["keyboard","mechanical","rgb"],"rating":4.6,"reviews":312},
            {"sku":"DEMO-004","name":"Atomic Habits — James Clear","desc":"#1 NYT bestseller on habits and continuous improvement","cat":"Books","brand":"Penguin","price":49900,"orig":69900,"stock":100,"img":"https://images.unsplash.com/photo-1544947950-fa07a98d237f","tags":["self-help","habits","book"],"rating":4.9,"reviews":8923},
            {"sku":"DEMO-005","name":"Yoga Mat Premium 6mm","desc":"Non-slip TPE yoga mat, 183x61cm, with carry strap","cat":"Sports & Fitness","brand":"YogaZen","price":149900,"orig":199900,"stock":60,"img":"https://images.unsplash.com/photo-1601925228150-f8e6de5f63a0","tags":["yoga","mat","fitness"],"rating":4.6,"reviews":891},
        ]
    },
    {
        "email": "suresh.menon@bookworld.in",
        "name": "Suresh Menon",
        "phone": "+915432109876",
        "store": {
            "name": "BookWorld India",
            "slug": "bookworld-india",
            "description": "India's favourite online bookstore. Fiction, non-fiction, textbooks, and more.",
            "category": "Books",
        },
        "agent": {
            "greeting": "Welcome to BookWorld! What kind of book are you looking for today?",
            "persona": "Passionate bibliophile",
            "context": "We sell fiction, non-fiction, self-help, textbooks, and children's books. All books are genuine editions.",
            "max_discount_pct": 5.0,
            "min_cart_paise": 30000,
        },
        "products": [
            {"sku":"BW-001","name":"Atomic Habits — James Clear","desc":"The #1 NYT bestseller on building good habits and breaking bad ones","cat":"Books","brand":"Penguin","price":49900,"orig":69900,"stock":200,"img":"https://images.unsplash.com/photo-1544947950-fa07a98d237f","tags":["self-help","habits","bestseller"],"rating":4.9,"reviews":8923},
            {"sku":"BW-002","name":"The Alchemist — Paulo Coelho","desc":"Timeless classic about following your dreams, paperback edition","cat":"Books","brand":"HarperCollins","price":29900,"orig":39900,"stock":300,"img":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d","tags":["fiction","classic","novel"],"rating":4.8,"reviews":12341},
            {"sku":"BW-003","name":"Rich Dad Poor Dad","desc":"Robert Kiyosaki's financial literacy classic, 25th anniversary ed.","cat":"Books","brand":"Plata Publishing","price":39900,"orig":49900,"stock":250,"img":"https://images.unsplash.com/photo-1544947950-fa07a98d237f","tags":["finance","investing","self-help"],"rating":4.7,"reviews":9876},
            {"sku":"BW-004","name":"The Psychology of Money","desc":"Morgan Housel's 19 stories about money, wealth, and greed","cat":"Books","brand":"Harriman House","price":44900,"orig":59900,"stock":180,"img":"https://images.unsplash.com/photo-1519389950473-47ba0277781c","tags":["finance","psychology","money"],"rating":4.8,"reviews":5432},
            {"sku":"BW-005","name":"Harry Potter Box Set (1-7)","desc":"Complete hardcover set of all 7 Harry Potter books","cat":"Books","brand":"Bloomsbury","price":399900,"orig":549900,"stock":40,"img":"https://images.unsplash.com/photo-1481627834876-b7833e8f5570","tags":["fantasy","fiction","children"],"rating":4.9,"reviews":3210},
            {"sku":"BW-006","name":"NCERT Class 12 Physics Set","desc":"Complete set of NCERT Class 12 Physics Part 1 and Part 2","cat":"Books","brand":"NCERT","price":14900,"orig":19900,"stock":500,"img":"https://images.unsplash.com/photo-1532012197267-da84d127e765","tags":["textbook","ncert","physics"],"rating":4.6,"reviews":4321},
            {"sku":"BW-007","name":"Zero to One — Peter Thiel","desc":"Notes on startups and how to build the future","cat":"Books","brand":"Currency","price":39900,"orig":49900,"stock":150,"img":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d","tags":["startup","business","entrepreneurship"],"rating":4.6,"reviews":3456},
            {"sku":"BW-008","name":"Sapiens — Yuval Noah Harari","desc":"A brief history of humankind, paperback edition","cat":"Books","brand":"Vintage","price":49900,"orig":65900,"stock":200,"img":"https://images.unsplash.com/photo-1544947950-fa07a98d237f","tags":["history","science","non-fiction"],"rating":4.8,"reviews":7654},
            {"sku":"BW-009","name":"The Midnight Library","desc":"Matt Haig's bestselling novel about infinite possibilities","cat":"Books","brand":"Canongate","price":34900,"orig":44900,"stock":120,"img":"https://images.unsplash.com/photo-1481627834876-b7833e8f5570","tags":["fiction","novel","bestseller"],"rating":4.5,"reviews":4521},
            {"sku":"BW-010","name":"Deep Work — Cal Newport","desc":"Rules for focused success in a distracted world","cat":"Books","brand":"Grand Central","price":42900,"orig":54900,"stock":160,"img":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d","tags":["productivity","self-help","focus"],"rating":4.7,"reviews":2987},
            {"sku":"BW-011","name":"The 48 Laws of Power","desc":"Robert Greene's masterclass on power, strategy, and influence","cat":"Books","brand":"Profile Books","price":54900,"orig":69900,"stock":140,"img":"https://images.unsplash.com/photo-1544947950-fa07a98d237f","tags":["power","strategy","non-fiction"],"rating":4.5,"reviews":6543},
            {"sku":"BW-012","name":"Ikigai — Héctor García","desc":"The Japanese secret to a long and happy life","cat":"Books","brand":"Penguin","price":24900,"orig":34900,"stock":220,"img":"https://images.unsplash.com/photo-1481627834876-b7833e8f5570","tags":["self-help","japanese","happiness"],"rating":4.6,"reviews":5678},
        ]
    }
]

# ─────────────────────────────────────────────────────────────────────────────
# CUSTOMERS
# ─────────────────────────────────────────────────────────────────────────────
CUSTOMERS = [
    # ── Test / Demo accounts ─────────────────────────────────────────────────
    {"email":"customer@test.com",       "name":"Test Customer",  "phone":"+919000000001","city":"Mumbai",    "state":"Maharashtra","pincode":"400001","street":"1 Demo Lane, Andheri"},
    # ── Seeded users ─────────────────────────────────────────────────────────
    {"email":"amit.kumar@gmail.com",     "name":"Amit Kumar",     "phone":"+919123456789","city":"Mumbai",    "state":"Maharashtra","pincode":"400001","street":"14 Marine Drive, Colaba"},
    {"email":"sneha.patel@gmail.com",    "name":"Sneha Patel",    "phone":"+919234567890","city":"Ahmedabad", "state":"Gujarat",     "pincode":"380001","street":"22 CG Road, Navrangpura"},
    {"email":"rohit.singh@gmail.com",    "name":"Rohit Singh",    "phone":"+919345678901","city":"Delhi",     "state":"Delhi",       "pincode":"110001","street":"45 Connaught Place"},
    {"email":"anjali.sharma@gmail.com",  "name":"Anjali Sharma",  "phone":"+919456789012","city":"Bengaluru","state":"Karnataka",   "pincode":"560001","street":"7 Brigade Road, MG Road"},
    {"email":"vikram.mehta@gmail.com",   "name":"Vikram Mehta",   "phone":"+919567890123","city":"Hyderabad","state":"Telangana",   "pincode":"500001","street":"88 Banjara Hills, Road No. 12"},
]

async def seed():
    print("\n[RESET] Dropping all tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        print("[RESET] Recreating tables...")
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        merchant_users = []
        stores = []
        all_products = []  # list of (product, store_index)

        # ── 1. Create merchants + stores + products ────────────────────────
        for i, m_data in enumerate(MERCHANTS):
            merchant = User(
                id=_uuid(), email=m_data["email"], name=m_data["name"],
                phone=m_data["phone"], hashed_password=PWD,
                auth_provider="email", is_active=True,
                created_at=datetime.utcnow() - timedelta(days=180 - i*10)
            )
            db.add(merchant)
            merchant_users.append(merchant)

            store = Store(
                id=_uuid(), name=m_data["store"]["name"],
                slug=m_data["store"]["slug"],
                owner_user_id=merchant.id,
                description=m_data["store"]["description"],
                public_api_key="pub_" + _uuid().replace("-", ""),
                secret_api_key="sec_" + _uuid().replace("-", ""),
                is_active=True,
            )
            db.add(store)
            stores.append(store)

            agent_cfg = m_data["agent"]
            db.add(StoreAgentConfig(
                id=_uuid(), store_id=store.id,
                greeting_message=agent_cfg["greeting"],
                persona_name=agent_cfg["persona"],
                store_context=agent_cfg["context"],
                max_discount_pct=agent_cfg["max_discount_pct"],
                min_cart_for_discount_paise=agent_cfg["min_cart_paise"],
            ))

            store_products = []
            for p in m_data["products"]:
                prod = Product(
                    id=_uuid(), sku=p["sku"], name=p["name"],
                    description=p["desc"], category=p["cat"],
                    brand=p["brand"], price_paise=p["price"],
                    original_price_paise=p["orig"], stock_quantity=p["stock"],
                    image_url=p["img"], tags=json.dumps(p["tags"]),
                    rating=p["rating"], review_count=p["reviews"],
                    store_id=store.id, is_active=True,
                    created_at=datetime.utcnow() - timedelta(days=120 - i*5)
                )
                db.add(prod)
                store_products.append(prod)
            all_products.append(store_products)

            print(f"  [+] Merchant: {m_data['name']} | Store: {m_data['store']['name']} | {len(m_data['products'])} products | Max discount: {agent_cfg['max_discount_pct']}%")

        # ── 2. Create customers + addresses ───────────────────────────────
        customer_users = []
        customer_addresses = []
        for c_data in CUSTOMERS:
            customer = User(
                id=_uuid(), email=c_data["email"], name=c_data["name"],
                phone=c_data["phone"], hashed_password=PWD,
                auth_provider="email", is_active=True,
                created_at=datetime.utcnow() - timedelta(days=90)
            )
            db.add(customer)
            customer_users.append(customer)

            addr = Address(
                id=_uuid(), user_id=customer.id, label="Home",
                full_name=c_data["name"], phone=c_data["phone"],
                street_address=c_data["street"], city=c_data["city"],
                state=c_data["state"], pincode=c_data["pincode"],
                is_default=True
            )
            db.add(addr)
            customer_addresses.append(addr)
            print(f"  [+] Customer: {c_data['name']} <{c_data['email']}>")

        await db.flush()

        # ── 3. Create Orders ───────────────────────────────────────────────
        # Amit: 2 orders (TechZone + HomeLiving)
        # Sneha: 1 order (FashionHub)
        # Rohit: 1 order (SportsPro)
        # Anjali: 2 orders (TechZone + BookWorld)
        # Vikram: no orders yet
        orders_plan = [
            # (customer_idx, store_idx, [product_idx_in_store], qty, status, days_ago)
            (0, 0, [0, 2], 1, OrderStatus.DELIVERED, 45),    # Amit → TechZone (UltraBook + Keyboard)
            (0, 2, [5, 6], 2, OrderStatus.PAID,      20),    # Amit → HomeLiving (Kettle + LED lights)
            (1, 1, [0, 7], 1, OrderStatus.SHIPPED,   10),    # Sneha → FashionHub (Saree + Palazzo)
            (2, 3, [1, 2], 1, OrderStatus.CONFIRMED, 5),     # Rohit → SportsPro (Yoga mat + Bands)
            (3, 0, [5, 4], 1, OrderStatus.DELIVERED, 30),    # Anjali → TechZone (NVMe + Wireless mouse)
            (3, 4, [0, 2, 7], 1, OrderStatus.PAID,   15),    # Anjali → BookWorld (Atomic Habits + Rich Dad + Sapiens)
        ]

        for (ci, si, prod_idxs, qty, status, days_ago) in orders_plan:
            cust = customer_users[ci]
            addr = customer_addresses[ci]
            store = stores[si]
            prods = [all_products[si][pi] for pi in prod_idxs]

            subtotal = sum(p.price_paise * qty for p in prods)
            # Apply merchant-specific discount
            disc_pct = MERCHANTS[si]["agent"]["max_discount_pct"] * 0.5  # 50% of max for seeded orders
            disc = int(subtotal * disc_pct / 100)
            total = subtotal - disc

            order = Order(
                id=_uuid(),
                order_number="ORD-" + _uuid()[:8].upper(),
                user_id=cust.id,
                store_id=store.id,
                subtotal_paise=subtotal,
                total_paise=total,
                discount_paise=disc,
                status=status,
                shipping_address_id=addr.id,
                shipping_address=json.dumps({
                    "full_name": addr.full_name,
                    "street": addr.street_address,
                    "city": addr.city,
                    "state": addr.state,
                    "pincode": addr.pincode,
                }),
                razorpay_order_id="order_" + _uuid()[:14],
                created_at=datetime.utcnow() - timedelta(days=days_ago),
            )
            db.add(order)

            for p in prods:
                db.add(OrderItem(
                    id=_uuid(), order_id=order.id, product_id=p.id,
                    product_name=p.name, quantity=qty,
                    unit_price_paise=p.price_paise,
                    subtotal_paise=p.price_paise * qty
                ))

            print(f"  [+] Order: {cust.name} <- {store.name} | Rs.{total/100:,.0f} | {status.value}")

        await db.commit()
        print("\n[SUCCESS] All data seeded!")

if __name__ == "__main__":
    asyncio.run(seed())
