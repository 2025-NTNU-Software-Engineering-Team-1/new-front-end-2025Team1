import { test, expect } from "@playwright/test";
import { login_ta } from "./utils/arranges";

test.beforeEach(async ({ page, baseURL }) => {
  await login_ta(page, baseURL!);
});

// TA don't have the scope
//015
test("Pin post to top", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //Get into Hi post
  const hiPost = page.locator('div.card-body.p-4:has(div.text-lg.font-bold:has-text("Hi"))');
  await hiPost.waitFor({ state: "visible", timeout: 10000 });
  await hiPost.click();
  await page.waitForTimeout(500);
  
  //Pin to top
  const moreBtn = page.locator("label.btn.btn-ghost.btn-sm");
  await expect(moreBtn).toBeVisible();
  await moreBtn.click({ force: true });  

  const pinItem = page.locator("ul.dropdown-content >> text=Pin Post");
  await expect(pinItem).toBeVisible();
  await pinItem.click();

  const confirmBtn = page.locator('button:has-text("Confirm")');
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  await page.waitForTimeout(500);  

  //check if success
  const pushpin = "\u{1F4CC}";
  await expect(page.getByText(pushpin)).toBeVisible({ timeout: 10000 });
  
  //repair
  await expect(moreBtn).toBeVisible();
  await moreBtn.click({ force: true });
  
  const unpinItem = page.locator("ul.dropdown-content >> text=Unpin");
  await expect(unpinItem).toBeVisible();
  await unpinItem.click();

  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  
});

//016
test("Close a post", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //New post
  await page.getByRole("link", { name: "Post" , exact: true}).click();
  //Select
  await page.locator("select.select-bordered").nth(0).selectOption({ label: "Prob1" });
  await page.locator("input.input-bordered").nth(0).fill("To be closed");
  await page.locator("textarea.textarea-bordered").nth(0).fill("This is the post for closing");
  
  //Post
  await page.getByRole("button", { name: "Post" }).click();
  
  //Delete
  const moreBtn = page.locator("label.btn.btn-ghost.btn-sm");
  await expect(moreBtn).toBeVisible();
  await moreBtn.click({ force: true });  

  const closeItem = page.locator("ul.dropdown-content >> text=Close Discussion");
  await expect(closeItem).toBeVisible();
  await closeItem.click();

  const confirmBtn = page.locator('button:has-text("Confirm")');
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  await page.waitForTimeout(500); 
  
  //check if success
  const lock = "\u{1F512}";
  await expect(page.getByText(lock)).toBeVisible({ timeout: 10000 });
});

//017
test("Post solved", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //Get into Hi post
  const hiPost = page.locator('div.card-body.p-4:has(div.text-lg.font-bold:has-text("Hi"))');
  await hiPost.waitFor({ state: "visible", timeout: 10000 });
  await hiPost.click();
  await page.waitForTimeout(500);
  
  //Solved
  const moreBtn = page.locator("label.btn.btn-ghost.btn-sm");
  await expect(moreBtn).toBeVisible();
  await moreBtn.click({ force: true });
  const solveItem = page.locator("ul.dropdown-content >> text=Mark as Solved");
  await expect(solveItem).toBeVisible();
  await solveItem.click();

  const confirmBtn = page.locator('button:has-text("Confirm")');
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  await page.waitForTimeout(500); 

  //check if success
  
  await expect(page.getByText("✓ Solved")).toBeVisible();
  
  //repair
  await expect(moreBtn).toBeVisible();
  await moreBtn.click({ force: true });

  const unsolveItem = page.locator("ul.dropdown-content >> text=Mark as Unsolved");
  await expect(unsolveItem).toBeVisible();
  await unsolveItem.click();

  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  
});

//018
test("Delete a post", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //New post
  await page.getByRole("link", { name: "Post" , exact: true}).click();
  //Select
  await page.locator("select.select-bordered").nth(0).selectOption({ label: "Prob1" });
  await page.locator("input.input-bordered").nth(0).fill("To be deleted");
  await page.locator("textarea.textarea-bordered").nth(0).fill("This is the post for deleting");
  
  //Post
  await page.getByRole("button", { name: "Post" }).click();
  
  //Delete
  const moreBtn = page.locator("label.btn.btn-ghost.btn-sm");
  await expect(moreBtn).toBeVisible();
  await moreBtn.click({ force: true });  

  const delItem = page.locator("ul.dropdown-content >> text=Delete Post");
  await expect(delItem).toBeVisible();
  await delItem.click();

  const confirmBtn = page.locator('button:has-text("Confirm")');
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  await page.waitForTimeout(500); 
  
  //check if success
  const delPosts = page.getByText("To be deleted");

  const count = await delPosts.count();
  expect(count).toBe(0);
  
});



