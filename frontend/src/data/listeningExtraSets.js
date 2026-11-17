// Choice: [question, correct answer, distractor 1, distractor 2]
// Written: [question or form label, correct answer, ...accepted alternatives]

const entries = [
  {
    id: 'extra-hall-booking',
    title: 'Booking a community hall',
    intro: 'A resident calls to book a hall for a family event.',
    dialogue: [
      ['Caller', 'Hi, is the community hall free on Saturday evening? We could also come on Friday if needed.'],
      ['Coordinator', 'Friday is full, but Saturday is free from six. We suggest the Riverside Room for a family event. It holds sixty people.'],
      ['Caller', 'We are expecting forty guests. Does the room include chairs?'],
      ['Coordinator', 'Yes, and tables too. The hire fee is eighty pounds and the refundable deposit is twenty pounds. Use the side entrance on Mill Road.'],
      ['Caller', 'Can I pay in person? And what should we bring?'],
      ['Coordinator', 'Please pay online by Thursday. Bring your own rubbish bags. The booking is under Patel.'],
    ],
    choices: [
      ['Which day is available?', 'Saturday', 'Friday', 'Sunday'],
      ['Which room is recommended?', 'Riverside Room', 'Garden Room', 'Main Hall'],
      ['How many guests does the caller expect?', '40', '60', '80'],
      ['How should the caller pay?', 'Online', 'In person', 'By post'],
    ],
    form: [
      ['Earliest start, in the evening: ___ o’clock', '6', 'six'],
      ['Hire fee: £___', '80', 'eighty'],
      ['Refundable deposit: £___', '20', 'twenty'],
      ['Booking surname: ___', 'Patel'],
    ],
    short: [
      ['On which road is the side entrance?', 'Mill Road'],
      ['What must the group bring?', 'rubbish bags'],
    ],
  },
  {
    id: 'extra-library-membership',
    title: 'Joining the library',
    intro: 'A new resident asks about membership and borrowing.',
    dialogue: [
      ['Resident', 'I have just moved here. Do I have to pay to join the library?'],
      ['Librarian', 'Membership is free. Bring proof of address; a recent electricity bill is fine. Fill out the form at the information desk.'],
      ['Resident', 'How many books can I take home? My old library allowed four.'],
      ['Librarian', 'Here it is six books for three weeks. You can renew them online if nobody else has requested them.'],
      ['Resident', 'I work late. Is there an evening opening?'],
      ['Librarian', 'On Tuesdays we close at eight. On other weekdays we close at five. The book return box is beside the entrance. Please write your surname, Morgan, on the form.'],
    ],
    choices: [
      ['How much does membership cost?', 'It is free', '£4', '£6'],
      ['Where does the resident fill out the form?', 'Information desk', 'Return box', 'Computer room'],
      ['How can members renew a book?', 'Online', 'By post only', 'At the return box'],
      ['Which day has late opening?', 'Tuesday', 'Thursday', 'Friday'],
    ],
    form: [
      ['Maximum books: ___', '6', 'six'],
      ['Loan period: ___ weeks', '3', 'three'],
      ['Tuesday closing time: ___ p.m.', '8', 'eight'],
      ['Surname on the form: ___', 'Morgan'],
    ],
    short: [
      ['What kind of bill can prove the address?', 'electricity bill'],
      ['Where is the return box?', 'beside the entrance', 'by the entrance'],
    ],
  },
  {
    id: 'extra-station-property',
    title: 'Finding a lost umbrella',
    intro: 'A traveller calls a railway station about a lost item.',
    dialogue: [
      ['Traveller', 'I left a folding umbrella on the train from Leeds. It is dark green, with a wooden handle.'],
      ['Officer', 'Was it the nine fifteen train?'],
      ['Traveller', 'No, I missed that one and caught the nine forty. I sat in coach C.'],
      ['Officer', 'We have a matching umbrella. Someone found it under a seat. The reference is L seven two.'],
      ['Traveller', 'Can I collect it from the ticket office?'],
      ['Officer', 'Go to the service desk on platform two. We keep items for fourteen days. Bring photo ID. It is open until six this evening.'],
    ],
    choices: [
      ['Where did the train come from?', 'Leeds', 'York', 'Manchester'],
      ['What colour is the umbrella?', 'Dark green', 'Dark blue', 'Black'],
      ['Where was it found?', 'Under a seat', 'On a luggage rack', 'At the ticket office'],
      ['Where should the traveller collect it?', 'Service desk', 'Ticket office', 'Train entrance'],
    ],
    form: [
      ['Train departure time: ___', '9:40', 'nine forty', '09:40'],
      ['Coach: ___', 'C'],
      ['Reference number: ___', 'L72', 'L 72', 'L 7 2'],
      ['Platform: ___', '2', 'two'],
    ],
    short: [
      ['What identification should the traveller bring?', 'photo ID', 'photo identification'],
      ['How long are items kept?', '14 days', 'fourteen days'],
    ],
  },
  {
    id: 'extra-bus-diversion',
    title: 'A temporary bus diversion',
    intro: 'A transport announcement explains a change to a bus route.',
    dialogue: [
      ['Announcer', 'From Monday, route eighteen will avoid Bridge Street while the road is repaired. This change will last for two weeks.'],
      ['Announcer', 'Buses will still stop outside the hospital, but will no longer stop at the market. Use the temporary stop in Queen Street, next to the pharmacy.'],
      ['Announcer', 'The first weekday bus leaves the station at seven ten. After nine, buses run every twenty minutes. The fare is still two pounds.'],
      ['Announcer', 'Passengers travelling to the university should change at Central Square. For updates, check the operator’s website.'],
    ],
    choices: [
      ['Why is the route changing?', 'Road repairs', 'A sports event', 'A new hospital'],
      ['Which stop stays open?', 'Hospital', 'Market', 'Bridge Street'],
      ['What is beside the temporary stop?', 'Pharmacy', 'Library', 'School'],
      ['Where should university passengers change?', 'Central Square', 'Bus station', 'Bridge Street'],
    ],
    form: [
      ['Route number: ___', '18', 'eighteen'],
      ['Diversion duration: ___ weeks', '2', 'two'],
      ['First weekday departure: ___', '7:10', '07:10', 'seven ten'],
      ['Fare: £___', '2', 'two'],
    ],
    short: [
      ['Which street has the temporary stop?', 'Queen Street'],
      ['Where can passengers find updates?', 'website', 'operator’s website', 'the website'],
    ],
  },
  {
    id: 'extra-repair-appointment',
    title: 'Arranging a repair',
    intro: 'A customer books a repair for a washing machine.',
    dialogue: [
      ['Customer', 'My washing machine starts, but it does not drain. Could an engineer come this week?'],
      ['Agent', 'We had a Wednesday slot, but it is taken. I can book Friday morning. The engineer will arrive between nine and eleven.'],
      ['Customer', 'What is the call-out charge?'],
      ['Agent', 'Thirty-five pounds. Parts cost extra. Please clear the area around the machine and keep pets out of the kitchen.'],
      ['Customer', 'The address is sixteen Cedar Lane. The bell does not work.'],
      ['Agent', 'I will ask the engineer to phone on arrival. Your job number is R four six. To rearrange, email us by Thursday.'],
    ],
    choices: [
      ['What is wrong with the machine?', 'It does not drain', 'It does not start', 'It will not heat water'],
      ['Which day is booked?', 'Friday', 'Wednesday', 'Saturday'],
      ['What costs extra?', 'Parts', 'The booking email', 'A phone call'],
      ['How will the engineer contact the customer on arrival?', 'By phone', 'By email', 'By ringing the bell'],
    ],
    form: [
      ['Arrival window begins at ___ a.m.', '9', 'nine'],
      ['Call-out charge: £___', '35', 'thirty-five', 'thirty five'],
      ['House number: ___', '16', 'sixteen'],
      ['Job reference: ___', 'R46', 'R 46', 'R 4 6'],
    ],
    short: [
      ['Which room should pets stay out of?', 'kitchen', 'the kitchen'],
      ['What is the last day to email to rearrange?', 'Thursday'],
    ],
  },
  {
    id: 'extra-cafe-job',
    title: 'Asking about a café job',
    intro: 'A student phones a café about a weekend vacancy.',
    dialogue: [
      ['Student', 'I saw your advert. Is the kitchen assistant job still open?'],
      ['Manager', 'The kitchen job is filled, but we need someone at the till. It is on Sundays only, from eight until two.'],
      ['Student', 'I have worked in a shop before, but not in a café.'],
      ['Manager', 'Shop experience is useful. We offer two hours of training. The pay is eleven pounds an hour, and you should wear black shoes.'],
      ['Student', 'How do I apply?'],
      ['Manager', 'Email your CV by Wednesday. Interviews are on Thursday, in the upstairs office. Ask for Helen when you arrive.'],
    ],
    choices: [
      ['Where is help needed?', 'At the till', 'In the kitchen', 'In the delivery van'],
      ['Which day would the student work?', 'Sunday', 'Saturday', 'Thursday'],
      ['What experience does the student have?', 'Working in a shop', 'Cooking in a café', 'Driving deliveries'],
      ['Where are the interviews?', 'Upstairs office', 'Kitchen', 'Main counter'],
    ],
    form: [
      ['Shift starts at ___ a.m.', '8', 'eight'],
      ['Training duration: ___ hours', '2', 'two'],
      ['Hourly pay: £___', '11', 'eleven'],
      ['Interview contact: ___', 'Helen'],
    ],
    short: [
      ['What should the student email?', 'CV', 'a CV'],
      ['What should workers wear on their feet?', 'black shoes'],
    ],
  },
  {
    id: 'extra-harbour-walk',
    title: 'The harbour heritage walk',
    intro: 'A guide explains the route and arrangements for a walking tour.',
    dialogue: [
      ['Guide', 'Welcome to our harbour walk. We normally begin at the clock tower, but today we will start outside the old customs house.'],
      ['Guide', 'The tour begins at ten fifteen and lasts ninety minutes. We will visit the fish market before going to the lighthouse. The boatyard is closed.'],
      ['Guide', 'The path near the lighthouse can be slippery, so wear sturdy shoes. The café is shut, but drinking water is available at the visitor centre.'],
      ['Guide', 'Adult tickets cost nine pounds. Children under twelve pay five. At the end, please return your headset to the guide.'],
    ],
    choices: [
      ['Where does today’s walk begin?', 'Old customs house', 'Clock tower', 'Visitor centre'],
      ['Which place is visited before the lighthouse?', 'Fish market', 'Boatyard', 'Café'],
      ['Which site is closed to visitors?', 'Boatyard', 'Fish market', 'Lighthouse'],
      ['Where is drinking water available?', 'Visitor centre', 'Café', 'Clock tower'],
    ],
    form: [
      ['Start time: ___', '10:15', 'ten fifteen'],
      ['Duration: ___ minutes', '90', 'ninety'],
      ['Adult ticket: £___', '9', 'nine'],
      ['Ticket for children under twelve: £___', '5', 'five'],
    ],
    short: [
      ['What type of shoes does the guide recommend?', 'sturdy shoes'],
      ['What equipment must visitors return?', 'headset', 'headsets', 'their headset'],
    ],
  },
  {
    id: 'extra-volunteer-induction',
    title: 'A volunteer induction',
    intro: 'A coordinator briefs volunteers before a riverside clean-up.',
    dialogue: [
      ['Coordinator', 'Meet by the south gate at eight forty-five. Last year we met at the bridge, but this year that area is being resurfaced.'],
      ['Coordinator', 'We will work in groups of four. The first group will clear the path. The second will sort what we collect at the picnic shelter.'],
      ['Coordinator', 'We supply gloves and litter pickers. Bring a water bottle. Do not handle broken glass; tell your group leader if you find any.'],
      ['Coordinator', 'We take a break at eleven and finish at one. Put recyclable items in blue sacks and general waste in black sacks. If it rains heavily, we will text you.'],
    ],
    choices: [
      ['Where should volunteers meet?', 'South gate', 'Bridge', 'Picnic shelter'],
      ['What will the second group do?', 'Sort collected items', 'Clear the path', 'Repair the bridge'],
      ['Who should volunteers tell about broken glass?', 'Group leader', 'A park visitor', 'Nobody'],
      ['How will the coordinator contact volunteers if it rains heavily?', 'By text', 'By letter', 'Through the website'],
    ],
    form: [
      ['Meeting time: ___', '8:45', '08:45', 'eight forty-five', 'eight forty five'],
      ['Volunteers per group: ___', '4', 'four'],
      ['Break: ___ a.m.', '11', 'eleven'],
      ['Recycling sack colour: ___', 'blue'],
    ],
    short: [
      ['What should each volunteer bring?', 'water bottle', 'a water bottle'],
      ['Where will collected items be sorted?', 'picnic shelter', 'the picnic shelter'],
    ],
  },
  {
    id: 'extra-course-registration',
    title: 'Registering for an evening course',
    intro: 'A learner enquires about an evening language class.',
    dialogue: [
      ['Learner', 'I would like the beginner Spanish course. Does it still meet on Mondays?'],
      ['Registrar', 'The beginners now meet on Wednesdays. Monday is for intermediate students. Your course lasts eight weeks and starts on the twelfth of May.'],
      ['Learner', 'Is the fee still ninety pounds?'],
      ['Registrar', 'It is ninety-five. A workbook is included, but please bring headphones for the audio exercises. Classes are in Studio B.'],
      ['Learner', 'Can I register today?'],
      ['Registrar', 'Yes, use the online form. If you cancel at least seven days before the first class, you can get a full refund.'],
    ],
    choices: [
      ['Which language is the learner studying?', 'Spanish', 'French', 'Italian'],
      ['When does the beginner group meet?', 'Wednesday', 'Monday', 'Friday'],
      ['How should the learner register?', 'Use an online form', 'Phone the teacher', 'Visit Studio B'],
      ['How early must the learner cancel for a full refund?', 'At least seven days before', 'One day before', 'After the first lesson'],
    ],
    form: [
      ['Course duration: ___ weeks', '8', 'eight'],
      ['Start date: ___ May', '12', 'twelfth', '12th'],
      ['Course fee: £___', '95', 'ninety-five', 'ninety five'],
      ['Classroom: Studio ___', 'B'],
    ],
    short: [
      ['What is included in the fee?', 'workbook', 'a workbook'],
      ['What should the learner bring for audio exercises?', 'headphones'],
    ],
  },
  {
    id: 'extra-campus-orientation',
    title: 'A campus orientation briefing',
    intro: 'A student adviser explains the first day at college.',
    dialogue: [
      ['Adviser', 'On orientation day, collect your student card in the sports hall. The old instructions mentioned the library, so please ignore that location.'],
      ['Adviser', 'Card collection begins at nine thirty. Bring your passport. At eleven, a guide will take you to the science building for a safety briefing.'],
      ['Adviser', 'Lunch is at twelve thirty in the courtyard. Vegetarian meals are available, but tell us about allergies on the registration form before Friday.'],
      ['Adviser', 'In the afternoon, meet your tutor in Room Twelve. The IT help desk can reset your password. If you need a campus map, pick one up at reception.'],
    ],
    choices: [
      ['Where are student cards collected?', 'Sports hall', 'Library', 'Science building'],
      ['What happens in the science building?', 'Safety briefing', 'Lunch', 'Tutor meeting'],
      ['Where is lunch served?', 'Courtyard', 'Sports hall', 'Reception'],
      ['Who can reset a student password?', 'IT help desk', 'Lunch staff', 'Tour guide'],
    ],
    form: [
      ['Card collection starts at ___', '9:30', '09:30', 'nine thirty'],
      ['Safety briefing starts at ___ a.m.', '11', 'eleven'],
      ['Lunch time: ___', '12:30', 'twelve thirty'],
      ['Tutor meeting: Room ___', '12', 'twelve'],
    ],
    short: [
      ['What document should students bring?', 'passport', 'a passport'],
      ['Where can students collect a campus map?', 'reception', 'at reception'],
    ],
  },
];

export default entries.map(({ choices, form, short, ...entry }, setIndex) => ({
  ...entry,
  minutes: 10,
  questions: [
    ...choices.map(([prompt, answer, first, second], index) => {
      const options = [first, second];
      options.splice((setIndex + index) % 3, 0, answer);
      return { type: 'Multiple choice', prompt, answer, options };
    }),
    ...form.map(([prompt, answer, ...acceptedAnswers]) => ({
      type: 'Form completion', prompt, answer, acceptedAnswers,
    })),
    ...short.map(([prompt, answer, ...acceptedAnswers]) => ({
      type: 'Short answer', prompt, answer, acceptedAnswers, limit: 3,
    })),
  ],
}));