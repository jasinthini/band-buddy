import originalPassages from './readingQuestions.json';

export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export const TYPES = [
  'Multiple choice',
  'True / False / Not Given',
  'Sentence completion',
  'Short answer',
  'Matching headings',
];

const TF = ['True', 'False', 'Not given'];

const mc = (prompt, answer, other, explanation, position = 0) => {
  const options = [...other];
  options.splice(position, 0, answer);
  return { type: TYPES[0], prompt, answer, options, explanation };
};

const tf = (prompt, answer, explanation) => ({
  type: TYPES[1], prompt, answer, options: TF, explanation,
});

const written = (type, prompt, answer, limit, explanation) => ({
  type, prompt, answer, limit, explanation,
});

const heading = (letter, answer, other, explanation) => ({
  type: TYPES[4],
  prompt: `Choose the best heading for paragraph ${letter}.`,
  answer,
  options: [other[0], answer, other[1]],
  explanation,
});

function originalType(question) {
  if (question.type) return question.type;
  if (!question.options) return TYPES[2];
  return question.options.some((option) => option.toLowerCase() === 'not given')
    ? TYPES[1]
    : TYPES[0];
}

// Each row adds five questions to its existing passage.
// Format: [question type, prompt, answer, explanation, optional word limit].
const additions = {
  'community-library': [
    [2, 'The redesigned library opened in ___.', 'September', 'Paragraph B gives the opening month.', 1],
    [3, 'On which floor could people borrow books?', 'ground floor', 'Paragraph B says borrowing remained on the ground floor.', 2],
    [1, 'Residents could learn to complete online forms at the sessions.', 'True', 'Paragraph B lists completing online forms.'],
    [1, 'The book exchange shelf used the main borrowing system.', 'False', 'Paragraph C says it operated separately.'],
    [1, 'All of the individual desks were bought from a local company.', 'Not given', 'The passage does not say who supplied the desks.'],
  ],
  'workplace-garden': [],
  'repair-cafe': [],
  'night-bus': [],
  'school-water-audit': [],
  'market-language-club': [],
};

// Two short, independent reading tasks based on each original paragraph.
// They use the actual paragraph text, so their answers stay in sync with the JSON.
function originalPractice(passage, count) {
  const result = [];
  const used = new Set(
    [...passage.questions, ...(additions[passage.id] ?? []).map((row) => ({ answer: row[2] }))]
      .map((question) => String(question.answer).toLowerCase()),
  );

  for (const [index, paragraph] of passage.paragraphs.entries()) {
    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph];
    const letter = String.fromCharCode(65 + index);
    for (const raw of [...sentences].reverse()) {
      const sentence = raw.trim();
      const matches = [...sentence.matchAll(/\b[A-Za-z]{5,}\b/g)];
      const word = matches.reverse().find((item) => !used.has(item[0].toLowerCase()));
      if (!word) continue;

      used.add(word[0].toLowerCase());
      const blank = sentence.slice(0, word.index) + '___' +
        sentence.slice(word.index + word[0].length);
      result.push(written(
        TYPES[result.length % 2 ? 3 : 2],
        `Use ONE WORD from paragraph ${letter}: ${blank}`,
        word[0],
        1,
        `Paragraph ${letter}: ${sentence}`,
      ));

      if (result.length === count) return result;
    }
  }
  return result;
}

