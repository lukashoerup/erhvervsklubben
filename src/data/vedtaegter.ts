/**
 * The club's statutes, transcribed verbatim from `250426_Vedtaegter_vS.docx`
 * in the club's Drive.
 *
 * Verbatim on purpose: these are the rules members are held to, so a summary
 * would be a second, competing version of them. The Drive document remains the
 * source of truth — if the club amends the statutes under §14, amend them there
 * first, then here.
 *
 * §4 Stk. 3 states the monthly dues, which the finance code also charges. The
 * two are cross-checked in vedtaegter.test.ts so the stated figure and the
 * charged figure cannot drift apart unnoticed.
 */

export type Statute = {
  /** Section number, as cited: §1, §2, … */
  n: number
  title: string
  /** Each stykke as its own paragraph, in order. */
  items: string[]
}

export const VEDTAEGTER: Statute[] = [
  {
    n: 1,
    title: 'Navn og hjemsted',
    items: [
      'Foreningens navn er Erhvervsklubben.',
      'Foreningen har hjemsted i København og møder forekommer fortrinsvis i København.',
    ],
  },
  {
    n: 2,
    title: 'Formål',
    items: [
      'Foreningens formål er at skabe et netværk for enkeltpersoner med interesse for erhverv, iværksætteri og innovation mv.',
      'Gennem møder og samarbejde skal medlemmerne kunne dele erfaringer, sparre om idéer og styrke deres personlige og faglige udvikling.',
    ],
  },
  {
    n: 3,
    title: 'Definitioner',
    items: [
      'Lead: Ved lead forstås det medlem, som er ansvarlig for at arrangere det kommende møde. Det indebærer mødeindkaldelse, planlægge dagsorden, koordinere med relevante parter og sikre mødefremdrift.',
      'Aktive medlemmer: Medlemmer som betaler kontingent. Aktive medlemmer giver retten til stemmerettigheder, ikke anciennitet. Anciennitet kan kun opbygges ved mødedeltagelse.',
      'Inaktive medlemmer: Medlemmer som er på pause og ikke betaler kontingent. Har ikke ret til deltagelse i arrangementer.',
    ],
  },
  {
    n: 4,
    title: 'Medlemskab',
    items: [
      'Stk. 1. Som medlemmer kan optages enkeltpersoner med interesse i foreningens formål.',
      'Stk. 2. Optagelse sker ved godkendelse fra minimum 2/3 af de aktive medlemmer.',
      'Stk. 2. A. Enkeltpersoner skal have deltaget til ét arrangement som gæst, før medlemskab kan gå til afstemning.',
      'Stk. 3. Medlemskab forudsætter betaling af et kontingent på 200 kr. pr. måned. Kontingentet betales forud og opkræves månedligt.',
      'Stk. 4. Aktivt medlemskab kan kun gøres inaktivt med 3 måneders varsel.',
      'Stk. 5. Ved inaktivitet i 2 år eller mere, så skal der stemmes om hvorvidt et inaktivt medlem kan blive aktivt igen, eller hvorvidt medlemskabet overgår til alumne status.',
      'Stk. 5. A. Såfremt et medlemskab er overgået til alumne status, så vil et evt. ønske om at blive et aktivt medlem igen forudsætte samme optagelsesprocedure, som for et nyt medlem.',
    ],
  },
  {
    n: 5,
    title: 'Generalforsamling',
    items: [
      'Stk. 1. Foreningens øverste myndighed er generalforsamlingen, der afholdes én gang årligt inden udgangen af april måned.',
      'Stk. 2. Indkaldelse sker skriftligt (f.eks. pr. e-mail) med minimum 2 ugers varsel og med angivelse af dagsorden.',
      'Stk. 3. Dagsordenen skal mindst indeholde følgende punkter: 1. Valg af dirigent. 2. Valg af referent. 3. Årsberetning fra bestyrelsen. 4. Fremlæggelse og godkendelse af regnskab. 5. Valg af formand. 6. Valg af næstformand. 7. Valg af kasserer. 8. Eventuelt.',
      'Stk. 4. Valg sker ved simpelt flertal blandt de fremmødte.',
      'Stk. 5. Alle øvrige beslutninger kræver 2/3 flertal, medmindre andet fremgår af vedtægterne.',
    ],
  },
  {
    n: 6,
    title: 'Ekstraordinær generalforsamling',
    items: [
      'Stk. 1. For ekstraordinære forhold og beslutninger afholdes der en ekstraordinær generalforsamling med samme kompetence som den ordinære generalforsamling.',
      'Stk. 2. For indkaldelse, dagsorden, valg og beslutninger følges samme forhold som ved §5 – Generalforsamling.',
    ],
  },
  {
    n: 7,
    title: 'Bestyrelse',
    items: [
      'Stk. 1. Bestyrelsen består af minimum 3 medlemmer: formand, næstformand og kasserer.',
      'Stk. 1. A. Bestyrelsen kan kun udgøres af aktive medlemmer, og en bestyrelsespost skal derfor videregives, før et (nu tidligere) bestyrelsesmedlem kan overgå til at være et inaktivt medlem.',
      'Stk. 2. Bestyrelsen vælges på generalforsamlingen for 1 år ad gangen.',
      'Stk. 3. Genvalg kan finde sted.',
      'Stk. 3. A. Man kan maksimalt sidde to år i streg på en bestyrelsespost.',
      'Stk. 4. Bestyrelsen konstituerer sig selv, hvis ikke andet besluttes på generalforsamlingen.',
    ],
  },
  {
    n: 8,
    title: 'Økonomi og regnskab',
    items: [
      'Stk. 1. Foreningens regnskabsår følger kalenderåret: 1. januar – 31. december.',
      'Stk. 2. Kassereren fører regnskab over foreningens økonomi og fremlægger årsregnskab på generalforsamlingen.',
      'Stk. 3. Foreningen tegnes af formanden i forening med enten næstformand eller kasserer.',
    ],
  },
  {
    n: 9,
    title: 'Møder',
    items: [
      'Stk. 1. Der afholdes som udgangspunkt møde hver anden måned.',
      'Stk. 2. Mødefrekvensen besluttes fra gang til gang af de fremmødte medlemmer.',
      'Stk. 3. Der planlægges altid to møder forud, således at der til enhver tid er to planlagte møder i kalenderen.',
      'Stk. 4. Lead-rollen går på skift mellem medlemmerne. Lead er ansvarlig for at indkalde til mødet med minimum 2 ugers varsel, planlægge dagsorden og sikre mødefremdrift.',
      'Stk. 4. A. Såfremt lead er forhindret i deltagelse i eget arrangement, så skal lead sørge for at der er et andet medlem som kan overtage lead-rollen til arrangementet.',
    ],
  },
  {
    n: 10,
    title: 'Gæste- og prøvedeltagelse',
    items: [
      'Stk. 1. Gæste- og prøvedeltagelse ved møder kræver forudgående godkendelse.',
      'Stk. 2. Beslutningen om at tillade en gæst træffes forud for mødet med mindst 2/3 flertal blandt samtlige aktive medlemmer.',
      'Stk. 3. Gæster har ingen stemmeret og optjener ikke anciennitet.',
    ],
  },
  {
    n: 11,
    title: 'Anciennitet',
    items: [
      'Stk. 1. Anciennitet opbygges løbende ved deltagelse i foreningens arrangementer. Jo flere arrangementer et aktivt medlem deltager i, desto større anciennitet opnås.',
      'Stk. 1. A. Anciennitet måles i antal deltagelser.',
      'Stk. 2. Det er muligt at rejse spørgsmål om anciennitet ved forhold, hvor et aktivt medlem f.eks. forlader et arrangement tidligt for personlige aktiviteter eksempelvis deltagelse i pigekor, en date eller lignende.',
      'Stk. 3. I sådanne tilfælde kan de fremmødte aktive medlemmer stemme om, hvorvidt der skal frakendes anciennitet for deltagelsen. Anciennitet frakendes kun, hvis minimum 2/3 af de fremmødte stemmer imod.',
      'Stk. 4. Afstemningen skal finde sted under samme møde og afklares under spisningen. Hvis der ikke stemmes, optjenes fuld anciennitet automatisk.',
      'Stk. 4. A. Det kræves, at aktive medlemmer, som har arrangeret andre personlige aktiviteter, som overlapper med arrangementets agenda, meddeler dette til resten af gruppen, senest under spisningen.',
    ],
  },
  {
    n: 12,
    title: 'Brug af midler',
    items: [
      'Stk. 1. Oplæg til brug af foreningens midler skal fremsendes til mødets ansvarlige ("lead") senest 14 dage før et møde. Midler kan aldrig anvendes på samme dag, som oplægget er drøftet, men tidligst på det efterfølgende møde.',
      'Stk. 2. For at midler kan anvendes, kræves mindst 2/3 flertal blandt de fremmødte aktive medlemmer.',
      'Stk. 2. A. Såfremt under halvdelen af foreningens aktive medlemmer er til stede, skal beslutningen om brug af midler vedtages enstemmigt.',
    ],
  },
  {
    n: 13,
    title: 'Sanktioner',
    items: [
      'Stk. 1. Et aktivt medlem, der gentagne gange udebliver fra møder uden afbud, optræder krænkende, eller modarbejder foreningens formål, kan ekskluderes.',
      'Stk. 2. Eksklusion kan kun ske ved enstemmig beslutning blandt de øvrige aktive medlemmer på et møde.',
      'Stk. 3. Den pågældende har ret til at blive hørt, før der stemmes.',
      'Stk. 4. Ved mindre forseelser kan aktive medlemmer sanktioneres på anden vis, som ikke er formaliseret i vedtægterne, fx ved bidrag til en bødekasse.',
    ],
  },
  {
    n: 14,
    title: 'Vedtægtsændringer',
    items: [
      'Ændringer af nærværende vedtægter kan kun vedtages på en ordinær generalforsamling og kræver 2/3 flertal blandt de fremmødte aktive medlemmer.',
    ],
  },
  {
    n: 15,
    title: 'Opløsning',
    items: [
      'Stk. 1. Beslutning om opløsning af foreningen kan kun træffes på en ordinær eller ekstraordinær generalforsamling.',
      'Stk. 2. Opløsning kræver, at mindst 2/3 af foreningens aktive medlemmer stemmer for.',
      'Stk. 3. Ved opløsning fordeles foreningens formue ligeligt mellem de på tidspunktet eksisterende aktive medlemmer.',
    ],
  },
]

