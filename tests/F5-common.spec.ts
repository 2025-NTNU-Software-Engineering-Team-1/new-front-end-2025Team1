import { test, expect } from "@playwright/test";
import { login_student } from "./utils/arranges";
import fs from "fs";

test.beforeEach(async ({ page, baseURL }) => {
  await login_student(page, baseURL!);
});

//001
test.skip("Make a post", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //New post
  await page.getByRole("link", { name: "Post" , exact: true}).click();
  //Select
  await page.locator("select.select-bordered").nth(0).selectOption({ label: "Prob1" });
  await page.locator("input.input-bordered").nth(0).fill("First Post");
  await page.locator("textarea.textarea-bordered").nth(0).fill("This is the first post for Prob1");
  
  //Post
  await page.getByRole("button", { name: "Post" }).click();
  
  //check if success
  const text = await page.getByText(/Post \d+/).innerText();
  const PID = text.match(/\d+/)[0];
  await expect(page).toHaveURL(`http://localhost:8080/course/meow/discussion/${PID}`);
});

//002
test.skip("See the posts", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //check if success
  await page.waitForTimeout(1000);
  const cards = page.locator('div.card').filter({ hasNot: page.locator('div.card'),});
  const count = await cards.count();await expect(count).toBeGreaterThan(0);

});

//003 manual fail
test("Code", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //New post
  await page.getByRole("link", { name: "Post" , exact: true}).click();
  //Select
  await page.locator("select.select-bordered").nth(0).selectOption({ label: "Prob1" });
  await page.locator("select.select-bordered").nth(2).selectOption({ label: "C++" });
  await page.locator("input.input-bordered").nth(0).fill("```");
  await page.locator("input.input-bordered").nth(0).fill("First Code");
  const code = fs.readFileSync('./tests/add.cpp', 'utf-8');
  await page.locator("textarea.textarea-bordered").fill(code);
  await page.waitForTimeout(500);
  await page.locator("input.input-bordered").nth(0).fill("```");
  await page.locator('input[type="checkbox"].checkbox-xs').check();
    
  //Post
  await page.getByRole("button", { name: "Post" }).click();
  
  //check if success
  const text = await page.getByText(/Post \d+/).innerText();
  const PID = text.match(/\d+/)[0];
  await expect(page).toHaveURL(`http://localhost:8080/course/meow/discussion/${PID}`);

});

//004
test("Search the posts", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  await page.locator("input.input-bordered").nth(0).fill("First Post");
  await page.getByPlaceholder("Search discussions...").locator("..").locator("button").click();
  
  //check if success
  await page.waitForTimeout(1000);
  const cards = page.locator('div.card').filter({ hasNot: page.locator('div.card'),});
  const count = await cards.count();await expect(count).toBeGreaterThan(0);

});








