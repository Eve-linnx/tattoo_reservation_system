import React, { useState, useEffect } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

const SERVICES = [
  { id: 'small', name: 'Krátké sezení', durationHours: 1.5, price: 'od 1 800 Kč', desc: 'Jemné linky, nápisy a drobné motivy do 6×6 cm.' },
  { id: 'medium', name: 'Střední sezení', durationHours: 3.0, price: 'od 4 200 Kč', desc: 'Předloktí, lýtko, rameno (stínování a detail).' },
  { id: 'large', name: 'Půldenní sezení', durationHours: 4.5, price: 'od 6 500 Kč', desc: 'Komplexní blackwork projekty, začátek rukávu.' },
  { id: 'full', name: 'Celodenní sezení', durationHours: 8.0, price: 'od 9 500 Kč', desc: 'Vyhrazený prostor pro velké plochy (09:00 – 17:00).' },
];

const TATTOO_ARTISTS = [
  {
    id: 1,
    name: 'Jan Novák',
    title: 'Resident Artist & Zakladatel',
    specialization: 'Dark Blackwork / Heavy Dotwork / Geometrické kompozice',
    hours: '09:00 – 18:00 (Po – Pá)',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    bio: 'Přes 8 let praxe. Zaměřuje se na masivní syté černé plochy, precizní linky a abstraktní ornamentiku navrženou přesně na tělo.',
  },
  {
    id: 2,
    name: 'Elena Křížová',
    title: 'Resident Artist',
    specialization: 'Micro-realism / Botanical / Fine-line minimalistické skici',
    hours: '09:00 – 18:00 (Po – Pá)',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    bio: 'Jemná estetika, mikro-detailní botanické ilustrace, autorské miniatury a minimalistická kaligrafie s vysokou trvanlivostí linky.',
  }
];

const PORTFOLIO_WORKS = [
  { id: 1, artist: 'Jan Novák', style: 'Blackwork', title: 'Geometrický rukáv', img: '/portfolio/1photo.jpg' },
  { id: 2, artist: 'Elena Křížová', style: 'Fine-line', title: 'Botanická kapradina', img: '/portfolio/2photo.jpg' },
  { id: 3, artist: 'Jan Novák', style: 'Dotwork', title: 'Mandala & Tečkování', img: '/portfolio/3photo.jpg' },
  { id: 4, artist: 'Elena Křížová', style: 'Fine-line', title: 'Abstraktní linie', img: '/portfolio/4photo.jpg' },
  { id: 5, artist: 'Jan Novák', style: 'Blackwork', title: 'Dark ornamentika', img: '/portfolio/5photo.jpg' },
  { id: 6, artist: 'Elena Křížová', style: 'Micro-realism', title: 'Mikro portrét', img: '/portfolio/6photo.jpg' },
];

const DETAILED_PRICING = [
  { category: 'Základní služby', items: [
    { name: 'Osobní konzultace & příprava návrhu', price: 'V ceně termínu', note: 'Konzultace před tetováním, úpravy skici na míru' },
    { name: 'Minimální startovní sazba', price: '1 800 Kč', note: 'Zahrnuje sterilní cartridge, barvy a jednorázový hygienický set' },
  ]},
  { category: 'Sezení dle rozsahu', items: [
    { name: 'Krátké sezení (do 1,5 hod)', price: '1 800 – 2 800 Kč', note: 'Ideální pro jemné linky, prsty, zápěstí nebo klíční kost' },
    { name: 'Střední sezení (cca 3 hodiny)', price: '4 200 – 5 500 Kč', note: 'Motivy velikosti dlaně až formátu A5 s lehkým stínováním' },
    { name: 'Půldenní sezení (cca 4,5 hodiny)', price: '6 500 – 7 500 Kč', note: 'Detailní projekty, předloktí, lýtko, počátek rukávu' },
    { name: 'Celodenní sezení (09:00 – 17:00)', price: 'od 9 500 Kč', note: 'Vyhrazený prostor pro velké souvislé plochy a celá záda' },
  ]},
  { category: 'Péče & Doplňky', items: [
    { name: 'Hojivá druhá kůže (Second Skin)', price: 'Zdarma k sezení', note: 'Prodyšná ochranná fólie pro prvních 3–5 dní hojení' },
    { name: 'Korekce motivu do 3 měsíců', price: 'Zdarma', note: 'Drobné dotáhnutí linek po kompletním zahojení' },
  ]}
];

