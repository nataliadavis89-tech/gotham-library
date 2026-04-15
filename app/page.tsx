'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useLibrary } from '../store/library'
import { Book, BookStatus, supabase } from '../lib/supabase'

const STATUS_COLORS: Record<string, string> = {
  finished: '#4ADE80', reading: '#60A5FA', pending: '#C9A84C',
  wishlist: '#F87171', abandoned: '#9A9289'
}
const STATUS_LABELS: Record<string, string> = {
  finished: 'TERMINADO', reading: 'LEYENDO', pending: 'PENDIENTE',
  wishlist: 'OBJETIVO', abandoned: 'ABANDONADO'
}

async function uploadCover(file: File, bookId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${bookId}.${ext}`
  const { error } = await supabase.storage.from('covers').upload(path, file, { upsert: true })
  if (error) { console.error(error); return null }
  const { data } = supabase.storage.from('covers').getPublicUrl(path)
  return data.publicUrl
}

function CoverImg({ isbn, customCover, size = 48, height = 66, bookId, onCoverChange }: {
  isbn?: string; customCover?: string; size?: number; height?: number;
  bookId?: string; onCoverChange?: (url: string) => void
}) {
  const [ok, setOk] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const uri = customCover || (isbn && ok ? `https://covers.openlibrary.org/b/isbn/${isbn.replace(/[^0-9X]/gi,'')}-M.jpg` : null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onCoverChange) return
    setUploading(true)
    try {
      const canvas = document.createElement('canvas')
      const img = document.createElement('img')
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const maxW = 200, maxH = 280
        let w = img.width, h = img.height
        if (w > maxW) { h = h * maxW / w; w = maxW }
        if (h > maxH) { w = w * maxH / h; h = maxH }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        URL.revokeObjectURL(url)
        onCoverChange(dataUrl)
        setUploading(false)
      }
      img.onerror = () => { alert('Error cargando imagen'); setUploading(false) }
      img.src = url
    } catch(err: any) {
      alert('Error: ' + err.message)
      setUploading(false)
    }
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height }}>
      {uri
        ? <img src={uri} onError={() => setOk(false)} style={{ width: size, height, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: size, height, background: '#1a1a1a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #C9A84C22' }}>
            <span style={{ fontSize: size > 60 ? 24 : 14, opacity: 0.4 }}>🦇</span>
          </div>
      }
      {onCoverChange && bookId && (
        <>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: uploading ? 'rgba(201,168,76,0.8)' : 'rgba(0,0,0,0.75)', border: 'none', color: '#fff', fontSize: 9, padding: '4px 0', borderRadius: '0 0 6px 6px', cursor: 'pointer', fontWeight: 600 }}>
            {uploading ? '...' : '📷 Cambiar'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </>
      )}
      
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: STATUS_COLORS[status], border: `1px solid ${STATUS_COLORS[status]}44`, borderRadius: 4, padding: '2px 6px' }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function Stars({ rating, onChange }: { rating?: number; onChange?: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} onClick={() => onChange?.(i)} style={{ color: (rating||0) >= i ? '#C9A84C' : '#333', fontSize: 16, cursor: onChange ? 'pointer' : 'default' }}>★</span>
      ))}
      
    </div>
  )
}

type View = 'home' | 'library' | 'add' | 'recommend' | 'profile' | 'detail' | 'rewards'

