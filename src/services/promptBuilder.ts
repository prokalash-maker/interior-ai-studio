import { RoomType, RoomTypeOption, GeometryPreservationMode, GeometryModeOption, InteriorStyle, LightingOption, AtmosphereOption, MaterialOption } from '../types/project';

export const ROOM_TYPES: RoomTypeOption[] = [
  { id: 'living_room', labelRu: 'Гостиная', labelUk: 'Вітальня', labelEn: 'Living Room', iconName: 'Armchair' },
  { id: 'kitchen', labelRu: 'Кухня', labelUk: 'Кухня', labelEn: 'Kitchen', iconName: 'Utensils' },
  { id: 'kitchen_living', labelRu: 'Кухня-гостиная', labelUk: 'Кухня-вітальня', labelEn: 'Kitchen-Living Open Space', iconName: 'Home' },
  { id: 'bedroom', labelRu: 'Спальня', labelUk: 'Спальня', labelEn: 'Master Bedroom', iconName: 'Bed' },
  { id: 'kids_room', labelRu: 'Детская', labelUk: 'Дитяча', labelEn: 'Kids Room', iconName: 'Baby' },
  { id: 'bathroom', labelRu: 'Ванная комната', labelUk: 'Ванна кімната', labelEn: 'Bathroom', iconName: 'Bath' },
  { id: 'toilet', labelRu: 'Санузел / Гостевой с/у', labelUk: 'Санвузол / Гостьовий с/в', labelEn: 'Powder Room / Restroom', iconName: 'DoorClosed' },
  { id: 'hallway', labelRu: 'Прихожая / Холл', labelUk: 'Передпокій / Хол', labelEn: 'Entryway / Foyer', iconName: 'Compass' },
  { id: 'office', labelRu: 'Кабинет / Рабочая зона', labelUk: 'Кабінет / Робоча зона', labelEn: 'Home Office / Study', iconName: 'Briefcase' },
  { id: 'dressing_room', labelRu: 'Гардеробная', labelUk: 'Гардеробна', labelEn: 'Walk-in Closet / Dressing Room', iconName: 'Shirt' },
  { id: 'commercial', labelRu: 'Коммерческий интерьер', labelUk: 'Комерційний інтер\'єр', labelEn: 'Commercial Space / Boutique', iconName: 'Building' },
  { id: 'other', labelRu: 'Другое помещение', labelUk: 'Інше приміщення', labelEn: 'Architectural Space', iconName: 'Box' },
];

export const GEOMETRY_MODES: GeometryModeOption[] = [
  {
    id: 'strict',
    titleRu: 'MODE 1 — Строгая архитектура (Strict Architecture)',
    titleUk: 'MODE 1 — Сувора архітектура (Strict Architecture)',
    titleEn: 'MODE 1 — Strict Architecture',
    descRu: 'Denoise 0.25. Максимальное сохранение геометрии: стены, шкафы, мебель, окна и точка съемки остаются неизменными. AI накладывает реалистичные материалы и физический свет.',
    descUk: 'Denoise 0.25. Максимальне збереження геометрії: стіни, шафи, меблі, вікна та точка зйомки залишаються незмінними. AI накладає реалістичні матеріали та фізичне світло.',
    descEn: 'Denoise 0.25. Maximum geometry preservation: walls, cabinets, furniture, and camera perspective remain locked. AI applies photorealistic materials and physical light.',
    fidelityScore: 98,
  },
  {
    id: 'balanced',
    titleRu: 'MODE 2 — Реалистичная визуализация (Realistic Visualization)',
    titleUk: 'MODE 2 — Реалістична візуалізація (Realistic Visualization)',
    titleEn: 'MODE 2 — Realistic Visualization',
    descRu: 'Denoise 0.35 (Основной режим). Баланс фотореализма и архитектурного контроля: сохранение композиции Archicad с глубокой проработкой фактур дерева, камня, отражений и светотеней.',
    descUk: 'Denoise 0.35 (Основний режим). Баланс фотореалізму та архітектурного контролю: збереження композиції Archicad із глибокою проробкою фактур дерева, каменю, відблисків та світлотіней.',
    descEn: 'Denoise 0.35 (Recommended). Optimal balance of photorealism and architectural preservation: keeps Archicad composition while deeply materializing surfaces, reflections, and ambient lighting.',
    fidelityScore: 90,
  },
  {
    id: 'creative',
    titleRu: 'MODE 3 — Авторский концепт (Creative Design)',
    titleUk: 'MODE 3 — Авторський концепт (Creative Design)',
    titleEn: 'MODE 3 — Creative Design',
    descRu: 'Denoise 0.50. Свободное художественное преобразование: AI предлагает выразительные дизайнерские решения, альтернативное оформление и акцентный декор.',
    descUk: 'Denoise 0.50. Вільне художнє перетворення: AI пропонує виразні дизайнерські рішення, альтернативне оформлення та акцентний декор.',
    descEn: 'Denoise 0.50. Creative design transformation: AI proposes expressive finishes, bespoke furniture styling, and artistic interior decor.',
    fidelityScore: 70,
  },
];

