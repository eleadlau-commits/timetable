// Help's own questions: the ones about the whole app rather than one feature. Features add
// their own through the 'help.questions' slot, so they go when the feature does.
// An answer is a list of paragraphs.

// Where people can write to us. The same address as in the account's privacy notice.
export const CONTACT = 'mobiledurham.help@gmail.com';

export const QUESTIONS = [
  {
    group: 'start', order: 1,
    question: 'What can Mobile Durham do?',
    answer: [
      'It puts your Durham timetable on your phone, and adds the things around it: what\'s on today, how busy the library is, a study timer, a to-do list, your campus card, places and student deals around Durham, and your friends\' timetables.',
      'The tabs along the bottom are Study, Planner, Home, Spots and More. The menu (top left) has Account, Reminders, Settings, Help and About.',
    ],
  },
  {
    group: 'app', order: 10,
    question: 'Who makes Mobile Durham?',
    answer: [
      'Students at Durham. It isn\'t made, run or checked by Durham University.',
    ],
  },
  {
    group: 'app', order: 20,
    question: 'Does it cost anything?',
    answer: [
      'No. It\'s free for students, with no adverts.',
    ],
  },
  {
    group: 'app', order: 30,
    question: 'Does it work without the internet?',
    answer: [
      'Mostly. Your timetable, to-dos, notes, reminders and campus card are kept on your phone, so they work offline. The library\'s numbers, the places on Spots, friends and downloading a new copy of your timetable need the internet.',
    ],
  },
  {
    group: 'app', order: 90,
    question: 'Something isn\'t working. Who do I tell?',
    answer: [
      'Email us at {contact}, and say what you were doing and what happened. A screenshot helps.',
    ],
  },
];