export default function App() {
  const [reservations, setReservations] = useState([]);
  const [activeTab, setActiveTab] = useState('booking');

  const [selectedArtist, setSelectedArtist] = useState(TATTOO_ARTISTS[0]);
  const [selectedService, setSelectedService] = useState(SERVICES[1]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedStartTime, setSelectedStartTime] = useState(null);

  // Formulář
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientNote, setClientNote] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  // Pop-up dialog úspěchu
  const [successModalData, setSuccessModalData] = useState(null);

  // PIN autentizace pro agendu personálu
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminFilterArtistId, setAdminFilterArtistId] = useState('ALL');

  const fetchReservations = async () => {
    try {
      const res = await fetch(`${API_BASE}/reservations`);
      if (res.ok) {
        const data = await res.json();
        setReservations(data);
      }
    } catch (err) {
      console.error('Chyba při komunikaci s backendem:', err);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const monthNames = [
    'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
  ];

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(selectedYear, selectedMonth, 1).getDay() + 6) % 7;

  const isPrevMonthDisabled = selectedYear === currentYear && selectedMonth === currentMonth;
  const maxYear = currentMonth === 0 ? currentYear : currentYear + 1;
  const maxMonth = (currentMonth + 11) % 12;
  const isNextMonthDisabled = selectedYear > maxYear || (selectedYear === maxYear && selectedMonth >= maxMonth);

  const handlePrevMonth = () => {
    if (isPrevMonthDisabled) return;
    if (selectedMonth === 0) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
    setSelectedDay(null);
    setSelectedStartTime(null);
  };

  const handleNextMonth = () => {
    if (isNextMonthDisabled) return;
    if (selectedMonth === 11) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
    setSelectedDay(null);
    setSelectedStartTime(null);
  };

  const isDateDisabled = (day) => {
    const target = new Date(selectedYear, selectedMonth, day);
    const dayOfWeek = target.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;

    const minBookingDate = new Date();
    minBookingDate.setHours(minBookingDate.getHours() + 24);
    const targetEnd = new Date(selectedYear, selectedMonth, day, 23, 59, 59);
    return targetEnd < minBookingDate;
  };

  const getAvailableStartTimes = () => {
    if (!selectedDay) return [];

    const workStartHour = 9;
    const workEndHour = 18;
    const slots = [];
    const minLeadTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (selectedService.id === 'full') {
      const datePrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      const slotStart = new Date(`${datePrefix}T09:00:00`);
      const slotEnd = new Date(`${datePrefix}T17:00:00`);

      const isTooSoon = slotStart < minLeadTime;
      const isColliding = reservations.some((r) => {
        if (r.status !== 'CONFIRMED' && r.status !== 'PENDING_APPROVAL') return false;
        if (r.client_name && !r.client_name.includes(`[${selectedArtist.name}`) && r.resource_id !== selectedArtist.id) {
          return false;
        }
        const rStart = new Date(r.start_time);
        const rEnd = new Date(r.end_time);
        const rStartWithPause = new Date(rStart.getTime() - 30 * 60 * 1000);
        const rEndWithPause = new Date(rEnd.getTime() + 30 * 60 * 1000);
        return slotStart < rEndWithPause && slotEnd > rStartWithPause;
      });

      return [{
        start: '09:00',
        end: '17:00',
        isBlocked: isColliding || isTooSoon,
        blockReason: isTooSoon ? 'Příliš brzy (<24h)' : 'Obsazeno',
      }];
    }

    for (let h = workStartHour; h < workEndHour; h++) {
      for (let m of [0, 30]) {
        const startDecimal = h + m / 60;
        const endDecimal = startDecimal + selectedService.durationHours;

        if (endDecimal > workEndHour) continue;

        const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const endH = Math.floor(endDecimal);
        const endM = Math.round((endDecimal - endH) * 60);
        const endTimeString = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        const datePrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        const slotStart = new Date(`${datePrefix}T${timeString}:00`);
        const slotEnd = new Date(`${datePrefix}T${endTimeString}:00`);

        const isTooSoon = slotStart < minLeadTime;

        const isColliding = reservations.some((r) => {
          if (r.status !== 'CONFIRMED' && r.status !== 'PENDING_APPROVAL') return false;
          if (r.client_name && !r.client_name.includes(`[${selectedArtist.name}`) && r.resource_id !== selectedArtist.id) {
            return false;
          }

          const rStart = new Date(r.start_time);
          const rEnd = new Date(r.end_time);

          const rStartWithPause = new Date(rStart.getTime() - 30 * 60 * 1000);
          const rEndWithPause = new Date(rEnd.getTime() + 30 * 60 * 1000);

          return slotStart < rEndWithPause && slotEnd > rStartWithPause;
        });

        slots.push({
          start: timeString,
          end: endTimeString,
          isBlocked: isColliding || isTooSoon,
          blockReason: isTooSoon ? 'Příliš brzy (<24h)' : 'Obsazeno',
        });
      }
    }
    return slots;
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Výběr termínu
    if (!selectedDay || !selectedStartTime) {
      setErrorMessage('Prosím vyberte v kalendáři den a volný čas sezení.');
      return;
    }

    const rawPhone = clientPhone.replace(/\s+/g, '');
    const emailClean = clientEmail.trim();

    // 2. Kontrola, zda je vyplněn alespoň jeden kontakt
    if (!rawPhone && !emailClean) {
      setErrorMessage('Vyplňte prosím alespoň jeden kontaktní údaj (telefonní číslo nebo e-mail).');
      return;
    }

    // 3. Normalizace a validace telefonního čísla na tvar s předčíslím
    let normalizedPhone = null;
    if (rawPhone) {
      const czSkPhoneRegex = /^(\+420|\+421|00420|00421)?[1-9]\d{8}$/;
      if (!czSkPhoneRegex.test(rawPhone)) {
        setErrorMessage('Zadejte platné devítimístné telefonní číslo (např. 777 123 456 nebo +420 777 123 456).');
        return;
      }

      if (rawPhone.startsWith('+420') || rawPhone.startsWith('+421')) {
        const prefix = rawPhone.slice(0, 4);
        const body = rawPhone.slice(4);
        normalizedPhone = `${prefix} ${body.slice(0, 3)} ${body.slice(3, 6)} ${body.slice(6)}`;
      } else if (rawPhone.startsWith('00420') || rawPhone.startsWith('00421')) {
        const prefix = `+${rawPhone.slice(2, 5)}`;
        const body = rawPhone.slice(5);
        normalizedPhone = `${prefix} ${body.slice(0, 3)} ${body.slice(3, 6)} ${body.slice(6)}`;
      } else {
        normalizedPhone = `+420 ${rawPhone.slice(0, 3)} ${rawPhone.slice(3, 6)} ${rawPhone.slice(6)}`;
      }
    }

    // 4. Validace e-mailu
    if (emailClean) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(emailClean)) {
        setErrorMessage('Zadejte prosím e-mail v platném formátu (např. jmeno@domena.cz).');
        return;
      }
    }

    // 5. Primární a sekundární kontakt
    const primaryContact = normalizedPhone || emailClean;
    const secondaryContact = (normalizedPhone && emailClean) ? emailClean : null;

    const notePart = clientNote.trim() ? ` {Poznámka: ${clientNote.trim()}}` : '';
    const contactString = secondaryContact ? `${primaryContact} (${secondaryContact})` : primaryContact;
    const formattedClientString = `${clientName.trim()} [Kontakt: ${contactString}] [${selectedArtist.name} - ${selectedService.name}]${notePart}`;

    const datePrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    const payload = {
      resource_id: selectedArtist.id,
      client_name: formattedClientString,
      start_time: `${datePrefix}T${selectedStartTime.start}:00`,
      end_time: `${datePrefix}T${selectedStartTime.end}:00`,
    };

    try {
      const res = await fetch(`${API_BASE}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessModalData({
          id: data.id,
          artist: selectedArtist.name,
          service: selectedService.name,
          date: `${selectedDay}. ${monthNames[selectedMonth]} ${selectedYear}`,
          time: `${selectedStartTime.start} – ${selectedStartTime.end}`,
          client: clientName.trim(),
          contactType: normalizedPhone ? 'Telefon' : 'E-mail',
          contactValue: primaryContact,
        });

        setClientName('');
        setClientPhone('');
        setClientEmail('');
        setClientNote('');
        setSelectedDay(null);
        setSelectedStartTime(null);
        fetchReservations();
      } else {
        setErrorMessage(data.detail || 'Požadavek se nepodařilo odeslat.');
      }
    } catch (err) {
      setErrorMessage('Nelze se spojit se serverem studia.');
    }
  };

  const handleApprove = async (id, isApproved) => {
    try {
      const res = await fetch(`${API_BASE}/reservations/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: isApproved }),
      });
      if (res.ok) {
        fetchReservations();
      } else {
        const err = await res.json();
        alert(err.detail || 'Operace se nezdařila.');
      }
    } catch (err) {
      alert('Chyba komunikace se serverem.');
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPinInput === '1234') {
      setIsAdminAuthenticated(true);
      setAdminPinInput('');
    } else {
      alert('Nesprávný PIN studia.');
    }
  };

  const parseReservationDetails = (rawName) => {
    let name = rawName || '';
    let contact = 'Neuvedeno';
    let artistAndService = '';
    let note = '';

    const noteMatch = name.match(/\{Poznámka:\s*(.*?)\}/);
    if (noteMatch) {
      note = noteMatch[1];
      name = name.replace(noteMatch[0], '');
    }

    const contactMatch = name.match(/\[Kontakt:\s*(.*?)\]/);
    if (contactMatch) {
      contact = contactMatch[1];
      name = name.replace(contactMatch[0], '');
    }

    const serviceMatch = name.match(/\[(.*?)\]/);
    if (serviceMatch) {
      artistAndService = serviceMatch[1];
      name = name.replace(serviceMatch[0], '');
    }

    return {
      clientName: name.trim() || 'Klient',
      contact: contact.trim(),
      details: artistAndService.trim(),
      note: note.trim(),
    };
  };

  return (
    <div style={{ backgroundColor: '#FAFAFA', color: '#111111', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* POP-UP DIALOG POTVRZENÍ */}
      {successModalData && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ backgroundColor: '#FFFFFF', maxWidth: '480px', width: '100%', padding: '36px', borderRadius: '2px', border: '1px solid #EAEAEA', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#059669', textTransform: 'uppercase', marginBottom: '8px' }}>
              ✓ Žádost byla úspěšně odeslána
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
              TERMÍN ČEKÁ NA POTVRZENÍ
            </h2>
            <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 24px' }}>
              Děkujeme, <strong>{successModalData.client}</strong>. Vaše žádost <strong>#{successModalData.id}</strong> byla předána do agendy ateliéru.
            </p>

            <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', padding: '16px', borderRadius: '2px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#777' }}>Tatér:</span>
                <span style={{ fontWeight: '700' }}>{successModalData.artist}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#777' }}>Služba:</span>
                <span style={{ fontWeight: '700' }}>{successModalData.service}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#777' }}>Termín:</span>
                <span style={{ fontWeight: '700' }}>{successModalData.date} ({successModalData.time})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #DDD', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ color: '#777' }}>Kontaktní údaj ({successModalData.contactType}):</span>
                <span style={{ fontWeight: '700' }}>{successModalData.contactValue}</span>
              </div>
            </div>

            <button
              onClick={() => setSuccessModalData(null)}
              style={{ width: '100%', backgroundColor: '#000', color: '#FFF', border: 'none', padding: '14px', fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Rozumím a zavřít
            </button>
          </div>
        </div>
      )}

      {/* Horní lišta */}
      <header style={{ width: '100%', borderBottom: '1px solid #EAEAEA', backgroundColor: '#FFFFFF', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: '100%', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <span style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '3px', textTransform: 'uppercase' }}>
              ATELIER NOIR
            </span>
            <span style={{ height: '14px', width: '1px', backgroundColor: '#DDD' }}></span>
            <span style={{ fontSize: '12px', color: '#666', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Custom Tattoo & Art Space
            </span>
          </div>

          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <button
              onClick={() => setActiveTab('booking')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: activeTab === 'booking' ? '800' : '500', color: activeTab === 'booking' ? '#000' : '#888', borderBottom: activeTab === 'booking' ? '2px solid #000' : '2px solid transparent', paddingBottom: '4px' }}
            >
              Rezervovat sezení
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: activeTab === 'portfolio' ? '800' : '500', color: activeTab === 'portfolio' ? '#000' : '#888', borderBottom: activeTab === 'portfolio' ? '2px solid #000' : '2px solid transparent', paddingBottom: '4px' }}
            >
              Portfolio
            </button>
            <button
              onClick={() => setActiveTab('studio')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: activeTab === 'studio' ? '800' : '500', color: activeTab === 'studio' ? '#000' : '#888', borderBottom: activeTab === 'studio' ? '2px solid #000' : '2px solid transparent', paddingBottom: '4px' }}
            >
              Studio & Ceník
            </button>
          </div>
        </div>
      </header>

      {/* Hlavní obsah */}
      <div style={{ width: '100%', padding: '40px 48px', boxSizing: 'border-box', flex: 1 }}>
        
        {/* TAB 1: REZERVAČNÍ SYSTÉM */}
        {activeTab === 'booking' && (
          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr 400px', gap: '36px', alignItems: 'start' }}>
            
            {/* Sloupec 1: Výběr Tatéra a Rozsahu */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Výběr tatéra */}
              <div style={{ backgroundColor: '#FFF', border: '1px solid #EAEAEA', padding: '24px', borderRadius: '2px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#999', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Výběr umělce
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
                  REZIDENTNÍ TATÉR
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {TATTOO_ARTISTS.map(artist => {
                    const isSelected = selectedArtist.id === artist.id;
                    return (
                      <div
                        key={artist.id}
                        onClick={() => { setSelectedArtist(artist); setSelectedStartTime(null); }}
                        style={{
                          border: isSelected ? '2px solid #000' : '1px solid #EAEAEA',
                          padding: '16px 12px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#FAFAFA' : '#FFF',
                          transition: 'all 0.15s ease',
                          textAlign: 'center',
                          borderRadius: '2px',
                        }}
                      >
                        <img 
                          src={artist.photo} 
                          alt={artist.name} 
                          style={{ 
                            width: '72px', 
                            height: '72px', 
                            aspectRatio: '1 / 1',
                            borderRadius: '50%', 
                            objectFit: 'cover', 
                            objectPosition: '50% 25%',
                            filter: 'grayscale(100%)', 
                            margin: '0 auto 10px',
                            display: 'block',
                            border: isSelected ? '1px solid #000' : '1px solid #E5E5E5',
                          }}
                        />
                        <div style={{ fontWeight: '800', fontSize: '14px', color: '#111' }}>{artist.name}</div>
                        <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>09:00 – 18:00 (Po – Pá)</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rozsah práce */}
              <div style={{ backgroundColor: '#FFF', border: '1px solid #EAEAEA', padding: '24px', borderRadius: '2px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#999', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Rozsah práce
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
                  TYP SEZENÍ
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {SERVICES.map((s) => {
                    const isSelected = selectedService.id === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => { setSelectedService(s); setSelectedStartTime(null); }}
                        style={{
                          padding: '14px 16px',
                          border: isSelected ? '2px solid #000' : '1px solid #EEE',
                          backgroundColor: isSelected ? '#FAFAFA' : '#FFF',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontWeight: '800', fontSize: '13px' }}>{s.name}</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#000' }}>{s.price}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', margin: '2px 0 4px', lineHeight: '1.4' }}>
                          {s.desc}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: '600' }}>
                          Doba sezení: {s.durationHours === 8 ? 'celý den (09:00 – 17:00)' : `cca ${s.durationHours} hod.`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Sloupec 2: Kalendář */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #EAEAEA', padding: '32px', borderRadius: '2px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#999', textTransform: 'uppercase', marginBottom: '8px' }}>
                Termín u: {selectedArtist.name}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 24px', paddingBottom: '16px', borderBottom: '1px solid #F0F0F0' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px', textTransform: 'uppercase' }}>
                    {monthNames[selectedMonth]}
                  </h2>
                  <span style={{ fontSize: '13px', color: '#888', fontWeight: '600', letterSpacing: '1px' }}>
                    ROK {selectedYear}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={handlePrevMonth}
                    disabled={isPrevMonthDisabled}
                    title="Předchozí měsíc"
                    style={{
                      width: '40px',
                      height: '40px',
                      border: '1px solid #E5E5E5',
                      backgroundColor: isPrevMonthDisabled ? '#FAFAFA' : '#FFF',
                      color: isPrevMonthDisabled ? '#DDD' : '#000',
                      cursor: isPrevMonthDisabled ? 'not-allowed' : 'pointer',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '2px',
                    }}
                  >
                    ←
                  </button>
                  <button
                    onClick={handleNextMonth}
                    disabled={isNextMonthDisabled}
                    title="Následující měsíc"
                    style={{
                      width: '40px',
                      height: '40px',
                      border: '1px solid #E5E5E5',
                      backgroundColor: isNextMonthDisabled ? '#FAFAFA' : '#FFF',
                      color: isNextMonthDisabled ? '#DDD' : '#000',
                      cursor: isNextMonthDisabled ? 'not-allowed' : 'pointer',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '2px',
                    }}
                  >
                    →
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '28px' }}>
                {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#AAA', padding: '8px 0', textTransform: 'uppercase' }}>{d}</div>
                ))}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`offset-${i}`} style={{ height: '46px' }} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const disabled = isDateDisabled(day);
                  const isSelected = selectedDay === day;

                  return (
                    <button
                      key={day}
                      disabled={disabled}
                      onClick={() => { setSelectedDay(day); setSelectedStartTime(null); }}
                      style={{
                        height: '46px',
                        border: isSelected ? '2px solid #000' : '1px solid #EAEAEA',
                        backgroundColor: isSelected ? '#000' : disabled ? '#FBFBFB' : '#FFF',
                        color: isSelected ? '#FFF' : disabled ? '#DDD' : '#111',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontWeight: isSelected ? '800' : '500',
                        fontSize: '14px',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {selectedDay ? (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px', color: '#000' }}>
                    Dostupné sloty pro {selectedService.name}:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                    {getAvailableStartTimes().map((slot) => {
                      const isSelected = selectedStartTime?.start === slot.start;
                      return (
                        <button
                          key={slot.start}
                          disabled={slot.isBlocked}
                          onClick={() => setSelectedStartTime(slot)}
                          style={{
                            padding: '10px 8px',
                            border: isSelected ? '2px solid #000' : '1px solid #E5E5E5',
                            backgroundColor: slot.isBlocked ? '#F5F5F5' : isSelected ? '#111' : '#FFF',
                            color: slot.isBlocked ? '#CCC' : isSelected ? '#FFF' : '#000',
                            cursor: slot.isBlocked ? 'not-allowed' : 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontWeight: '700', fontSize: '13px' }}>{slot.start}</div>
                          <div style={{ fontSize: '10px', marginTop: '2px', color: slot.isBlocked ? '#BBB' : isSelected ? '#DDD' : '#666' }}>
                            {slot.isBlocked ? slot.blockReason : `do ${slot.end}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '24px', backgroundColor: '#F9FAFB', color: '#888', fontSize: '13px', textAlign: 'center' }}>
                  Zvolte pracovní den v kalendáři pro zobrazení časových oken.
                </div>
              )}
            </div>

            {/* Sloupec 3: Rekapitulace a Kontaktní údaje */}
            <div style={{ backgroundColor: '#FFF', border: '1px solid #EAEAEA', padding: '32px', borderRadius: '2px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#999', textTransform: 'uppercase', marginBottom: '8px' }}>
                Dokončení
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 20px', letterSpacing: '-0.5px' }}>
                REZERVACE SEZENÍ
              </h2>

              <div style={{ borderTop: '1px solid #EEE', borderBottom: '1px solid #EEE', padding: '16px 0', marginBottom: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#777' }}>Tatér:</span>
                  <span style={{ fontWeight: '700' }}>{selectedArtist.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#777' }}>Rozsah:</span>
                  <span style={{ fontWeight: '700' }}>{selectedService.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#777' }}>Termín:</span>
                  <span style={{ fontWeight: '700' }}>
                    {selectedDay ? `${selectedDay}. ${monthNames[selectedMonth]} ${selectedYear}` : 'Nevybráno'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#777' }}>Časové okno:</span>
                  <span style={{ fontWeight: '700' }}>
                    {selectedStartTime ? `${selectedStartTime.start} – ${selectedStartTime.end}` : 'Nevybráno'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#777' }}>Orientační cena:</span>
                  <span style={{ fontWeight: '700' }}>{selectedService.price}</span>
                </div>
              </div>

              <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                    Jméno a příjmení *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="např. Karolína Svobodová"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #CCC', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                      Telefonní číslo <span style={{ fontWeight: '400', color: '#666' }}>(nebo e-mail)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="+420 777 123 456"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #CCC', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                    E-mailová adresa <span style={{ fontWeight: '400', color: '#666' }}>(nebo telefon)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="klient@email.cz"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #CCC', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                    Představa o motivu (volitelné)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Umístění, styl motivu..."
                    value={clientNote}
                    onChange={(e) => setClientNote(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #CCC', fontSize: '13px', boxSizing: 'border-box', resize: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedDay || !selectedStartTime}
                  style={{
                    backgroundColor: (!selectedDay || !selectedStartTime) ? '#DDD' : '#000',
                    color: '#FFF',
                    border: 'none',
                    padding: '14px',
                    fontSize: '12px',
                    fontWeight: '800',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    cursor: (!selectedDay || !selectedStartTime) ? 'not-allowed' : 'pointer',
                    marginTop: '8px',
                  }}
                >
                  Odeslat žádost o termín →
                </button>
              </form>

              {errorMessage && (
                <div style={{ marginTop: '14px', padding: '12px', fontSize: '12px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '2px', border: '1px solid #FCA5A5' }}>
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PORTFOLIO */}
        {activeTab === 'portfolio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '56px', width: '100%' }}>
            <div style={{ borderLeft: '4px solid #000', paddingLeft: '28px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#999', textTransform: 'uppercase', marginBottom: '8px' }}>
                Vybrané práce
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-1px', margin: '0 0 16px' }}>
                PORTFOLIO ATELIÉRU.
              </h1>
              <p style={{ fontSize: '16px', color: '#555', maxWidth: '950px', lineHeight: '1.7', margin: 0 }}>
                Ukázky realizovaných projektů a volných autorských motivů. Každé tetování je originál vytvořený na míru klientovi s důrazem na čistou kompozici, precizní linky a dlouhodobou stálost pigmentu.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '28px', width: '100%' }}>
              {PORTFOLIO_WORKS.map((work) => (
                <div key={work.id} style={{ backgroundColor: '#FFF', border: '1px solid #EAEAEA', overflow: 'hidden' }}>
                  <div style={{ height: '380px', overflow: 'hidden', backgroundColor: '#F0F0F0' }}>
                    <img
                      src={work.img}
                      alt={work.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%)', transition: 'transform 0.3s ease' }}
                    />
                  </div>
                  <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '16px' }}>{work.title}</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{work.artist}</div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: '#F4F4F4', padding: '4px 8px', borderRadius: '2px' }}>
                      {work.style}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: STUDIO & CENÍK */}
        {activeTab === 'studio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '56px', width: '100%' }}>
            <div style={{ borderLeft: '4px solid #000', paddingLeft: '28px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#999', textTransform: 'uppercase', marginBottom: '8px' }}>
                O Ateliéru
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-1px', margin: '0 0 16px' }}>
                PROSTOR PRO SOUDOBOU TETOVACÍ TVORBU.
              </h1>
              <p style={{ fontSize: '16px', color: '#555', maxWidth: '950px', lineHeight: '1.7', margin: 0 }}>
                Atelier Noir funguje na principu privátního studia. Nevěříme na katalogové motivy ani na rychlá sezení ve spěchu. Každý klient má u nás garantovaný klid, sterilní prostředí a plnou pozornost umělce. Pracujeme výhradně s certifikovanými veganskými pigmenty splňujícími nejpřísnější normy EU REACH.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#999', textTransform: 'uppercase', marginBottom: '16px' }}>
                Rezidentní umělci
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: '32px', width: '100%' }}>
                {TATTOO_ARTISTS.map(a => (
                  <div key={a.id} style={{ backgroundColor: '#FFF', border: '1px solid #EAEAEA', display: 'flex', overflow: 'hidden' }}>
                    <img 
                      src={a.photo} 
                      alt={a.name} 
                      style={{ width: '220px', minWidth: '220px', objectFit: 'cover', filter: 'grayscale(100%)', borderRight: '1px solid #EAEAEA' }}
                    />
                    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                      <div>
                        <div style={{ fontSize: '20px', fontWeight: '900', marginBottom: '2px' }}>{a.name}</div>
                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>{a.title}</div>
                        <div style={{ fontSize: '12px', color: '#000', fontWeight: '700', marginBottom: '10px' }}>{a.specialization}</div>
                        <div style={{ fontSize: '14px', color: '#555', lineHeight: '1.6' }}>{a.bio}</div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#777', borderTop: '1px solid #F0F0F0', paddingTop: '14px', marginTop: '16px' }}>
                        Pracovní doba: <strong>{a.hours}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#999', textTransform: 'uppercase', marginBottom: '16px' }}>
                Kompletní ceník sezení
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px', width: '100%' }}>
                {DETAILED_PRICING.map((cat, idx) => (
                  <div key={idx} style={{ backgroundColor: '#FFF', border: '1px solid #EAEAEA', padding: '32px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 24px', borderBottom: '1px solid #EEE', paddingBottom: '12px' }}>
                      {cat.category}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                      {cat.items.map((item, i) => (
                        <div key={i} style={{ borderBottom: i < cat.items.length - 1 ? '1px dashed #F0F0F0' : 'none', paddingBottom: i < cat.items.length - 1 ? '16px' : '0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '700', fontSize: '14px' }}>{item.name}</span>
                            <span style={{ fontWeight: '800', fontSize: '14px', color: '#000' }}>{item.price}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#777', lineHeight: '1.5' }}>{item.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: CHRÁNĚNÁ AGEDA PERSONÁLU */}
        {activeTab === 'admin' && (
          <div style={{ backgroundColor: '#FFF', border: '1px solid #EAEAEA', padding: '36px' }}>
            {!isAdminAuthenticated ? (
              <div style={{ maxWidth: '360px', margin: '60px auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '8px' }}>PŘÍSTUP PERSONÁLU</h2>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>Zadejte 4místný PIN studia pro správu žádostí.</p>
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="PIN"
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '8px', padding: '10px', border: '1px solid #CCC' }}
                  />
                  <button type="submit" style={{ backgroundColor: '#000', color: '#FFF', padding: '12px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
                    Odemknout agendu →
                  </button>
                </form>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid #EEE', paddingBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0 }}>AGENDA ŽÁDOSTÍ ATELIÉRU</h2>
                    <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>
                      Schvalování termínů dle specifikace Baseline v0.2 (PENDING_APPROVAL → CONFIRMED / REJECTED)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <select
                      value={adminFilterArtistId}
                      onChange={(e) => setAdminFilterArtistId(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #DDD', fontSize: '12px', fontWeight: '600', backgroundColor: '#FFF' }}
                    >
                      <option value="ALL">Všichni tatéři</option>
                      <option value="Jan Novák">Pouze Jan Novák</option>
                      <option value="Elena Křížová">Pouze Elena Křížová</option>
                    </select>
                    <button onClick={fetchReservations} style={{ padding: '8px 16px', border: '1px solid #DDD', backgroundColor: '#FFF', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                      Obnovit
                    </button>
                    <button onClick={() => setIsAdminAuthenticated(false)} style={{ padding: '8px 16px', border: '1px solid #DDD', backgroundColor: '#FAFAFA', cursor: 'pointer', fontSize: '12px' }}>
                      Zamknout
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {reservations.filter(r => adminFilterArtistId === 'ALL' || (r.client_name && r.client_name.includes(adminFilterArtistId))).length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#999', fontSize: '14px', backgroundColor: '#FAFAFA' }}>
                      Žádné rezervace pro zvolený filtr.
                    </div>
                  ) : (
                    reservations
                      .filter(r => adminFilterArtistId === 'ALL' || (r.client_name && r.client_name.includes(adminFilterArtistId)))
                      .map(r => {
                        const s = new Date(r.start_time);
                        const e = new Date(r.end_time);
                        const details = parseReservationDetails(r.client_name);

                        const statusColors = {
                          PENDING_APPROVAL: { bg: '#FEF3C7', color: '#92400E', label: 'Čeká na schválení' },
                          CONFIRMED: { bg: '#D1FAE5', color: '#065F46', label: 'Potvrzeno' },
                          REJECTED: { bg: '#FEE2E2', color: '#991B1B', label: 'Zamítnuto' },
                          CANCELLED: { bg: '#F3F4F6', color: '#374151', label: 'Zrušeno' },
                          EXPIRED: { bg: '#EDE9FE', color: '#5B21B6', label: 'Expirováno' },
                        };
                        const badge = statusColors[r.status] || { bg: '#EEE', color: '#333', label: r.status };

                        return (
                          <div key={r.id} style={{ border: '1px solid #EAEAEA', backgroundColor: r.status === 'PENDING_APPROVAL' ? '#FFFDF5' : '#FFF', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontSize: '18px', fontWeight: '900', color: '#111' }}>{details.clientName}</span>
                                  <span style={{ fontSize: '12px', color: '#888' }}>ID #{r.id}</span>
                                  <span style={{ fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '2px', backgroundColor: badge.bg, color: badge.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {badge.label}
                                  </span>
                                </div>
                                <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                                  Kontakt: <strong style={{ color: '#111' }}>{details.contact}</strong>
                                </div>
                              </div>

                              {r.status === 'PENDING_APPROVAL' && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => handleApprove(r.id, true)}
                                    style={{ backgroundColor: '#000', color: '#FFF', border: 'none', padding: '10px 20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer' }}
                                  >
                                    Schválit termín
                                  </button>
                                  <button
                                    onClick={() => handleApprove(r.id, false)}
                                    style={{ backgroundColor: '#FFF', color: '#DC2626', border: '1px solid #FCA5A5', padding: '10px 18px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer' }}
                                  >
                                    Zamítnout
                                  </button>
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', backgroundColor: '#FAFAFA', padding: '16px', border: '1px solid #F0F0F0', fontSize: '13px' }}>
                              <div>
                                <div style={{ fontSize: '11px', color: '#888', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Datum & Čas</div>
                                <div style={{ fontWeight: '700' }}>
                                  {s.toLocaleDateString('cs-CZ')} ({s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: '11px', color: '#888', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Umělec & Rozsah</div>
                                <div style={{ fontWeight: '700' }}>{details.details || 'Nespeficikováno'}</div>
                              </div>

                              {details.note && (
                                <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #DDD', paddingTop: '8px', marginTop: '4px' }}>
                                  <div style={{ fontSize: '11px', color: '#888', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Představa o motivu</div>
                                  <div style={{ color: '#444' }}>{details.note}</div>
                                </div>
                              )}
                            </div>

                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Diskrétní patička přikotvená ke spodku */}
      <footer style={{ borderTop: '1px solid #EAEAEA', backgroundColor: '#FFFFFF', padding: '24px 48px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#888' }}>
        <div>
          © 2026 Atelier Noir. Všechna práva vyhrazena. | Tým Tetovačky (SWI projekt)
        </div>
        <div>
          <button
            onClick={() => setActiveTab('admin')}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
          >
            Vstup pro personál (Agenda tatérů)
          </button>
        </div>
      </footer>

    </div>
  );
}