export default function App() {
  const { books, rewards, rewPerBook, initialized, init, addBook, updateBook, addReward, setRewPerBook, balance } = useLibrary()
  const [view, setView] = useState<View>('home')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [libFilter, setLibFilter] = useState('all')
  const [libSort, setLibSort] = useState('default')
  const [libSearch, setLibSearch] = useState('')
  const [addMode, setAddMode] = useState<'isbn'|'search'|'manual'|'manuscript'>('search')
  const [manuTitle, setManuTitle] = useState('')
  const [manuAuthor, setManuAuthor] = useState('')
  const [manuStatus, setManuStatus] = useState<BookStatus>('pending')
  const [manuPages, setManuPages] = useState(0)
  const [manuProcessing, setManuProcessing] = useState(false)
  const [manuDone, setManuDone] = useState(false)
  const manuFileRef = useRef<HTMLInputElement>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [newBook, setNewBook] = useState<Partial<Book>>({ status: 'pending' })
  const [wishTab, setWishTab] = useState<'recs'|'wishlist'>('recs')
  const [wishSearch, setWishSearch] = useState('')
  const [wishResults, setWishResults] = useState<any[]>([])
  const [recGenres, setRecGenres] = useState<string[]>(['Terror','Ficcion'])
  const [showGenrePicker, setShowGenrePicker] = useState(false)
  const [profileModal, setProfileModal] = useState<{type:'author'|'genre', value:string}|null>(null)
  const [recs, setRecs] = useState<any[]>([])
  const [rewardForm, setRewardForm] = useState<'edit'|'add'|'spend'|null>(null)
  const [rewardAmt, setRewardAmt] = useState('')
  const [rewardDesc, setRewardDesc] = useState('')

  useEffect(() => { init() }, [])

  const finished = books.filter(b => b.status === 'finished')
  const reading = books.filter(b => b.status === 'reading')
  const pending = books.filter(b => b.status === 'pending')
  const wishlist = books.filter(b => b.status === 'wishlist')

  const goBook = (b: Book) => { setSelectedBook(b); setView('detail') }

  const filteredBooks = books
    .filter(b => libFilter === 'all' || b.status === libFilter)
    .filter(b => !libSearch || b.title.toLowerCase().includes(libSearch.toLowerCase()) || b.author.toLowerCase().includes(libSearch.toLowerCase()))
    .sort((a, b) => {
      if (libSort === 'title_asc') return a.title.localeCompare(b.title)
      if (libSort === 'title_desc') return b.title.localeCompare(a.title)
      if (libSort === 'rating_desc') return (b.rating||0) - (a.rating||0)
      return 0
    })

  const searchOL = async (q: string) => {
    if (q.length < 3) { setSearchResults([]); return }
    setSearching(true)
    try {
      const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,isbn,cover_i,first_publish_year`)
      const j = await r.json()
      setSearchResults(j.docs || [])
    } catch {}
    setSearching(false)
  }

  const searchWishOL = async (q: string) => {
    if (q.length < 3) { setWishResults([]); return }
    try {
      const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,isbn,cover_i,first_publish_year`)
      const j = await r.json()
      setWishResults(j.docs || [])
    } catch {}
  }

  const handleAddBook = async () => {
    if (!newBook.title) return alert('El titulo es obligatorio')
    const b: Book = { id: 'u' + Date.now(), title: newBook.title!, author: newBook.author || 'Desconocido', status: newBook.status || 'pending', ...newBook }
    await addBook(b)
    setNewBook({ status: 'pending' }); setSearchQ(''); setSearchResults([])
    alert(`"${b.title}" añadido al archivo`)
    setView('library')
  }

  const BOOKS_DB: Record<string, any[]> = {
    'Terror': [{title:'The Haunting of Hill House',author:'Shirley Jackson',isbn:'9780143039983'},{title:'House of Leaves',author:'Mark Z. Danielewski',isbn:'9780375703768'},{title:'Mexican Gothic',author:'Silvia Moreno-Garcia',isbn:'9780525620785'},{title:'Lullaby',author:'Chuck Palahniuk',isbn:'9780385722148'},{title:'Bird Box',author:'Josh Malerman',isbn:'9780062259653'},{title:'It',author:'Stephen King',isbn:'9781501156700'}],
    'Ficcion': [{title:'Orbital',author:'Samantha Harvey',isbn:'9780802163028'},{title:'James',author:'Percival Everett',isbn:'9780385550369'},{title:'Beloved',author:'Toni Morrison',isbn:'9781400033416'},{title:'A Little Life',author:'Hanya Yanagihara',isbn:'9780804172707'},{title:'Pachinko',author:'Min Jin Lee',isbn:'9781455563920'},{title:'Shuggie Bain',author:'Douglas Stuart',isbn:'9780802148049'}],
    'Poesia': [{title:'Las flores del mal',author:'Charles Baudelaire',isbn:'9788420633411'},{title:'Trilce',author:'Cesar Vallejo',isbn:'9788420655123'},{title:'Ariel',author:'Sylvia Plath',isbn:'9780060908195'},{title:'Desolacion',author:'Gabriela Mistral',isbn:'9789500395014'},{title:'Howl',author:'Allen Ginsberg',isbn:'9780872860179'},{title:'Leaves of Grass',author:'Walt Whitman',isbn:'9780140421988'}],
    'Filosofia': [{title:'El ser y la nada',author:'Jean-Paul Sartre',isbn:'9789500394963'},{title:'Meditaciones',author:'Marco Aurelio',isbn:'9788420671031'},{title:'The Myth of Sisyphus',author:'Albert Camus',isbn:'9780679733737'},{title:'Beyond Good and Evil',author:'Friedrich Nietzsche',isbn:'9780140449235'},{title:'Being and Time',author:'Martin Heidegger',isbn:'9780061575594'},{title:'The Ethics',author:'Baruch Spinoza',isbn:'9780140435719'}],
    'Cuentos': [{title:'El aleph',author:'Jorge Luis Borges',isbn:'9788420671048'},{title:'Exhalation',author:'Ted Chiang',isbn:'9781101947890'},{title:'Dublineses',author:'James Joyce',isbn:'9788420633060'},{title:'Interpreter of Maladies',author:'Jhumpa Lahiri',isbn:'9780395927205'},{title:'The Bazaar of Bad Dreams',author:'Stephen King',isbn:'9781476727059'},{title:'Men Without Women',author:'Haruki Murakami',isbn:'9781101974599'}],
    'Ciencia Ficcion': [{title:'El problema de los tres cuerpos',author:'Liu Cixin',isbn:'9780765377067'},{title:'Dune',author:'Frank Herbert',isbn:'9780441013593'},{title:'The Left Hand of Darkness',author:'Ursula K. Le Guin',isbn:'9780441478125'},{title:'Never Let Me Go',author:'Kazuo Ishiguro',isbn:'9781400078776'},{title:'Station Eleven',author:'Emily St. John Mandel',isbn:'9780385353304'},{title:'Hyperion',author:'Dan Simmons',isbn:'9780553283686'}],
    'Psicologia': [{title:'El hombre en busca de sentido',author:'Viktor Frankl',isbn:'9788425432026'},{title:'El cuerpo lleva la cuenta',author:'Bessel van der Kolk',isbn:'9788416253821'},{title:'Thinking Fast and Slow',author:'Daniel Kahneman',isbn:'9780374533557'},{title:'Attached',author:'Amir Levine',isbn:'9781585429050'},{title:'Flow',author:'Mihaly Csikszentmihalyi',isbn:'9780061339202'},{title:'Emotional Intelligence',author:'Daniel Goleman',isbn:'9780553383713'}],
  }

  const generateRecs = () => {
    const pool: any[] = []
    recGenres.forEach(g => { if (BOOKS_DB[g]) pool.push(...BOOKS_DB[g].map(b => ({...b, genre: g}))) })
    const owned = new Set(books.map(b => b.title.toLowerCase()))
    const filtered = pool.filter(r => !owned.has(r.title.toLowerCase()))
    setRecs([...(filtered.length >= 6 ? filtered : pool)].sort(() => Math.random() - 0.5).slice(0, 8))
    setShowGenrePicker(false)
  }

  useEffect(() => { generateRecs() }, [])

  const nav = (v: View) => setView(v)

  if (!initialized) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 32 }}>🦇</span>
      <span style={{ color: '#C9A84C', fontSize: 12, letterSpacing: 2 }}>GOTHAM LIBRARY</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#080808', position: 'relative' }}>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 70 }}>

        {/* HOME */}
        {view === 'home' && (
          <div>
            <div style={{ background: '#111', padding: '14px 16px', borderBottom: '1px solid #C9A84C22' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C', letterSpacing: 2 }}>GOTHAM</div>
              <div style={{ fontSize: 8, color: '#5C574F', letterSpacing: 2 }}>LIBRARY</div>
            </div>
            <div style={{ background: '#1a1a1a', padding: 16, borderBottom: '1px solid #C9A84C11' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#5C574F' }}>BIENVENIDA</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#C9A84C' }}>Emefreak</div>
              <div style={{ fontSize: 10, color: '#9A9289', marginTop: 2 }}>{books.length} casos en el archivo</div>
            </div>
            <div style={{ display: 'flex', gap: 6, padding: 10 }}>
              {[
                { n: finished.length, l: 'TERMINADOS', c: '#4ADE80', f: 'finished' },
                { n: reading.length, l: 'LEYENDO', c: '#60A5FA', f: 'reading' },
                { n: pending.length, l: 'PENDIENTES', c: '#9A9289', f: 'pending' },
                { n: balance(), l: 'ALCANCIA€', c: '#C9A84C', f: 'rewards' },
              ].map(s => (
                <button key={s.f} onClick={() => s.f === 'rewards' ? nav('rewards') : (setLibFilter(s.f), nav('library'))}
                  style={{ flex: 1, background: '#1a1a1a', border: '1px solid #ffffff08', borderRadius: 8, padding: 8, cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.n}</div>
                  <div style={{ fontSize: 7, color: '#5C574F', marginTop: 2 }}>{s.l}</div>
                </button>
              ))}
            </div>

            {[
              { items: reading, label: 'EN PROGRESO', color: '#60A5FA', filter: 'reading', showProgress: true },
              { items: pending, label: 'PENDIENTES DE LEER', color: '#C9A84C', filter: 'pending', showProgress: false },
              { items: finished, label: 'CASOS CERRADOS', color: '#4ADE80', filter: 'finished', showProgress: false },
            ].map(sec => sec.items.length > 0 && (
              <div key={sec.label} style={{ margin: '10px 12px', background: '#1a1a1a', borderRadius: 12, borderLeft: `3px solid ${sec.color}`, paddingTop: 12, paddingBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: sec.color }} />
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: sec.color }}>{sec.label}</span>
                  </div>
                  <button onClick={() => { setLibFilter(sec.filter); nav('library') }} style={{ fontSize: 9, color: '#5C574F', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Ver todos ({sec.items.length}) →
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 14px 4px' }}>
                  {sec.items.slice(0, 10).map(b => (
                    <button key={b.id} onClick={() => goBook(b)} style={{ background: 'none', border: 'none', cursor: 'pointer', width: 80, flexShrink: 0, textAlign: 'center' }}>
                      <CoverImg isbn={b.isbn} customCover={b.custom_cover} size={72} height={100} />
                      <div style={{ fontSize: 8, color: '#E4DFD6', marginTop: 5, lineHeight: 1.3, width: 80, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.title}</div>
                      <div style={{ fontSize: 7, color: '#5C574F', marginTop: 2 }}>{b.author}</div>
                      {sec.showProgress && b.progress ? (
                        <div style={{ width: 72, height: 2, background: '#222', borderRadius: 1, marginTop: 4 }}>
                          <div style={{ width: `${b.progress}%`, height: '100%', background: '#60A5FA', borderRadius: 1 }} />
                        </div>
                      ) : null}
                      {b.rating ? <div style={{ fontSize: 8, color: '#C9A84C', marginTop: 2 }}>{'★'.repeat(b.rating)}</div> : null}
                    </button>
                  ))}
                  {sec.items.length > 10 && (
                    <button onClick={() => { setLibFilter(sec.filter); nav('library') }} style={{ width: 60, height: 100, background: '#222', borderRadius: 8, border: '1px solid #C9A84C22', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 24, color: '#C9A84C' }}>›</span>
                      <span style={{ fontSize: 9, color: '#5C574F' }}>Ver todos</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LIBRARY */}
        {view === 'library' && (
          <div>
            <div style={{ background: '#111', padding: '14px 16px', borderBottom: '1px solid #C9A84C22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C', letterSpacing: 2 }}>GOTHAM</div>
                <div style={{ fontSize: 8, color: '#5C574F', letterSpacing: 2 }}>BIBLIOTECA</div>
              </div>
              <select value={libSort} onChange={e => setLibSort(e.target.value)} style={{ background: '#1a1a1a', border: '1px solid #C9A84C22', color: '#9A9289', fontSize: 10, padding: '4px 8px', borderRadius: 6 }}>
                <option value="default">Por defecto</option>
                <option value="title_asc">Título A-Z</option>
                <option value="title_desc">Título Z-A</option>
                <option value="rating_desc">Mejor valorados</option>
              </select>
            </div>
            <div style={{ padding: '10px 14px 6px' }}>
              <input value={libSearch} onChange={e => setLibSearch(e.target.value)} placeholder="Buscar por título o autor..." style={{ width: '100%', background: '#1a1a1a', border: '1px solid #C9A84C22', color: '#E4DFD6', fontSize: 13, padding: '10px 12px', borderRadius: 10 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, padding: '0 14px 8px', overflowX: 'auto' }}>
              {[['all','Todos'],['reading','Leyendo'],['finished','Terminado'],['pending','Pendiente'],['wishlist','Objetivo'],['abandoned','Abandonado']].map(([k,l]) => (
                <button key={k} onClick={() => setLibFilter(k)} style={{ whiteSpace: 'nowrap', padding: '5px 12px', borderRadius: 20, border: `1px solid ${libFilter===k ? '#C9A84C66' : '#ffffff08'}`, background: libFilter===k ? '#C9A84C22' : '#1a1a1a', color: libFilter===k ? '#C9A84C' : '#5C574F', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                  {l} ({k==='all' ? books.length : books.filter(b=>b.status===k).length})
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: '#5C574F', padding: '0 14px 6px', letterSpacing: 1 }}>{filteredBooks.length} libros</div>
            {filteredBooks.map(b => (
              <button key={b.id} onClick={() => goBook(b)} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #ffffff06', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
                <CoverImg isbn={b.isbn} customCover={b.custom_cover} size={40} height={56} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#E4DFD6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  <div style={{ fontSize: 10, color: '#9A9289', marginTop: 2 }}>{b.author}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                    <StatusBadge status={b.status} />
                    {b.rating ? <span style={{ fontSize: 9, color: '#C9A84C' }}>{'★'.repeat(b.rating)}</span> : null}
                  </div>
                  {b.status === 'reading' && (
                    <div style={{ width: '100%', height: 2, background: '#222', borderRadius: 1, marginTop: 4 }}>
                      <div style={{ width: `${b.progress||0}%`, height: '100%', background: '#60A5FA', borderRadius: 1 }} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ADD */}
        {view === 'add' && (
          <div>
            <div style={{ background: '#111', padding: '14px 16px', borderBottom: '1px solid #C9A84C22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', letterSpacing: 2 }}>NUEVO CASO</span>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {([['search','🔍','Buscar'],['isbn','🔢','ISBN'],['manual','✏️','Manual'],['manuscript','📄','Manuscrito']] as const).map(([m,ic,label]) => (
                  <button key={m} onClick={() => { setAddMode(m as any); setNewBook({status:'pending'}); setSearchResults([]) }}
                    style={{ flex: 1, background: addMode===m?'#C9A84C22':'#1a1a1a', border:`1px solid ${addMode===m?'#C9A84C66':'#ffffff08'}`, borderRadius: 10, padding:'10px 4px', cursor:'pointer' }}>
                    <div style={{ fontSize: 16 }}>{ic}</div>
                    <div style={{ fontSize: 9, color: addMode===m?'#C9A84C':'#9A9289', fontWeight: 700, marginTop: 4 }}>{label}</div>
                  </button>
                ))}
                {addMode === 'manuscript' && (
                  <div style={{ width:'100%', marginTop: 8 }}>
                    <div onClick={() => manuFileRef.current?.click()}
                      style={{ border:'1.5px dashed #C9A84C44', borderRadius:10, padding:20, marginBottom:14, textAlign:'center', cursor:'pointer', background:manuDone?'rgba(201,168,76,0.06)':'transparent' }}>
                      <div style={{ fontSize:28, marginBottom:6 }}>{manuDone?'📄':'📎'}</div>
                      <div style={{ fontSize:12, fontWeight:500, color:'#E4DFD6' }}>
                        {manuProcessing ? 'Procesando...' : manuDone ? `✓ ${manuPages} páginas procesadas` : 'Subir páginas o PDF'}
                      </div>
                      <div style={{ fontSize:9, color:'#5C574F', marginTop:4 }}>PDF, JPG, PNG · hasta 200 páginas</div>
                      <input ref={manuFileRef} type="file" accept=".pdf,image/*" multiple style={{ display:'none' }} onChange={async e => {
                        const files = e.target.files
                        if (!files || files.length === 0) return
                        setManuProcessing(true)
                        let total = 0
                        for (let i = 0; i < files.length; i++) total += Math.ceil(files[i].size / 50000)
                        await new Promise(r => setTimeout(r, 1200))
                        setManuPages(Math.max(total, files.length))
                        setManuProcessing(false)
                        setManuDone(true)
                      }} />
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:8, letterSpacing:2, color:'#8B6914', display:'block', marginBottom:6 }}>TÍTULO DEL MANUSCRITO</label>
                      <input value={manuTitle} onChange={e => setManuTitle(e.target.value)} placeholder="Nombre de tu manuscrito" style={{ width:'100%', background:'#1a1a1a', border:'1px solid #C9A84C22', color:'#E4DFD6', fontSize:13, padding:'10px 12px', borderRadius:8, boxSizing:'border-box' as any }} />
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:8, letterSpacing:2, color:'#8B6914', display:'block', marginBottom:6 }}>AUTOR</label>
                      <input value={manuAuthor} onChange={e => setManuAuthor(e.target.value)} placeholder="Tu nombre" style={{ width:'100%', background:'#1a1a1a', border:'1px solid #C9A84C22', color:'#E4DFD6', fontSize:13, padding:'10px 12px', borderRadius:8, boxSizing:'border-box' as any }} />
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <label style={{ fontSize:8, letterSpacing:2, color:'#8B6914', display:'block', marginBottom:6 }}>ESTADO</label>
                      <div style={{ display:'flex', gap:6 }}>
                        {(['pending','reading','finished'] as BookStatus[]).map(s => (
                          <button key={s} onClick={() => setManuStatus(s)} style={{ flex:1, padding:'6px 8px', borderRadius:6, border:`1px solid ${manuStatus===s?'#C9A84C44':'#ffffff08'}`, background:manuStatus===s?'#C9A84C22':'#1a1a1a', color:manuStatus===s?'#C9A84C':'#5C574F', fontSize:9, fontWeight:600, cursor:'pointer' }}>
                            {s==='pending'?'PENDIENTE':s==='reading'?'LEYENDO':'TERMINADO'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={async () => {
                      if (!manuTitle) return alert('Añade un título')
                      if (!manuDone) return alert('Sube primero el archivo')
                      const b: Book = { id:'m'+Date.now(), title:manuTitle, author:manuAuthor||'Yo', status:manuStatus, genre:'Manuscrito', is_own:true, synopsis:`Manuscrito personal · ${manuPages} páginas` }
                      await addBook(b)
                      setManuTitle(''); setManuAuthor(''); setManuDone(false); setManuPages(0)
                      alert('Manuscrito registrado'); setView('library')
                    }} style={{ width:'100%', background:'#C9A84C', border:'none', borderRadius:10, padding:14, fontSize:12, fontWeight:700, color:'#080808', letterSpacing:1, cursor:'pointer' }}>
                      REGISTRAR MANUSCRITO
                    </button>
                  </div>
                )}
              </div>

              {addMode === 'search' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 8, letterSpacing: 2, color: '#8B6914', display: 'block', marginBottom: 6 }}>BUSCAR EN OPEN LIBRARY</label>
                  <input value={searchQ} onChange={e => { setSearchQ(e.target.value); searchOL(e.target.value) }} placeholder="Título, autor..." style={{ width: '100%', background: '#1a1a1a', border: '1px solid #C9A84C22', color: '#E4DFD6', fontSize: 13, padding: '10px 12px', borderRadius: 8 }} />
                  {searching && <div style={{ color: '#C9A84C', fontSize: 10, padding: '6px 0' }}>Buscando...</div>}
                  {searchResults.length > 0 && !newBook.title && (
                    <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #C9A84C22', marginTop: 6, overflow: 'hidden' }}>
                      {searchResults.map(r => (
                        <button key={r.key} onClick={() => { setNewBook({ title: r.title, author: r.author_name?.[0], isbn: r.isbn?.[0], year: r.first_publish_year, status: 'pending' }); setSearchResults([]) }} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #ffffff06', padding: '10px 12px', display: 'flex', gap: 10, cursor: 'pointer', textAlign: 'left', alignItems: 'center' }}>
                          {r.cover_i ? <img src={`https://covers.openlibrary.org/b/id/${r.cover_i}-S.jpg`} style={{ width: 32, height: 44, borderRadius: 3, objectFit: 'cover' }} /> : <div style={{ width: 32, height: 44, background: '#222', borderRadius: 3 }} />}
                          <div>
                            <div style={{ fontSize: 12, color: '#E4DFD6', fontWeight: 500 }}>{r.title}</div>
                            <div style={{ fontSize: 10, color: '#9A9289' }}>{r.author_name?.[0]}</div>
                            {r.first_publish_year && <div style={{ fontSize: 9, color: '#5C574F' }}>{r.first_publish_year}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {newBook.title && (
                <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #C9A84C44', padding: 12, marginBottom: 12, display: 'flex', gap: 10 }}>
                  <CoverImg isbn={newBook.isbn} size={54} height={76} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E4DFD6' }}>{newBook.title}</div>
                    <div style={{ fontSize: 11, color: '#9A9289', marginTop: 3 }}>{newBook.author}</div>
                    {newBook.year && <div style={{ fontSize: 10, color: '#5C574F', marginTop: 4 }}>{newBook.year}</div>}
                    <button onClick={() => setNewBook({ status: 'pending' })} style={{ fontSize: 10, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>Cambiar</button>
                  </div>
                </div>
              )}

              {(addMode === 'manual' || (addMode === 'search' && !newBook.title)) && (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 8, letterSpacing: 2, color: '#8B6914', display: 'block', marginBottom: 6 }}>TÍTULO *</label>
                    <input value={newBook.title||''} onChange={e => setNewBook(p => ({...p, title: e.target.value}))} placeholder="Título del libro" style={{ width: '100%', background: '#1a1a1a', border: '1px solid #C9A84C22', color: '#E4DFD6', fontSize: 13, padding: '10px 12px', borderRadius: 8 }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 8, letterSpacing: 2, color: '#8B6914', display: 'block', marginBottom: 6 }}>AUTOR</label>
                    <input value={newBook.author||''} onChange={e => setNewBook(p => ({...p, author: e.target.value}))} placeholder="Nombre del autor" style={{ width: '100%', background: '#1a1a1a', border: '1px solid #C9A84C22', color: '#E4DFD6', fontSize: 13, padding: '10px 12px', borderRadius: 8 }} />
                  </div>
                </>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 8, letterSpacing: 2, color: '#8B6914', display: 'block', marginBottom: 6 }}>ESTADO INICIAL</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(['pending','reading','finished','wishlist'] as BookStatus[]).map(s => (
                    <button key={s} onClick={() => setNewBook(p => ({...p, status: s}))} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${newBook.status===s ? '#C9A84C44' : '#ffffff08'}`, background: newBook.status===s ? '#C9A84C22' : '#1a1a1a', color: newBook.status===s ? '#C9A84C' : '#5C574F', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleAddBook} style={{ width: '100%', background: '#C9A84C', border: 'none', borderRadius: 10, padding: 14, fontSize: 12, fontWeight: 700, color: '#080808', letterSpacing: 1, cursor: 'pointer' }}>
                REGISTRAR EN EL ARCHIVO
              </button>
            </div>
          </div>
        )}

        {/* RECOMMEND / WISHLIST */}
        {view === 'recommend' && (
          <div>
            <div style={{ background: '#111', padding: '14px 16px', borderBottom: '1px solid #C9A84C22' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C', letterSpacing: 2 }}>PARA TI</div>
              <div style={{ fontSize: 8, color: '#5C574F', letterSpacing: 2 }}>BASADO EN TU ARCHIVO</div>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #ffffff08' }}>
              {(['recs','wishlist'] as const).map(t => (
                <button key={t} onClick={() => setWishTab(t)} style={{ flex: 1, padding: 12, background: 'none', border: 'none', borderBottom: `2px solid ${wishTab===t ? '#C9A84C' : 'transparent'}`, color: wishTab===t ? '#C9A84C' : '#5C574F', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {t === 'recs' ? 'Recomendaciones' : `Wishlist (${wishlist.length})`}
                </button>
              ))}
            </div>

            {wishTab === 'recs' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#E4DFD6' }}>Tu seleccion</div>
                    <div style={{ fontSize: 9, color: '#5C574F', marginTop: 2 }}>{recs.length} libros · {recGenres.join(', ')}</div>
                  </div>
                  <button onClick={() => setShowGenrePicker(true)} style={{ background: '#C9A84C22', border: '1px solid #C9A84C44', borderRadius: 8, padding: '6px 10px', color: '#C9A84C', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>✦ Nueva rec</button>
                </div>
                {recs.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderBottom: '1px solid #ffffff06', alignItems: 'center' }}>
                    <CoverImg isbn={r.isbn} size={52} height={72} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#E4DFD6' }}>{r.title}</div>
                      <div style={{ fontSize: 10, color: '#9A9289', marginTop: 2 }}>{r.author}</div>
                      <div style={{ fontSize: 9, color: '#8B6914', marginTop: 3 }}>{r.genre}</div>
                    </div>
                    <button onClick={async () => { await addBook({ id:'w'+Date.now(), title:r.title, author:r.author, isbn:r.isbn, status:'wishlist', genre:r.genre }); alert('Añadido a Wishlist') }} style={{ background: '#C9A84C22', border: '1px solid #C9A84C44', borderRadius: 6, padding: '5px 8px', color: '#C9A84C', fontSize: 9, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Lista</button>
                  </div>
                ))}
                <button onClick={() => setShowGenrePicker(true)} style={{ width: 'calc(100% - 28px)', margin: 14, background: '#C9A84C11', border: '1px solid #C9A84C22', borderRadius: 10, padding: 12, color: '#C9A84C', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✦ Personalizar y generar nuevas</button>
              </div>
            )}

            {wishTab === 'wishlist' && (
              <div>
                <div style={{ padding: '10px 14px 4px' }}>
                  <input value={wishSearch} onChange={e => { setWishSearch(e.target.value); searchWishOL(e.target.value) }} placeholder="Busca un libro para añadir..." style={{ width: '100%', background: '#1a1a1a', border: '1px solid #C9A84C22', color: '#E4DFD6', fontSize: 13, padding: '10px 12px', borderRadius: 10 }} />
                  {wishResults.length > 0 && (
                    <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #C9A84C22', marginTop: 6, overflow: 'hidden' }}>
                      {wishResults.map(r => (
                        <button key={r.key} onClick={async () => { await addBook({ id:'w'+Date.now(), title:r.title, author:r.author_name?.[0]||'Desconocido', isbn:r.isbn?.[0], status:'wishlist' }); setWishSearch(''); setWishResults([]); alert('Añadido') }} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #ffffff06', padding: '10px 12px', display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'center', textAlign: 'left' }}>
                          {r.cover_i ? <img src={`https://covers.openlibrary.org/b/id/${r.cover_i}-S.jpg`} style={{ width: 32, height: 44, borderRadius: 3, objectFit: 'cover' }} /> : <div style={{ width: 32, height: 44, background: '#222', borderRadius: 3 }} />}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: '#E4DFD6' }}>{r.title}</div>
                            <div style={{ fontSize: 10, color: '#9A9289' }}>{r.author_name?.[0]}</div>
                          </div>
                          <span style={{ color: '#C9A84C', fontSize: 10, fontWeight: 600 }}>+ Lista</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {wishlist.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: 32, opacity: 0.4 }}>🎯</div>
                    <div style={{ fontSize: 14, color: '#9A9289', marginTop: 10 }}>Wishlist vacía</div>
                    <div style={{ fontSize: 11, color: '#5C574F', marginTop: 4 }}>Busca libros arriba</div>
                  </div>
                ) : wishlist.map(b => (
                  <div key={b.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid #ffffff06', alignItems: 'center' }}>
                    <button onClick={() => goBook(b)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><CoverImg isbn={b.isbn} customCover={b.custom_cover} size={40} height={56} /></button>
                    <button onClick={() => goBook(b)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#E4DFD6' }}>{b.title}</div>
                      <div style={{ fontSize: 10, color: '#9A9289' }}>{b.author}</div>
                    </button>
                    <button onClick={async () => { await updateBook(b.id, { status: 'pending' }); alert('Movido al archivo') }} style={{ background: '#C9A84C22', border: '1px solid #C9A84C44', borderRadius: 8, width: 34, height: 34, color: '#C9A84C', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>↑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DETAIL */}
        {view === 'detail' && selectedBook && (
          <div>
            <div style={{ background: '#111', padding: '14px 16px', borderBottom: '1px solid #C9A84C22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setView('library')} style={{ background: 'none', border: 'none', color: '#E4DFD6', fontSize: 14, cursor: 'pointer' }}>← Volver</button>
              <StatusBadge status={selectedBook.status} />
            </div>
            <div style={{ display: 'flex', gap: 14, padding: 14, background: '#1a1a1a', borderBottom: '1px solid #C9A84C11' }}>
              <CoverImg isbn={selectedBook.isbn} customCover={selectedBook.custom_cover} size={110} height={154} bookId={selectedBook.id} onCoverChange={async (url) => { await updateBook(selectedBook.id, { custom_cover: url }); setSelectedBook(b => b ? {...b, custom_cover: url} : b) }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#E4DFD6', lineHeight: 1.3 }}>{selectedBook.title.toUpperCase()}</div>
                <div style={{ fontSize: 11, color: '#9A9289', marginTop: 5 }}>{selectedBook.author}</div>
                {selectedBook.genre && <div style={{ fontSize: 9, color: '#8B6914', marginTop: 6, letterSpacing: 1 }}>{selectedBook.genre}</div>}
                {selectedBook.year && <div style={{ fontSize: 9, color: '#5C574F', marginTop: 4 }}>{selectedBook.year}{selectedBook.publisher ? ` · ${selectedBook.publisher}` : ''}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #ffffff08' }}>
              {[['pending','Pendiente'],['reading','Leyendo'],['finished','Terminado'],['abandoned','Abandonado'],['wishlist','Objetivo']].map(([s,l]) => (
                <button key={s} onClick={async () => {
                  if (s === 'finished' && selectedBook.status !== 'finished') {
                    if (confirm(`¿Sumar +${rewPerBook}€ a tu alcancía?`)) {
                      await addReward({ type:'earn', label:selectedBook.title.slice(0,30), amount:rewPerBook, date:new Date().toLocaleDateString('es') })
                    }
                  }
                  await updateBook(selectedBook.id, { status: s as BookStatus })
                  setSelectedBook(b => b ? {...b, status: s as BookStatus} : b)
                }} style={{ padding: '10px 14px', minWidth: 80, background: selectedBook.status===s ? '#C9A84C' : '#1a1a1a', border: 'none', color: selectedBook.status===s ? '#080808' : '#5C574F', fontSize: 9, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  {l}
                </button>
              ))}
            </div>

            {selectedBook.status === 'finished' && (
              <div style={{ margin: 12, background: '#C9A84C11', borderRadius: 8, border: '1px solid #C9A84C44', padding: 12 }}>
                <div style={{ fontSize: 8, letterSpacing: 2, color: '#8B6914' }}>RECOMPENSA</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#C9A84C' }}>+{rewPerBook}€</div>
                <div style={{ fontSize: 9, color: '#5C574F' }}>Sumado a tu alcancía</div>
              </div>
            )}

            <div style={{ padding: '14px 14px 10px' }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#5C574F', marginBottom: 8 }}>CALIFICACION</div>
              <Stars rating={selectedBook.rating} onChange={async n => { await updateBook(selectedBook.id, { rating: n }); setSelectedBook(b => b ? {...b, rating: n} : b) }} />
            </div>

            {selectedBook.status === 'finished' && (
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 8, letterSpacing: 2, color: '#5C574F', marginBottom: 8 }}>LO VOLVERIA A LEER?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['yes','maybe','no'] as const).map(v => (
                    <button key={v} onClick={async () => { await updateBook(selectedBook.id, { would_reread: v }); setSelectedBook(b => b ? {...b, would_reread: v} : b) }} style={{ flex: 1, padding: 8, borderRadius: 8, background: selectedBook.would_reread===v ? '#C9A84C' : '#222', border: `1px solid ${selectedBook.would_reread===v ? '#C9A84C' : '#ffffff08'}`, color: selectedBook.would_reread===v ? '#080808' : '#9A9289', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {v === 'yes' ? 'Sí' : v === 'maybe' ? 'Quizás' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedBook.status === 'reading' && (
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 8, letterSpacing: 2, color: '#5C574F', marginBottom: 8 }}>PROGRESO — {selectedBook.progress||0}%</div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  {[0,10,20,30,40,50,60,70,80,90,100].map(v => (
                    <button key={v} onClick={async () => { await updateBook(selectedBook.id, { progress: v }); setSelectedBook(b => b ? {...b, progress: v} : b) }} style={{ flex: 1, height: 20, borderRadius: 4, background: (selectedBook.progress||0) >= v ? '#60A5FA' : '#222', border: 'none', cursor: 'pointer' }} />
                  ))}
                </div>
                <div style={{ width: '100%', height: 3, background: '#222', borderRadius: 2 }}>
                  <div style={{ width: `${selectedBook.progress||0}%`, height: '100%', background: '#60A5FA', borderRadius: 2 }} />
                </div>
              </div>
            )}

            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#5C574F', marginBottom: 8 }}>NOTAS PERSONALES</div>
              <textarea value={selectedBook.notes||''} onChange={async e => { const v = e.target.value; await updateBook(selectedBook.id, { notes: v }); setSelectedBook(b => b ? {...b, notes: v} : b) }} placeholder="Escribe tus pensamientos..." style={{ width: '100%', background: '#1a1a1a', border: '1px solid #ffffff0a', color: '#E4DFD6', fontSize: 12, padding: 10, borderRadius: 8, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            {selectedBook.synopsis && (
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 8, letterSpacing: 2, color: '#5C574F', marginBottom: 8 }}>SINOPSIS</div>
                <div style={{ fontSize: 11, color: '#9A9289', lineHeight: 1.6 }}>{selectedBook.synopsis}</div>
              </div>
            )}
            <div style={{ height: 20 }} />
          </div>
        )}

        {/* PROFILE */}
        {view === 'profile' && (
          <div>
            <div style={{ background: '#1a1a1a', padding: 20, textAlign: 'center', borderBottom: '1px solid #C9A84C11' }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: '#8B6914', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 28, fontWeight: 700, color: '#080808' }}>E</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#E4DFD6' }}>Emefreak</div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#C9A84C', marginTop: 4 }}>DETECTIVE ÉLITE · NIVEL 9</div>
              <div style={{ width: '80%', height: 4, background: '#222', borderRadius: 2, margin: '10px auto 0', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min((finished.length/45)*100, 100)}%`, height: '100%', background: '#C9A84C', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 9, color: '#5C574F', marginTop: 5 }}>{finished.length} / 45 libros al siguiente nivel</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12 }}>
              {[
                { n: finished.length, l: 'CERRADOS', c: '#4ADE80', f: 'finished' },
                { n: reading.length, l: 'LEYENDO', c: '#60A5FA', f: 'reading' },
                { n: balance(), l: 'ALCANCÍA€', c: '#C9A84C', f: 'rewards' },
                { n: pending.length, l: 'PENDIENTES', c: '#9A9289', f: 'pending' },
              ].map(s => (
                <button key={s.f} onClick={() => s.f === 'rewards' ? nav('rewards') : (setLibFilter(s.f), nav('library'))} style={{ flex: '1 1 45%', background: '#1a1a1a', border: '1px solid #ffffff06', borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.n}</div>
                  <div style={{ fontSize: 8, letterSpacing: 1, color: '#5C574F', marginTop: 2 }}>{s.l}</div>
                </button>
              ))}
            </div>
            <div style={{ padding: '0 14px 14px' }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#5C574F', marginBottom: 10 }}>AUTORES MÁS LEÍDOS</div>
              {Object.entries(finished.reduce((acc: Record<string,number>, b) => { acc[b.author]=(acc[b.author]||0)+1; return acc }, {})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([a,c]) => (
                <button key={a} onClick={() => setProfileModal({type:'author', value:a})} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', background:'none', border:'none', borderBottom:'1px solid #ffffff06', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize: 12, color: '#E4DFD6' }}>{a}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize: 11, color: '#8B6914', fontWeight: 600 }}>{c} {c===1?'libro':'libros'}</span>
                    <span style={{ color:'#5C574F' }}>›</span>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ padding: '0 14px 14px' }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#5C574F', marginBottom: 10 }}>GÉNEROS FAVORITOS</div>
              {Object.entries(finished.reduce((acc: Record<string,number>, b) => { if(b.genre) acc[b.genre]=(acc[b.genre]||0)+1; return acc }, {})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([g,c]) => (
                <button key={g} onClick={() => setProfileModal({type:'genre', value:g})} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', background:'none', border:'none', borderBottom:'1px solid #ffffff06', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize: 12, color: '#E4DFD6' }}>{g}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize: 11, color: '#8B6914', fontWeight: 600 }}>{c} {c===1?'libro':'libros'}</span>
                    <span style={{ color:'#5C574F' }}>›</span>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ padding: '0 14px 14px', textAlign:'center' }}>
              <button onClick={() => nav('rewards')} style={{ background:'rgba(201,168,76,0.1)', border:'1px solid #C9A84C33', borderRadius:10, padding:'12px 24px', color:'#C9A84C', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                💰 Ver Alcancía — {balance()}€
              </button>
            </div>
          </div>
        )}

        {/* REWARDS */}
        {view === 'rewards' && (
          <div>
            <div style={{ background: '#111', padding: '14px 16px', borderBottom: '1px solid #C9A84C22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => nav('profile')} style={{ background: 'none', border: 'none', color: '#E4DFD6', fontSize: 14, cursor: 'pointer' }}>← Volver</button>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', letterSpacing: 2 }}>ALCANCÍA</span>
              <div style={{ width: 60 }} />
            </div>
            <div style={{ margin: 14, background: '#1a1a1a', borderRadius: 12, border: '1px solid #C9A84C44', padding: 16 }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#8B6914', marginBottom: 4 }}>SALDO DISPONIBLE</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#C9A84C' }}>{balance().toFixed(2)}€</div>
              <div style={{ fontSize: 10, color: '#5C574F', marginTop: 3 }}>{rewPerBook}€ por libro terminado</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {[['edit','EDITAR','#C9A84C'],['add','+ AÑADIR','#4ADE80'],['spend','- GASTAR','#F87171']].map(([k,l,c]) => (
                  <button key={k} onClick={() => setRewardForm(rewardForm===k as any ? null : k as any)} style={{ flex: 1, background: `${c}22`, border: `1px solid ${c}44`, borderRadius: 6, padding: '6px 8px', color: c, fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {[
                  { n: rewards.filter(r=>r.type==='earn').reduce((a,r)=>a+r.amount,0), l: 'GANADO', c: '#4ADE80' },
                  { n: rewards.filter(r=>r.type==='spend').reduce((a,r)=>a+r.amount,0), l: 'GASTADO', c: '#F87171' },
                  { n: rewPerBook, l: 'POR LIBRO', c: '#C9A84C' },
                ].map(s => (
                  <div key={s.l} style={{ flex: 1, border: `1px solid ${s.c}33`, borderRadius: 8, padding: 8, textAlign: 'center', background: `${s.c}08` }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.n}€</div>
                    <div style={{ fontSize: 7, color: '#5C574F', marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {rewardForm && (
                <div style={{ background: '#222', borderRadius: 8, padding: 12, marginTop: 12 }}>
                  <div style={{ fontSize: 8, letterSpacing: 2, color: '#8B6914', marginBottom: 8 }}>
                    {rewardForm==='edit' ? 'REWARD POR LIBRO' : rewardForm==='add' ? 'AÑADIR SALDO' : 'REGISTRAR GASTO'}
                  </div>
                  {rewardForm !== 'edit' && <input value={rewardDesc} onChange={e=>setRewardDesc(e.target.value)} placeholder="Descripción" style={{ width: '100%', background: '#1a1a1a', border: '1px solid #C9A84C22', color: '#E4DFD6', fontSize: 13, padding: '8px 10px', borderRadius: 7, marginBottom: 8 }} />}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={rewardAmt} onChange={e=>setRewardAmt(e.target.value)} type="number" placeholder="€" style={{ flex: 1, background: '#1a1a1a', border: '1px solid #C9A84C22', color: '#E4DFD6', fontSize: 13, padding: '8px 10px', borderRadius: 7 }} />
                    <button onClick={async () => {
                      const v = parseFloat(rewardAmt)
                      if (!v || v <= 0) return alert('Importe inválido')
                      if (rewardForm === 'edit') { setRewPerBook(v) }
                      else if (rewardForm === 'add') { await addReward({ type:'earn', label:rewardDesc||'Ajuste manual', amount:v, date:new Date().toLocaleDateString('es') }) }
                      else { if (v > balance()) return alert('Saldo insuficiente'); await addReward({ type:'spend', label:rewardDesc||'Gasto', amount:v, date:new Date().toLocaleDateString('es') }) }
                      setRewardForm(null); setRewardAmt(''); setRewardDesc('')
                    }} style={{ background: '#C9A84C', border: 'none', borderRadius: 7, padding: '0 14px', fontSize: 10, fontWeight: 700, color: '#080808', cursor: 'pointer' }}>
                      {rewardForm==='edit' ? 'GUARDAR' : rewardForm==='add' ? 'AÑADIR' : 'RESTAR'}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 8, letterSpacing: 2, color: '#8B6914', margin: '14px 0 10px' }}>HISTORIAL</div>
              {[...rewards].reverse().map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #ffffff06' }}>
                  <span style={{ flex: 1, fontSize: 11, color: '#9A9289', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.type==='earn' ? '#4ADE80' : '#F87171', margin: '0 8px' }}>{r.type==='earn'?'+':'-'}{r.amount}€</span>
                  <span style={{ fontSize: 9, color: '#5C574F' }}>{r.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#111', borderTop: '1px solid #C9A84C22', display: 'flex', alignItems: 'center', height: 60, zIndex: 100 }}>
        {[
          { v: 'home' as View, l: 'Inicio' },
          { v: 'library' as View, l: 'Biblioteca' },
          { v: 'add' as View, l: '', isAdd: true },
          { v: 'recommend' as View, l: 'Para ti' },
          { v: 'profile' as View, l: 'Operador' },
        ].map(item => item.isAdd ? (
          <button key="add" onClick={() => nav('add')} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#080808', lineHeight: 1 }}>+</div>
          </button>
        ) : (
          <button key={item.v} onClick={() => nav(item.v)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderBottom: `2px solid ${view===item.v ? '#C9A84C' : 'transparent'}`, height: '100%', cursor: 'pointer' }}>
            <span style={{ fontSize: 9, color: view===item.v ? '#C9A84C' : '#5C574F', fontWeight: view===item.v ? 700 : 400 }}>{item.l}</span>
          </button>
        ))}
      </div>

      {/* GENRE PICKER MODAL */}
      {showGenrePicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setShowGenrePicker(false)}>
          <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: '#1a1a1a', borderRadius: '20px 20px 0 0', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: '#333', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E4DFD6', marginBottom: 4 }}>¿Qué géneros quieres?</div>
            <div style={{ fontSize: 11, color: '#5C574F', marginBottom: 16 }}>Selecciona uno o varios</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {Object.keys(BOOKS_DB).map(g => (
                <button key={g} onClick={() => setRecGenres(p => p.includes(g) ? p.filter(x=>x!==g) : [...p,g])} style={{ padding: '8px 14px', borderRadius: 20, border: `1px solid ${recGenres.includes(g) ? '#C9A84C66' : '#ffffff08'}`, background: recGenres.includes(g) ? '#C9A84C22' : '#222', color: recGenres.includes(g) ? '#C9A84C' : '#5C574F', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {g}
                </button>
              ))}
            </div>
            <button onClick={generateRecs} style={{ width: '100%', background: '#C9A84C', border: 'none', borderRadius: 12, padding: 14, fontSize: 13, fontWeight: 700, color: '#080808', cursor: 'pointer' }}>
              ✦ Generar recomendaciones
            </button>
          </div>
        </div>
      )}
      
      {profileModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={() => setProfileModal(null)}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#1a1a1a', borderRadius:'20px 20px 0 0', padding:20, paddingBottom:34, maxHeight:'70vh', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:36, height:4, background:'#333', borderRadius:2, margin:'0 auto 14px' }} />
            <div style={{ fontSize:16, fontWeight:700, color:'#E4DFD6' }}>{profileModal.value}</div>
            <div style={{ fontSize:10, color:'#5C574F', marginTop:2, marginBottom:12 }}>
              {finished.filter(b => profileModal.type==='author' ? b.author===profileModal.value : b.genre===profileModal.value).length} libros terminados
            </div>
            <div style={{ overflowY:'auto', flex:1 }}>
              {finished.filter(b => profileModal.type==='author' ? b.author===profileModal.value : b.genre===profileModal.value).map(b => (
                <button key={b.id} onClick={() => { setProfileModal(null); goBook(b) }}
                  style={{ width:'100%', display:'flex', gap:10, padding:'10px 0', background:'none', border:'none', borderBottom:'1px solid #ffffff08', cursor:'pointer', textAlign:'left', alignItems:'center' }}>
                  <CoverImg isbn={b.isbn} customCover={b.custom_cover} size={36} height={50} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:'#E4DFD6' }}>{b.title}</div>
                    <div style={{ fontSize:10, color:'#9A9289' }}>{b.author}</div>
                  </div>
                  {b.rating ? <span style={{ fontSize:11, color:'#C9A84C' }}>{'★'.repeat(b.rating)}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