export const INTERIOR_STYLES: InteriorStyle[] = [
  {
    id: 'modern',
    name: 'Modern / Сучасний',
    category: 'contemporary',
    descriptionRu: 'Чистые четкие линии, лаконичные формы, встроенные системы хранения и сбалансированные пропорции.',
    descriptionUk: 'Чисті чіткі лінії, лаконічні форми, вбудовані системи зберігання та збалансовані пропорції.',
    descriptionEn: 'Clean sharp lines, laconic silhouettes, integrated storage systems, and balanced proportions.',
    promptKeywords: 'contemporary modern interior design, sleek clean lines, refined bespoke cabinetry, uncluttered sophisticated aesthetic, high-end architectural finish',
    defaultMaterials: ['wood_oak', 'microcement', 'metal_black', 'glass'],
    defaultLighting: 'architectural',
    previewColor: '#3b82f6',
  },
  {
    id: 'minimalism',
    name: 'Minimalism / Мінімалізм',
    category: 'minimalist',
    descriptionRu: 'Аскетичная эстетика, скрытые плинтусы и двери, монохромные поверхности, фокус на архитектурном объеме.',
    descriptionUk: 'Аскетична естетика, приховані плінтуси й двері, монохромні поверхні, фокус на архітектурному об\'ємі.',
    descriptionEn: 'Ascetic aesthetic, concealed baseboards and flush doors, monochrome surfaces, architectural focus.',
    promptKeywords: 'pure architectural minimalism, clean seamless surfaces, hidden door frames, concealed joinery, mono-material monolithic expression, calm serene atmosphere',
    defaultMaterials: ['microcement', 'wood_oak', 'metal_black'],
    defaultLighting: 'diffused',
    previewColor: '#64748b',
  },
  {
    id: 'japandi',
    name: 'Japandi / Джапанді',
    category: 'natural',
    descriptionRu: 'Гармоничный синтез японской философии умиротворения и скандинавской функциональности.',
    descriptionUk: 'Гармонійний синтез японської філософії умиротворення та скандинавської функціональності.',
    descriptionEn: 'Harmonious fusion of Japanese wabi-sabi tranquility and Scandinavian functional minimalism.',
    promptKeywords: 'japandi aesthetic, blend of Scandinavian functionality and Japanese rustic minimalism, light warm oak, paper shoji lamps, organic ceramic elements, tactile linen, tranquil balance',
    defaultMaterials: ['wood_oak', 'linen', 'stone_natural'],
    defaultLighting: 'warm_ambient',
    previewColor: '#d97706',
  },
  {
    id: 'wabi_sabi',
    name: 'Wabi-Sabi / Вабі-Сабі',
    category: 'natural',
    descriptionRu: 'Красота естественного несовершенства, фактурная штукатурка, натуральное стареющее дерево и природный камень.',
    descriptionUk: 'Краса природної недосконалості, фактурне тинькування, натуральне дерево та природний камінь.',
    descriptionEn: 'Beauty of natural imperfection, tactile textured lime plaster, aged timber, and raw stone.',
    promptKeywords: 'wabi-sabi philosophy, raw textured lime plaster walls, imperfect natural stone, handcrafted timber with rich grain, weathered matte textures, grounding earthy calmness',
    defaultMaterials: ['lime_plaster', 'stone_natural', 'wood_walnut'],
    defaultLighting: 'soft_studio',
    previewColor: '#a16207',
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian / Скандинавський',
    category: 'natural',
    descriptionRu: 'Светлое воздушное пространство, натуральная древесина березы и ясеня, уютный текстиль и естественный дневной свет.',
    descriptionUk: 'Світлий повітряний простір, натуральна деревина берези та ясеня, затишний текстиль та природне світло.',
    descriptionEn: 'Light airy space, bleached natural woods, cozy wool and linen textiles, natural daylight.',
    promptKeywords: 'scandinavian interior design, nordic hygge, airy bleached wood, soft cozy wool and cotton textures, light flooded room, functional elegance, warm minimalist accents',
    defaultMaterials: ['wood_oak', 'linen', 'glass'],
    defaultLighting: 'daylight',
    previewColor: '#0ea5e9',
  },
  {
    id: 'contemporary',
    name: 'Contemporary / Контемпорарі',
    category: 'contemporary',
    descriptionRu: 'Актуальный европейский дизайн с акцентом на фактуры премиального камня, латунные детали и сложный сценарий освещения.',
    descriptionUk: 'Актуальний європейський дизайн із акцентом на фактури преміального каменю, латунні деталі та багаторівневе світло.',
    descriptionEn: 'High-end European design focused on luxury stone slabs, brushed brass accents, and layered lighting.',
    promptKeywords: 'contemporary luxury interior, tailored bespoke Italian furniture, bookmatched marble panels, brushed champagne brass, plush velvet and bouclé textiles, architectural elegance',
    defaultMaterials: ['marble', 'metal_brass', 'boucle', 'wood_walnut'],
    defaultLighting: 'architectural',
    previewColor: '#6366f1',
  },
  {
    id: 'neoclassic',
    name: 'Neoclassic / Неокласика',
    category: 'classic',
    descriptionRu: 'Сдержанная классическая симметрия, тонкие стеновые молдинги, французский паркет «елочка» и благородные карнизы.',
    descriptionUk: 'Стримана класична симетрія, витончені молдинги, французький паркет «ялинка» та шляхетні карнизи.',
    descriptionEn: 'Refined classical symmetry, delicate wall moldings, French chevron oak parquet, and graceful cornices.',
    promptKeywords: 'refined neoclassicism, elegant wall moldings and boiserie panels, french chevron oak parquet, symmetrical composition, timeless high-ceiling grandeur, discreet luxury',
    defaultMaterials: ['wood_oak', 'marble', 'metal_brass', 'leather'],
    defaultLighting: 'evening_cozy',
    previewColor: '#8b5cf6',
  },
  {
    id: 'loft',
    name: 'Loft / Лофт',
    category: 'contemporary',
    descriptionRu: 'Индустриальный шарм, открытые фактуры кирпичной кладки, стальные балки, патинированное дерево и кожа.',
    descriptionUk: 'Індустріальний шарм, відкриті фактури цегляного мурування, сталеві балки, патиноване дерево та шкіра.',
    descriptionEn: 'Urban industrial charm, exposed masonry and concrete, blackened steel beams, and distressed leather.',
    promptKeywords: 'urban industrial loft, exposed masonry and concrete pillars, raw blackened steel framing, distressed rich cognac leather, reclaimed timber accents, high spatial volume',
    defaultMaterials: ['concrete', 'metal_black', 'leather', 'wood_walnut'],
    defaultLighting: 'architectural',
    previewColor: '#ea580c',
  },
  {
    id: 'industrial',
    name: 'Industrial / Індустріальний',
    category: 'contemporary',
    descriptionRu: 'Брутальные металлические конструкции, шлифованный бетон, открытые инженерные элементы и матовое стекло.',
    descriptionUk: 'Брутальні металеві конструкції, шліфований бетон, відкриті інженерні елементи та матове скло.',
    descriptionEn: 'Brutal metal framing, polished architectural concrete, exposed ductwork, and wire glass.',
    promptKeywords: 'pure industrial aesthetic, smooth power-floated concrete floor, black architectural ironwork, wire-glass partitions, raw honest materials, dramatic shadows',
    defaultMaterials: ['concrete', 'metal_black', 'glass'],
    defaultLighting: 'diffused',
    previewColor: '#475569',
  },
  {
    id: 'art_deco',
    name: 'Art Deco / Арт-Деко',
    category: 'classic',
    descriptionRu: 'Геометрические орнаменты, глянец редкого шпона, контрастный полированный мрамор, золото и выразительный лоск.',
    descriptionUk: 'Геометричні орнаменти, глянець рідкісного шпону, контрастний полірований мармур, золото та виразний блиск.',
    descriptionEn: 'Opulent geometric motifs, high-gloss exotic veneers, contrasting polished marble, and brass inlays.',
    promptKeywords: 'magnificent art deco interior, geometric brass inlays, glossy ebony and burr walnut veneer, nero marquina black marble, opulent statement lighting, velvet upholstery',
    defaultMaterials: ['marble', 'metal_brass', 'wood_walnut', 'boucle'],
    defaultLighting: 'evening_cozy',
    previewColor: '#eab308',
  },
  {
    id: 'mid_century_modern',
    name: 'Mid-Century Modern',
    category: 'contemporary',
    descriptionRu: 'Культовый дизайн 1950–60-х: обтекаемые формы мебели, теплый орех, органическая пластика и оптимистичные акценты.',
    descriptionUk: 'Культовий дизайн 1950–60-х: обтічні форми меблів, теплий горіх, органічна пластика та вінтажний затишок.',
    descriptionEn: 'Iconic 1950s–60s styling, sculpted organic walnut furniture, tapered silhouettes, and retro warmth.',
    promptKeywords: 'mid-century modern iconic interior, sculpted organic walnut chairs, tapered legs, ribbed wooden tambour panels, retro-modern warmth, brass sputnik accents',
    defaultMaterials: ['wood_walnut', 'leather', 'metal_brass'],
    defaultLighting: 'sunset_warm',
    previewColor: '#c2410c',
  },
  {
    id: 'mediterranean',
    name: 'Mediterranean / Середземноморський',
    category: 'natural',
    descriptionRu: 'Солнечная терракота, арочные своды, побелка известью, кованые элементы и расслабленная курортная атмосфера.',
    descriptionUk: 'Сонячна теракота, арочні склепіння, вапняна побілка, ковані деталі та розслаблена атмосфера курортної вілли.',
    descriptionEn: 'Sunlit terracotta floors, soft sculpted arches, whitewashed plaster walls, and breezy coastal vibes.',
    promptKeywords: 'coastal mediterranean villa interior, soft sculpted plaster arches, terracotta tile flooring, whitewashed organic walls, linen drapery dancing in the breeze, handcrafted ceramics',
    defaultMaterials: ['lime_plaster', 'stone_natural', 'linen'],
    defaultLighting: 'daylight',
    previewColor: '#0284c7',
  },
  {
    id: 'luxury',
    name: 'Luxury / Тиха розкіш (Quiet Luxury)',
    category: 'contemporary',
    descriptionRu: 'Безупречное качество материалов, скрытая подсветка, крупный оникс/кварцит, индивидуальные столярные изделия.',
    descriptionUk: 'Бездоганна якість матеріалів, приховане підсвічування, великий онікс/кварцит, індивідуальні столярні вироби.',
    descriptionEn: 'Quiet luxury penthouse finish, backlit quartzite, custom bespoke millwork, museum-grade illumination.',
    promptKeywords: 'quiet luxury high-end penthouse interior, ultra-refined minimalist opulence, backlit patagonian quartzite, custom bespoke millwork, cashmere and silk rugs, museum-grade illumination',
    defaultMaterials: ['marble', 'wood_walnut', 'metal_brass', 'leather'],
    defaultLighting: 'architectural',
    previewColor: '#10b981',
  },
  {
    id: 'organic_modern',
    name: 'Organic Modern / Органічний',
    category: 'natural',
    descriptionRu: 'Природные биоморфные формы, необрезной край слэбов, травертин, тактильные шероховатые поверхности и живая зелень.',
    descriptionUk: 'Природні біоморфні форми, живий край деревини, травертин, тактильні шорсткі поверхні та жива зелень.',
    descriptionEn: 'Biomorphic curvilinear shapes, raw travertine stone, tactile clay and bouclé textures, warm neutral earth tones.',
    promptKeywords: 'organic modern architecture, soft rounded curvilinear shapes, porous raw travertine stone, tactile clay and wool textures, warm neutral earth tones, biophilic integration',
    defaultMaterials: ['stone_natural', 'lime_plaster', 'boucle', 'wood_oak'],
    defaultLighting: 'warm_ambient',
    previewColor: '#84cc16',
  },
  {
    id: 'brutalism',
    name: 'Brutalism / Бруталізм',
    category: 'minimalist',
    descriptionRu: 'Монолитный фактурный бетон с отпечатками опалубки, монументальные объемы, строгая геометрия и скульптурность.',
    descriptionUk: 'Монолітний фактурний бетон із відбитками опалубки, монументальні об\'єми, сувора геометрія та скульптурність.',
    descriptionEn: 'Board-formed textured concrete, monolithic stone elements, stark architectural geometry, and dramatic shadows.',
    promptKeywords: 'interior architectural brutalism, board-formed textured cast concrete walls, heavy monolithic stone elements, stark architectural geometry, dramatic directional light beam',
    defaultMaterials: ['concrete', 'metal_black', 'stone_natural'],
    defaultLighting: 'soft_studio',
    previewColor: '#52525b',
  },
  {
    id: 'high_tech',
    name: 'High-Tech / Хай-Тек',
    category: 'contemporary',
    descriptionRu: 'Интеллектуальные поверхности, динамическое контурное светодиодное освещение, алюминий, тонированное стекло.',
    descriptionUk: 'Інтелектуальні поверхні, динамічне контурне світлодіодне освітлення, анодований алюміній, тоноване скло.',
    descriptionEn: 'Precision anodized aluminum trims, smart integrated LED slots, smoked glass partitions, ultra-modern aerodynamic geometry.',
    promptKeywords: 'futuristic high-tech luxury interior, precision anodized aluminum trims, smart integrated ambient LED linear slots, smoked glass partitions, ultra-modern aerodynamic geometry',
    defaultMaterials: ['metal_black', 'glass', 'microcement'],
    defaultLighting: 'architectural',
    previewColor: '#06b6d4',
  },
  {
    id: 'eclectic',
    name: 'Eclectic / Еклектика',
    category: 'contemporary',
    descriptionRu: 'Смелый авторский микс винтажных раритетов, современного искусства, богатых текстур и глубоких оттенков.',
    descriptionUk: 'Сміливий авторський мікс вінтажних раритетів, сучасного мистецтва, багатих текстур та глибоких відтінків.',
    descriptionEn: 'Curated artistic eclectic blend of vintage statement pieces, contemporary art, and layered expressive textures.',
    promptKeywords: 'curated artistic eclectic interior, sophisticated layered textures, bold artistic juxtaposition, statement designer pieces, deep expressive color palette, cultured sophistication',
    defaultMaterials: ['wood_walnut', 'boucle', 'marble', 'metal_brass'],
    defaultLighting: 'evening_cozy',
    previewColor: '#ec4899',
  },
  {
    id: 'transitional',
    name: 'Transitional / Перехідний',
    category: 'classic',
    descriptionRu: 'Идеальный баланс между классическим уютом и современными чистыми силуэтами, спокойные нейтральные тона.',
    descriptionUk: 'Ідеальний баланс між класичним затишком та сучасними чистими силуетами, спокійні нейтральні тони.',
    descriptionEn: 'Seamless marriage of traditional comfort and contemporary lines, soft greige and taupe palette.',
    promptKeywords: 'transitional interior elegance, seamless marriage of traditional comfort and contemporary lines, soft greige and taupe palette, tailored upholstery, subtle classic trims',
    defaultMaterials: ['wood_oak', 'linen', 'stone_natural'],
    defaultLighting: 'daylight',
    previewColor: '#78716c',
  },
  {
    id: 'classic',
    name: 'Classic / Класика',
    category: 'classic',
    descriptionRu: 'Дворцовая гармония, лепные розетки, наборный паркет, пилястры, благородные ткани и торжественное величие.',
    descriptionUk: 'Палацова гармонія, ліпні розетки, набірний паркет, пілястри, шляхетні тканини та урочиста велич.',
    descriptionEn: 'Timeless classical architecture, intricate ornamental plaster molding, antique parquetry, Corinthian capitals.',
    promptKeywords: 'timeless classical architecture, intricate ornamental plaster molding, antique parquetry, Corinthian capitals, silk damask drapery, heirloom craftsmanship',
    defaultMaterials: ['wood_walnut', 'marble', 'metal_brass', 'leather'],
    defaultLighting: 'evening_cozy',
    previewColor: '#b45309',
  },
];

