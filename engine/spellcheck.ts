/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { useEditorStore } from "@/store/editorStore";

const DICTIONARY = new Set<string>([
  "the", "and", "of", "to", "in", "is", "was", "for", "on", "are", "with", "as", "be", "at",
  "or", "from", "has", "had", "have", "it", "this", "that", "these", "those", "they", "them",
  "we", "you", "your", "ours", "their", "he", "she", "his", "her", "him", "its", "not", "no",
  "but", "by", "an", "a", "so", "if", "then", "than", "also", "just", "very", "really", "quite",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "zero", "first",
  "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "hundred",
  "thousand", "million", "color", "colorize", "colored", "colorful", "coloring", "layer", "layers",
  "canvas", "image", "images", "filter", "filters", "text", "font", "fonts", "brush", "brushes",
  "brushstrokes", "shadow", "shadows", "opacity", "selection", "select", "selected", "selecting",
  "move", "moving", "moved", "crop", "cropped", "cropping", "resize", "resized", "resizing",
  "rotate", "rotated", "rotating", "rotation", "flip", "flipped", "flipping", "align", "aligned",
  "aligning", "alignment", "distribute", "distributed", "distributing", "group", "groups",
  "grouped", "grouping", "merge", "merged", "merging", "flatten", "flattened", "flattening",
  "gradient", "gradients", "palette", "swatch", "swatches", "about", "above", "across", "after",
  "again", "against", "all", "almost", "along", "already", "always", "among", "amount", "any",
  "anything", "anyone", "around", "back", "before", "behind", "being", "below", "best", "better",
  "between", "both", "bring", "brought", "came", "come", "comes", "coming", "can", "cannot",
  "could", "day", "days", "does", "doing", "done", "down", "during", "each", "early", "either",
  "else", "end", "ends", "ended", "ending", "even", "ever", "every", "everyone", "everything",
  "example", "examples", "eyes", "face", "fact", "facts", "far", "feel", "feeling", "few", "find",
  "found", "first", "follow", "following", "for", "friend", "friends", "from", "get", "gets",
  "getting", "gave", "give", "given", "gives", "giving", "go", "goes", "going", "gone", "good",
  "got", "great", "hand", "hands", "hard", "have", "having", "head", "hear", "heard", "help",
  "helped", "helping", "here", "herself", "high", "himself", "home", "house", "how", "however",
  "idea", "ideas", "into", "itself", "keep", "keeping", "kept", "kind", "kinds", "know", "knowing",
  "known", "knows", "large", "last", "later", "leave", "leaving", "left", "less", "let", "lets",
  "life", "like", "liked", "likely", "little", "live", "lived", "lives", "living", "long",
  "longer", "look", "looked", "looking", "looks", "made", "make", "makes", "making", "man",
  "many", "may", "maybe", "me", "mean", "means", "meant", "meet", "meeting", "men", "might",
  "more", "most", "much", "must", "myself", "name", "named", "names", "naming", "near", "need",
  "needed", "needs", "never", "new", "news", "next", "night", "non", "none", "nor", "nothing",
  "now", "number", "numbers", "off", "often", "old", "once", "only", "open", "opened", "opening",
  "opens", "other", "others", "our", "ourselves", "out", "over", "own", "owned", "page", "pages",
  "part", "parts", "people", "person", "place", "placed", "places", "placing", "point", "points",
  "possible", "put", "puts", "putting", "quite", "rather", "read", "reading", "reads", "really",
  "right", "said", "same", "saw", "say", "says", "saying", "see", "seeing", "seen", "sees",
  "seem", "seemed", "seems", "set", "sets", "setting", "she", "should", "show", "showed",
  "showing", "shown", "shows", "side", "sides", "since", "small", "smaller", "some", "somehow",
  "someone", "something", "sometimes", "soon", "sort", "sorts", "start", "started", "starting",
  "starts", "still", "stop", "stopped", "stopping", "such", "sure", "take", "taken", "takes",
  "taking", "tell", "telling", "tells", "than", "thank", "thanks", "that", "their", "them",
  "themselves", "then", "there", "these", "they", "thing", "things", "think", "thinking",
  "thinks", "thought", "through", "time", "times", "together", "told", "too", "took", "toward",
  "try", "tried", "tries", "trying", "turn", "turned", "turning", "turns", "two", "under",
  "understand", "understanding", "understood", "until", "upon", "us", "use", "used", "useful",
  "uses", "using", "very", "view", "views", "want", "wanted", "wanting", "wants", "was", "way",
  "ways", "week", "weeks", "well", "went", "were", "what", "when", "where", "whether", "which",
  "while", "who", "whole", "whom", "whose", "why", "will", "with", "within", "without", "woman",
  "women", "word", "words", "work", "worked", "working", "works", "world", "would", "write",
  "writing", "written", "wrote", "year", "years", "yes", "yet", "young", "zoom", "zoomed",
  "zooming", "paste", "pasted", "pasting", "copy", "copied", "copies", "copying", "cut", "cuts",
  "cutting", "undo", "undoing", "redo", "redoing", "delete", "deleted", "deleting", "insert",
  "inserted", "inserting", "draw", "drawn", "drawing", "draws", "drawings", "stroke", "strokes",
  "fill", "filled", "filling", "fills", "stroke", "outline", "outlines", "path", "paths", "shape",
  "shapes", "rectangle", "rectangles", "square", "squares", "circle", "circles", "ellipse",
  "ellipses", "triangle", "triangles", "line", "lines", "curve", "curves", "curved", "points",
  "anchor", "anchors", "clipped", "clipping", "clip", "mask", "masks", "masked", "masking",
  "alpha", "alphas", "channel", "channels", "mode", "modes", "space", "spaces", "rgb", "hsl",
  "hex", "exposure", "contrast", "brightness", "hue", "saturation", "vibrance", "temperature",
  "tint", "highlight", "highlights", "shadows", "midtones", "blur", "blurred", "blurring",
  "sharpen", "sharpened", "sharpening", "sharp", "soft", "soften", "noise", "grain", "pixel",
  "pixels", "resolution", "dpi", "export", "exported", "exporting", "import", "imported",
  "importing", "save", "saved", "saving", "saves", "open", "closed", "closing", "close", "new",
  "file", "files", "folder", "folders", "project", "projects", "document", "documents", "name",
  "size", "width", "height", "dimensions", "position", "positions", "positioned", "transform",
  "transforms", "transformed", "transform", "scaling", "scale", "scaled", "scales", "horizontal",
  "vertical", "diagonal", "angle", "angles", "degrees", "left", "right", "center", "centered",
  "centering", "top", "bottom", "middle", "front", "back", "front", "layer", "background",
  "foreground", "edges", "edge", "feather", "feathered", "feathering", "smudge", "smudged",
  "smudging", "stamp", "stamped", "stamping", "clone", "cloned", "cloning", "paint", "painted",
  "painting", "paints", "pencil", "pencils", "pen", "pens", "eraser", "erasers", "erase",
  "erased", "erasing", "spray", "sprayed", "spraying", "airbrush", "blend", "blended", "blending",
  "blends", "multiply", "screen", "overlay", "darken", "lighten", "difference", "exclusion",
  "smooth", "smoothing", "rough", "texture", "textures", "pattern", "patterns", "style", "styles",
  "styling", "swatch", "glow", "glowing", "neon", "metallic", "glass", "plastic", "wood", "metal",
  "gold", "silver", "bronze", "copper", "chrome", "marble", "stone", "cloud", "clouds", "sky",
  "sun", "sunset", "sunrise", "moon", "star", "stars", "sparkle", "sparkles", "fire", "flame",
  "flames", "water", "wave", "waves", "rain", "snow", "leaf", "leaves", "tree", "trees", "flower",
  "flowers", "grass", "ocean", "mountain", "mountains", "river", "lake", "valley", "beach",
  "desert", "forest", "jungle", "city", "cities", "town", "village", "road", "roads", "street",
  "streets", "bridge", "bridges", "building", "buildings", "house", "room", "rooms", "door",
  "doors", "window", "windows", "wall", "walls", "floor", "floors", "ceiling", "roof", "table",
  "chair", "chairs", "desk", "bed", "sofa", "lamp", "lamps", "mirror", "mirrors", "picture",
  "pictures", "photo", "photos", "photograph", "photographs", "camera", "cameras", "lens",
  "lenses", "lens", "zoom", "flash", "exposure", "shutter", "aperture", "focus", "focused",
  "focusing", "frame", "frames", "framed", "framing", "album", "albums", "gallery", "gallery",
  "icon", "icons", "logo", "logos", "brand", "brands", "banner", "banners", "poster", "posters",
  "flyer", "flyers", "brochure", "brochures", "card", "cards", "invitation", "invitations",
  "certificate", "certificates", "menu", "menus", "label", "labels", "tag", "tags", "sticker",
  "stickers", "emblem", "emblems", "seal", "seals", "badge", "badges", "button", "buttons",
  "arrow", "arrows", "pointer", "pointers", "cursor", "cursors", "hand", "mouse", "keyboard",
  "screen", "screens", "monitor", "monitors", "tablet", "tablets", "phone", "phones", "mobile",
  "laptop", "laptops", "computer", "computers", "software", "hardware", "internet", "website",
  "websites", "webpage", "webpages", "email", "emails", "message", "messages", "comment",
  "comments", "reply", "replies", "reply", "forward", "forwards", "delete", "spam", "login",
  "logins", "logout", "password", "passwords", "username", "usernames", "account", "accounts",
  "profile", "profiles", "avatar", "avatars", "cover", "covers", "thumbnail", "thumbnails",
  "preview", "previews", "layout", "layouts", "design", "designs", "designed", "designing",
  "designer", "designers", "art", "arts", "artist", "artists", "artwork", "artworks", "craft",
  "crafts", "creative", "creativity", "idea", "inspiration", "inspirations", "mood", "moods",
  "theme", "themes", "tone", "tones", "feeling", "emotion", "emotions", "warm", "cool", "cold",
  "hot", "dry", "wet", "soft", "smooth", "glossy", "matte", "shiny", "dull", "bright", "dark",
  "light", "lighter", "darker", "transparent", "translucent", "opaque", "invisible", "visible",
  "hidden", "visible", "selected", "unselected", "locked", "unlocked", "fixed", "flexible",
  "static", "dynamic", "active", "inactive", "enabled", "disabled", "enabled", "default",
  "defaults", "custom", "customize", "customized", "customizing", "preference", "preferences",
  "setting", "settings", "option", "options", "advanced", "basic", "simple", "simple", "complex",
  "normal", "regular", "bold", "italic", "underline", "underlined", "strikethrough", "spacing",
  "leading", "kerning", "tracking", "baseline", "superscript", "subscript", "uppercase",
  "lowercase", "capitalize", "capitalized", "sentence", "sentences", "paragraph", "paragraphs",
  "punctuation", "grammar", "spelling", "spellcheck", "dictionary", "vocabulary", "synonym",
  "synonyms", "antonym", "antonyms", "language", "languages", "english", "french", "german",
  "spanish", "italian", "japanese", "chinese", "korean", "russian", "portuguese", "translate",
  "translated", "translation", "translations", "accent", "accents", "accent", "dialect",
  "dialects", "letter", "letters", "character", "characters", "glyph", "glyphs", "symbol",
  "symbols", "number", "numbers", "digit", "digits", "numeral", "numerals", "roman", "latin",
  "greek", "cyrillic", "hindi", "arabic", "hebrew", "currency", "currencies", "dollar", "dollars",
  "euro", "euros", "pound", "pounds", "yen", "cent", "cents", "price", "prices", "cost", "costs",
  "value", "values", "worth", "amount", "amounts", "total", "totals", "discount", "discounts",
  "sale", "sales", "offer", "offers", "promotion", "promotions", "coupon", "coupons", "voucher",
  "vouchers", "gift", "gifts", "present", "presents", "surprise", "surprises", "celebration",
  "celebrations", "birthday", "anniversary", "wedding", "weddings", "funeral", "holiday",
  "holidays", "festival", "festivals", "party", "parties", "event", "events", "meeting",
  "meetings", "conference", "conferences", "workshop", "workshops", "seminar", "seminars",
  "training", "education", "school", "schools", "college", "university", "universities",
  "student", "students", "teacher", "teachers", "professor", "professors", "class", "classes",
  "course", "courses", "lesson", "lessons", "homework", "assignment", "assignments", "exam",
  "exams", "test", "tests", "tested", "testing", "grade", "grades", "score", "scores", "result",
  "results", "answer", "answers", "question", "questions", "research", "science", "sciences",
  "scientific", "history", "historical", "geography", "math", "mathematics", "mathematical",
  "physics", "chemistry", "biology", "medicine", "medical", "health", "healthy", "healthier",
  "doctor", "doctors", "nurse", "nurses", "patient", "patients", "hospital", "hospitals",
  "clinic", "clinics", "pharmacy", "pharmacies", "medicine", "medicines", "drug", "drugs",
  "vitamin", "vitamins", "exercise", "exercises", "diet", "diets", "food", "foods", "meal",
  "meals", "breakfast", "lunch", "dinner", "supper", "snack", "snacks", "drink", "drinks",
  "drank", "drunk", "drinking", "coffee", "tea", "juice", "milk", "water", "bread", "butter",
  "cheese", "egg", "eggs", "meat", "chicken", "beef", "pork", "fish", "shrimp", "vegetable",
  "vegetables", "fruit", "fruits", "apple", "apples", "orange", "oranges", "banana", "bananas",
  "grape", "grapes", "berry", "berries", "peach", "peaches", "pear", "pears", "lemon", "lemons",
  "lime", "limes", "mango", "mangoes", "watermelon", "melon", "melons", "tomato", "tomatoes",
  "potato", "potatoes", "carrot", "carrots", "onion", "onions", "garlic", "pepper", "peppers",
  "bean", "beans", "rice", "pasta", "noodle", "noodles", "soup", "soups", "salad", "salads",
  "sandwich", "sandwiches", "pizza", "burger", "burgers", "cake", "cakes", "cookie", "cookies",
  "pie", "pies", "chocolate", "candy", "candies", "sugar", "salt", "sauce", "sauces", "oil",
  "vinegar", "spice", "spices", "flavor", "flavors", "taste", "tastes", "delicious", "bake",
  "baked", "baking", "cook", "cooked", "cooking", "cooks", "recipe", "recipes", "kitchen",
  "restaurant", "restaurants", "cafe", "cafes", "hotel", "hotels", "motel", "lodge", "resort",
  "resorts", "vacation", "holiday", "travel", "travels", "traveled", "traveling", "tour",
  "tours", "tourist", "tourists", "ticket", "tickets", "airport", "airports", "train", "trains",
  "train", "bus", "buses", "taxi", "taxis", "car", "cars", "automobile", "truck", "trucks",
  "bicycle", "bicycles", "bike", "bikes", "motorcycle", "motorcycles", "boat", "boats", "ship",
  "ships", "ferry", "ferries", "plane", "planes", "airplane", "airplanes", "helicopter",
  "helicopters", "rocket", "rockets", "space", "satellite", "satellites", "planet", "planets",
  "earth", "moon", "mars", "jupiter", "saturn", "neptune", "uranus", "venus", "mercury",
  "pluto", "galaxy", "galaxies", "universe", "cosmos", "star", "constellation", "constellations",
  "zodiac", "horoscope", "astrology", "astronomy", "solar", "lunar", "eclipse", "eclipses",
  "comet", "comets", "meteor", "meteors", "asteroid", "asteroids", "orbit", "orbits", "gravity",
  "magnetic", "magnetism", "electric", "electricity", "energy", "energies", "power", "powers",
  "powered", "fuel", "fuels", "engine", "engines", "motor", "motors", "machine", "machines",
  "mechanic", "mechanics", "robotic", "robot", "robots", "automation", "automatic", "manual",
  "manually", "digital", "analog", "optical", "visible", "invisible", "infrared", "ultraviolet",
  "xray", "radiation", "radioactive", "chemical", "chemicals", "chemistry", "reaction",
  "reactions", "mixture", "mixtures", "element", "elements", "compound", "compounds", "atom",
  "atoms", "molecule", "molecules", "cell", "cells", "tissue", "tissues", "organ", "organs",
  "body", "bodies", "brain", "heart", "lungs", "liver", "kidney", "kidneys", "stomach", "bone",
  "bones", "muscle", "muscles", "skin", "hair", "nail", "nails", "tooth", "teeth", "ear", "ears",
  "eye", "nose", "mouth", "neck", "shoulder", "shoulders", "arm", "arms", "elbow", "elbows",
  "wrist", "wrists", "finger", "fingers", "thumb", "thumbs", "leg", "legs", "knee", "knees",
  "ankle", "ankles", "foot", "feet", "toe", "toes", "back", "spine", "chest", "waist", "hip",
  "hips", "thigh", "thighs", "kneel", "stand", "standing", "stands", "sit", "sitting", "sits",
  "sleep", "sleeping", "slept", "wake", "waking", "woke", "walk", "walked", "walking", "walks",
  "run", "running", "ran", "jump", "jumped", "jumping", "jumps", "skip", "skipped", "skipping",
  "dance", "danced", "dancing", "dances", "sing", "sang", "sung", "singing", "song", "songs",
  "music", "musical", "musician", "musicians", "instrument", "instruments", "guitar", "guitars",
  "piano", "violin", "violins", "drum", "drums", "flute", "trumpet", "trumpets", "saxophone",
  "horn", "horns", "bass", "choir", "chorus", "melody", "melodies", "rhythm", "rhythms",
  "tempo", "beat", "beats", "note", "notes", "chord", "chords", "lyric", "lyrics", "verse",
  "verses", "chorus", "bridge", "album", "record", "records", "vinyl", "cd", "disc", "discs",
  "mp3", "audio", "video", "videos", "film", "films", "movie", "movies", "cinema", "cinemas",
  "theater", "theaters", "theatre", "theatres", "actor", "actors", "actress", "actresses",
  "director", "directors", "producer", "producers", "script", "scripts", "screenplay",
  "screenplays", "scene", "scenes", "shot", "shots", "shooting", "filmed", "filming", "camera",
  "edit", "editing", "edited", "edits", "editor", "editors", "edition", "editions", "publish",
  "published", "publishing", "publisher", "publishers", "print", "printed", "printing", "prints",
  "printer", "printers", "paper", "papers", "cardboard", "plastic", "glass", "metal", "wooden",
  "rubber", "leather", "fabric", "fabrics", "cloth", "clothes", "clothing", "dress", "dresses",
  "shirt", "shirts", "pants", "shorts", "skirt", "skirts", "jacket", "jackets", "coat", "coats",
  "sweater", "sweaters", "hoodie", "hoodies", "sock", "socks", "shoe", "shoes", "boot", "boots",
  "sandal", "sandals", "slipper", "slippers", "hat", "hats", "cap", "caps", "scarf", "scarves",
  "glove", "gloves", "belt", "belts", "button", "buttons", "zipper", "zippers", "pocket",
  "pockets", "collar", "collars", "sleeve", "sleeves", "fashion", "fashions", "style", "trend",
  "trends", "modern", "classic", "classical", "vintage", "antique", "retro", "futuristic",
  "sleek", "elegant", "elegance", "graceful", "beautiful", "beauty", "pretty", "handsome",
  "gorgeous", "stunning", "striking", "attractive", "charming", "lovely", "nice", "pleasant",
  "pleasing", "wonderful", "amazing", "awesome", "fantastic", "fabulous", "terrific", "excellent",
  "superb", "outstanding", "remarkable", "notable", "impressive", "memorable", "unforgettable",
  "wonder", "marvel", "miracle", "magic", "magical", "mystery", "mysterious", "secret",
  "secrets", "hidden", "unknown", "mystic", "myth", "myths", "legend", "legends", "legendary",
  "fable", "fables", "tale", "tales", "story", "stories", "narrative", "narratives", "plot",
  "plots", "character", "characters", "hero", "heroes", "heroine", "villain", "villains",
  "villain", "monster", "monsters", "dragon", "dragons", "giant", "giants", "dwarf", "dwarves",
  "elf", "elves", "fairy", "fairies", "wizard", "wizards", "witch", "witches", "magician",
  "magicians", "sorcerer", "sorcerers", "knight", "knights", "warrior", "warriors", "soldier",
  "soldiers", "army", "armies", "navy", "airforce", "battle", "battles", "war", "wars", "peace",
  "peaceful", "war", "sword", "swords", "shield", "shields", "spear", "spears", "bow",
  "arrows", "axe", "axes", "hammer", "hammers", "helmet", "helmets", "armor", "armors",
  "castle", "castles", "fortress", "fortresses", "palace", "palaces", "tower", "towers",
  "gate", "gates", "wall", "moat", "king", "kings", "queen", "queens", "prince", "princes",
  "princess", "princesses", "royal", "royalty", "noble", "nobles", "lord", "lords", "lady",
  "ladies", "duke", "dukes", "count", "counts", "kingdom", "kingdoms", "empire", "empires",
  "emperor", "emperors", "republic", "republics", "nation", "nations", "national", "country",
  "countries", "capital", "capitals", "state", "states", "province", "provinces", "region",
  "regions", "district", "districts", "zone", "zones", "area", "areas", "location", "locations",
  "destination", "destinations", "address", "addresses", "street", "avenue", "boulevard",
  "lane", "court", "square", "plaza", "park", "parks", "garden", "gardens", "zoo", "zoos",
  "museum", "museums", "library", "libraries", "stadium", "stadiums", "arena", "arenas",
  "gym", "gyms", "pool", "pools", "court", "field", "fields", "court", "track", "tracks",
  "race", "races", "racing", "sport", "sports", "soccer", "football", "basketball", "baseball",
  "tennis", "golf", "hockey", "rugby", "cricket", "volleyball", "badminton", "boxing", "wrestling",
  "swimming", "cycling", "running", "marathon", "jogging", "yoga", "pilates", "karate", "judo",
  "skating", "skiing", "snowboarding", "surfing", "kayaking", "canoeing", "fishing", "hunting",
  "camping", "hiking", "climbing", "bouldering", "archery", "shooting", "game", "games", "gamer",
  "gaming", "player", "players", "team", "teams", "match", "matches", "match", "tournament",
  "tournaments", "championship", "championships", "league", "leagues", "coach", "coaches",
  "referee", "referees", "umpire", "umpires", "score", "score", "goal", "goals", "point",
  "points", "win", "wins", "winning", "won", "lose", "lost", "losing", "loss", "losses",
  "draw", "drew", "drawn", "tie", "ties", "victory", "victories", "defeat", "defeats",
  "practice", "practices", "practiced", "practicing", "train", "training", "trained", "trainee",
  "trainees", "skill", "skills", "skilled", "talent", "talents", "talented", "ability",
  "abilities", "capability", "capabilities", "strength", "strengths", "strong", "stronger",
  "weak", "weaker", "weakness", "weaknesses", "speed", "speeds", "fast", "faster", "fastest",
  "quick", "quicker", "quickly", "slow", "slower", "slowly", "careful", "carefully", "careless",
  "carelessly", "patient", "patiently", "impatient", "polite", "politely", "rude", "rudely",
  "honest", "honestly", "dishonest", "loyal", "loyally", "brave", "bravely", "courage",
  "courageous", "fear", "fears", "fearless", "afraid", "scared", "frightened", "nervous",
  "nervously", "anxious", "anxiety", "worried", "worry", "worries", "worrying", "calm",
  "calmly", "relax", "relaxed", "relaxing", "relaxation", "stress", "stressed", "stressful",
  "happy", "happier", "happiest", "happiness", "happy", "sad", "sadder", "sadness", "unhappy",
  "upset", "angry", "anger", "mad", "furious", "annoyed", "annoying", "frustrated", "frustrating",
  "frustration", "confused", "confusing", "confusion", "surprised", "surprising", "shocked",
  "shocking", "amused", "amusing", "funny", "funnier", "humor", "humorous", "joke", "jokes",
  "laugh", "laughed", "laughing", "laughs", "smile", "smiled", "smiling", "smiles", "grin",
  "grinned", "grinning", "cry", "cried", "crying", "cries", "tear", "tears", "weep", "wept",
  "weeping", "sob", "sobbed", "sobbing", "hug", "hugged", "hugging", "kiss", "kissed", "kissing",
  "love", "loved", "loving", "loves", "lovely", "beloved", "dear", "dearest", "friend",
  "friendly", "friendship", "friendships", "enemy", "enemies", "hate", "hated", "hating",
  "hates", "hateful", "like", "dislike", "disliked", "dislikes", "prefer", "preferred",
  "preferring", "prefers", "choice", "choices", "choose", "chose", "chosen", "choosing",
  "decide", "decided", "deciding", "decision", "decisions", "determine", "determined",
  "determination", "resolve", "resolved", "resolution", "solutions", "solve", "solved",
  "solving", "solution", "solutions", "problem", "problems", "issue", "issues", "question",
  "trouble", "troubles", "difficulty", "difficulties", "difficult", "easier", "easiest", "easy",
  "easily", "hard", "harder", "hardest", "hardly", "simple", "simpler", "simplest", "simplify",
  "simplified", "simplifying", "complex", "complicated", "complicate", "complicated",
  "technical", "technically", "technology", "technologies", "technique", "techniques",
  "method", "methods", "approach", "approaches", "strategy", "strategies", "strategic",
  "plan", "plans", "planned", "planning", "planner", "planners", "schedule", "schedules",
  "scheduled", "scheduling", "deadline", "deadlines", "priority", "priorities", "prioritize",
  "prioritized", "urgent", "important", "importance", "important", "significant", "significance",
  "crucial", "critical", "essential", "necessary", "unnecessary", "required", "requirement",
  "requirements", "require", "required", "requiring", "needed", "optional", "mandatory",
  "voluntary", "free", "freedom", "independent", "independence", "dependent", "dependence",
  "rely", "relied", "relying", "relies", "reliable", "reliability", "trust", "trusted",
  "trusting", "trustworthy", "honest", "sincere", "sincerely", "genuine", "genuinely",
  "authentic", "authenticity", "real", "realistic", "reality", "realize", "realized",
  "realizing", "realizes", "true", "truly", "truth", "truthful", "false", "falsely", "wrong",
  "correct", "correctly", "incorrect", "accurate", "accuracy", "accurate", "precise", "precisely",
  "precision", "exact", "exactly", "approximate", "approximately", "roughly", "around", "about",
  "almost", "nearly", "just", "only", "simply", "merely", "barely", "hardly", "scarcely",
  "mostly", "mainly", "primarily", "particularly", "especially", "specifically", "generally",
  "typically", "usually", "normally", "often", "frequently", "rarely", "seldom", "occasionally",
  "sometimes", "regularly", "constantly", "always", "never", "ever", "soon", "earlier",
  "earliest", "later", "latest", "now", "today", "tomorrow", "yesterday", "tonight", "morning",
  "afternoon", "evening", "night", "noon", "midnight", "dawn", "dusk", "hour", "hours",
  "minute", "minutes", "second", "seconds", "moment", "moments", "period", "periods", "era",
  "eras", "century", "centuries", "decade", "decades", "season", "seasons", "spring",
  "summer", "autumn", "fall", "winter", "january", "february", "march", "april", "may",
  "june", "july", "august", "september", "october", "november", "december", "monday",
  "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "weekend", "weekdays",
  "month", "months", "date", "dates", "dated", "dating", "calendar", "calendars", "agenda",
  "agendas", "appointment", "appointments", "meeting", "appointment", "reservation",
  "reservations", "booking", "bookings", "book", "books", "booked", "booking", "read",
  "reads", "reading", "reader", "readers", "author", "authors", "writer", "writers",
  "writing", "writings", "manuscript", "manuscripts", "chapter", "chapters", "section",
  "sections", "page", "index", "indexes", "glossary", "bibliography", "reference", "references",
  "source", "sources", "citation", "citations", "quote", "quotes", "quoted", "quoting",
  "quotation", "quotations", "statement", "statements", "claim", "claims", "argument",
  "arguments", "debate", "debates", "discussion", "discussions", "conversation", "conversations",
  "dialogue", "dialogues", "speech", "speeches", "speaker", "speakers", "speak", "spoke",
  "spoken", "speaking", "talks", "talk", "talked", "talking", "chat", "chats", "chatted",
  "chatting", "texting", "text", "message", "messages", "messaging", "phone", "call", "called",
  "calling", "calls", "contact", "contacts", "contacted", "contacting", "communicate",
  "communicated", "communicating", "communication", "communications", "announce", "announced",
  "announcing", "announcement", "announcements", "declare", "declared", "declaring",
  "declaration", "declarations", "explain", "explained", "explaining", "explains",
  "explanation", "explanations", "describe", "described", "describing", "describes",
  "description", "descriptions", "explain", "detail", "details", "detailed", "mention",
  "mentioned", "mentioning", "mentions", "note", "noted", "noting", "notes", "notice",
  "noticed", "noticing", "notices", "observe", "observed", "observing", "observes",
  "observation", "observations", "watch", "watched", "watching", "watches", "listen",
  "listened", "listening", "listens", "hear", "hearing", "hears", "heard", "sound", "sounds",
  "sounded", "sounding", "noise", "noises", "noisy", "quiet", "quietly", "silent", "silence",
  "loud", "loudly", "volume", "volumes", "pitch", "pitches", "tone", "voice", "voices",
  "whisper", "whispered", "whispering", "whispers", "shout", "shouted", "shouting", "shouts",
  "yell", "yelled", "yelling", "yells", "scream", "screamed", "screaming", "screams",
  "cheer", "cheered", "cheering", "cheers", "applaud", "applauded", "applauding",
  "applause", "clap", "clapped", "clapping", "claps",
]);

