// Exercise the public drawer and expandable groups, including at mobile widths.
export async function navigationClick(page,selector){
  const link=page.locator(selector).first();
  if(await link.evaluate(el=>!!el.closest('#navigation'))){
    const toggle=page.getByRole('button',{name:'Open navigation',exact:true});
    if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
    const group=link.locator('xpath=ancestor::details[1]');
    if(await group.count()&&!await group.evaluate(el=>el.open))await group.locator('summary').first().click();
  }
  await link.click();
}
export const navigate=(page,view)=>navigationClick(page,'#navigation [data-view="'+view+'"]');
export async function prepareReviewedSubmission(page){if(await page.locator('[data-entry-review]').count()&&await page.locator('[data-guided-panel="0"]').isVisible())await page.locator('#submit-action').click();}
export async function signOut(page){
  const menu=page.locator('.user-menu');if(!await menu.evaluate(el=>el.open))await menu.locator('summary').click();
  await page.locator('[data-shell-logout]').click();
}

// Task menu remains keyboard accessible when secondary actions are collapsed.
export async function workspaceTask(page,key){const button=page.locator('[data-workspace-task="'+key+'"]');await button.waitFor({state:'attached'});const menu=page.locator('.dashboard-action-menu');if(!await button.isVisible())await menu.locator('summary').click();else if(await button.evaluate(el=>!el.closest('.dashboard-action-menu'))&&await menu.evaluate(el=>el.open))await menu.locator('summary').click();await button.click();}