// Each entry contains two paragraphs and ten questions.
// Four answers are typed; the others cover choice, headings and True/False/Not Given.
// Fields: title, paragraphs A and B, four typed questions, one multiple choice,
// three statements (True, False, Not Given), and two paragraph headings.
const banks = [
  [
    ['A fridge for the whole street',
      'A bakery began leaving unsold bread in a community fridge on Tuesdays. Volunteers put an orange sticker on each bag showing the date. Anyone could take a bag without signing up.',
      'At first the fridge stood outside the bakery, but afternoon sunlight made it warm. Volunteers moved it into the community centre. They now clean it before the centre closes every evening.',
      [['On which day did the bakery leave bread?', 'Tuesdays'], ['What colour were the stickers?', 'orange'], ['The fridge was moved into the ___ centre.', 'community'], ['Volunteers clean the fridge every ___.', 'evening']],
      ['Why was the fridge moved?', 'Sunlight made it warm.', 'People could not find it.', 'The bakery stopped supplying bread.'],
      ['The date appeared on each bag.', 'People had to sign up before taking bread.', 'The bakery supplied bread for exactly six months.'],
      ['Sharing unsold bread', 'Moving and maintaining the fridge']],
    ['Tools to borrow',
      'A neighbourhood workshop lends tools for three days. Borrowers show proof of address and leave a phone number. The most popular item is a drill, so the workshop now has four.',
      'Broken tools go onto a yellow shelf. A technician checks them on Saturdays. If a tool cannot be repaired, its metal parts are sent to a recycling centre.',
      [['How many days can people borrow a tool?', 'three'], ['Which tool is most popular?', 'drill'], ['What colour is the shelf for broken tools?', 'yellow'], ['The technician checks tools on ___.', 'Saturdays']],
      ['What happens to metal parts that cannot be reused in a repair?', 'They go to a recycling centre.', 'Borrowers take them home.', 'They are stored with working tools.'],
      ['Borrowers leave a phone number.', 'There is only one drill.', 'The technician is paid by the local council.'],
      ['How borrowing works', 'What happens to damaged tools']],
    ['The school walking map',
      'Pupils made a map of safe walking routes to school. They marked crossings with blue dots and shady paths with green lines. A teacher printed copies for new pupils.',
      'The group then tested the routes on a rainy morning. A large puddle blocked one path beside the park, so they added an alternative through Oak Street. They plan to check the map again in winter.',
      [['What colour are the crossing symbols?', 'blue'], ['Who printed the maps?', 'teacher'], ['What blocked a path beside the park?', 'puddle'], ['In which season will the group check the map again?', 'winter']],
      ['What did the pupils do after the rainy test?', 'They added an alternative route.', 'They removed all crossings.', 'They stopped handing out maps.'],
      ['Green lines show shady paths.', 'The puddle was on Oak Street.', 'The pupils gave a copy to the mayor.'],
      ['Making a route map', 'Testing and updating a route']],
    ['A quiet hour at the museum',
      'The town museum opened one hour early on Fridays for visitors who preferred a quieter experience. Staff switched off recorded announcements and offered a paper guide at the entrance.',
      'When the museum asked for comments, several visitors requested more seating. Staff moved benches from a meeting room into the main gallery and left more space between them for wheelchairs.',
      [['On which day did the quiet opening take place?', 'Fridays'], ['What kind of guide was offered?', 'paper'], ['What did visitors request more of?', 'seating'], ['The benches were moved into the main ___.', 'gallery']],
      ['Why did staff leave more space between benches?', 'To make space for wheelchairs.', 'To display larger paintings.', 'To separate two tour groups.'],
      ['Recorded announcements were switched off.', 'The benches came from the entrance.', 'The museum charged less during the quiet hour.'],
      ['Adapting the opening hour', 'Acting on visitor comments']],
    ['The weekend seed swap',
      'Gardeners brought spare seeds to a table in the village hall. Each envelope showed the plant name and the month when it should be sown. Lettuce seeds were the first to run out.',
      'The organisers kept a notebook for tips that people wanted to share. At their next event they will give a short demonstration on growing herbs in pots, since many visitors live in flats.',
      [['Where was the swap held? Use TWO WORDS.', 'village hall', 2], ['Which seeds ran out first?', 'lettuce'], ['What did organisers use to collect tips?', 'notebook'], ['The next event teaches people to grow herbs in ___.', 'pots']],
      ['Why will the next event focus on growing herbs in pots?', 'Many visitors live in flats.', 'The hall has no tables.', 'There were no spare seeds.'],
      ['Envelopes showed when the seeds should be sown.', 'Lettuce seeds were still available at the end.', 'The organisers bought the envelopes at a supermarket.'],
      ['Exchanging clearly labelled seeds', 'Planning a practical demonstration']],
    ['Letters from the coast',
      'Children at a coastal school exchanged letters with pupils in a city. The first letters described journeys to school. The teachers asked everyone to draw one thing they passed on the way.',
      'Later the classes held a video call. A city pupil asked why some coastal roads closed in storms. The coastal class answered with a photo of waves reaching the road and a simple sketch of the sea wall.',
      [['What journeys did the first letters describe?', 'school'], ['How many things did pupils have to draw?', 'one'], ['Which weather condition caused road closures?', 'storms'], ['What reached the coastal road in the photo?', 'waves']],
      ['How did the coastal class answer the question?', 'With a photograph and a sketch.', 'With a radio broadcast.', 'With a second video call only.'],
      ['The classes held a video call after exchanging letters.', 'The first letters were about holidays.', 'The schools continued the project the following year.'],
      ['Introducing each other by letter', 'Explaining a local problem']],
    ['The reusable cup shelf',
      'A café kept clean reusable cups on a shelf beside its counter. Customers paid a small deposit and got it back when they returned the cup. They could keep a cup for up to a week.',
      'At first many people returned cups without their lids. The café put a reminder on the bottom of each cup and started keeping spare lids beside the till.',
      [['What payment was returned to customers?', 'deposit'], ['How long could a customer keep a cup? Use TWO WORDS.', 'a week', 2], ['What was often missing when cups came back?', 'lids'], ['Where was the reminder placed?', 'bottom']],
      ['Where did the café keep spare lids?', 'Beside the till.', 'In customers’ bags.', 'Outside the entrance.'],
      ['Clean cups were kept beside the counter.', 'Customers could keep cups for up to a month.', 'The café counted how many paper cups it saved.'],
      ['Borrowing and returning a cup', 'Solving a problem with lids']],
    ['A noticeboard for lost items',
      'A sports centre made a noticeboard for lost items. Staff wrote only the date and a short description. They left out colours so that someone claiming an item had to describe it first.',
      'After four weeks, unclaimed clothes were washed and donated. Staff kept electronic items longer in a locked cupboard because they could contain personal information.',
      [['What detail did staff leave off the notices?', 'colours'], ['After how many weeks were clothes donated?', 'four'], ['What was done to clothes before donation?', 'washed'], ['Electronics were kept in a locked ___.', 'cupboard']],
      ['Why were electronic items treated differently?', 'They might contain personal information.', 'They were easier to wash.', 'They were on loan from the centre.'],
      ['The notices showed dates.', 'Lost clothes were thrown away after four weeks.', 'The cupboard was in the manager’s office.'],
      ['Listing found items safely', 'Dealing with items nobody claims']],
  ],
  [
    ['Heat under the trees',
      'A council compared temperatures in streets with and without mature trees. Volunteers used identical thermometers at noon. Instead of comparing a single day, the team repeated the measurements for three weeks.',
      'Shaded streets were usually cooler, yet the difference narrowed on cloudy days. The council used the findings to rank planting sites, giving priority to pavements near clinics where people often queue outside.',
      [['What instruments did volunteers use?', 'thermometers'], ['For how many weeks did measurements continue?', 'three'], ['On what kind of days was the difference smaller?', 'cloudy'], ['Which facilities were given planting priority?', 'clinics']],
      ['How did the council use the findings?', 'To decide where to plant trees first.', 'To estimate the age of each tree.', 'To set clinic opening hours.'],
      ['Temperatures were recorded at noon.', 'The team collected data on a single day.', 'Volunteers measured humidity as well.'],
      ['Designing a fair temperature comparison', 'Turning measurements into planting priorities']],
    ['The refill trial',
      'A grocer trialled refill stations for rice and oats. Customers weighed an empty container first, then attached a label showing its weight. Staff initially stayed beside the machines to explain the process.',
      'Demand fell when staff were no longer available to help. Interviews revealed that shoppers feared holding up the queue. The grocer moved the stations away from the tills rather than reducing the price.',
      [['Which grain was offered alongside rice?', 'oats'], ['What displayed the container’s empty weight?', 'label'], ['What did shoppers worry about delaying?', 'queue'], ['The stations were moved away from the ___.', 'tills']],
      ['What change did the grocer make after the interviews?', 'It moved the stations.', 'It reduced the price.', 'It replaced rice with flour.'],
      ['Staff helped customers at first.', 'Demand rose when staff stopped helping.', 'The grocer bought the machines from overseas.'],
      ['Introducing a new way to shop', 'Responding to a barrier shoppers reported']],
    ['Noise beneath the ferry route',
      'Researchers placed underwater microphones near a ferry route. To distinguish ferry noise from other sounds, they compared recordings taken during scheduled crossings with recordings from an early morning break in service.',
      'The strongest noise came when ferries accelerated after a turn. The operator tested a gentler increase in speed. One crossing became slightly longer, but the operator kept the experiment running to collect more data.',
      [['What equipment recorded the sounds?', 'microphones'], ['When was the service break? Use TWO WORDS.', 'early morning', 2], ['The strongest noise came after a ___.', 'turn'], ['What happened to one crossing’s duration?', 'longer']],
      ['Why did the operator continue the experiment?', 'To collect more data.', 'To make ferries travel faster.', 'To record the crew’s conversations.'],
      ['Recordings were made during scheduled crossings.', 'The strongest noise occurred when ferries were stationary.', 'Fish numbers increased during the trial.'],
      ['Separating ferry noise from background sounds', 'Testing a small operational change']],
    ['A workshop without reminders',
      'A library changed how people booked free workshops. Previously, registrants received two texts. The new system let them add the event to a calendar, but sent no automatic reminders.',
      'Attendance dropped unevenly. Regular visitors still arrived, while more first-time visitors stayed away. Staff restored a single text on the morning of each class and began monitoring both groups separately.',
      [['How many texts did the old system send?', 'two'], ['Where could registrants add the event?', 'calendar'], ['How did staff remind people after attendance dropped?', 'text'], ['When was the reminder sent?', 'morning']],
      ['What did staff begin monitoring separately?', 'Attendance from regular and first-time visitors.', 'Attendance at two different buildings.', 'Bookings from staff and volunteers.'],
      ['The workshops were free.', 'Attendance dropped equally across both groups.', 'Most registrants owned smartphones.'],
      ['Removing automatic reminders', 'Tracking who was affected']],
    ['Who uses the cycle lockers?',
      'A railway station installed secure lockers for bicycles beside its entrance. Managers initially estimated demand by counting all parked bicycles, including those left by people who worked nearby.',
      'When lockers opened, many were empty at weekends. Interviews showed that weekend cyclists rode for leisure and needed somewhere to park for an hour, not a full day. The station added an hourly booking option.',
      [['What vehicles were the lockers for?', 'bicycles'], ['Where were the lockers installed?', 'entrance'], ['When were many lockers empty?', 'weekends'], ['What new booking option was added?', 'hourly']],
      ['Why did the managers’ initial count give an incomplete picture?', 'It did not distinguish between different users’ needs.', 'It excluded all bicycles left by nearby workers.', 'It included only lockers that were occupied.'],
      ['Managers counted bicycles left by nearby workers.', 'Weekend leisure riders generally needed a full day of parking.', 'The hourly option increased revenue.'],
      ['Estimating demand from parked bicycles', 'Changing bookings to suit leisure riders']],
    ['A different lunch queue',
      'A school opened a second lunch counter with a shorter menu. Staff expected queues to shorten, but pupils still gathered at the original counter because the second menu was printed in small type.',
      'A larger sign made both menus visible from the door. Waiting times then fell for sandwiches but not for hot meals, which still took longer to serve. Staff kept measuring each queue separately.',
      [['How did the second menu compare in length?', 'shorter'], ['What size was the original lettering?', 'small'], ['Waiting times fell for ___.', 'sandwiches'], ['The larger sign could be read from the ___.', 'door']],
      ['Why did pupils initially keep using the first counter?', 'The second menu was hard to read.', 'The second counter charged more.', 'The second counter was outside the building.'],
      ['The school added a second counter.', 'Waiting times fell for every type of meal.', 'The school printed menus in two languages.'],
      ['Why a second counter initially failed', 'What clearer signs did and did not improve']],
    ['Monitoring a city pond',
      'Volunteers visited a pond once a month to record visible litter. They walked the same route and counted items from three fixed positions. They deliberately avoided counting fragments they could not identify.',
      'Counts dropped after the council installed a fence. However, wind could still blow rubbish into reeds beyond the volunteers’ view. The team kept its original count but also added photographs of the reed beds.',
      [['How often did volunteers visit? Use THREE WORDS.', 'once a month', 3], ['How many fixed positions were used?', 'three'], ['What did the council install?', 'fence'], ['What did the team add to its records?', 'photographs']],
      ['Why was the fall in counts hard to interpret?', 'Some rubbish could be hidden in reeds.', 'The pond was drained between visits.', 'Volunteers switched to a different route.'],
      ['Volunteers excluded fragments they could not identify.', 'The team abandoned its original count.', 'The fence was funded by a nearby business.'],
      ['Keeping repeated observations comparable', 'Checking what the count may have missed']],
    ['A delivery cooperative',
      'Three shops combined local deliveries to cut duplicate trips. Staff pooled orders every afternoon and grouped addresses by street. The shops kept separate payment systems so customers still paid the shop that sold each item.',
      'The trial worked well on weekdays. On Saturdays, however, late orders made routes unreliable. The shops introduced a deadline before lunch and offered next-day delivery to anyone who missed it.',
      [['How many shops took part?', 'three'], ['How were addresses grouped?', 'street'], ['On which days did the trial work well?', 'weekdays'], ['The new Saturday deadline was before ___.', 'lunch']],
      ['What happened to a Saturday order after the deadline?', 'It could be offered next-day delivery.', 'It was automatically refunded.', 'It took priority on the current route.'],
      ['The shops kept separate payment systems.', 'The original routes were reliable on Saturdays.', 'The cooperative used electric vans.'],
      ['Coordinating routes while keeping payments separate', 'Dealing with late weekend orders']],
  ],
  [
    ['Measuring an empty platform',
      'A transport authority judged a new platform layout by counting how quickly passengers entered trains. The count improved, but observers noticed that some passengers requiring assistance waited behind the main queue and were excluded from the timing.',
      'The authority therefore added a second measure: the interval from a passenger’s arrival on the platform to boarding. It reported both measures because one described train operations while the other exposed differences in passenger experience.',
      [['What layout was being assessed?', 'platform'], ['Which passengers were omitted from the first timing? Use ONE WORD.', 'assistance'], ['The second measure began at the passenger’s ___.', 'arrival'], ['What event ended the second timing?', 'boarding']],
      ['Why did the authority report both measures?', 'They answered different questions about the same layout.', 'The two measures always gave identical results.', 'The new measure could not be collected.'],
      ['The original count improved.', 'The first count included everybody needing assistance.', 'The new layout reduced the number of train cancellations.'],
      ['An encouraging measure with a blind spot', 'Keeping separate measures for different outcomes']],
    ['When savings increase demand',
      'A town fitted low-energy lamps in a sports hall and assumed its electricity bill would fall in proportion to the lower power rating. But the cheaper lighting encouraged organisers to extend evening bookings.',
      'An analyst separated power use per hour from the total number of hours. The new lamps used less power during each hour, yet overall consumption fell less than projected. The analyst advised reporting both figures before expanding the programme.',
      [['Where were the lamps installed? Use TWO WORDS.', 'sports hall', 2], ['Which bookings were extended?', 'evening'], ['The analyst separated energy use from the number of ___.', 'hours'], ['Overall consumption fell ___ than projected.', 'less']],
      ['Why did the original forecast overstate the savings?', 'It overlooked a change in how long the hall was used.', 'It assumed lights would stay on all night.', 'It ignored a rise in the lamps’ power rating.'],
      ['The new lamps used less power each hour.', 'The organisers shortened evening bookings.', 'The analyst compared the hall with a swimming pool.'],
      ['A forecast altered by changed behaviour', 'Separating efficiency from total consumption']],
    ['The volunteer bias',
      'A college surveyed students about a study app through a link on its home screen. Frequent users responded enthusiastically, leading the college to conclude that the app was broadly helpful.',
      'A second survey contacted a random sample of enrolled students by email. Many respondents had never opened the app. The college kept the first survey as evidence of what active users valued, but stopped using it to estimate overall adoption.',
      [['Where was the first link? Use TWO WORDS.', 'home screen', 2], ['Which users responded enthusiastically?', 'frequent'], ['What kind of sample received the second survey?', 'random'], ['How was the second survey sent?', 'email']],
      ['What was the first survey still useful for?', 'Understanding what active users valued.', 'Estimating adoption across the entire college.', 'Comparing students’ exam results.'],
      ['Some respondents to the second survey had never used the app.', 'The first survey contacted a random sample by email.', 'The two surveys received the same number of responses.'],
      ['Drawing a broad conclusion from a narrow sample', 'Using each survey for a suitable purpose']],
    ['The risk of a simple ranking',
      'A charity ranked food banks by the number of parcels distributed each month. Larger sites appeared most productive, although some smaller sites spent substantial time helping visitors complete benefit applications.',
      'Instead of merging unlike activities into one score, the charity published separate figures for parcels and advice. It also included local context because a low parcel count could reflect either limited capacity or lower demand.',
      [['What items were counted for the original ranking?', 'parcels'], ['What type of applications did smaller sites help with?', 'benefit'], ['Which activity received its own figure alongside parcels?', 'advice'], ['Low counts could reflect lower ___.', 'demand']],
      ['Why did the charity include local context?', 'The same count could have different explanations.', 'No sites submitted any numerical data.', 'It wanted to set identical targets everywhere.'],
      ['Parcel numbers were originally counted monthly.', 'The charity combined advice and parcels into one new score.', 'The new figures were published online.'],
      ['What the original ranking overlooked', 'Making room for more than one explanation']],
    ['Canals in a changing climate',
      'Water managers modelled how a historic canal might cope with heavy rain. Their first model assumed all gates worked as intended. A review pointed out that debris could prevent several gates from closing during the same storm.',
      'The team tested scenarios in which gates failed together rather than independently. The estimated flood risk rose, so the managers prioritised inspections of narrow sections where a blockage could affect more than one gate.',
      [['What could stop gates from closing?', 'debris'], ['The first model assumed all ___ worked.', 'gates'], ['What activity was given priority after the new tests?', 'inspections'], ['Which sections were prioritised?', 'narrow']],
      ['What important change did the team make to the model?', 'It allowed gate failures to occur together.', 'It removed heavy rain from the scenarios.', 'It assumed every gate always failed.'],
      ['Flood risk rose in the revised estimate.', 'The first model assumed failures would happen together.', 'The inspections were completed before winter.'],
      ['A simplifying assumption challenged by a review', 'Testing connected failures']],
    ['A discount with an uneven effect',
      'A theatre reduced ticket prices for performances with poor advance sales. Revenue fell on some nights but rose on others. The manager suspected the outcome depended on whether the discount attracted people who would otherwise have stayed home.',
      'To test the idea, the theatre asked discounted-ticket holders how they would have behaved at full price. The manager treated the answers cautiously: people could describe an intention, but the theatre could not observe what those customers would actually have done.',
      [['Which sales were poor before the discount?', 'advance'], ['What financial measure fell on some nights?', 'revenue'], ['Which organisation ran the survey?', 'theatre'], ['People reported an intention about buying at full ___.', 'price']],
      ['Why were the survey results treated cautiously?', 'A reported intention might differ from actual behaviour.', 'The survey asked only about concession prices.', 'All respondents said they would stay home.'],
      ['Revenue rose on some nights.', 'Discounts were introduced because advance sales were already strong.', 'More than half the participants were first-time visitors.'],
      ['A discount with mixed results', 'The limits of asking about unrealised choices']],
    ['Why the archive kept duplicates',
      'An archive digitised handwritten records and planned to discard duplicate scans. Staff discovered that files labelled as duplicates sometimes showed different marks because lighting made faint notes visible in only one scan.',
      'Rather than keeping every image indefinitely, the archive retained variants when they captured distinct information. It also recorded why each variant was kept, so later reviewers would not mistake a deliberate decision for an editing error.',
      [['What kind of records were digitised?', 'handwritten'], ['What made faint notes visible in only one scan?', 'lighting'], ['Which files were retained if they showed distinct information?', 'variants'], ['Staff documented why each retained file was ___.', 'kept']],
      ['Why did the archive document its decisions?', 'To help future reviewers understand apparent duplicates.', 'To conceal differences between scans.', 'To show that every scan was equally clear.'],
      ['Some apparent duplicates contained different visible details.', 'The archive decided to keep every image indefinitely.', 'The archive used two different scanner brands.'],
      ['Finding differences in apparent duplicates', 'Preserving useful variants and documenting why']],
    ['The flood map and the front door',
      'A city produced a flood map at street level. Owners used it to decide whether to install barriers. Field visits showed that two houses on the same street could face different risks because their entrances sat at different heights.',
      'The city kept the map as an overview and added instructions on measuring a doorway against the pavement. It cautioned that a household assessment could refine a broad estimate, but could not predict the precise course of an individual flood.',
      [['At what level was the original map produced?', 'street'], ['Which parts of houses were at different heights?', 'entrances'], ['Residents measured doorways against the ___.', 'pavement'], ['The city kept the original map as an ___.', 'overview']],
      ['What could a household assessment do?', 'Refine a broad estimate without predicting an exact flood.', 'Predict precisely which path floodwater would take.', 'Remove the need for a flood map altogether.'],
      ['Owners consulted the map when considering barriers.', 'Houses on the same street always faced identical risks.', 'The city funded barriers for all residents.'],
      ['Different risks within a single street', 'Combining a broad map with household measurements']],
  ],
];

