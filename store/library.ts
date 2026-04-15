import { create } from 'zustand'
import { supabase, Book, RewardLog } from '../lib/supabase'

const SEED_BOOKS: Book[] = [
  {id:'001',title:'La Mitologia Clasica',author:'Margot Arnand',status:'finished',rating:5,genre:'Mitologia',isbn:'0517183080'},
  {id:'002',title:'El corazon delator y otros cuentos',author:'Edgar Allan Poe',status:'finished',rating:4,genre:'Terror',isbn:'9789871534906'},
  {id:'003',title:'La belleza de los locos',author:'Fernando Colina',status:'finished',rating:3,genre:'Ensayo'},
  {id:'004',title:'Imago mundi',author:'Rafael Arraiz Lucca',status:'finished',rating:5,genre:'Poesia'},
  {id:'005',title:'Los detectives salvajes',author:'Roberto Bolano',status:'finished',rating:5,genre:'Ficcion',isbn:'9788433973498'},
  {id:'006',title:'El Cuervo',author:'Edgar Allan Poe',status:'finished',rating:5,genre:'Poesia',isbn:'9780486266855'},
  {id:'007',title:'Aquelarre de cuentos',author:'Ines Ordiz',status:'finished',rating:4,genre:'Terror'},
  {id:'008',title:'Batman',author:'Ostrander, Mandrake',status:'finished',rating:4,genre:'Comic'},
  {id:'009',title:'Los cuadernos de la cazadora Aterka',author:'Rocio Cuervo',status:'finished',rating:4,genre:'Fantasia'},
  {id:'010',title:'Amantes Ilustrado',author:'Oliverio Girondo',status:'finished',rating:5,genre:'Poesia'},
  {id:'011',title:'Cuentos Completos 3',author:'Julio Cortazar',status:'finished',rating:4,genre:'Cuentos'},
  {id:'012',title:'Cuentos completos',author:'Julio Cortazar',status:'finished',rating:4,genre:'Cuentos',isbn:'9788420432342'},
  {id:'013',title:'El ingenio maligno',author:'Rafael Angel Herra',status:'finished',rating:3,genre:'Filosofia'},
  {id:'014',title:'Textos selectos',author:'Oliverio Girondo',status:'finished',rating:5,genre:'Poesia'},
  {id:'015',title:'Snuff',author:'Chuck Palahniuk',status:'finished',rating:5,genre:'Ficcion',isbn:'9780307275837'},
  {id:'016',title:'Flower Crowns and Fearsome Things',author:'Amanda Lovelace',status:'finished',rating:4,genre:'Poesia'},
  {id:'017',title:'Different',author:'Monica Montanes',status:'finished',rating:4,genre:'Ficcion'},
  {id:'018',title:'Etica eudemia',author:'Aristoteles',status:'finished',rating:5,genre:'Filosofia'},
  {id:'019',title:'Persuasion de los dias',author:'Oliverio Girondo',status:'finished',rating:5,genre:'Poesia'},
  {id:'020',title:'En la masmedula',author:'Oliverio Girondo',status:'finished',rating:5,genre:'Poesia'},
  {id:'021',title:'Cartas de mama',author:'Julio Cortazar',status:'finished',rating:4,genre:'Cuentos'},
  {id:'022',title:'El dueno de la luz',author:'Ivonne Rivas',status:'finished',rating:5,genre:'Poesia'},
  {id:'023',title:'Death at the Sanatorium',author:'Ragnar Jonasson',status:'finished',rating:5,genre:'Thriller',isbn:'9781914585906'},
  {id:'024',title:'La cromatologia de la muerte',author:'Lucas Blanco Moreno',status:'finished',rating:3,genre:'Poesia'},
  {id:'025',title:'The Active Side of Infinity',author:'Carlos Castaneda',status:'finished',rating:5,genre:'Espiritualidad',isbn:'9780060931162'},
  {id:'026',title:'El Amor Inteligente',author:'Enrique Rojas',status:'finished',rating:2,genre:'Psicologia'},
  {id:'027',title:'Asfixia',author:'Chuck Palahniuk',status:'finished',rating:5,genre:'Ficcion',isbn:'9780385720922'},
  {id:'028',title:'Ficciones',author:'Jorge Luis Borges',status:'finished',rating:5,genre:'Cuentos',isbn:'9788420633138'},
  {id:'029',title:'La sanguijuela de mi nina',author:'Christopher Moore',status:'finished',rating:4,genre:'Humor'},
  {id:'030',title:'La Fanfarlo',author:'Charles Baudelaire',status:'finished',rating:5,genre:'Poesia'},
  {id:'031',title:'Poesias Selectas',author:'Charles Baudelaire',status:'finished',rating:5,genre:'Poesia'},
  {id:'032',title:'Diccionario de los suenos',author:'Debra Simko',status:'finished',rating:3,genre:'Psicologia'},
  {id:'033',title:'Historias de cronopios y de famas',author:'Julio Cortazar',status:'finished',rating:5,genre:'Cuentos',isbn:'9788437604169'},
  {id:'034',title:'El caballero de la armadura oxidada',author:'Robert Fisher',status:'finished',rating:5,genre:'Fabula',isbn:'9788497990011'},
  {id:'035',title:'Vampiros',author:'Le Fanu, Tolstoi, Polidori',status:'finished',rating:4,genre:'Terror'},
  {id:'036',title:'Condenada',author:'Chuck Palahniuk',status:'finished',rating:5,genre:'Ficcion',isbn:'9780385676717'},
  {id:'037',title:'La muchacha indecible',author:'Giorgio Agamben',status:'finished',rating:5,genre:'Filosofia'},
  {id:'038',title:'Rebelion en la granja',author:'George Orwell',status:'finished',rating:5,genre:'Satira',isbn:'9788499890081'},
  {id:'039',title:'The Arrival',author:'Shaun Tan',status:'finished',rating:5,genre:'Novela Grafica',isbn:'9780734407993'},
  {id:'040',title:'La condesa sangrienta',author:'Alejandra Pizarnik',status:'finished',rating:5,genre:'Terror',isbn:'9788415862680'},
  {id:'041',title:'Batman Character Encyclopedia',author:'Matthew K. Manning',status:'finished',rating:4,genre:'Comic',isbn:'9781465455925'},
  {id:'042',title:'Sana a Tus Antepasados',author:'Shelley A. Kaehr',status:'finished',rating:4,genre:'Espiritualidad'},
  {id:'043',title:'Jung, Un Viaje Hacia Si Mismo',author:'Frederic Lenoir',status:'finished',rating:4,genre:'Psicologia'},
  {id:'044',title:'Ocho millones de maneras de morir',author:'Lawrence Block',status:'reading',progress:31,genre:'Noir',isbn:'9780380712861'},
  {id:'045',title:'Mis mejores amigos',author:'Vinicio Romero Martinez',status:'pending',genre:'Ficcion'},
  {id:'046',title:'Dolores Claiborne',author:'Stephen King',status:'pending',genre:'Terror',isbn:'9788490326237'},
  {id:'047',title:'Confianza en uno Mismo',author:'Ralph Waldo Emerson',status:'pending',genre:'Filosofia'},
  {id:'048',title:'Rayuela',author:'Julio Cortazar',status:'pending',genre:'Ficcion',isbn:'9788437604183'},
  {id:'049',title:'The Clowns of God',author:'Morris West',status:'pending',genre:'Thriller'},
  {id:'050',title:'Mujeres que corren con los lobos',author:'Clarissa Pinkola Estes',status:'pending',genre:'Psicologia'},
  {id:'051',title:'Library of Souls',author:'Ransom Riggs',status:'pending',genre:'Fantasia',isbn:'9781594748400'},
  {id:'052',title:'The Master and Margarita',author:'Mikhail Bulgakov',status:'pending',genre:'Satira'},
  {id:'053',title:'El monte de las animas',author:'Gustavo Adolfo Becquer',status:'pending',genre:'Terror'},
  {id:'054',title:'Fight Club',author:'Chuck Palahniuk',status:'pending',genre:'Ficcion',isbn:'9780393327345'},
  {id:'055',title:'Memento',author:'Begona Quesada',status:'pending',genre:'Ficcion'},
  {id:'056',title:'El Anticristo',author:'Friedrich Nietzsche',status:'pending',genre:'Filosofia'},
  {id:'057',title:'Dracula and Other Horror Classics',author:'Bram Stoker',status:'pending',genre:'Terror'},
  {id:'058',title:'Illuminations',author:'Alan Moore',status:'pending',genre:'Cuentos'},
  {id:'059',title:'Batman Night of the Owls',author:'Various',status:'pending',genre:'Comic'},
  {id:'060',title:'Venenos',author:'Ben Hubbard',status:'pending',genre:'Divulgacion'},
  {id:'061',title:'El Libro de Los Mediums',author:'Allan Kardec',status:'pending',genre:'Espiritualidad'},
  {id:'062',title:'Acerca del alma',author:'Aristoteles',status:'pending',genre:'Filosofia'},
  {id:'063',title:'Nocturnos',author:'Javier Perez Campos',status:'pending',genre:'Poesia'},
  {id:'064',title:'Wolverine Origin',author:'Paul Jenkins',status:'pending',genre:'Comic'},
  {id:'065',title:'Classic Ghost Stories',author:'Miles Kelly',status:'pending',genre:'Terror',isbn:'9781789995308'},
  {id:'066',title:'Muchas vidas muchos maestros',author:'Brian L. Weiss',status:'pending',genre:'Espiritualidad'},
  {id:'067',title:'La Invencion del Sonido',author:'Chuck Palahniuk',status:'pending',genre:'Terror'},
  {id:'068',title:'The Life of Chuck',author:'Stephen King',status:'pending',genre:'Ficcion'},
  {id:'069',title:'Sakura',author:'Elaine Vilar Madruga',status:'pending',genre:'Fantasia'},
  {id:'070',title:'El eco de mis muertes',author:'Santiago Caruso',status:'pending',genre:'Poesia'},
  {id:'071',title:'The Woman in White',author:'Wilkie Collins',status:'wishlist',genre:'Misterio',isbn:'9780141439617'},
]