export function tokenize(text: string): { word: string; start: number }[] {
  const out: { word: string; start: number }[] = [];
  const re = /[A-Za-z]+(?:'[A-Za-z]+)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ word: m[0], start: m.index });
  }
  return out;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  const prev = new Array<number>(lb + 1);
  const curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }
  return prev[lb];
}

export function suggest(word: string, max = 4): string[] {
  const lower = word.toLowerCase();
  return [...DICTIONARY]
    .map((w) => ({ w, d: levenshtein(lower, w.toLowerCase()) }))
    .filter((x) => x.d <= 2)
    .sort((a, b) => a.d - b.d || a.w.localeCompare(b.w))
    .slice(0, max)
    .map((x) => x.w);
}

export function isMisspelled(word: string): boolean {
  if (DICTIONARY.has(word.toLowerCase())) return false;
  if (/\d/.test(word)) return false;
  const first = word[0];
  if (word.length > 2 && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return false;
  }
  return true;
}

export function setCharStyle(obj: any, index: number, style: Record<string, any>) {
  if (!obj || typeof obj.setSelectionStyles !== "function") return;
  obj.setSelectionStyles(style, index, index + 1);
}

export function clearUnderlines(obj: any) {
  if (!obj || typeof obj.text !== "string" || typeof obj.setSelectionStyles !== "function") return;
  const len = obj.text.length;
  for (let i = 0; i < len; i++) {
    const style = obj.getStyleAtPosition?.(i, true);
    if (style?.underline) {
      obj.setSelectionStyles({ underline: false }, i, i + 1);
    }
  }
}