export const ATMOSPHERE_OPTIONS: AtmosphereOption[] = [
  { id: 'bright', labelRu: 'Светлый и воздушный', labelUk: 'Світлий та повітряний', labelEn: 'Bright & Airy', promptDescription: 'bright, sun-kissed, spacious and airy atmosphere' },
  { id: 'warm', labelRu: 'Тёплый и обволакивающий', labelUk: 'Теплий та огортаючий', labelEn: 'Warm & Cozy', promptDescription: 'warm intimate ambiance, cozy welcoming vibes, gentle amber undertones' },
  { id: 'neutral', labelRu: 'Нейтральный баланс', labelUk: 'Нейтральний баланс', labelEn: 'Neutral Balanced', promptDescription: 'perfectly balanced color temperature, neutral soothing tones' },
  { id: 'cool', labelRu: 'Прохладный нордический', labelUk: 'Прохолодний нордичний', labelEn: 'Cool Nordic', promptDescription: 'crisp fresh atmosphere with cool elegant undertones' },
  { id: 'cozy', labelRu: 'Уютный (Hygge)', labelUk: 'Затишний (Hygge)', labelEn: 'Cozy (Hygge)', promptDescription: 'exceptionally cozy lived-in comfort, soft textures, tranquil sanctuary' },
  { id: 'premium', labelRu: 'Премиальный (High-End)', labelUk: 'Преміальний (High-End)', labelEn: 'Premium High-End', promptDescription: 'opulent five-star luxury penthouse atmosphere, flawless executive finish' },
  { id: 'contrast', labelRu: 'Контрастный и графичный', labelUk: 'Контрастний та графічний', labelEn: 'Bold & Graphic Contrast', promptDescription: 'striking visual contrast, rich shadows and crisp highlights, graphic depth' },
  { id: 'dramatic', labelRu: 'Драматичный (Chiaroscuro)', labelUk: 'Драматичний (Chiaroscuro)', labelEn: 'Dramatic Chiaroscuro', promptDescription: 'moody dramatic chiaroscuro lighting, deep mysterious shadows and focused illumination' },
  { id: 'natural', labelRu: 'Природный эко', labelUk: 'Природний еко', labelEn: 'Natural & Biophilic', promptDescription: 'organic nature-connected biophilic tranquility, earthy harmonious atmosphere' },
];

