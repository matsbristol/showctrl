// Norwegian for the logistics screens (see src/i18n/README in the glossary). English text → bokmål.
export default {
  // Shared form words
  Name: 'Navn', Notes: 'Notater', Phone: 'Telefon', Status: 'Status', Type: 'Type', Who: 'Hvem', From: 'Fra', To: 'Til',
  Time: 'Tid', Removed: 'Fjernet', Everyone: 'Alle', 'Belongs to': 'Hører til', 'Edit {name}': 'Rediger {name}',
  'Enter a name.': 'Skriv inn et navn.', 'Whole event': 'Hele arrangementet', 'Whole festival': 'Hele festivalen',
  'Not {aPerformer}': 'Ingen {performer}', 'e.g. Press, Catering crew': 'f.eks. Presse, cateringcrew',

  // Accommodation
  Accommodation: 'Overnatting', Hotel: 'Hotell', Guest: 'Gjest', Ref: 'Ref.', room: 'rom',
  'Hotels, room blocks and the rooming list for {performers}, crew and guests.': 'Hoteller, romkvoter og romliste for {performers}, crew og gjester.',
  '+ Add hotel': '+ Legg til hotell', '+ Add booking': '+ Legg til booking',
  'Block:': 'Kvote:', 'rooms per night': 'rom per natt', 'No hotels yet.': 'Ingen hoteller ennå.',
  'Rooms used per night': 'Rom brukt per natt', 'Rooming list': 'Romliste', 'No bookings.': 'Ingen bookinger.',
  'Edit hotel': 'Rediger hotell', 'Add hotel': 'Legg til hotell', Address: 'Adresse', 'Contact person': 'Kontaktperson',
  'Rooms held per night': 'Rom holdt av per natt',
  'Edit booking': 'Rediger booking', 'Add booking': 'Legg til booking', 'Add a hotel first.': 'Legg til et hotell først.',
  'Choose who the booking is for.': 'Velg hvem bookingen gjelder.', 'Check-out must be after check-in.': 'Utsjekk må være etter innsjekk.',
  'Guest name': 'Gjestens navn', 'Guest is': 'Gjesten er', 'e.g. Crew, Press, VIP': 'f.eks. Crew, presse, VIP',
  'Check-in': 'Innsjekk', 'Check-out': 'Utsjekk', 'Room type': 'Romtype', 'Single, double, suite': 'Enkelt, dobbelt, suite',
  'Confirmation number': 'Bekreftelsesnummer',
  // Booking statuses (BOOKING_STATUS)
  requested: 'bedt om', held: 'holdt av', confirmed: 'bekreftet', 'checked in': 'sjekket inn', 'checked out': 'sjekket ut', cancelled: 'avlyst',

  // Transport
  Transport: 'Transport',
  'Pickups and drop-offs for the day. Arrivals and departures without a ride are listed underneath, ready to book.':
    'Hentinger og avleveringer for dagen. Ankomster og avreiser uten transport står under, klare til å bookes.',
  '+ Add transfer': '+ Legg til transport', Pickup: 'Henting', People: 'Personer', 'From → to': 'Fra → til',
  'Vehicle & driver': 'Kjøretøy og sjåfør', 'Status of {name} pickup': 'Status for henting av {name}',
  'No transfers this day.': 'Ingen transport denne dagen.', 'Still needs a ride': 'Mangler transport',
  '{n} arrivals and departures': '{n} ankomster og avreiser', '{n} people': '{n} personer', 'Book ride': 'Book transport',
  'Own transport': 'Egen transport', 'Every arrival and departure has a ride.': 'Alle ankomster og avreiser har transport.',
  'Edit transfer': 'Rediger transport', 'Add transfer': 'Legg til transport',
  'Choose {aPerformer} or name who it’s for.': 'Velg {performer} eller skriv hvem det gjelder.',
  'Set the pickup time.': 'Angi hentetidspunkt.', 'Fill in from and to.': 'Fyll inn fra og til.',
  'e.g. Airport arrivals, Fjordhotellet': 'f.eks. Ankomsthallen på flyplassen, Fjordhotellet', 'e.g. Artist gate': 'f.eks. Artistinngangen',
  Vehicle: 'Kjøretøy', 'e.g. Van 2, Sprinter': 'f.eks. Varebil 2, Sprinter', Driver: 'Sjåfør', 'Driver phone': 'Sjåførens telefon',
  'Flight number, luggage, meeting point…': 'Flynummer, bagasje, møtested…',
  // Transfer statuses (TRANSFER_STATUS)
  planned: 'planlagt', 'en route': 'på vei', done: 'ferdig',

  // Facilities
  Facilities: 'Fasiliteter', Facility: 'Fasilitet',
  'Dressing rooms, offices and other spaces, and who has them when. Double bookings are flagged.':
    'Garderober, kontorer og andre rom, og hvem som har dem når. Dobbeltbookinger blir markert.',
  '+ Add facility': '+ Legg til fasilitet', '+ Book': '+ Book', 'Double booked': 'Dobbeltbooket', 'Free all day.': 'Ledig hele dagen.',
  'No facilities yet.': 'Ingen fasiliteter ennå.', 'No dressing room yet': 'Ingen garderobe ennå',
  'needs it {from}–{to}': 'trenger den {from}–{to}', 'Book room': 'Book rom',
  'Add facility': 'Legg til fasilitet', 'e.g. Dressing room 3, Production office': 'f.eks. Garderobe 3, Produksjonskontor',
  'Bookings at once (empty: 1)': 'Bookinger samtidig (tom: 1)',
  'Where it is, key holder, what’s in it': 'Hvor det er, hvem som har nøkkel, hva som er der',
  'Book facility': 'Book fasilitet', 'Add a facility first.': 'Legg til en fasilitet først.',
  'Choose {aPerformer} or say who it’s for.': 'Velg {performer} eller skriv hvem det gjelder.',
  'The end must be after the start.': 'Slutten må være etter starten.',
  // Facility kinds (FACILITY_KINDS)
  'Dressing room': 'Garderobe', 'Production office': 'Produksjonskontor', Catering: 'Catering', 'Green room': 'Green room',
  Storage: 'Lager', 'Meeting room': 'Møterom', Other: 'Annet',

  // Documents
  Documents: 'Dokumenter',
  'Site plans, safety documents, contracts and technical files. People see the ones for the stages they work on.':
    'Områdekart, sikkerhetsdokumenter, kontrakter og tekniske filer. Folk ser dem som gjelder scenene de jobber på.',
  'Site plans, safety documents, contracts and technical files for this stage, its acts and the whole event. People see the ones for the stages they work on.':
    'Områdekart, sikkerhetsdokumenter, kontrakter og tekniske filer for denne scenen, artistene der og hele arrangementet. Folk ser dem som gjelder scenene de jobber på.',
  '+ Add document': '+ Legg til dokument', 'Search documents': 'Søk i dokumenter', Category: 'Kategori',
  'All categories': 'Alle kategorier', '1 document': '1 dokument', '{n} documents': '{n} dokumenter', link: 'lenke',
  'No documents match.': 'Ingen dokumenter passer.', 'No documents yet.': 'Ingen dokumenter ennå.',
  'Could not read the file.': 'Kunne ikke lese filen.', 'Add document': 'Legg til dokument', Upload: 'Last opp',
  'Add link': 'Legg til lenke', 'Give it a name.': 'Gi den et navn.', 'Choose a file.': 'Velg en fil.',
  'In demo mode files can be up to 1 MB. Use a link, or the live version.': 'I demomodus kan filer være opptil 1 MB. Bruk en lenke, eller liveversjonen.',
  'Links must start with https:// or http://.': 'Lenker må starte med https:// eller http://.',
  Kind: 'Type', 'Upload a file': 'Last opp en fil', 'Add a link': 'Legg til en lenke', File: 'Fil', Link: 'Lenke',
  'For (event, {stage} or {performer})': 'For (arrangement, {stage} eller {performer})',
  // Document categories (FILE_CATEGORIES)
  'Site plan': 'Områdekart', Safety: 'Sikkerhet', Technical: 'Teknisk', Contract: 'Kontrakt', Schedule: 'Tidsplan', Rider: 'Rider',

  // Trucks & docks
  'Trucks & docks': 'Biler og lasteramper', 'Trucks · {stage}': 'Biler · {stage}', Trucks: 'Biler',
  'Every truck coming in or going out, and where to send it when it arrives. Set trucks and a location on load in and load out in the run sheet.':
    'Alle biler som kommer inn eller kjører ut, og hvor de skal sendes når de kommer. Legg inn biler og sted på load in og load out i run sheet.',
  Clashes: 'Konflikter', Clash: 'Konflikt', clash: 'konflikt',
  'has {trucks} trucks booked, room for {capacity}: {acts}': 'har {trucks} biler booket, plass til {capacity}: {acts}',
  Movements: 'Bevegelser', Movement: 'Bevegelse', '1 truck this day': '1 bil denne dagen', '{n} trucks this day': '{n} biler denne dagen',
  'Send to': 'Send til', 'Send {title} to': 'Send {title} til', 'Not set': 'Ikke satt', 'On site': 'På området', Due: 'Ventes',
  'No trucks this day. Add trucks to load in and load out items in the run sheet.': 'Ingen biler denne dagen. Legg til biler på load in og load out i run sheet.',
  Locations: 'Steder', '+ Add location': '+ Legg til sted', '{n} at a time': '{n} om gangen', 'no limit': 'ingen grense',
  'No locations yet. Add load bays, staging areas and truck parks.': 'Ingen steder ennå. Legg til lasteramper, oppstillingsplasser og bilparkeringer.',
  'Add location': 'Legg til sted', 'e.g. Load bay 2, Staging area North': 'f.eks. Lasterampe 2, Oppstillingsplass nord',
  'Trucks at once (empty: 1 for load bays and docks, unlimited otherwise)': 'Biler samtidig (tom: 1 for lasteramper og ramper, ellers ubegrenset)',
  'Notes for drivers': 'Notater til sjåfører', 'e.g. Enter via gate 7, wait for a call on Ch 1': 'f.eks. Kjør inn port 7, vent på anrop på kanal 1',
  'A location can belong to one {stage} (its load bay) or the whole festival (staging areas, truck parks).':
    'Et sted kan høre til én {stage} (lasterampen der) eller hele festivalen (oppstillingsplasser, bilparkeringer).',
  '1 truck': '1 bil', '{n} trucks': '{n} biler', truck: 'bil', trucks: 'biler', 'no location set': 'sted ikke satt',
  'Trucks, next 4 hours': 'Biler, neste 4 timer', 'All trucks': 'Alle biler', 'No trucks due in the next four hours.': 'Ingen biler ventes de neste fire timene.',
  // Location kinds (LOCATION_KINDS)
  'Load bay': 'Lasterampe', 'Staging area': 'Oppstillingsplass', 'Truck park': 'Bilparkering', 'Dock / ramp': 'Rampe',
} satisfies Record<string, string>