export async function runSpellCheck(canvas: any) {
  const obj = canvas?.getActiveObject?.();
  if (!obj || (obj.type !== "i-text" && obj.type !== "i-textbox")) {
    window.alert("Select a text layer to spell check.");
    return;
  }
  const ignored = new Set<string>();
  let text = String(obj.text ?? "");
  for (;;) {
    const tokens = tokenize(text).filter(
      (t) => !ignored.has(t.word.toLowerCase()) && isMisspelled(t.word)
    );
    if (!tokens.length) {
      clearUnderlines(obj);
      canvas.requestRenderAll();
      window.alert("Spell check complete — no errors found.");
      return;
    }
    for (const t of tokens) {
      for (let i = t.start; i < t.start + t.word.length; i++) {
        setCharStyle(obj, i, { underline: true, underlineColor: "#f87171" });
      }
    }
    canvas.requestRenderAll();
    const pick = await showOptions({
      title: "Spell Check",
      fields: [
        {
          key: "index",
          label: "Misspelled word",
          type: "select",
          value: 0,
          options: tokens.map((t, i) => ({
            value: String(i),
            label: `${t.word} (at ${t.start})`,
          })),
        },
      ],
    });
    if (!pick) {
      clearUnderlines(obj);
      canvas.requestRenderAll();
      return;
    }
    const token = tokens[Number(pick.index) || 0];
    const suggestions = suggest(token.word);
    const options = suggestions.map((s) => ({ value: s, label: s }));
    options.push({ value: "__ignore__", label: "Ignore All" });
    const fix = await showOptions({
      title: `"${token.word}"`,
      okLabel: "Replace",
      fields: [
        {
          key: "fix",
          label: "Replace with",
          type: "select",
          value: suggestions[0] ?? "__ignore__",
          options,
        },
      ],
    });
    if (!fix) {
      clearUnderlines(obj);
      canvas.requestRenderAll();
      return;
    }
    const choice = String(fix.fix);
    if (choice === "__ignore__") {
      ignored.add(token.word.toLowerCase());
      continue;
    }
    text = text.slice(0, token.start) + choice + text.slice(token.start + token.word.length);
    obj.set("text", text);
    clearUnderlines(obj);
    canvas.requestRenderAll();
    useEditorStore.getState().history?.push?.();
  }
}