const INITIAL_REWARDS: RewardLog[] = [
  {type:'earn',label:'Jung, Un Viaje Hacia Si Mismo',amount:10,date:'10/4/2026'},
  {type:'earn',label:'Regresiones transgeneracionales',amount:10,date:'10/4/2026'},
  {type:'earn',label:'El caballero de la armadura oxidada',amount:10,date:'10/4/2026'},
]

type Store = {
  books: Book[]
  rewards: RewardLog[]
  rewPerBook: number
  initialized: boolean
  init: () => Promise<void>
  addBook: (b: Book) => Promise<void>
  updateBook: (id: string, data: Partial<Book>) => Promise<void>
  addReward: (r: RewardLog) => Promise<void>
  setRewPerBook: (n: number) => void
  deleteBook: (id: string) => Promise<void>
  deleteReward: (index: number) => Promise<void>
  balance: () => number
}

export const useLibrary = create<Store>((set, get) => ({
  books: [],
  rewards: [],
  rewPerBook: 10,
  initialized: false,

  init: async () => {
    const { data: books } = await supabase.from('books').select('*').order('created_at')
    const { data: rewards } = await supabase.from('reward_log').select('*').order('created_at')

    if (!books || books.length === 0) {
      await supabase.from('books').insert(SEED_BOOKS)
      await supabase.from('reward_log').insert(INITIAL_REWARDS)
      set({ books: SEED_BOOKS, rewards: INITIAL_REWARDS, initialized: true })
    } else {
      set({ books: books as Book[], rewards: (rewards || []) as RewardLog[], initialized: true })
    }
  },

  addBook: async (b) => {
    await supabase.from('books').insert(b)
    set(s => ({ books: [b, ...s.books] }))
  },

  updateBook: async (id, data) => {
    await supabase.from('books').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
    set(s => ({ books: s.books.map(b => b.id === id ? { ...b, ...data } : b) }))
  },

  addReward: async (r) => {
    await supabase.from('reward_log').insert(r)
    set(s => ({ rewards: [...s.rewards, r] }))
  },

  setRewPerBook: (n) => set({ rewPerBook: n }),

  deleteBook: async (id) => {
    await supabase.from('books').delete().eq('id', id)
    set(s => ({ books: s.books.filter(b => b.id !== id) }))
  },

  deleteReward: async (index) => {
    const { rewards } = get()
    const r = rewards[index]
    if (!r) return
    if (r.id) await supabase.from('reward_log').delete().eq('id', r.id)
    set(s => ({ rewards: s.rewards.filter((_, i) => i !== index) }))
  },

  balance: () => get().rewards.reduce((a, r) => a + (r.type === 'earn' ? r.amount : -r.amount), 0),
}))
