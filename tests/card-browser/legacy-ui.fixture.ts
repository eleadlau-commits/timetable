import {test as base,expect} from '@playwright/test';
// Retain coverage of the underlying manual/photo/preview/delete presentation.
// Only this test harness opts into it; normal app startup uses the minimal wallet.
export const test=base.extend({
  page:async({page},use)=>{
    await page.route('**/src/main.tsx*',async route=>{
      const response=await route.fetch();
      const body=(await response.text()).replace(/jsxDEV\(App, \{\}/g,'jsxDEV(App, { showLegacyControls: true }');
      if(!body.includes('showLegacyControls'))throw new Error('Legacy UI harness did not match the app entry point');
      await route.fulfill({response,body});
    });
    await use(page);
  },
});
export {expect};
