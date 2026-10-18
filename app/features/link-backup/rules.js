// Rules for the link backup, without any screen code, so they can be tested.

// Where the link is kept: your private area, which only you can read (see firebase/firestore.rules).
export function backupPath(uid) {
  return `users/${uid}/private/main`;
}

// Whether this phone's link is already saved to this account, going by what was saved last.
export function isSaved(saved, uid, link) {
  return !!(saved && link && saved.uid === uid && saved.link === link);
}

// Whether there's a link worth backing up: the timetable came from a link, not a file.
export function linkToBackUp(timetable) {
  return timetable?.source === 'link' && /^https:\/\/\S+$/.test(timetable.url || '') ? timetable.url : null;
}