function makeSet(row, level, index) {
  const [title, first, second, typed, choice, statements, headings] = row;
  const [a, b] = headings;
  const [prompt, answer, ...distractors] = choice;
  const evidence = `Paragraphs A and B: ${first} ${second}`;

  return {
    id: `reading-${level.toLowerCase()}-${index + 3}`,
    title,
    level,
    minutes: level === 'Beginner' ? 10 : level === 'Intermediate' ? 12 : 15,
    paragraphs: [first, second],
    questions: [
      mc(prompt, answer, distractors, evidence, index % 3),
      ...typed.map(([label, expected, limit = 1], position) =>
        written(position % 2 ? TYPES[3] : TYPES[2], label, expected, limit,
          `Paragraph ${position < 2 ? 'A' : 'B'}: ${position < 2 ? first : second}`)),
      tf(statements[0], 'True', evidence),
      tf(statements[1], 'False', evidence),
      tf(statements[2], 'Not given', 'Neither paragraph establishes this detail.'),
      heading('A', a, [b, 'Recommendations for future assessment'], first),
      heading('B', b, ['The original budget and its costs', a], second),
    ],
  };
}

const existing = originalPassages.map((passage, index) => {
  const level = LEVELS[index % LEVELS.length];
  const explicit = (additions[passage.id] ?? []).map(([type, prompt, answer, explanation, limit]) =>
    type === 1 ? tf(prompt, answer, explanation) : written(TYPES[type], prompt, answer, limit, explanation));
  const target = index < 3 ? 12 : 10;
  return {
    ...passage,
    level,
    minutes: index < 3 ? 15 : 10,
    questions: [
      ...passage.questions.map((question) => ({ ...question, type: originalType(question) })),
      ...explicit,
      ...originalPractice(passage, Math.max(0, target - passage.questions.length - explicit.length)),
    ],
  };
});

const orderedSets = [
  ...existing,
  ...banks[0].flatMap((_, index) =>
    LEVELS.map((level, levelIndex) => makeSet(banks[levelIndex][index], level, index))),
];

const paidSets = orderedSets.filter((set) => set.id !== 'community-library');
const planById = new Map(
  paidSets.map((set, index) => [
    set.id,
    index < 4 ? 'starter' : index < 14 ? 'plus' : 'premium',
  ]),
);

export const SETS = orderedSets.map((set) => ({
  ...set,
  requiredPlan: set.id === 'community-library' ? 'trial' : planById.get(set.id),
  types: [...new Set(set.questions.map((question) => question.type))],
}));