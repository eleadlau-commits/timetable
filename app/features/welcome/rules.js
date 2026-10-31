// Rules for who the app is for, without any screen code, so they can be tested.

// The two versions of the app.
export const KINDS = ['student', 'business'];

// Whether a slot item (a Home widget or page) belongs in this version. An item says who it's
// for with `audience`: 'business', 'everyone', or nothing for students only.
export function isFor(item, business) {
  const audience = item?.audience || 'student';
  return audience === 'everyone' || (audience === 'business') === !!business;
}