export const LIGHTING_OPTIONS: LightingOption[] = [
  { id: 'daylight', labelRu: 'Дневной естественный свет', labelUk: 'Денне природне світло', labelEn: 'Natural Daylight', promptDescription: 'natural bright daylight streaming through the windows, soft realistic skylight fill' },
  { id: 'diffused', labelRu: 'Пасмурный рассеянный день', labelUk: 'Хмарний розсіяний день', labelEn: 'Overcast Diffused Light', promptDescription: 'soft diffused overcast daylight, velvety shadow roll-offs, zero harsh glares' },
  { id: 'morning', labelRu: 'Утреннее восходящее солнце', labelUk: 'Ранкове східне сонце', labelEn: 'Morning Sunlight', promptDescription: 'crisp gentle morning sunshine casting long soft angled shadows across the floor' },
  { id: 'evening_cozy', labelRu: 'Вечерний теплый интерьерный свет', labelUk: 'Вечірнє тепле інтер\'єрне світло', labelEn: 'Cozy Evening Interior Light', promptDescription: 'cozy evening interior scene, glowing floor lamps, hidden cove LED strips, warm 2700K illumination' },
  { id: 'sunset_warm', labelRu: 'Закатный золотой час (Golden Hour)', labelUk: 'Західний золотий час (Golden Hour)', labelEn: 'Golden Hour Sunset', promptDescription: 'radiant golden hour sunset light beaming into the space, rich amber highlights and warm glowing dust motes' },
  { id: 'night', labelRu: 'Ночной интерьер с акцентным светом', labelUk: 'Нічний інтер\'єр із акцентним світлом', labelEn: 'Night Interior with Accent Pools', promptDescription: 'atmospheric night interior, deep blue ambient window light contrasted with warm focused spotlight pools' },
  { id: 'soft_studio', labelRu: 'Мягкий студийный свет', labelUk: 'М\'яке студійне світло', labelEn: 'Soft Studio Lighting', promptDescription: 'professional architectural magazine photo shoot lighting, ultra-balanced fill and key illumination' },
  { id: 'architectural', labelRu: 'Архитектурное скрытое освещение', labelUk: 'Архітектурне приховане освітлення', labelEn: 'Architectural Hidden Profiles', promptDescription: 'sophisticated architectural lighting design, concealed ceiling profile light, floating plinth glow, focused art spots' },
];