/**
 * One section, by number.
 *
 * Throws rather than returning undefined. The public landing page quotes the
 * statutes instead of paraphrasing them, and a citation that silently resolves
 * to nothing would leave a blank paragraph on the club's front door — a loud
 * failure at build and test time is the cheaper mistake.
 */
export function statute(n: number): Statute {
  const found = VEDTAEGTER.find((s) => s.n === n)
  if (!found) throw new Error(`Vedtægterne har ingen §${n}`)
  return found
}

/**
 * A stykke with its "Stk. 3." / "Stk. 2. A." label stripped.
 *
 * The label is part of the statute and stays on /regler, where members are
 * reading the rules *as* rules. The public page quotes the same sentences as a
 * description of the club, where the numbering is noise — the citation is
 * carried by the "§9" printed beside it instead. Stripping at the point of use
 * rather than storing a second copy keeps one text in the repo, so a future
 * amendment cannot land on the statutes page and miss the front door.
 */
export function stk(text: string): string {
  return text.replace(/^Stk\. \d+\.(\s+[A-Z]\.)?\s+/, '')
}

/** §4 Stk. 3, as written — the clause the charged dues rate must agree with. */
export const DUES_CLAUSE = VEDTAEGTER.find((s) => s.n === 4)!.items.find((i) =>
  i.startsWith('Stk. 3.'),
)!

/** The kroner figure stated in §4 Stk. 3, read from the text rather than repeated. */
export function statedMonthlyDues(): number {
  const match = DUES_CLAUSE.match(/kontingent på (\d+) kr\./)
  if (!match) throw new Error('§4 Stk. 3 no longer states a monthly figure')
  return Number(match[1])
}