export const MATERIAL_OPTIONS: MaterialOption[] = [
  // 1. Дерево и натуральный шпон
  {
    id: 'wood_oak',
    category: 'wood',
    labelRu: 'Натуральный светлый дуб / ясень',
    labelUk: 'Натуральний світлий дуб / ясен',
    labelEn: 'Natural White Oak / Ash',
    promptDescription: 'natural wide-plank white oak flooring and bespoke rift-cut veneer with tactile vertical wood grain',
  },
  {
    id: 'wood_walnut',
    category: 'wood',
    labelRu: 'Благородный американский орех',
    labelUk: 'Шляхетний американський горіх',
    labelEn: 'American Walnut',
    promptDescription: 'rich deep american walnut cabinetry with vertical wood grain, chocolate undertones and satin oil finish',
  },
  {
    id: 'wood_bleached',
    category: 'wood',
    labelRu: 'Выбеленный скандинавский дуб',
    labelUk: 'Вибілений скандинавський дуб',
    labelEn: 'Bleached Scandinavian Oak',
    promptDescription: 'pale bleached scandinavian oak joinery with subtle silvery undertones and natural matte lacquer',
  },
  {
    id: 'wood_smoked',
    category: 'wood',
    labelRu: 'Мореный темный дуб',
    labelUk: 'Морений темний дуб',
    labelEn: 'Smoked Dark Oak',
    promptDescription: 'fumed dark smoked oak millwork, deep charcoal-brown grain with tactile matte oil texture',
  },
  {
    id: 'wood_thermo',
    category: 'wood',
    labelRu: 'Термоясень с выразительной текстурой',
    labelUk: 'Термоясен із виразною текстурою',
    labelEn: 'Thermo-Treated Ash',
    promptDescription: 'thermally modified ash wood with rich caramel contrast, deep organic grain and satin tactile warmth',
  },
  {
    id: 'wood_slats',
    category: 'wood',
    labelRu: 'Фактурные реечные панели / ламели',
    labelUk: 'Фактурні рейкові панелі / ламелі',
    labelEn: 'Vertical Fluted Wood Slats',
    promptDescription: 'architectural vertical fluted wood slat acoustic paneling with rhythmic shadow grooves',
  },
  {
    id: 'wood_ebony',
    category: 'wood',
    labelRu: 'Макассар / темный эбен',
    labelUk: 'Макассар / темний ебен',
    labelEn: 'Macassar Ebony Veneer',
    promptDescription: 'exotic macassar ebony wood veneer with dramatic contrasting black and warm amber flame stripes',
  },
  {
    id: 'wood_wabi',
    category: 'wood',
    labelRu: 'Состаренное дерево Wabi-Sabi',
    labelUk: 'Зістарене дерево Wabi-Sabi',
    labelEn: 'Weathered Reclaimed Wood',
    promptDescription: 'weathered wabi-sabi reclaimed timber with natural knots, crackles and authentic organic patina',
  },
  {
    id: 'wood_rattan',
    category: 'wood',
    labelRu: 'Натуральный ротанг и соломка',
    labelUk: 'Натуральний ротанг і соломка',
    labelEn: 'Natural Woven Rattan & Cane',
    promptDescription: 'natural woven cane webbing and rattan mesh with warm honey tones and open airy weave',
  },

  // 2. Натуральный камень, мрамор и кварцит
  {
    id: 'stone_natural',
    category: 'stone',
    labelRu: 'Натуральный римский травертин Navona',
    labelUk: 'Натуральний римський травертин Navona',
    labelEn: 'Roman Travertine Navona',
    promptDescription: 'porous warm beige roman travertine Navona with authentic directional veining, honed matte surface and filled cavities',
  },
  {
    id: 'marble',
    category: 'stone',
    labelRu: 'Мрамор Calacatta Gold с золотыми венами',
    labelUk: 'Мармур Calacatta Gold із золотими венами',
    labelEn: 'Calacatta Gold Marble',
    promptDescription: 'seamless bookmatched calacatta gold marble with delicate warm grey and honey-gold veining on pure white crystalline ground',
  },
  {
    id: 'stone_marquina',
    category: 'stone',
    labelRu: 'Черный мрамор Nero Marquina',
    labelUk: 'Чорний мармур Nero Marquina',
    labelEn: 'Nero Marquina Black Marble',
    promptDescription: 'deep black nero marquina marble with sharp crisp white fossil calcite veins and soft satin hone',
  },
  {
    id: 'stone_ceppo',
    category: 'stone',
    labelRu: 'Архитектурный камень Ceppo di Gré',
    labelUk: 'Архітектурний камінь Ceppo di Gré',
    labelEn: 'Ceppo di Gré Stone',
    promptDescription: 'authentic milanese ceppo di gré architectural stone with distinctive sedimentary pebble aggregate texture',
  },
  {
    id: 'stone_patagonia',
    category: 'stone',
    labelRu: 'Кварцит Patagonia с подсветкой',
    labelUk: 'Кварцит Patagonia з підсвічуванням',
    labelEn: 'Backlit Patagonia Quartzite',
    promptDescription: 'dramatic backlit translucent patagonia quartzite slab with volcanic black crystals and glowing golden quartz clusters',
  },
  {
    id: 'stone_verde',
    category: 'stone',
    labelRu: 'Изумрудный мрамор Verde Alpi',
    labelUk: 'Смарагдовий мармур Verde Alpi',
    labelEn: 'Verde Alpi Emerald Marble',
    promptDescription: 'luxurious deep forest green verde alpi marble with intricate web of pale quartz veins and polished depth',
  },
  {
    id: 'stone_onyx',
    category: 'stone',
    labelRu: 'Медовый оникс с подсветкой',
    labelUk: 'Медовий онікс із підсвічуванням',
    labelEn: 'Illuminated Honey Amber Onyx',
    promptDescription: 'translucent warm honey amber onyx feature wall with soft diffused inner ambient lighting',
  },
  {
    id: 'stone_terrazzo',
    category: 'stone',
    labelRu: 'Венецианский терраццо',
    labelUk: 'Венеціанський терацо',
    labelEn: 'Venetian Marble Terrazzo',
    promptDescription: 'seamless bespoke venetian terrazzo with tumbled botticino and carrara marble chips in warm cement matrix',
  },
  {
    id: 'stone_slate',
    category: 'stone',
    labelRu: 'Графитовый слоистый сланец',
    labelUk: 'Графітовий шаруватий сланець',
    labelEn: 'Graphite Split Slate',
    promptDescription: 'natural cleft graphite black split slate with tactile riven relief and subtle mineral sheen',
  },
  {
    id: 'stone_limestone',
    category: 'stone',
    labelRu: 'Светлый известняк Jura Beige',
    labelUk: 'Світлий вапняк Jura Beige',
    labelEn: 'Jura Beige Honed Limestone',
    promptDescription: 'warm cream jura beige limestone with delicate micro-fossil inclusions and silky smooth honed finish',
  },

  // 3. Поверхности, фасады и архитектурная отделка
  {
    id: 'microcement',
    category: 'surface',
    labelRu: 'Бесшовный шелковистый микроцемент',
    labelUk: 'Безшовний шовковистий мікроцемент',
    labelEn: 'Seamless Silk Microcement',
    promptDescription: 'smooth architectural continuous microcement plaster on floor and walls with subtle hand-troweled clouding',
  },
  {
    id: 'concrete',
    category: 'surface',
    labelRu: 'Архитектурный бетон с опалубкой',
    labelUk: 'Архітектурний бетон з опалубкою',
    labelEn: 'Board-Formed Architectural Concrete',
    promptDescription: 'authentic architectural cast concrete with fine timber formwork texture, tie-rod holes and matte tactile surface',
  },
  {
    id: 'lime_plaster',
    category: 'surface',
    labelRu: 'Декоративная известковая штукатурка Marmorino',
    labelUk: 'Декоративне вапняне тинькування Marmorino',
    labelEn: 'Marmorino Lime Plaster',
    promptDescription: 'mineral marmorino lime plaster with subtle satin burnish, velvet depth and breathable natural organic texture',
  },
  {
    id: 'surf_fenix',
    category: 'surface',
    labelRu: 'Суперматовые нано-фасады Fenix NTM',
    labelUk: 'Суперматові нано-фасади Fenix NTM',
    labelEn: 'Ultra-Matte Fenix NTM Anti-Fingerprint',
    promptDescription: 'ultra-matte velvety soft-touch fenix NTM nanotech cabinetry surfaces with zero glare and anti-fingerprint finish',
  },
  {
    id: 'surf_lacquer',
    category: 'surface',
    labelRu: 'Высокоглянцевая рояльная эмаль',
    labelUk: 'Високоглянсова рояльна емаль',
    labelEn: 'High-Gloss Piano Lacquer',
    promptDescription: 'deep high-gloss mirror-polished piano lacquer panels with crystal-clear architectural reflections',
  },
  {
    id: 'surf_porcelain',
    category: 'surface',
    labelRu: 'Крупноформатный керамогранит 120x280',
    labelUk: 'Крупноформатний керамограніт 120x280',
    labelEn: 'Large Format Porcelain Slabs',
    promptDescription: 'large format 120x280cm architectural porcelain slabs with razor-thin 1mm rectified joints and matte tactile relief',
  },
  {
    id: 'surf_acoustic_suede',
    category: 'surface',
    labelRu: 'Стеновые панели из замши / алькантары',
    labelUk: 'Стінові панелі із замші / алькантари',
    labelEn: 'Acoustic Alcantara & Suede Panels',
    promptDescription: 'plush padded geometric wall panels upholstered in taupe micro-suede alcantara with sound-absorbing warmth',
  },

  // 4. Металлы и фурнитура
  {
    id: 'metal_black',
    category: 'metal',
    labelRu: 'Черный матовый металл',
    labelUk: 'Чорний матовий метал',
    labelEn: 'Matte Black Steel',
    promptDescription: 'powder-coated matte black architectural steel profiles, slim linear hardware and minimalist magnetic track housings',
  },
  {
    id: 'metal_brass',
    category: 'metal',
    labelRu: 'Брашированная латунь / шампань',
    labelUk: 'Брашована латунь / шампань',
    labelEn: 'Brushed Champagne Brass',
    promptDescription: 'luxurious warm brushed champagne brass metal trims, linear pendant lighting fixtures and subtle golden reflections',
  },
  {
    id: 'metal_graphite',
    category: 'metal',
    labelRu: 'Шлифованная сталь / графит',
    labelUk: 'Шліфована сталь / графіт',
    labelEn: 'Brushed Graphite Stainless Steel',
    promptDescription: 'dark graphite brushed stainless steel kitchen appliances, dual-door refrigerator with directional brushed metallic sheen',
  },
  {
    id: 'metal_bronze',
    category: 'metal',
    labelRu: 'Состаренная патинированная бронза',
    labelUk: 'Зістарена патинована бронза',
    labelEn: 'Aged Patinated Bronze',
    promptDescription: 'artisanal hand-rubbed antique bronze with dark undertones and burnished metallic edge highlights',
  },
  {
    id: 'metal_chrome',
    category: 'metal',
    labelRu: 'Зеркальный полированный хром',
    labelUk: 'Дзеркальний полірований хром',
    labelEn: 'Mirror Polished Chrome',
    promptDescription: 'brilliant mirror-polished chrome architectural fixtures with razor-sharp specular highlights',
  },
  {
    id: 'metal_copper',
    category: 'metal',
    labelRu: 'Теплая сатинированная медь',
    labelUk: 'Тепла сатинована мідь',
    labelEn: 'Warm Satin Copper',
    promptDescription: 'warm reddish satin-brushed pure copper accents with glowing ambient reflection',
  },

  // 5. Стекло и зеркала
  {
    id: 'glass',
    category: 'glass',
    labelRu: 'Осветленное стекло Optiwhite',
    labelUk: 'Освітлене скло Optiwhite',
    labelEn: 'Optiwhite Architectural Glass',
    promptDescription: 'ultra-clear low-iron optiwhite architectural glass with true color transmission and realistic refractive index',
  },
  {
    id: 'glass_fluted',
    category: 'glass',
    labelRu: 'Рифленое стекло Fluted / Moru',
    labelUk: 'Рифлене скло Fluted / Moru',
    labelEn: 'Fluted Reeded Architectural Glass',
    promptDescription: 'narrow-ribbed architectural fluted reeded glass cabinet doors with soft diffused light distortion',
  },
  {
    id: 'glass_smoked',
    category: 'glass',
    labelRu: 'Тонированное графитовое стекло',
    labelUk: 'Тоноване графітове скло',
    labelEn: 'Smoked Graphite Glass',
    promptDescription: 'semi-transparent dark smoked graphite glass showcase partitions with backlit interior display glow',
  },
  {
    id: 'mirror_bronze',
    category: 'glass',
    labelRu: 'Осветленное бронзовое зеркало',
    labelUk: 'Освітлене бронзове дзеркало',
    labelEn: 'Bronze Tinted Mirror',
    promptDescription: 'tinted architectural bronze mirror splashback reflecting warm ambient interior light with deep honey glow',
  },

  // 6. Текстиль, обивка и кожа
  {
    id: 'boucle',
    category: 'textile',
    labelRu: 'Тактильное букле и шерсть',
    labelUk: 'Тактильне букле та вовна',
    labelEn: 'Tactile Bouclé Wool',
    promptDescription: 'tactile off-white oatmeal bouclé wool upholstery fabric with rich chunky loop texture on dining chairs',
  },
  {
    id: 'linen',
    category: 'textile',
    labelRu: 'Фактурный лен и хлопок',
    labelUk: 'Фактурний льон і бавовна',
    labelEn: 'Slubbed Natural Organic Linen',
    promptDescription: 'heavy slubbed natural unbleached flax linen drapery with natural organic drape and tactile weave',
  },
  {
    id: 'fabric_velvet',
    category: 'textile',
    labelRu: 'Глубокий матовый хлопковый бархат',
    labelUk: 'Глибокий матовий бавовняний оксамит',
    labelEn: 'Deep Matte Cotton Velvet',
    promptDescription: 'luxurious dense matte cotton velvet upholstery with deep shadows and soft subtle nap highlights',
  },
  {
    id: 'leather',
    category: 'textile',
    labelRu: 'Премиальная полуанилиновая кожа',
    labelUk: 'Преміальна напіванілінова шкіра',
    labelEn: 'Semi-Aniline Leather',
    promptDescription: 'buttery-soft full-grain semi-aniline leather with natural pebble grain and precision saddle stitching',
  },
  {
    id: 'leather_cognac',
    category: 'textile',
    labelRu: 'Винтажная коньячная кожа с патиной',
    labelUk: 'Вінтажна коньячна шкіра з патиною',
    labelEn: 'Vintage Cognac Saddle Leather',
    promptDescription: 'warm cognac saddle leather with rich natural distress, subtle pull-up pull effect and aged warmth',
  },
  {
    id: 'fabric_chenille',
    category: 'textile',
    labelRu: 'Мягкий матовый шенилл',
    labelUk: 'М\'який матовий шенілл',
    labelEn: 'Plush Matte Chenille Upholstery',
    promptDescription: 'durable plush matte chenille upholstery yarn with cozy micro-texture and soft light-absorbing feel',
  },
];

export interface PromptBuildParams {
  roomType: RoomType;
  style: InteriorStyle;
  geometryMode: GeometryPreservationMode;
  lightingId: string;
  atmosphereId: string;
  selectedMaterials: string[];
  materialReferences?: import('../types/project').MaterialReference[];
  customUserPrompt?: string;
  customMaterials?: string;
  customStyle?: string;
  customLighting?: string;
  customDecor?: string;
}

export function buildArchitecturalNegativePrompt(): string {
  return 'mixed cabinet finishes, unintended white kitchen cabinets, changed room layout, changed architecture, changed camera angle, different perspective, relocated furniture, missing furniture, extra furniture, duplicated objects, redesigned kitchen, altered cabinets, changed window positions, changed door positions, distorted geometry, warped walls, floating objects, malformed appliances, unrealistic proportions, invented architectural elements, excessive decoration, cartoon, illustration, painting, low quality, blurry textures, white clay, monochrome, grey 3d render, wireframe, plastic CGI, raw unfinished model, wavy wood grain, liquid textures, oversaturated, burnt contrast, green ceiling tint, melted metal, plastic veneer, watermark, signature';
}

export function buildArchitecturalPositivePrompt(params: PromptBuildParams): string {
  const room = ROOM_TYPES.find((r) => r.id === params.roomType) || ROOM_TYPES[0];
  const lighting = LIGHTING_OPTIONS.find((l) => l.id === params.lightingId) || LIGHTING_OPTIONS[0];
  const atmosphere = ATMOSPHERE_OPTIONS.find((a) => a.id === params.atmosphereId) || ATMOSPHERE_OPTIONS[0];
  const materialsList = params.selectedMaterials
    .map((mId) => MATERIAL_OPTIONS.find((m) => m.id === mId)?.promptDescription)
    .filter(Boolean)
    .join(', ');

  let materialRefsDirective = '';
  if (params.materialReferences && params.materialReferences.length > 0) {
    const lines = params.materialReferences.map((ref) => {
      const surface = ref.targetSurface.toUpperCase();
      const details = [
        ref.name,
        ref.notes ? `(${ref.notes})` : '',
        ref.url ? `[Catalog Spec: ${ref.url}]` : '',
        ref.imageBase64 ? '[Visual Swatch Image Attached]' : '',
      ].filter(Boolean).join(' ');
      return `- Target Surface: ${surface} -> ${details}`;
    });

    materialRefsDirective = `\n\nEXACT ARCHITECTURAL MATERIAL REFERENCES & SWATCHES:
You MUST map the following designer materials to their exact designated architectural surfaces:
${lines.join('\n')}
Match the grain, reflection roughness, diffuse color, and tactile micro-details of these specified materials precisely.`;
  }

  const customSections: string[] = [];
  if (params.customMaterials && params.customMaterials.trim().length > 0) {
    customSections.push(`Architect's Custom Materials & Surface Finishes: ${params.customMaterials.trim()}`);
  }
  if (params.customStyle && params.customStyle.trim().length > 0) {
    customSections.push(`Architect's Custom Style Direction: ${params.customStyle.trim()}`);
  }
  if (params.customLighting && params.customLighting.trim().length > 0) {
    customSections.push(`Architect's Custom Lighting & Fixtures: ${params.customLighting.trim()}`);
  }
  if (params.customDecor && params.customDecor.trim().length > 0) {
    customSections.push(`Architect's Custom Decor & Accent Props: ${params.customDecor.trim()}`);
  }
  const customBlock = customSections.length > 0 ? `\n\nARCHITECT CUSTOM SPECIFICATIONS:\n${customSections.join('\n')}` : '';

  const corePrompt = `Transform the provided architectural clay render into a highly photorealistic professional interior photograph.

CRITICAL: The uploaded image is the exact architectural reference and must remain the primary structural source.

Preserve the original camera position, camera angle, perspective, room dimensions, wall positions, ceiling height, windows, doors, openings, furniture placement, cabinet dimensions, appliance locations, object proportions and overall composition.

Do not redesign the room.

Do not move, replace, remove, duplicate or invent furniture, kitchen cabinets, appliances, architectural elements or large decorative objects.

Do not change the shape, dimensions or arrangement of any existing object.

Only improve the visual appearance of the existing scene through physically realistic materials, surface textures, natural lighting, ambient illumination, realistic shadows, reflections, material roughness and professional architectural photography.

Apply realistic wood, stone, ceramic, glass, metal and fabric materials only where appropriate to the existing objects.

The final image must depict the same room, from exactly the same viewpoint, with the same composition and object placement as the input image.

The result should look like a real photograph of the completed interior, not a redesigned or newly invented room.

Space Type: ${room.labelEn} (${room.labelRu}).
Design Style: ${params.style.name} — ${params.style.promptKeywords}.
Atmosphere: ${atmosphere.promptDescription}.
Lighting Scheme: ${lighting.promptDescription}.
${materialsList ? `Material Palette: ${materialsList}.` : ''}
${materialRefsDirective}${customBlock}

Photographic & Rendering Standards:
Ultra-high resolution interior architecture photograph, shot on a Hasselblad H6D-100c with 24mm tilt-shift architectural lens, perfectly corrected vertical lines. Realistic global illumination, physically based materials (PBR), authentic subsurface scattering, accurate Fresnel reflections, micro-surface imperfections, and soft ambient occlusion in room corners.`;

  if (params.customUserPrompt && params.customUserPrompt.trim().length > 0) {
    return `${corePrompt}\n\nSpecific Architect Directives:\n${params.customUserPrompt.trim()}`;
  }

  return corePrompt;
}

export function buildSmartPrompt(params: PromptBuildParams): string {
  return buildArchitecturalPositivePrompt(params);
}
